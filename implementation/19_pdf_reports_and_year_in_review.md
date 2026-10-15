# 📑 Step 19: PDF Reports & Year-in-Review Generator

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 3–4 hours

---

## 🎯 Objective
1. Generate weekly/monthly executive life summary PDF reports delivered straight to your inbox.
2. Build an annual "Personal Life Wrapped" generator (like Spotify Wrapped, but for your entire life: books, code, miles, tracks, best months).

---

## 📄 1. Weekly PDF Report Generator

Automated generation using headless Puppeteer or `@react-pdf/renderer`:
- Weekly sleep quality curve & average HRV.
- Total coding hours and top Git repositories.
- Financial spending by category vs budget.
- Highlights from books and articles read.
- Top correlation insights discovered that week.

---

## 🎁 2. Annual "Life Wrapped" Generator

Auto-compiled at the end of every December:

```
╔══════════════════════════════════════════════════════╗
║             🎉 YOUR 2026 LIFE WRAPPED                ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  💻 1,842 Commits across 14 Open Source Repos        ║
║  📚 24 Books Read (Top: Designing Data-Intensive)    ║
║  🏃 420 km Run & 168 Gym Sessions Logged             ║
║  🎵 12,480 Minutes Listened (Top: Ludovico Einaudi)  ║
║  🌟 Happiest Month: July (Average Mood: 8.4/10)      ║
║  🔥 Longest Streak: 48 Days of Continuous Coding     ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

## 🧪 Verification & Checklist
- [x] Implement PDF generator route `GET /api/v1/export/report?period=week&format=pdf`.
- [x] Create HTML/CSS print template styled with clean charts.
- [x] Test annual aggregation query grouping by month.

---

## 🔮 Advanced Enhancements & Additions

### 1. Vector Chart Rendering in Executive PDF
Upgrade from text tables to high-resolution vector data visualizations inside the PDF:
- Render sparkline SVGs or generate chart PNGs using `@resvg/resvg-js` or Chart.js node canvas.
- Include 7-day sleep architecture bar charts (Deep, REM, Light sleep breakdown).
- Include cumulative coding hours vs historical baseline trend line.

### 2. Shareable "Life Wrapped" Mobile Cards (1080x1920)
Generate high-aesthetic, Spotify-Wrapped style vertical story graphics:
- Built with HTML/Canvas or `@vercel/og` (Satori).
- Highlights:
  * Top Code Repositories & Lines Shipped
  * Top 5 Books Read & Favorite Quote
  * Kilometers Run & Workout Consistency Percentage
  * Top 5 Musical Artists & Most Played Focus Track
- One-click image download or auto-send to Telegram chat on New Year's Eve.

### 3. Automated Monthly Retro Archive Binder
On the 1st of each month, compile a comprehensive 3-page retrospective PDF:
- Executive Summary, Habit SLA Scorecard, Energy Balance Breakdown, and Discovered Insights.
- Automatically save to a persistent `./data/reports/YYYY-MM_retrospective.pdf` archive.

