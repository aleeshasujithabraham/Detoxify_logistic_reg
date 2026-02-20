const API_BASE = "http://127.0.0.1:5000";

let allComments = [];
let currentVideoInfo = null;
let currentAnalysis = null;


async function fetchComments() {
    const urlInput = document.getElementById("youtubeUrl");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const btnText = analyzeBtn.querySelector(".btn-text");
    const btnLoader = analyzeBtn.querySelector(".btn-loader");
    const videoInfo = document.getElementById("videoInfo");
    const commentsSection = document.getElementById("commentsSection");
    const dashboard = document.getElementById("analysisDashboard");
    const filterTabs = document.getElementById("filterTabs");

    const url = urlInput.value.trim();

    if (!url) {
        showError("Please paste a YouTube video URL.");
        urlInput.focus();
        return;
    }

    hideError();
    videoInfo.style.display = "none";
    commentsSection.style.display = "none";
    dashboard.style.display = "none";
    filterTabs.style.display = "none";

    analyzeBtn.disabled = true;
    btnText.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Analyzing...`;
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

        
        allComments = data.comments;
        currentVideoInfo = data.video;
        currentAnalysis = data.analysis;
        displayVideoInfo(data.video);
        displayDashboard(data.analysis);

        
        filterTabs.style.display = "flex";
        resetFilterButtons();
        displayComments(data.comments, data.totalFetched);

    } catch (err) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
            showError("Cannot connect to the server. Make sure the backend is running on port 5000.");
        } else {
            showError("An unexpected error occurred. Please try again.");
        }
        console.error("Fetch error:", err);
    } finally {
        analyzeBtn.disabled = false;
        btnText.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Analyze`;
        btnLoader.style.display = "none";
    }
}


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

function displayDashboard(analysis) {
    const dashboard = document.getElementById("analysisDashboard");

    document.getElementById("safeCount").textContent = analysis.safeCount;
    document.getElementById("flaggedCount").textContent = analysis.flaggedCount;
    document.getElementById("highCount").textContent = analysis.highSeverity;
    document.getElementById("mediumCount").textContent = analysis.mediumSeverity;
    document.getElementById("lowCount").textContent = analysis.lowSeverity;

    const percent = analysis.toxicityPercentage;
    document.getElementById("toxicityPercent").textContent = percent + "%";

    
    const fill = document.getElementById("toxicityFill");
    fill.style.width = "0%";
    fill.className = "toxicity-fill";

    if (percent > 50) fill.classList.add("toxicity-high");
    else if (percent > 25) fill.classList.add("toxicity-medium");
    else fill.classList.add("toxicity-low");

    setTimeout(() => { fill.style.width = percent + "%"; }, 100);

    dashboard.style.display = "block";
}

function filterComments(filter) {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    });

    let filtered;
    switch (filter) {
        case "safe":
            filtered = allComments.filter(c => !c.isFlagged);
            break;
        case "flagged":
            filtered = allComments.filter(c => c.isFlagged);
            break;
        case "high":
            filtered = allComments.filter(c => c.severity === "high");
            break;
        default:
            filtered = allComments;
    }

    displayComments(filtered, filtered.length, false);
}

function resetFilterButtons() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === "all");
    });
}


function displayComments(comments, totalFetched, scroll = true) {
    const section = document.getElementById("commentsSection");
    const list = document.getElementById("commentsList");
    const badge = document.getElementById("commentCountBadge");

    badge.textContent = `${totalFetched} shown`;
    list.innerHTML = "";

    if (comments.length === 0) {
        list.innerHTML = `
            <div class="comment-card" style="text-align:center; color: var(--neutral-400); padding: 40px;">
                <p>No comments match this filter.</p>
            </div>
        `;
        section.style.display = "block";
        return;
    }

    comments.forEach((comment, index) => {
        const card = createCommentCard(comment, index + 1);
        card.style.animationDelay = `${index * 0.025}s`;
        list.appendChild(card);
    });

    section.style.display = "block";

    if (scroll) {
        setTimeout(() => {
            document.getElementById("videoInfo").scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
    }
}


function createCommentCard(comment, number) {
    const card = document.createElement("div");
    card.className = "comment-card";

    
    if (comment.isFlagged) {
        card.classList.add("flagged");
        card.classList.add(`severity-${comment.severity}`);
    }

    const initial = comment.author ? comment.author.charAt(0).toUpperCase() : "?";
    const dateStr = formatDate(comment.publishedAt);
    const escapedText = escapeHtml(comment.text);

    let avatarHtml;
    if (comment.authorProfileImage && !comment.authorProfileImage.includes("default")) {
        avatarHtml = `<img src="${comment.authorProfileImage}" alt="${escapeHtml(comment.author)}" class="comment-avatar" onerror="this.outerHTML='<div class=\\'comment-avatar-placeholder\\'>${initial}</div>'">`;
    } else {
        avatarHtml = `<div class="comment-avatar-placeholder">${initial}</div>`;
    }

    
    let analysisBadge = "";
    if (comment.isFlagged) {
        const severityLabel = comment.severity.charAt(0).toUpperCase() + comment.severity.slice(1);
        analysisBadge = `
            <span class="analysis-badge badge-${comment.severity}" title="${comment.confidence}% confidence">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                ${severityLabel} · ${comment.confidence}%
            </span>`;
    } else {
        analysisBadge = `
            <span class="analysis-badge badge-safe">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                Safe
            </span>`;
    }

    card.innerHTML = `
        <div class="comment-header">
            ${avatarHtml}
            <div class="comment-meta">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-date">${dateStr}</span>
            </div>
            ${analysisBadge}
            <span class="comment-number">#${number}</span>
        </div>
        <div class="comment-text">${escapedText}</div>
        <div class="comment-footer">
            ${comment.likeCount > 0 ? `
            <div class="comment-likes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
                ${formatNumber(comment.likeCount)}
            </div>` : ""}
        </div>
    `;

    return card;
}



function showError(message) {
    const errorDisplay = document.getElementById("errorDisplay");
    document.getElementById("errorMessage").textContent = message;
    errorDisplay.style.display = "block";
}

function hideError() {
    document.getElementById("errorDisplay").style.display = "none";
}

function formatNumber(num) {
    if (!num || num === "N/A") return "N/A";
    return parseInt(num).toLocaleString();
}

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

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("youtubeUrl").addEventListener("keydown", (e) => {
        if (e.key === "Enter") fetchComments();
    });
});


function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;
    let y = 20;

    
    doc.setFillColor(232, 73, 141); 
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DETOXIFY', margin, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Harassment Evidence Report', margin, 27);

    
    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.setFontSize(9);
    doc.text(dateStr, pageWidth - margin, 27, { align: 'right' });

    y = 50;

    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Video Details', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    if (currentVideoInfo) {
        const videoTitle = currentVideoInfo.title || 'Unknown';
        const channel = currentVideoInfo.channelTitle || 'Unknown';
        const url = document.getElementById('youtubeUrl').value.trim();

        
        const titleLines = doc.splitTextToSize('Title: ' + videoTitle, pageWidth - margin * 2);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 5 + 2;

        doc.text('Channel: ' + channel, margin, y);
        y += 6;
        doc.text('URL: ' + url, margin, y);
        y += 10;
    }

    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis Summary', margin, y);
    y += 8;

    if (currentAnalysis) {
        const stats = [
            { label: 'Total', value: currentAnalysis.totalComments, color: [100, 100, 100] },
            { label: 'Safe', value: currentAnalysis.safeCount, color: [16, 185, 129] },
            { label: 'Flagged', value: currentAnalysis.flaggedCount, color: [239, 68, 68] },
            { label: 'Toxicity', value: currentAnalysis.toxicityPercentage + '%', color: [155, 89, 182] },
        ];

        const boxWidth = (pageWidth - margin * 2 - 15) / 4;
        stats.forEach((stat, i) => {
            const x = margin + i * (boxWidth + 5);

            
            doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
            doc.roundedRect(x, y, boxWidth, 22, 3, 3, 'F');

            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(String(stat.value), x + boxWidth / 2, y + 10, { align: 'center' });

            
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(stat.label.toUpperCase(), x + boxWidth / 2, y + 18, { align: 'center' });
        });

        y += 32;

       
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`High Severity: ${currentAnalysis.highSeverity}   |   Medium Severity: ${currentAnalysis.mediumSeverity}   |   Low Severity: ${currentAnalysis.lowSeverity}`, margin, y);
        y += 10;
    }

    
    const flaggedComments = allComments.filter(c => c.isFlagged);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Flagged Comments (${flaggedComments.length})`, margin, y);
    y += 4;

    if (flaggedComments.length === 0) {
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('No offensive comments were detected in this video.', margin, y);
    } else {
        const tableData = flaggedComments.map((c, i) => [
            i + 1,
            c.author || 'Unknown',
            (c.text || '').substring(0, 120) + (c.text && c.text.length > 120 ? '...' : ''),
            c.severity ? c.severity.charAt(0).toUpperCase() + c.severity.slice(1) : 'N/A',
            c.confidence + '%'
        ]);

        doc.autoTable({
            startY: y + 2,
            head: [['#', 'Username', 'Comment', 'Severity', 'Confidence']],
            body: tableData,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 7.5,
                cellPadding: 4,
                overflow: 'linebreak',
                lineColor: [230, 220, 240],
                lineWidth: 0.3,
            },
            headStyles: {
                fillColor: [155, 89, 182],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
            },
            alternateRowStyles: {
                fillColor: [252, 245, 250],
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' },
            },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    const val = data.cell.raw;
                    if (val === 'High') data.cell.styles.textColor = [220, 38, 38];
                    else if (val === 'Medium') data.cell.styles.textColor = [217, 119, 6];
                    else if (val === 'Low') data.cell.styles.textColor = [124, 58, 237];
                }
            }
        });
    }

   
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();

        
        doc.setDrawColor(230, 220, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 18, pageWidth - margin, pageH - 18);

        
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Detoxify | Tink-Her-Hack 2026 | This report is for documentation purposes only.',
            margin, pageH - 12);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageH - 12, { align: 'right' });
    }

   
    const filename = currentVideoInfo
        ? `Detoxify_Report_${currentVideoInfo.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : 'Detoxify_Report.pdf';
    doc.save(filename);
}
