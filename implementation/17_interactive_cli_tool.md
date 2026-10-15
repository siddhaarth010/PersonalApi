# 💻 Step 17: Interactive CLI Tool (`me`)

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Create a lightweight, elegant terminal command line utility `me` that allows instant life querying, status checks, and check-in logging directly from the terminal without opening a browser.

---

## ⌨️ CLI Command Reference

```bash
# Check today's snapshot
$ me status

# View sleep statistics
$ me sleep --week

# Log an instant entry
$ me log mood 8 --notes "Crushed workout"

# Ask your personal AI agent
$ me ask "Why was my sleep score low yesterday?"

# Compare two time periods
$ me compare october september
```

---

## 🏗️ Implementation (`bin/me.ts` or `src/cli/index.ts`)

Built using `commander`, `chalk`, and `cli-table3`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();
const API_URL = process.env.PERSONAL_API_URL || 'http://localhost:3001/api/v1';

program
  .name('me')
  .description('Personal API — The Operating System for Your Life')
  .version('1.0.0');

program
  .command('status')
  .description('Print your real-time life status snapshot')
  .action(async () => {
    const res = await fetch(`${API_URL}/me`);
    const data = await res.json();

    console.log(chalk.bold.cyan('\n🧬 Personal API Snapshot — ' + data.timestamp.slice(0, 10)));
    
    const table = new Table({
      head: [chalk.gray('Domain'), chalk.gray('Metric'), chalk.gray('Value')],
      colWidths: [15, 20, 25]
    });

    table.push(
      ['Productivity', 'Commits Today', chalk.green(data.today.productivity?.commits || 0)],
      ['Wellbeing', 'Mood Score', chalk.yellow(data.today.wellbeing?.mood || 'N/A')],
      ['Wellbeing', 'Energy Score', chalk.blue(data.today.wellbeing?.energy || 'N/A')],
      ['Media', 'Tracks Played', chalk.magenta(data.today.media?.total_tracks_played || 0)]
    );

    console.log(table.toString());
  });

program.parse(process.argv);
```

---

## 🧪 Verification & Checklist
- [x] Add `bin: { "me": "./dist/cli/index.js" }` to `package.json`.
- [x] Run `npm link` to make `me` available globally in your terminal.
- [x] Test `me status` output formatting in PowerShell / bash.

---

## 🔮 Advanced Enhancements & Additions

### 1. Interactive TUI Terminal Survey (`me checkin`)
Launch an elegant, interactive terminal wizard powered by `@inquirer/prompts`:
```bash
$ me checkin
? How is your energy right now? (1-10) [8]
? What is your current mood rating? (1-10) [9]
? Select tags: ( ) flow  (*) deep-work  ( ) gym  (*) meditation
? Add reflections or notes: Crushed architecture review and shipped v2
✅ Check-in recorded! Streak advanced to 24 days 🔥
```

### 2. Full-Screen Terminal Dashboard Mode (`me top` / `me dash`)
Render an ASCII/Unicode live terminal dashboard using `blessed-contrib` or `ink`:
- CPU-style gauge for cognitive fragmentation.
- Sparkline ASCII charts for 7-day sleep duration and HRV.
- Live streaming activity feed reacting to SSE events from the backend.

### 3. Fast Full-Text CLI Search (`me search <term>`)
Search across all life data instantly from the terminal:
- `me search "marathon"` -> returns all workouts, notes, and music associated with running.
- Highlight matched terms using `chalk.bgYellow.black`.

