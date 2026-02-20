from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from googleapiclient.discovery import build
from transformers import pipeline
from dotenv import load_dotenv
import os
import re
from pathlib import Path

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pathlib

# Set static_folder to frontend directory for serving static files
FRONTEND_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend"
app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
@app.route("/")
def serve_index():
    # Serve the main frontend page
    return send_from_directory(app.static_folder, "index.html")

# Serve other static files (JS, CSS, images, etc.)
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)
CORS(app)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


# -------------------------------------------------------------------
# Load custom logistic regression model and vectorizer
# -------------------------------------------------------------------
import joblib
MODEL_PATH = Path(__file__).parent / "logreg_model.joblib"
VECTORIZER_PATH = Path(__file__).parent / "vectorizer.joblib"
print("Loading custom logistic regression model...")
logreg_model = joblib.load(MODEL_PATH)
vectorizer = joblib.load(VECTORIZER_PATH)
print("Custom model loaded successfully!")


def extract_video_id(url):
    """Extract the video ID from various YouTube URL formats."""
    patterns = [
        r'(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'  # plain video ID
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def fetch_comments(video_id, max_comments=100):
    """Fetch top-level comments from a YouTube video."""
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

    comments = []
    next_page_token = None

    while len(comments) < max_comments:
        request_obj = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=min(100, max_comments - len(comments)),
            order="relevance",
            textFormat="plainText",
            pageToken=next_page_token
        )
        response = request_obj.execute()

        for item in response.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            comments.append({
                "author": snippet["authorDisplayName"],
                "authorProfileImage": snippet.get("authorProfileImageUrl", ""),
                "text": snippet["textDisplay"],
                "likeCount": snippet["likeCount"],
                "publishedAt": snippet["publishedAt"],
                "updatedAt": snippet.get("updatedAt", snippet["publishedAt"]),
            })

        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

    return comments[:max_comments]


def fetch_video_info(video_id):
    """Fetch basic info about the video."""
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    response = youtube.videos().list(
        part="snippet,statistics",
        id=video_id
    ).execute()

    if not response.get("items"):
        return None

    item = response["items"][0]
    snippet = item["snippet"]
    stats = item["statistics"]

    return {
        "title": snippet["title"],
        "channelTitle": snippet["channelTitle"],
        "publishedAt": snippet["publishedAt"],
        "thumbnail": snippet["thumbnails"]["high"]["url"],
        "commentCount": stats.get("commentCount", "N/A"),
        "viewCount": stats.get("viewCount", "N/A"),
        "likeCount": stats.get("likeCount", "N/A"),
    }



def classify_comment(text):
    """Run a single comment through the custom logistic regression model."""
    try:
        truncated = text[:512] if len(text) > 512 else text
        X_vec = vectorizer.transform([truncated])
        pred = logreg_model.predict(X_vec)[0]
        proba = logreg_model.predict_proba(X_vec)[0]
        # Assuming binary classification: 1 = toxic/sexist, 0 = safe
        is_flagged = bool(pred)
        confidence = round(100 * max(proba), 1)
        if is_flagged:
            severity = "high" if confidence > 90 else "medium" if confidence > 75 else "low"
        else:
            severity = "none"
        return {
            "isFlagged": is_flagged,
            "confidence": confidence,
            "severity": severity,
        }
    except Exception as e:
        print(f"Model error: {e}")
        return {"isFlagged": False, "confidence": 0, "severity": "none"}


@app.route("/api/comments", methods=["POST"])
def get_comments():
    """API endpoint to fetch and analyze YouTube comments."""
    data = request.get_json()
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "Please provide a YouTube URL"}), 400

    if not YOUTUBE_API_KEY:
        return jsonify({"error": "YouTube API key is not configured. Please set YOUTUBE_API_KEY in your .env file."}), 500

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL. Please provide a valid YouTube video link."}), 400

    try:
        video_info = fetch_video_info(video_id)
        if not video_info:
            return jsonify({"error": "Video not found. Please check the URL and try again."}), 404

        comments = fetch_comments(video_id, max_comments=100)

        # Run each comment through the AI classifier
        for comment in comments:
            analysis = classify_comment(comment["text"])
            comment["isFlagged"] = analysis["isFlagged"]
            comment["confidence"] = analysis["confidence"]
            comment["severity"] = analysis["severity"]

        # Summary stats
        total = len(comments)
        flagged = sum(1 for c in comments if c["isFlagged"])
        safe = total - flagged
        high_count = sum(1 for c in comments if c.get("severity") == "high")
        medium_count = sum(1 for c in comments if c.get("severity") == "medium")
        low_count = sum(1 for c in comments if c.get("severity") == "low")

        return jsonify({
            "video": video_info,
            "comments": comments,
            "totalFetched": total,
            "analysis": {
                "totalComments": total,
                "flaggedCount": flagged,
                "safeCount": safe,
                "toxicityPercentage": round(flagged / total * 100, 1) if total > 0 else 0,
                "highSeverity": high_count,
                "mediumSeverity": medium_count,
                "lowSeverity": low_count,
            }
        })

    except Exception as e:
        error_msg = str(e)
        if "commentsDisabled" in error_msg:
            return jsonify({"error": "Comments are disabled for this video."}), 403
        if "quotaExceeded" in error_msg:
            return jsonify({"error": "YouTube API quota exceeded. Please try again later."}), 429
        return jsonify({"error": f"Failed to fetch comments: {error_msg}"}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "api_key_configured": bool(YOUTUBE_API_KEY), "model_loaded": logreg_model is not None and vectorizer is not None})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
