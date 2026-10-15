# 🖥️ Step 07: Web Dashboard Foundation

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 3–4 hours

---

## 🎯 Objective
Create a high-aesthetic, cybernetic-themed personal life dashboard using React 19, Vite, Lucide icons, and Recharts that pulls data in real-time from the Personal API server (`:3001`).

---

## 🎨 Design System & Theme (`dashboard/src/index.css`)
- **Theme**: Dark glassmorphism with deep navy/slate backgrounds (`#0a0e17`), glowing neon accents (`#6366f1` indigo, `#10b981` emerald, `#ec4899` pink).
- **Typography**: Clean monospace badges paired with modern system sans-serif hierarchy.
- **Card Aesthetics**: Translucent frosted panels with subtle 1px border glows and micro-hover interactions.

```css
:root {
  --bg-primary: #0a0e17;
  --bg-card: rgba(17, 24, 39, 0.7);
  --border-card: rgba(255, 255, 255, 0.08);
  --accent-cyan: #06b6d4;
  --accent-indigo: #6366f1;
  --accent-emerald: #10b981;
}
```

---

## 🧩 Components Overview (`dashboard/src/App.tsx`)

1. **Header Bar**:
   - Status badge showing active sources count.
   - Global **Sync** action button with rotating spinner indicator.
2. **Hero Greeting**:
   - Time-of-day greeting ("Good Morning / Evening") with today's full date.
3. **Stat Cards**:
   - Commits Today, Current Mood, Energy level, Tracks Played.
4. **Interactive 30-Day Trend Chart**:
   - Dual-line curved Area chart with gradients for Mood & Energy.
   - Filter toggles: **Today**, **Week**, **Month**.
5. **Quick Check-In Form**:
   - 1–10 button matrix for Mood and Energy.
   - Optional notes field and instant "Log Entry" submission.
6. **AI Insights & Anomalies Panel**:
   - Tagged insight badges (`correlation`, `anomaly`, `prediction`) with confidence bars.
7. **Habit Streaks & Goals Tracker**:
   - Streak counters with fire icons and personal best comparisons.
   - Progress bars for active yearly and daily goals.
8. **Activity Feeds**:
   - Recent Git commits with commit hash badges and relative timestamps.
   - Recently played Spotify music with timestamps and artist popularity rankings.

---

## 🧪 Verification & Checklist
- [x] Run `npm run build` in `/dashboard` cleanly with zero TypeScript errors.
- [x] Run `npm run dev` and navigate to `http://localhost:5173`.
- [x] Test live fetching from `http://localhost:3001/api/v1/me`.
- [x] Submit a quick check-in entry and observe live graph updates.

---

## 🔮 Advanced Enhancements & Additions

### 1. Modular Component Refactoring & State Management
Deconstruct monolithic `App.tsx` into a clean domain component tree:
```
dashboard/src/
├── components/
│   ├── layout/            # Header, Navigation, Footer, StatusBadge
│   ├── overview/          # HeroGreeting, StatCards
│   ├── vitality/          # HealthMetricsCard, SleepQualityChart
│   ├── productivity/      # CommitFeed, WakaTimeBreakdown, CalendarLoad
│   ├── energy/            # FragmentationMeter, EnergyBalanceSheet
│   ├── intelligence/      # InsightsPanel, AnomalyAlerts, ChatDrawer
│   ├── habits/            # StreaksWidget, GoalsTracker, SlaGrid
│   └── retrospective/     # TimeCapsuleCard, LifeContributionHeatmap
├── hooks/                 # usePersonalApi, useLiveStream, useCheckin
└── stores/                # Zustand store with optimistic update actions
```

### 2. 365-Day Life Contribution Heatmap Grid
Implement a GitHub-style 52-week contribution matrix visualizing composite daily life quality:
$$\text{Day Score} = 0.3 \cdot \text{Sleep} + 0.3 \cdot \text{Productivity} + 0.2 \cdot \text{Movement} + 0.2 \cdot \text{Mood}$$
- Render 5 shades of vibrant emerald/cyan squares.
- Interactive tooltip showing full daily breakdown on hover.
- Click any day square to inspect that date's historical life commit and journal notes.

### 3. Progressive Web App (PWA) & Offline Mobile Installation
- Add `manifest.webmanifest` with custom dark-cyber icon assets.
- Integrate `vite-plugin-pwa` with `workbox` caching strategy for offline review.
- Support iOS "Add to Home Screen" standalone app mode with native safe-area insets.

