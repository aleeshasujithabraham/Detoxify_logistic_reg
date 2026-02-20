const API_BASE = "http://127.0.0.1:5000";

/**
 * Main function: fetches YouTube comments from the backend API
 */
async function fetchComments() {
    const urlInput = document.getElementById("youtubeUrl");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const btnText = analyzeBtn.querySelector(".btn-text");
    const btnLoader = analyzeBtn.querySelector(".btn-loader");
    const errorDisplay = document.getElementById("errorDisplay");
    const errorMessage = document.getElementById("errorMessage");
    const videoInfo = document.getElementById("videoInfo");
    const commentsSection = document.getElementById("commentsSection");

    const url = urlInput.value.trim();

    // Validate input
    if (!url) {
        showError("Please paste a YouTube video URL.");
        urlInput.focus();
        return;
    }

    // Reset UI
    hideError();
    videoInfo.style.display = "none";
    commentsSection.style.display = "none";

    // Show loading state
    analyzeBtn.disabled = true;
    btnText.textContent = "Fetching...";
    btnLoader.style.display = "inline-flex";

    try {
        const response = await fetch(`${API_BASE}/api/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || "Something went wrong. Please try again.");
            return;
        }

        // Display video info
        displayVideoInfo(data.video);

        // Display comments
        displayComments(data.comments, data.totalFetched);

    } catch (err) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
            showError("Cannot connect to the server. Make sure the backend is running on port 5000.");
        } else {
            showError("An unexpected error occurred. Please try again.");
        }
        console.error("Fetch error:", err);
    } finally {
        // Reset button
        analyzeBtn.disabled = false;
        btnText.textContent = "Fetch Comments";
        btnLoader.style.display = "none";
    }
}

/**
 * Display video information card
 */
function displayVideoInfo(video) {
    const section = document.getElementById("videoInfo");

    document.getElementById("videoThumbnail").src = video.thumbnail;
    document.getElementById("videoTitle").textContent = video.title;
    document.getElementById("videoChannel").textContent = video.channelTitle;
    document.getElementById("videoViews").textContent = formatNumber(video.viewCount) + " views";
    document.getElementById("videoLikes").textContent = formatNumber(video.likeCount) + " likes";
    document.getElementById("videoCommentCount").textContent = formatNumber(video.commentCount) + " comments";

    section.style.display = "block";
}

/**
 * Display comments list with stagger animation
 */
function displayComments(comments, totalFetched) {
    const section = document.getElementById("commentsSection");
    const list = document.getElementById("commentsList");
    const badge = document.getElementById("commentCountBadge");

    badge.textContent = `${totalFetched} fetched`;
    list.innerHTML = "";

    if (comments.length === 0) {
        list.innerHTML = `
            <div class="comment-card" style="text-align:center; color: var(--neutral-400); padding: 40px;">
                <p>No comments found for this video.</p>
            </div>
        `;
        section.style.display = "block";
        return;
    }

    comments.forEach((comment, index) => {
        const card = createCommentCard(comment, index + 1);
        card.style.animationDelay = `${index * 0.03}s`;
        list.appendChild(card);
    });

    section.style.display = "block";

    // Smooth scroll to results
    setTimeout(() => {
        document.getElementById("videoInfo").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
}

/**
 * Create a single comment card element
 */
function createCommentCard(comment, number) {
    const card = document.createElement("div");
    card.className = "comment-card";

    const initial = comment.author ? comment.author.charAt(0).toUpperCase() : "?";
    const dateStr = formatDate(comment.publishedAt);
    const escapedText = escapeHtml(comment.text);

    let avatarHtml;
    if (comment.authorProfileImage && !comment.authorProfileImage.includes("default")) {
        avatarHtml = `<img src="${comment.authorProfileImage}" alt="${escapeHtml(comment.author)}" class="comment-avatar" onerror="this.outerHTML='<div class=\\'comment-avatar-placeholder\\'>${initial}</div>'">`;
    } else {
        avatarHtml = `<div class="comment-avatar-placeholder">${initial}</div>`;
    }

    card.innerHTML = `
        <div class="comment-header">
            ${avatarHtml}
            <div class="comment-meta">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-date">${dateStr}</span>
            </div>
            <span class="comment-number">#${number}</span>
        </div>
        <div class="comment-text">${escapedText}</div>
        ${comment.likeCount > 0 ? `
        <div class="comment-footer">
            <div class="comment-likes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
                ${formatNumber(comment.likeCount)}
            </div>
        </div>` : ""}
    `;

    return card;
}

/**
 * Show error message
 */
function showError(message) {
    const errorDisplay = document.getElementById("errorDisplay");
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.textContent = message;
    errorDisplay.style.display = "block";
}

/**
 * Hide error message
 */
function hideError() {
    document.getElementById("errorDisplay").style.display = "none";
}

/**
 * Format large numbers (e.g., 1234567 -> 1,234,567)
 */
function formatNumber(num) {
    if (!num || num === "N/A") return "N/A";
    return parseInt(num).toLocaleString();
}

/**
 * Format ISO date to readable string
 */
function formatDate(isoDate) {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Allow pressing Enter to submit
 */
document.addEventListener("DOMContentLoaded", () => {
    const urlInput = document.getElementById("youtubeUrl");
    urlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            fetchComments();
        }
    });
});
