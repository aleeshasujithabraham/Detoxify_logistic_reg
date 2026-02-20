from flask import Flask, request, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from dotenv import load_dotenv
import os
import re
from pathlib import Path

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
CORS(app)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


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


@app.route("/api/comments", methods=["POST"])
def get_comments():
    """API endpoint to fetch YouTube comments."""
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

        return jsonify({
            "video": video_info,
            "comments": comments,
            "totalFetched": len(comments)
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
    return jsonify({"status": "ok", "api_key_configured": bool(YOUTUBE_API_KEY)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
