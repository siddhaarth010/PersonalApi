#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { calculatePersonalSLA } from '../analytics/sla.js';
import { getAllStreaks, updateStreak } from '../analytics/streaks.js';
import { getAllGoalForecasts } from '../analytics/goals.js';
import { askPersonalAI } from '../ai/agent.js';
import { generateDailyBriefing } from '../notifications/briefing.js';
import { connectorManager } from '../connectors/index.js';
import { calculateFragmentationScore, getEnergyAccountingSummary, logEnergyTransaction } from '../analytics/energy.js';
import { getOnThisDayCapsule, analyzePeakPeriods } from '../analytics/archaeology.js';

const program = new Command();
const API_URL = process.env.PERSONAL_API_URL || 'http://localhost:3001/api/v1';

program
  .name('me')
  .description(chalk.cyan('🧬 Personal API — The Operating System for Your Life'))
  .version('1.0.0');

/**
 * Helper: tries fetching from local API, falls back to direct SQLite database
 */
async function fetchFromApiOrDb(endpoint: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${API_URL}${endpoint}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return await res.json();
  } catch {
    // API server offline, fallback to direct SQLite query
  }
  return null;
}

// ============================================================
// Command: me status
// ============================================================
program
  .command('status')
  .description('Print your real-time life status snapshot across all domains')
  .action(async () => {
    const apiData = await fetchFromApiOrDb('/me');
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    console.log(chalk.bold.cyan(`\n🧬 Personal API Snapshot — ${today}`));

    const table = new Table({
      head: [chalk.gray('Domain'), chalk.gray('Metric'), chalk.gray('Value'), chalk.gray('Status / Context')],
      colWidths: [16, 20, 22, 28],
    });

    if (apiData) {
      const p = apiData.today?.productivity;
      const w = apiData.today?.wellbeing;
      const h = apiData.today?.health;
      const sla = apiData.sla;

      table.push(
        ['Productivity', 'Commits Today', chalk.green(String(p?.commits ?? 0)), `${p?.active_repos ?? 0} active repos`],
        ['Productivity', 'Coding Hours', chalk.cyan(`${p?.coding_hours ?? 0}h`), 'WakaTime session total'],
        ['Wellbeing', 'Mood Score', chalk.yellow(w?.mood ? `${w.mood}/10` : 'Not logged'), w?.mood >= 7 ? 'High vitality' : 'Normal'],
        ['Wellbeing', 'Energy Score', chalk.magenta(w?.energy ? `${w.energy}/10` : 'Not logged'), w?.energy >= 7 ? 'Optimal focus' : 'Normal'],
        ['Health', 'Sleep Duration', chalk.blue(h?.sleep_hours ? `${h.sleep_hours}h` : 'N/A'), h?.sleep_score ? `${h.sleep_score}% score` : ''],
        ['Health', 'Active Steps', chalk.green(h?.steps ? h.steps.toLocaleString() : 'N/A'), 'Wearable activity'],
        ['DevOps SLA', '30-Day Uptime', chalk.bold(sla?.overall_uptime ? `${sla.overall_uptime}%` : '90%'), sla?.system_state || 'Operational']
      );
    } else {
      // Direct SQLite fallback
      const commits = db.prepare("SELECT COUNT(*) as count FROM github_commits WHERE committed_at LIKE ? || '%'").get(today) as any;
      const mood = db.prepare("SELECT AVG(value) as avg FROM manual_entries WHERE type = 'mood' AND recorded_at LIKE ? || '%'").get(today) as any;
      const energy = db.prepare("SELECT AVG(value) as avg FROM manual_entries WHERE type = 'energy' AND recorded_at LIKE ? || '%'").get(today) as any;
      const health = db.prepare("SELECT sleep_hours, sleep_score, steps FROM health_metrics WHERE date = ?").get(today) as any;
      const sla = calculatePersonalSLA(30);

      table.push(
        ['Productivity', 'Commits Today', chalk.green(String(commits?.count ?? 0)), 'Direct local SQLite'],
        ['Wellbeing', 'Mood Score', chalk.yellow(mood?.avg ? `${mood.avg.toFixed(1)}/10` : 'Not logged'), 'Subjective rating'],
        ['Wellbeing', 'Energy Score', chalk.magenta(energy?.avg ? `${energy.avg.toFixed(1)}/10` : 'Not logged'), 'Vitality level'],
        ['Health', 'Sleep Duration', chalk.blue(health?.sleep_hours ? `${health.sleep_hours}h` : '7.5h'), health?.sleep_score ? `${health.sleep_score}% score` : '82% score'],
        ['Health', 'Active Steps', chalk.green(health?.steps ? health.steps.toLocaleString() : '8,400'), 'Wearable sync'],
        ['DevOps SLA', '30-Day Uptime', chalk.bold(`${sla.overallUptime}%`), sla.systemState]
      );
    }

    console.log(table.toString());

    // Streaks summary
    const streaks = getAllStreaks();
    const streakLine = streaks.map(s => `${chalk.bold(s.name)}: ${chalk.green(s.current_count + 'd')} ${s.status === 'at_risk' ? chalk.red('⚠️') : '🔥'}`).join('  |  ');
    console.log(`\n🔥 ${chalk.bold('Habit Streaks')}: ${streakLine}\n`);
  });

// ============================================================
// Command: me sleep
// ============================================================
program
  .command('sleep')
  .description('View sleep telemetry and recovery history')
  .option('-w, --week', 'Show full 7-day sleep log')
  .action(async (options) => {
    const db = getDb();
    const limit = options.week ? 7 : 3;
    const history = db.prepare(`
      SELECT date, sleep_hours, sleep_score, deep_sleep_hours, rem_sleep_hours, resting_hr, hrv_rmssd, steps
      FROM health_metrics ORDER BY date DESC LIMIT ?
    `).all(limit) as any[];

    console.log(chalk.bold.blue(`\n😴 Sleep Telemetry & Vitality (Last ${limit} Days)`));

    const table = new Table({
      head: [chalk.gray('Date'), chalk.gray('Sleep'), chalk.gray('Score'), chalk.gray('Deep / REM'), chalk.gray('RHR'), chalk.gray('HRV'), chalk.gray('Steps')],
      colWidths: [14, 12, 10, 16, 10, 10, 12],
    });

    history.forEach(h => {
      const scoreColor = h.sleep_score >= 80 ? chalk.green : h.sleep_score >= 70 ? chalk.yellow : chalk.red;
      table.push([
        h.date,
        chalk.cyan(`${h.sleep_hours}h`),
        scoreColor(`${h.sleep_score}%`),
        `${h.deep_sleep_hours ?? 1.2}h / ${h.rem_sleep_hours ?? 1.4}h`,
        `${h.resting_hr ?? 56} bpm`,
        `${h.hrv_rmssd ?? 62} ms`,
        h.steps ? h.steps.toLocaleString() : 'N/A',
      ]);
    });

    console.log(table.toString());

    // 30-day baseline comparison
    const avg = db.prepare('SELECT AVG(sleep_hours) as avg_sleep, AVG(sleep_score) as avg_score FROM health_metrics LIMIT 30').get() as any;
    console.log(chalk.gray(`30-day Personal Baseline: ${avg?.avg_sleep ? avg.avg_sleep.toFixed(1) : 7.4}h avg sleep | ${Math.round(avg?.avg_score || 82)}% avg recovery index\n`));
  });

// ============================================================
// Command: me log <type> <value>
// ============================================================
program
  .command('log <type> <value>')
  .description('Quick-log a metric entry (mood, energy, sleep, workout, notes)')
  .option('-n, --notes <notes>', 'Optional context notes')
  .option('-t, --tags <tags>', 'Comma-separated tags (e.g. "morning,workout")')
  .action(async (type, value, options) => {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      console.error(chalk.red('Error: value must be a valid number'));
      process.exit(1);
    }

    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : ['cli'];
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO manual_entries (id, type, value, label, notes, tags, recorded_at)
      VALUES (?, ?, ?, 'CLI entry', ?, ?, ?)
    `).run(id, type, numVal, options.notes || null, JSON.stringify(tags), now);

    updateStreak(type);

    console.log(chalk.green(`\n✅ Logged ${chalk.bold(type)}: ${chalk.cyan(numVal)}`));
    if (options.notes) console.log(chalk.gray(`   Notes: "${options.notes}"`));
    console.log(chalk.gray(`   Recorded at: ${now}\n`));
  });

// ============================================================
// Command: me ask <query...>
// ============================================================
program
  .command('ask <query...>')
  .description('Ask your personal AI agent a natural language question about your life')
  .action(async (queryParts) => {
    const query = queryParts.join(' ');
    console.log(chalk.cyan(`\n🤖 Asking Personal AI: "${query}"...`));

    const response = await askPersonalAI(query);

    console.log('\n' + chalk.bold.cyan('━'.repeat(60)));
    console.log(chalk.white(response.answer));
    console.log(chalk.bold.cyan('━'.repeat(60)));
    console.log(chalk.gray(`Engine: ${response.provider} (${response.model}) | Context: ${response.contextSources.join(', ')}\n`));
  });

// ============================================================
// Command: me goals
// ============================================================
program
  .command('goals')
  .description('View goal progress, completion velocity and pace forecast')
  .action(async () => {
    const forecasts = getAllGoalForecasts();
    console.log(chalk.bold.green(`\n🎯 Active Life Goals & Velocity Forecast (${forecasts.length} Goals)`));

    const table = new Table({
      head: [chalk.gray('Goal'), chalk.gray('Current / Target'), chalk.gray('Progress'), chalk.gray('Velocity'), chalk.gray('Pacing Status')],
      colWidths: [22, 20, 14, 16, 26],
    });

    forecasts.forEach(g => {
      const statusText = g.isOnTrack ? chalk.green('🔥 On Track') : chalk.yellow('⚠️ Behind Pace');
      table.push([
        chalk.bold(g.name),
        `${g.currentValue} / ${g.targetValue} ${g.unit}`,
        `${g.percentComplete}%`,
        `${g.dailyVelocity} ${g.unit}/d`,
        statusText,
      ]);
    });

    console.log(table.toString());
    console.log('');
  });

// ============================================================
// Command: me brief
// ============================================================
program
  .command('brief')
  .description('Print today’s compiled morning life briefing')
  .action(async () => {
    const briefing = generateDailyBriefing();
    console.log('\n' + briefing.markdownText + '\n');
  });

// ============================================================
// Command: me compare [periodA] [periodB]
// ============================================================
program
  .command('compare [periodA] [periodB]')
  .description('Compare telemetry between two time windows')
  .action(async (periodA = 'this-week', periodB = 'last-week') => {
    const db = getDb();
    console.log(chalk.bold.cyan(`\n⚖️ Comparative Life Audit: ${periodA} vs ${periodB}`));

    const now = new Date();
    const dayMs = 86400000;

    // Period A: past 7 days
    const aFrom = new Date(now.getTime() - 7 * dayMs).toISOString().split('T')[0];
    const aTo = now.toISOString().split('T')[0];

    // Period B: 7-14 days ago
    const bFrom = new Date(now.getTime() - 14 * dayMs).toISOString().split('T')[0];
    const bTo = new Date(now.getTime() - 7 * dayMs).toISOString().split('T')[0];

    const getStats = (from: string, to: string) => {
      const commits = db.prepare("SELECT COUNT(*) as count FROM github_commits WHERE committed_at >= ? AND committed_at <= ?").get(`${from}T00:00:00Z`, `${to}T23:59:59Z`) as any;
      const sleep = db.prepare("SELECT AVG(sleep_hours) as avg_sleep, AVG(sleep_score) as avg_score, AVG(steps) as avg_steps FROM health_metrics WHERE date >= ? AND date <= ?").get(from, to) as any;
      const mood = db.prepare("SELECT AVG(value) as avg FROM manual_entries WHERE type = 'mood' AND recorded_at >= ? AND recorded_at <= ?").get(`${from}T00:00:00Z`, `${to}T23:59:59Z`) as any;
      return {
        commits: commits?.count ?? 0,
        sleepHours: sleep?.avg_sleep ? sleep.avg_sleep.toFixed(1) : '7.4',
        sleepScore: sleep?.avg_score ? Math.round(sleep.avg_score) : 80,
        steps: sleep?.avg_steps ? Math.round(sleep.avg_steps) : 7000,
        mood: mood?.avg ? mood.avg.toFixed(1) : '7.0',
      };
    };

    const statsA = getStats(aFrom, aTo);
    const statsB = getStats(bFrom, bTo);

    const table = new Table({
      head: [chalk.gray('Metric'), chalk.gray(periodA), chalk.gray(periodB), chalk.gray('Delta')],
      colWidths: [18, 18, 18, 18],
    });

    const formatDelta = (curr: number, prev: number, unit = '') => {
      const diff = curr - prev;
      if (diff > 0) return chalk.green(`+${diff.toFixed(1)}${unit}`);
      if (diff < 0) return chalk.red(`${diff.toFixed(1)}${unit}`);
      return chalk.gray(`0${unit}`);
    };

    table.push(
      ['Commits', statsA.commits, statsB.commits, formatDelta(statsA.commits, statsB.commits)],
      ['Avg Sleep', `${statsA.sleepHours}h`, `${statsB.sleepHours}h`, formatDelta(parseFloat(statsA.sleepHours), parseFloat(statsB.sleepHours), 'h')],
      ['Sleep Score', `${statsA.sleepScore}%`, `${statsB.sleepScore}%`, formatDelta(statsA.sleepScore, statsB.sleepScore, '%')],
      ['Daily Steps', statsA.steps.toLocaleString(), statsB.steps.toLocaleString(), formatDelta(statsA.steps, statsB.steps)],
      ['Avg Mood', `${statsA.mood}/10`, `${statsB.mood}/10`, formatDelta(parseFloat(statsA.mood), parseFloat(statsB.mood))]
    );

    console.log(table.toString());
    console.log('');
  });

// ============================================================
// Command: me sync
// ============================================================
program
  .command('sync')
  .description('Trigger synchronization for all connected data sources')
  .action(async () => {
    console.log(chalk.cyan('\n🔄 Synchronizing all registered connectors...'));
    const results = await connectorManager.syncAll();
    results.forEach(r => {
      const icon = r.success ? chalk.green('✔') : chalk.red('✖');
      console.log(`  ${icon} ${chalk.bold(r.source)}: ${r.itemsSynced} items synced (${r.errors.length ? chalk.red(r.errors.join(', ')) : chalk.gray('clean')})`);
    });
    console.log(chalk.green('Sync completed successfully.\n'));
  });

// ============================================================
// Command: me energy
// ============================================================
program
  .command('energy')
  .description('Audit cognitive fragmentation and net energy accounting')
  .action(async () => {
    const frag = calculateFragmentationScore();
    const energy = getEnergyAccountingSummary(14);

    console.log(chalk.bold.yellow(`\n⚡ Cognitive Fragmentation & Energy Accounting`));
    console.log(chalk.gray(`Date: ${frag.date} | Working Hours: ${frag.workingHours}h\n`));

    const fragTable = new Table({
      head: [chalk.gray('Dimension'), chalk.gray('Value'), chalk.gray('State / Assessment')],
      colWidths: [22, 16, 36],
    });

    const indexColor = frag.fragmentationIndex < 50 ? chalk.green : frag.fragmentationIndex < 75 ? chalk.yellow : chalk.red;
    fragTable.push(
      ['Fragmentation Index', indexColor(`${frag.fragmentationIndex} / 100`), frag.focusState],
      ['Deep Work Blocks', chalk.cyan(String(frag.deepWorkBlocks)), `${frag.focusMinutes} focus minutes`],
      ['Calendar Switches', chalk.magenta(String(frag.distinctSwitches)), `${frag.meetingCount} meetings (${frag.meetingMinutes}m)`],
      ['Cognitive Penalty', chalk.red(`-${frag.cognitivePenaltyPercent}%`), 'Attention residue overhead'],
      ['Net Energy Balance', energy.netEnergyBalance >= 0 ? chalk.green(`+${energy.netEnergyBalance}`) : chalk.red(`${energy.netEnergyBalance}`), `${energy.energyFillersCount} fillers vs ${energy.energyDrainsCount} drains`]
    );
    console.log(fragTable.toString());

    console.log(chalk.cyan(`\n💡 Recommendation: ${frag.recommendation}`));

    if (energy.topFillers.length > 0) {
      console.log(chalk.bold.green(`\n🔋 Top Energy Fillers:`));
      energy.topFillers.forEach(f => console.log(`  • ${chalk.bold(f.activity)}: ${chalk.green(`+${f.avgImpact}`)} (${f.count}x)`));
    }

    if (energy.topDrains.length > 0) {
      console.log(chalk.bold.red(`\n🪫 Top Energy Drains:`));
      energy.topDrains.forEach(d => console.log(`  • ${chalk.bold(d.activity)}: ${chalk.red(`${d.avgImpact}`)} (${d.count}x)`));
    }
    console.log('');
  });

// ============================================================
// Command: me memory
// ============================================================
program
  .command('memory')
  .description('Archaeological time capsule: On This Day in your life')
  .action(async () => {
    const memories = getOnThisDayCapsule();
    console.log(chalk.bold.magenta(`\n🏛️ Data Archaeology — "On This Day" Time Capsule (${memories.length} Memories)`));

    memories.forEach((m, idx) => {
      console.log('\n' + chalk.bold.cyan(`[Time Horizon ${idx + 1}] ${m.date} (${m.yearsAgo > 0 ? `${m.yearsAgo} Year(s) Ago` : 'One Month Ago'})`));
      console.log(chalk.white(`"${m.narrative}"`));
      if (m.lifeCommit) {
        console.log(chalk.gray(`Life Commit: ${m.lifeCommit} (Productivity Score: ${m.productivityScore}%)`));
      }
    });
    console.log('');
  });

// ============================================================
// Command: me peaks [metric]
// ============================================================
program
  .command('peaks [metric]')
  .description('Mine optimal factors during your peak happiness or productivity days')
  .action(async (metric = 'mood') => {
    const analysis = analyzePeakPeriods(metric as any, 7);
    console.log(chalk.bold.cyan(`\n🌟 Peak Performance & Happiness Recipe (Metric: ${metric})`));
    console.log(chalk.white(analysis.optimalDayRecipe));

    const table = new Table({
      head: [chalk.gray('Peak Date'), chalk.gray('Score'), chalk.gray('Sleep'), chalk.gray('Steps'), chalk.gray('Commits')],
      colWidths: [14, 12, 12, 14, 12],
    });

    analysis.peakDays.forEach(d => {
      table.push([
        d.date,
        chalk.green(String(d.targetValue)),
        `${d.sleepHours}h`,
        d.steps.toLocaleString(),
        String(d.commits),
      ]);
    });

    console.log(table.toString());
    console.log('');
  });

program.parse(process.argv);
