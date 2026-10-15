import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import {
  Activity, GitCommit, Music, Brain, Flame, Target,
  Zap, Heart, RefreshCw, ChevronRight, Plus,
  Sparkles, Radio, TrendingUp, AlertTriangle, Lightbulb,
  BarChart3, Moon, BookOpen, Clock, Calendar as CalendarIcon, ShieldCheck,
  Gauge, History, Layers
} from 'lucide-react'
import { api } from './api'
import './App.css'

interface DashboardData {
  me: any;
  moodAverages: any;
  energyAverages: any;
  sla: any;
  fragmentation: any;
  energyAccounting: any;
  onThisDay: any;
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [moodValue, setMoodValue] = useState<number | null>(null)
  const [energyValue, setEnergyValue] = useState<number | null>(null)
  const [entryNotes, setEntryNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [me, moodAverages, energyAverages, sla, fragmentation, energyAccounting, onThisDay] = await Promise.all([
        api.getMe(),
        api.getAverages('mood'),
        api.getAverages('energy'),
        api.getSla(30).catch(() => null),
        api.getFragmentation().catch(() => null),
        api.getEnergyAccounting(7).catch(() => null),
        api.getOnThisDay().catch(() => null),
      ])
      setData({ me, moodAverages, energyAverages, sla, fragmentation, energyAccounting, onThisDay })
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncAll()
      await fetchData()
    } catch { /* ignore sync errors */ }
    setSyncing(false)
  }

  const handleSubmitEntry = async () => {
    if (!moodValue && !energyValue) return
    setSubmitting(true)

    try {
      const entries: any[] = []
      if (moodValue) {
        entries.push({ type: 'mood', value: moodValue, label: 'Dashboard entry', notes: entryNotes || undefined })
      }
      if (energyValue) {
        entries.push({ type: 'energy', value: energyValue, label: 'Dashboard entry', notes: entryNotes || undefined })
      }

      for (const entry of entries) {
        await api.addEntry(entry)
      }

      setMoodValue(null)
      setEnergyValue(null)
      setEntryNotes('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2000)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading your life data...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="loading-container">
        <p style={{ fontSize: '2rem' }}>⚠️</p>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Connection Error</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 400, textAlign: 'center' }}>
          {error}. Make sure the API server is running on port 3001.
        </p>
        <button className="btn btn-primary" onClick={fetchData}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const me = data!.me
  const streaks = me.streaks || []
  const goals = me.goals || []
  const insights = me.insights || []
  const sources = me.sources || []
  const commits = me.today?.productivity?.recent_commits || []
  const topLanguages = me.today?.productivity?.top_languages || []
  const recentTracks = me.today?.media?.recent_tracks || []
  const topArtists = me.today?.media?.top_artists || []
  const moodTrend = data!.moodAverages?.daily_trend || []
  const energyTrend = data!.energyAverages?.daily_trend || []
  const slaReport = data!.sla || me.sla
  const frag = data!.fragmentation || { fragmentationIndex: 28, focusState: 'focused', deepWorkBlocks: 3, distinctSwitches: 4, cognitivePenaltyPercent: 12 }
  const energyAcc = data!.energyAccounting || { netBalance: 6, topFillers: [], topDrains: [] }
  const timeCapsule = data!.onThisDay || { memories: [] }

  // Build chart data by merging mood and energy trends
  const chartData = moodTrend.map((m: any, i: number) => ({
    date: m.date?.slice(5) || '',
    mood: Number(m.avg_value?.toFixed(1)) || 0,
    energy: energyTrend[i] ? Number(energyTrend[i].avg_value?.toFixed(1)) || 0 : 0,
  }))

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <span className="logo">🧬</span>
            <div>
              <h1>Personal API</h1>
              <span className="subtitle">The Operating System for Your Life</span>
            </div>
          </div>
          <div className="header-actions">
            <div className="header-status">
              <span className="status-dot" />
              <span>{sources.filter((s: any) => s.status === 'connected' || s.status === 'demo').length} sources active</span>
            </div>
            <button className={`btn btn-secondary btn-sm ${syncing ? 'syncing' : ''}`} onClick={handleSync} disabled={syncing}>
              <RefreshCw size={12} className={syncing ? 'spin-icon' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main-content">
        {/* Greeting */}
        <div className="greeting-section animate-in" style={{ marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {greeting} 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 'var(--space-xs)' }}>
            Here's your life at a glance — {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Metric Cards Row */}
        <div className="metric-row animate-in" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="metric-card primary">
            <span className="metric-icon"><GitCommit size={20} /></span>
            <span className="metric-label">Commits Today</span>
            <span className="metric-value">{me.today?.productivity?.commits || 0}</span>
            <span className="metric-sub">{(me.today?.productivity?.active_repos || []).length} active repos</span>
          </div>

          <div className="metric-card secondary">
            <span className="metric-icon"><Heart size={20} /></span>
            <span className="metric-label">Mood</span>
            <span className="metric-value">{me.today?.wellbeing?.mood ?? '—'}</span>
            <span className="metric-sub">out of 10</span>
          </div>

          <div className="metric-card warm">
            <span className="metric-icon"><Zap size={20} /></span>
            <span className="metric-label">Energy</span>
            <span className="metric-value">{me.today?.wellbeing?.energy ?? '—'}</span>
            <span className="metric-sub">out of 10</span>
          </div>

          <div className="metric-card success">
            <span className="metric-icon"><Music size={20} /></span>
            <span className="metric-label">Tracks Played</span>
            <span className="metric-value">{me.today?.media?.total_tracks_played || 0}</span>
            <span className="metric-sub">all time</span>
          </div>

          <div className="metric-card primary" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
            <span className="metric-icon"><Moon size={20} /></span>
            <span className="metric-label">Sleep & Recovery</span>
            <span className="metric-value">{me.today?.health?.sleep_hours ?? 7.4}h</span>
            <span className="metric-sub">Score: {me.today?.health?.sleep_score ?? 84}/100 · HRV: {me.today?.health?.hrv_rmssd ?? 68}ms</span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">

          {/* Mood & Energy Trend Chart */}
          <div className="card span-8 animate-in">
            <div className="card-header">
              <span className="card-title"><TrendingUp size={14} /> Mood & Energy — 30 Day Trend</span>
              <div className="tab-group">
                {(['today', 'week', 'month'] as const).map(p => (
                  <button
                    key={p}
                    className={`tab-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              <div className="chart-container" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6c5ce7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00cec9" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#00cec9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#1e1e2a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      }}
                    />
                    <Area type="monotone" dataKey="mood" stroke="#6c5ce7" fill="url(#moodGradient)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="energy" stroke="#00cec9" fill="url(#energyGradient)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📊</span>
                <p>No trend data yet. Log some mood & energy entries!</p>
              </div>
            )}
          </div>

          {/* Quick Entry */}
          <div className="card span-4 animate-in">
            <div className="card-header">
              <span className="card-title"><Plus size={14} /> Quick Check-in</span>
            </div>

            <div className="entry-form">
              <div className="form-group">
                <label className="form-label"><Heart size={10} /> Mood (1-10)</label>
                <div className="mood-scale">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <button
                      key={v}
                      className={`mood-btn ${moodValue === v ? 'selected' : ''}`}
                      onClick={() => setMoodValue(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label"><Zap size={10} /> Energy (1-10)</label>
                <div className="mood-scale">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <button
                      key={v}
                      className={`mood-btn ${energyValue === v ? 'selected' : ''}`}
                      onClick={() => setEnergyValue(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="How are you feeling?"
                  value={entryNotes}
                  onChange={e => setEntryNotes(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSubmitEntry}
                disabled={submitting || (!moodValue && !energyValue)}
                style={{ width: '100%' }}
              >
                {submitted ? '✅ Logged!' : submitting ? 'Saving...' : 'Log Entry'}
              </button>
            </div>
          </div>

          {/* Insights */}
          <div className="card span-6 animate-in">
            <div className="card-header">
              <span className="card-title"><Sparkles size={14} /> AI Insights</span>
              <span className="card-badge badge-live">Live</span>
            </div>
            {insights.length > 0 ? (
              <div className="insight-list">
                {insights.map((insight: any, i: number) => (
                  <div key={i} className={`insight-item ${insight.type}`}>
                    <span className="insight-icon">
                      {insight.type === 'correlation' ? <Brain size={16} /> :
                       insight.type === 'anomaly' ? <AlertTriangle size={16} /> :
                       <Lightbulb size={16} />}
                    </span>
                    <div>
                      <p className="insight-message">{insight.message}</p>
                      {insight.confidence && (
                        <p className="insight-confidence">Confidence: {Math.round(insight.confidence * 100)}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🧠</span>
                <p>Insights will appear as more data is collected</p>
              </div>
            )}
          </div>

          {/* Streaks */}
          <div className="card span-3 animate-in">
            <div className="card-header">
              <span className="card-title"><Flame size={14} /> Streaks</span>
            </div>
            {streaks.length > 0 ? (
              <div className="streak-list">
                {streaks.map((streak: any, i: number) => (
                  <div key={i} className="streak-item">
                    <span className="streak-name">
                      {streak.current_count >= streak.best_count && streak.current_count > 5 ? (
                        <span className="streak-fire">🔥 </span>
                      ) : null}
                      {streak.name}
                    </span>
                    <div className="streak-counts">
                      <span className="streak-current">{streak.current_count}d</span>
                      <span className="streak-best">best: {streak.best_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🔥</span>
                <p>Start logging to build streaks</p>
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="card span-3 animate-in">
            <div className="card-header">
              <span className="card-title"><Target size={14} /> Goals</span>
            </div>
            {goals.length > 0 ? (
              <div className="goal-list">
                {goals.map((goal: any, i: number) => {
                  const progress = Math.min(100, (goal.current_value / goal.target_value) * 100)
                  const status = progress >= 90 ? 'ahead' : progress >= 60 ? 'on-track' : 'behind'
                  return (
                    <div key={i} className="goal-item">
                      <div className="goal-header">
                        <span className="goal-name">{goal.name}</span>
                        <span className="goal-progress-text">
                          {goal.current_value}/{goal.target_value} {goal.unit}
                        </span>
                      </div>
                      <div className="goal-bar">
                        <div
                          className={`goal-bar-fill ${status}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🎯</span>
                <p>No goals set yet</p>
              </div>
            )}
          </div>

          {/* Personal SLA Uptime Engine */}
          <div className="card span-12 animate-in" style={{ gridColumn: 'span 12' }}>
            <div className="card-header">
              <span className="card-title">
                <ShieldCheck size={16} /> Personal SLA — High Availability Life Monitor (30 Days)
              </span>
              <span className={`sla-status-badge ${slaReport?.overallStatus || 'operational'}`}>
                ● {slaReport?.overallUptime ?? 88.5}% Uptime · {(slaReport?.overallStatus || 'operational').toUpperCase()}
              </span>
            </div>
            <div className="sla-grid">
              {(slaReport?.slas || []).map((slaItem: any) => (
                <div key={slaItem.id} className="sla-item">
                  <div className="sla-header">
                    <span className="sla-name">{slaItem.name}</span>
                    <span className={`sla-pct ${slaItem.status}`}>{slaItem.uptimePercentage}%</span>
                  </div>
                  <span className="sla-desc">{slaItem.thresholdDescription} ({slaItem.daysMet}/{slaItem.totalDays}d)</span>
                  <div className="sla-bar-bg">
                    <div
                      className={`sla-bar-fill ${slaItem.status}`}
                      style={{ width: `${Math.min(100, slaItem.uptimePercentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extended Sources Telemetry */}
          <div className="card span-12 animate-in" style={{ gridColumn: 'span 12' }}>
            <div className="card-header">
              <span className="card-title">
                <Activity size={16} /> Extended Telemetry — Deep Work, Schedule & Reading
              </span>
              <span className="card-badge badge-demo">Multi-Domain</span>
            </div>
            <div className="telemetry-pills">
              <div className="telemetry-pill">
                <div className="telemetry-pill-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                  <Clock size={18} />
                </div>
                <div className="telemetry-pill-info">
                  <h4>WakaTime Coding</h4>
                  <p>{me.today?.productivity?.coding_hours ?? 4.8}h active coding today</p>
                </div>
              </div>

              <div className="telemetry-pill">
                <div className="telemetry-pill-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <CalendarIcon size={18} />
                </div>
                <div className="telemetry-pill-info">
                  <h4>Google Calendar</h4>
                  <p>{me.today?.productivity?.meeting_count ?? 2} meetings · {me.today?.productivity?.focus_minutes ?? 120}m focus block</p>
                </div>
              </div>

              <div className="telemetry-pill">
                <div className="telemetry-pill-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
                  <BookOpen size={18} />
                </div>
                <div className="telemetry-pill-info">
                  <h4>Readwise & Kindle</h4>
                  <p>{me.today?.learning?.pages_read_today ?? 28} pages read · {me.today?.learning?.reading_streak_days ?? 14}d reading streak</p>
                </div>
              </div>

              <div className="telemetry-pill">
                <div className="telemetry-pill-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  <Activity size={18} />
                </div>
                <div className="telemetry-pill-info">
                  <h4>Daily Movement</h4>
                  <p>{me.today?.health?.steps ?? 7500} steps · {me.today?.health?.active_calories ?? 420} active kcal</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cognitive Energy & Time Capsule Engine */}
          <div className="card span-12 animate-in" style={{ gridColumn: 'span 12' }}>
            <div className="card-header">
              <span className="card-title">
                <Gauge size={16} /> Cognitive Energy & Retrospective Engine
              </span>
              <span className={`card-badge ${frag.focusState === 'flow' || frag.focusState === 'focused' ? 'badge-live' : 'badge-demo'}`}>
                Focus: {(frag.focusState || 'focused').toUpperCase()}
              </span>
            </div>
            
            <div className="energy-arch-grid">
              {/* Context Switching & Fragmentation Meter */}
              <div className="energy-meter-card">
                <div className="meter-header">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <Layers size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Context-Switching Fragmentation
                  </span>
                  <span className={`meter-badge ${frag.fragmentationIndex < 35 ? 'optimal' : frag.fragmentationIndex < 65 ? 'moderate' : 'high'}`}>
                    {frag.fragmentationIndex < 35 ? 'Optimal Flow' : frag.fragmentationIndex < 65 ? 'Moderate Friction' : 'High Friction'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span className="meter-score">{frag.fragmentationIndex ?? 28}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>/ 100 Index</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#ff7675' }}>
                    -{frag.cognitivePenaltyPercent ?? 10}% Cognitive Tax
                  </span>
                </div>

                <div className="sla-bar-bg" style={{ marginTop: 2 }}>
                  <div
                    className="sla-bar-fill"
                    style={{
                      width: `${Math.min(100, frag.fragmentationIndex ?? 28)}%`,
                      background: frag.fragmentationIndex < 35 ? '#55efc4' : frag.fragmentationIndex < 65 ? '#ffeaa7' : '#ff7675'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>🎯 {frag.deepWorkBlocks ?? 3} Deep Work Blocks</span>
                  <span>🔀 {frag.distinctSwitches ?? 4} Context Shifts</span>
                </div>
              </div>

              {/* Energy Accounting Model */}
              <div className="energy-meter-card">
                <div className="meter-header">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <Zap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Energy Balance Accounting
                  </span>
                  <span className="meter-badge optimal" style={{
                    color: (energyAcc.netBalance ?? 0) >= 0 ? '#55efc4' : '#ff7675',
                    background: (energyAcc.netBalance ?? 0) >= 0 ? 'rgba(85, 239, 196, 0.15)' : 'rgba(255, 118, 117, 0.15)'
                  }}>
                    {(energyAcc.netBalance ?? 0) >= 0 ? `+${energyAcc.netBalance} Surplus` : `${energyAcc.netBalance} Deficit`}
                  </span>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Top Fillers & Drains (Past 7 Days):
                </div>

                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: '0.72rem', color: '#55efc4', fontWeight: 600 }}>🔋 FILLERS</div>
                  <div className="tag-cloud">
                    {(energyAcc.topFillers || []).slice(0, 3).map((f: any, idx: number) => (
                      <span key={idx} className="filler-tag">+{f.netImpact} {f.activity}</span>
                    ))}
                    {(!energyAcc.topFillers || energyAcc.topFillers.length === 0) && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Deep coding, morning walk</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: '0.72rem', color: '#ff7675', fontWeight: 600 }}>⚡ DRAINS</div>
                  <div className="tag-cloud">
                    {(energyAcc.topDrains || []).slice(0, 3).map((d: any, idx: number) => (
                      <span key={idx} className="drain-tag">{d.netImpact} {d.activity}</span>
                    ))}
                    {(!energyAcc.topDrains || energyAcc.topDrains.length === 0) && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Late night doomscrolling</span>
                    )}
                  </div>
                </div>
              </div>

              {/* On This Day Time Capsule */}
              <div className="memory-capsule-card">
                <div className="meter-header">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b' }}>
                    <History size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    On This Day — Time Capsule
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                    {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {timeCapsule?.memories && timeCapsule.memories.length > 0 ? (
                  <div className="memory-item">
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {timeCapsule.memories[0].title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {timeCapsule.memories[0].summary || 'Historical milestones recorded across productivity & wellbeing.'}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <p>✨ <strong>Personal Archeology Active:</strong></p>
                    <p style={{ marginTop: 4 }}>Every day logged builds an enduring digital chronicle. Historical milestones and peak retrospectives automatically resurface on future anniversaries.</p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Recent Commits */}
          <div className="card span-6 animate-in">
            <div className="card-header">
              <span className="card-title"><GitCommit size={14} /> Recent Commits</span>
              <span className="card-badge badge-demo">{commits.length} today</span>
            </div>
            {commits.length > 0 ? (
              <div className="commit-list">
                {commits.slice(0, 8).map((commit: any, i: number) => (
                  <div key={i} className="commit-item">
                    <span className="commit-sha">{commit.sha}</span>
                    <div className="commit-info">
                      <p className="commit-message">{commit.message}</p>
                      <p className="commit-meta">{commit.repo} · {new Date(commit.committed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">💻</span>
                <p>No commits today. Time to code!</p>
              </div>
            )}
          </div>

          {/* Top Languages */}
          <div className="card span-6 animate-in">
            <div className="card-header">
              <span className="card-title"><BarChart3 size={14} /> Top Languages</span>
            </div>
            {topLanguages.length > 0 ? (
              <div className="chart-container" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLanguages} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="language" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#1e1e2a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                      }}
                    />
                    <Bar dataKey="count" fill="#6c5ce7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📝</span>
                <p>No language data yet</p>
              </div>
            )}
          </div>

          {/* Music / Spotify */}
          <div className="card span-6 animate-in">
            <div className="card-header">
              <span className="card-title"><Music size={14} /> Recently Played</span>
              <span className="card-badge badge-demo">Spotify</span>
            </div>
            {recentTracks.length > 0 ? (
              <div className="track-list">
                {recentTracks.slice(0, 8).map((track: any, i: number) => (
                  <div key={i} className="track-item">
                    <span className="track-rank">{i + 1}</span>
                    <div className="track-info">
                      <p className="track-name">{track.track_name}</p>
                      <p className="track-artist">{track.artist_name}</p>
                    </div>
                    <span className="track-time">
                      {new Date(track.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🎵</span>
                <p>Connect Spotify to see your listening history</p>
              </div>
            )}
          </div>

          {/* Top Artists */}
          <div className="card span-6 animate-in">
            <div className="card-header">
              <span className="card-title"><Radio size={14} /> Top Artists</span>
              <span className="card-badge badge-demo">This Month</span>
            </div>
            {topArtists.length > 0 ? (
              <div className="track-list">
                {topArtists.map((artist: any, i: number) => (
                  <div key={i} className="track-item">
                    <span className="track-rank" style={{
                      color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : undefined,
                      fontWeight: i < 3 ? 700 : 400
                    }}>
                      {i + 1}
                    </span>
                    <div className="track-info">
                      <p className="track-name">{artist.name}</p>
                      <p className="track-artist">Popularity: {artist.popularity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🎤</span>
                <p>Connect Spotify to see top artists</p>
              </div>
            )}
          </div>

          {/* Data Sources */}
          <div className="card span-full animate-in">
            <div className="card-header">
              <span className="card-title"><Activity size={14} /> Connected Sources</span>
              <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw size={12} className={syncing ? 'spin-icon' : ''} /> Sync All
              </button>
            </div>
            <div className="source-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-sm)' }}>
              {sources.map((source: any, i: number) => (
                <div key={i} className="source-item">
                  <div className="source-info">
                    <span className={`source-dot ${source.status}`} />
                    <div>
                      <p className="source-name">{source.name}</p>
                      <p className="source-meta">
                        {source.last_synced_at
                          ? `Last synced: ${new Date(source.last_synced_at).toLocaleString()}`
                          : 'Never synced'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: 'var(--space-xl)',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '0.75rem',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <p>🧬 Personal API v1.0.0 — You own your data. You are the platform.</p>
      </footer>
    </div>
  )
}

export default App
