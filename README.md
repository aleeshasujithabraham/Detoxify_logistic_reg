# ShieldHer — YouTube Comment Analyzer

An early-warning system for detecting online harassment patterns against women, starting with YouTube comment analysis.

Built for **Tink-Her-Hack** hackathon.

## Features (Phase 1)
- Paste any YouTube video URL
- Fetches and displays the first 100 comments
- Shows video info (title, channel, views, likes, comment count)
- Beautiful, women-friendly UI with soft pinks, lavender & purple palette

## Setup

### 1. Get a YouTube API Key (Free)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable **YouTube Data API v3** from the API Library
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key

### 2. Configure the API Key
Open the `.env` file in the project root and replace the placeholder:
```
YOUTUBE_API_KEY=your_actual_api_key_here
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Backend
```bash
cd backend
python app.py
```
The server starts at `http://127.0.0.1:5000`

### 5. Open the Frontend
Open `frontend/index.html` in your browser (just double-click it, or use Live Server in VS Code).

## Project Structure
```
Tink-Her-Hack/
├── backend/
│   └── app.py              # Flask API server
├── frontend/
│   ├── index.html           # Main page
│   ├── style.css            # Styling (women-friendly palette)
│   └── script.js            # Frontend logic
├── .env                     # Your API key (not committed)
├── .env.example             # Template for API key
├── .gitignore
├── requirements.txt
└── README.md
```

## Tech Stack
- **Backend:** Python, Flask, YouTube Data API v3
- **Frontend:** HTML, CSS, JavaScript (no frameworks)
- **API:** Google YouTube Data API (free tier — 10,000 units/day)
