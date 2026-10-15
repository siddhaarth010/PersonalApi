/**
 * Seed Script — Populates the database with realistic demo data
 * 
 * Run with: npm run seed
 * 
 * Creates 30 days of realistic, biologically and behaviorally coupled mock data
 * across coding, music, wearable health, mood, goals, and insights.
 */
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, getDb } from './db/database.js';

initializeDatabase();
const db = getDb();

console.log('🌱 Seeding database with realistic coupled demo data...\n');

// Clear existing data
db.exec('DELETE FROM github_commits');
db.exec('DELETE FROM github_repos');
db.exec('DELETE FROM spotify_recent_tracks');
db.exec('DELETE FROM spotify_top_items');
db.exec('DELETE FROM manual_entries');
db.exec('DELETE FROM life_commits');
db.exec('DELETE FROM streaks');
db.exec('DELETE FROM goals');
db.exec('DELETE FROM insights');
db.exec('DELETE FROM data_sources');
db.exec('DELETE FROM health_metrics');
db.exec('DELETE FROM sync_history');

// ============================================================
// Seed GitHub Repos
// ============================================================
const repos = [
  { name: 'personal-api', language: 'TypeScript', stars: 12, description: 'The operating system for your life' },
  { name: 'dotfiles', language: 'Shell', stars: 5, description: 'My development environment config' },
  { name: 'blog', language: 'MDX', stars: 3, description: 'Personal blog built with Astro' },
  { name: 'ml-experiments', language: 'Python', stars: 8, description: 'Machine learning side projects' },
  { name: 'leetcode-solutions', language: 'TypeScript', stars: 2, description: 'Daily problem solving practice' },
  { name: 'react-components', language: 'TypeScript', stars: 15, description: 'Reusable component library' },
  { name: 'cli-tools', language: 'Rust', stars: 7, description: 'Custom command line utilities' },
];

const repoStmt = db.prepare(`
  INSERT INTO github_repos (id, name, full_name, description, language, stars, forks, is_private, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
`);

repos.forEach((repo, i) => {
  const daysAgo = Math.floor(Math.random() * 14);
  repoStmt.run(
    String(1000 + i),
    repo.name,
    `user/${repo.name}`,
    repo.description,
    repo.language,
    repo.stars,
    new Date(Date.now() - daysAgo * 86400000).toISOString()
  );
});

console.log(`  ✅ Seeded ${repos.length} GitHub repos`);

// Commit messages pool
const commitMessages = [
  'feat: add user dashboard component',
  'fix: resolve dark mode flickering issue',
  'refactor: extract API client into separate module',
  'docs: update README with setup instructions',
  'feat: implement mood tracking endpoint',
  'fix: handle null values in sleep data',
  'chore: update dependencies',
  'feat: add streak tracking logic',
  'style: improve card component spacing',
  'fix: correct timezone offset in date queries',
  'feat: implement Spotify OAuth flow',
  'perf: add database indexes for time queries',
  'test: add unit tests for connectors',
  'feat: add goal progress calculation',
  'fix: prevent duplicate entries on re-sync',
  'feat: build correlation engine prototype',
  'chore: configure ESLint and Prettier',
  'feat: add data export as JSON',
  'fix: handle API rate limiting gracefully',
  'feat: implement life commit generation',
];

const commitStmt = db.prepare(`
  INSERT INTO github_commits (id, repo, message, sha, committed_at)
  VALUES (?, ?, ?, ?, ?)
`);

const healthStmt = db.prepare(`
  INSERT INTO health_metrics (
    id, date, sleep_hours, deep_sleep_hours, rem_sleep_hours,
    sleep_score, resting_hr, hrv_rmssd, steps, active_calories,
    source, raw_json, recorded_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const manualStmt = db.prepare(`
  INSERT INTO manual_entries (id, type, value, label, notes, tags, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const trackStmt = db.prepare(`
  INSERT INTO spotify_recent_tracks 
  (id, track_name, artist_name, album_name, album_image_url, duration_ms, played_at, track_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const tracks = [
  { name: 'Nuvole Bianche', artist: 'Ludovico Einaudi', album: 'In a Time Lapse' },
  { name: 'Experience', artist: 'Ludovico Einaudi', album: 'In a Time Lapse' },
  { name: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming" },
  { name: 'Intro', artist: 'The xx', album: 'xx' },
  { name: 'On the Nature of Daylight', artist: 'Max Richter', album: 'The Blue Notebooks' },
  { name: 'Strobe', artist: 'deadmau5', album: '4x4=12' },
  { name: 'Breathe', artist: 'Télépopmusik', album: 'Genetic World' },
  { name: 'Crystalised', artist: 'The xx', album: 'xx' },
  { name: 'Arrival of the Birds', artist: 'The Cinematic Orchestra', album: 'The Crimson Wing' },
  { name: 'Clair de Lune', artist: 'Claude Debussy', album: 'Suite bergamasque' },
  { name: 'Comptine d\'un autre été', artist: 'Yann Tiersen', album: 'Amelie OST' },
  { name: 'Genesis', artist: 'Grimes', album: 'Visions' },
  { name: 'Resonance', artist: 'HOME', album: 'Odyssey' },
  { name: 'Tadow', artist: 'Masego & FKJ', album: 'Tadow' },
  { name: 'Weightless', artist: 'Marconi Union', album: 'Weightless' },
];

let totalCommits = 0;
let totalEntries = 0;
let totalTracks = 0;

// ============================================================
// Coupled 30-Day Multi-Domain Life Telemetry Simulation
// ============================================================
for (let day = 0; day < 30; day++) {
  const dateObj = new Date(Date.now() - day * 86400000);
  const dateStr = dateObj.toISOString().split('T')[0];

  // 1. Natural cyclical sleep with realistic variation (6.0 - 8.5h)
  const cycle = Math.sin((day / 6) * Math.PI);
  const sleepHours = parseFloat((7.3 + cycle * 0.9 + (Math.random() - 0.5) * 0.6).toFixed(1));
  const deepHours = parseFloat((sleepHours * 0.22 + (Math.random() - 0.5) * 0.2).toFixed(1));
  const remHours = parseFloat((sleepHours * 0.24 + (Math.random() - 0.5) * 0.2).toFixed(1));
  const sleepScore = Math.min(96, Math.max(62, Math.round(50 + (sleepHours / 8.5) * 42 + (Math.random() - 0.5) * 6)));
  const restingHr = Math.round(68 - (sleepScore / 100) * 14 + (Math.random() - 0.5) * 4);
  const hrv = Math.round(40 + (sleepScore / 100) * 35 + (Math.random() - 0.5) * 8);

  // Steps coupled positively with energy/sleep
  const steps = Math.round(4500 + (sleepScore / 100) * 5500 + Math.random() * 2500);
  const activeCalories = Math.round(steps * 0.045 + 150);

  healthStmt.run(
    uuidv4(),
    dateStr,
    sleepHours,
    deepHours,
    remHours,
    sleepScore,
    restingHr,
    hrv,
    steps,
    activeCalories,
    'wearable',
    JSON.stringify({ device: 'Apple Watch Ultra + Oura Ring Gen 3' }),
    dateObj.toISOString()
  );

  // 2. Commits directly correlated with sleep hours & energy (higher sleep -> more coding focus)
  const commitProbability = sleepHours >= 7.0 ? 5 : 2;
  const commitsPerDay = Math.max(0, Math.round(commitProbability + (Math.random() - 0.5) * 2));
  for (let c = 0; c < commitsPerDay; c++) {
    const cDate = new Date(dateObj);
    cDate.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));
    commitStmt.run(
      uuidv4(),
      repos[Math.floor(Math.random() * repos.length)].name,
      commitMessages[Math.floor(Math.random() * commitMessages.length)],
      Math.random().toString(36).substring(2, 9),
      cDate.toISOString()
    );
    totalCommits++;
  }

  // 3. Mood & Energy coupled with sleep quality and activity
  // Energy directly tracks sleep score (r >= 0.70)
  const energyVal = Math.min(10, Math.max(1, Math.round((sleepScore / 100) * 8 + (Math.random() - 0.5) * 1.5 + 1)));
  // Mood tracks daily activity & sleep (r >= 0.55)
  const moodVal = Math.min(10, Math.max(1, Math.round((steps / 12500) * 4 + (energyVal / 10) * 5 + (Math.random() - 0.5) * 1.2)));

  const morningDate = new Date(dateObj);
  morningDate.setHours(8, 30);
  manualStmt.run(uuidv4(), 'mood', moodVal, 'Morning check-in', null, '["morning"]', morningDate.toISOString());

  const eveningDate = new Date(dateObj);
  eveningDate.setHours(21, 0);
  manualStmt.run(uuidv4(), 'mood', Math.min(10, Math.max(1, moodVal + (Math.random() > 0.5 ? 1 : 0))), 'Evening reflection', null, '["evening"]', eveningDate.toISOString());

  const noonDate = new Date(dateObj);
  noonDate.setHours(12, 15);
  manualStmt.run(uuidv4(), 'energy', energyVal, 'Midday energy review', null, '["midday"]', noonDate.toISOString());
  totalEntries += 3;

  // 4. Music listening (focus tracks during heavy coding days)
  const tracksToday = Math.max(2, Math.round(commitsPerDay * 2 + Math.random() * 4));
  for (let t = 0; t < tracksToday; t++) {
    const tDate = new Date(dateObj);
    tDate.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    trackStmt.run(
      uuidv4(),
      track.name,
      track.artist,
      track.album,
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
      240000 + Math.floor(Math.random() * 60000),
      tDate.toISOString(),
      'https://open.spotify.com'
    );
    totalTracks++;
  }
}

console.log(`  ✅ Seeded 30 days of health telemetry`);
console.log(`  ✅ Seeded ${totalCommits} GitHub commits`);
console.log(`  ✅ Seeded ${totalEntries} manual entries (mood & energy)`);
console.log(`  ✅ Seeded ${totalTracks} Spotify tracks`);

// Seed top Spotify items
const topArtistStmt = db.prepare(`
  INSERT INTO spotify_top_items (id, type, name, image_url, genres, popularity, time_range, rank)
  VALUES (?, 'artist', ?, '', ?, ?, ?, ?)
`);

const topArtists = [
  { name: 'Ludovico Einaudi', genres: 'neo-classical, ambient', popularity: 78 },
  { name: 'The xx', genres: 'indie pop, dream pop', popularity: 72 },
  { name: 'Max Richter', genres: 'contemporary classical', popularity: 65 },
  { name: 'M83', genres: 'dream pop, shoegaze', popularity: 69 },
  { name: 'deadmau5', genres: 'progressive house, electro', popularity: 71 },
];

for (const range of ['short_term', 'medium_term', 'long_term']) {
  topArtists.forEach((artist, i) => {
    topArtistStmt.run(`artist-${range}-${i}`, artist.name, artist.genres, artist.popularity, range, i + 1);
  });
}

// ============================================================
// Seed Streaks
// ============================================================
const today = new Date().toISOString().split('T')[0];
const streakStmt = db.prepare(`
  INSERT INTO streaks (id, name, current_count, best_count, last_logged_date)
  VALUES (?, ?, ?, ?, ?)
`);

streakStmt.run(uuidv4(), 'mood', 12, 28, today);
streakStmt.run(uuidv4(), 'energy', 8, 21, today);
streakStmt.run(uuidv4(), 'coding', 23, 23, today);
streakStmt.run(uuidv4(), 'reading', 5, 45, today);
streakStmt.run(uuidv4(), 'exercise', 3, 14, today);
console.log('  ✅ Seeded 5 streaks');

// ============================================================
// Seed Goals
// ============================================================
const goalStmt = db.prepare(`
  INSERT INTO goals (id, name, description, target_value, current_value, unit, period, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
`);

goalStmt.run(uuidv4(), 'Read 24 books', 'Complete 24 books this year', 24, 18, 'books', 'yearly');
goalStmt.run(uuidv4(), 'Exercise 4x/week', 'Workout at least 4 times per week', 4, 3.2, 'sessions', 'weekly');
goalStmt.run(uuidv4(), 'Sleep 7+ hours', 'Average 7+ hours of sleep per night', 7, 6.8, 'hours', 'daily');
goalStmt.run(uuidv4(), 'Commit daily', 'Make at least one GitHub commit every day', 1, 1, 'commits', 'daily');
goalStmt.run(uuidv4(), 'Meditate 10 min/day', 'Daily meditation practice', 10, 7, 'minutes', 'daily');
console.log('  ✅ Seeded 5 goals');

// ============================================================
// Seed Initial Insights
// ============================================================
const insightStmt = db.prepare(`
  INSERT INTO insights (id, type, message, severity, confidence, data_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insightStmt.run(uuidv4(), 'correlation', 'Productivity is 40% higher on days with 7+ hours of sleep', 'info', 0.89, '{}');
insightStmt.run(uuidv4(), 'correlation', 'Sleep quality score directly predicts energy levels (+35% boost)', 'info', 0.84, '{}');
insightStmt.run(uuidv4(), 'anomaly', 'Daily steps peaked above 12,000 yesterday', 'info', 0.92, '{}');
insightStmt.run(uuidv4(), 'prediction', 'At current pace, you will finish 22 books this year (goal: 24). Read 15 more minutes daily to stay on track.', 'info', 0.85, '{}');
console.log('  ✅ Seeded initial insights');

// ============================================================
// Seed Life Commits
// ============================================================
const lifeCommitStmt = db.prepare(`
  INSERT INTO life_commits (id, date, summary, details_json, mood_avg, energy_avg, productivity_score)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 0; day < 7; day++) {
  const date = new Date(Date.now() - day * 86400000).toISOString().split('T')[0];
  const mood = (6.5 + Math.random() * 2).toFixed(1);
  const energy = (6.0 + Math.random() * 2).toFixed(1);
  const productivity = Math.round(65 + Math.random() * 30);
  const commits = Math.floor(Math.random() * 6) + 2;

  lifeCommitStmt.run(
    uuidv4(),
    date,
    `${commits} commits, mood ${mood}/10, energy ${energy}/10. Productivity: ${productivity}%.`,
    JSON.stringify({ commits, tracks_played: Math.floor(Math.random() * 10) + 4 }),
    parseFloat(mood),
    parseFloat(energy),
    productivity
  );
}
console.log('  ✅ Seeded 7 life commits');

// ============================================================
// Seed Data Sources
// ============================================================
db.prepare("INSERT INTO data_sources (id, name, type, status, last_synced_at) VALUES ('github', 'GitHub', 'productivity', 'connected', datetime('now'))").run();
db.prepare("INSERT INTO data_sources (id, name, type, status, last_synced_at) VALUES ('spotify', 'Spotify', 'media', 'demo', datetime('now'))").run();
db.prepare("INSERT INTO data_sources (id, name, type, status) VALUES ('manual', 'Manual Entry', 'manual', 'connected')").run();
db.prepare("INSERT INTO data_sources (id, name, type, status, last_synced_at) VALUES ('health', 'Wearable Health', 'health', 'connected', datetime('now'))").run();

console.log('  ✅ Seeded 4 data sources\n');
console.log('🎉 Database re-seeded with realistic life correlations!');
