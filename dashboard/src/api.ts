const API_BASE = 'http://localhost:3001/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Core
  getMe: () => request<any>('/me'),
  getSummary: (period: string) => request<any>(`/me/summary?period=${period}`),
  getHealth: () => request<any>('/health'),

  // Productivity
  getCode: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/productivity/code?${params}`);
  },
  getCommits: (limit = 20) => request<any>(`/productivity/code/commits?limit=${limit}`),
  getRepos: () => request<any>('/productivity/code/repos'),

  // Media
  getMusic: () => request<any>('/media/music'),
  getRecentTracks: (limit = 20) => request<any>(`/media/music/recent?limit=${limit}`),
  getTopItems: (type: string, timeRange: string) =>
    request<any>(`/media/music/top?type=${type}&time_range=${timeRange}`),

  // Entries
  addEntry: (data: { type: string; value: number; label?: string; notes?: string; tags?: string[] }) =>
    request<any>('/entries', { method: 'POST', body: JSON.stringify(data) }),
  getEntries: (type?: string, limit = 20) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    params.set('limit', String(limit));
    return request<any>(`/entries?${params}`);
  },
  getAverages: (type: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/entries/averages/${type}?${params}`);
  },

  // Streaks & Goals
  getStreaks: () => request<any>('/streaks'),
  getGoals: () => request<any>('/goals'),
  addGoal: (data: { name: string; target_value: number; unit: string; period?: string; description?: string }) =>
    request<any>('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id: string, data: { current_value?: number; status?: string }) =>
    request<any>(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Insights
  getInsights: () => request<any>('/insights'),
  dismissInsight: (id: string) =>
    request<any>(`/insights/${id}/dismiss`, { method: 'PATCH' }),

  // Sources
  getSources: () => request<any>('/sources'),
  syncSource: (id: string) => request<any>(`/sources/${id}/sync`, { method: 'POST' }),
  syncAll: () => request<any>('/sources/sync-all', { method: 'POST' }),

  // Life Commits
  getLifeCommits: (limit = 7) => request<any>(`/life-commits?limit=${limit}`),

  // Analytics & SLA
  getSla: (days = 30) => request<any>(`/analytics/sla?days=${days}`),

  // Wearable Health & Secondary Connectors
  getHealthToday: () => request<any>('/health-metrics/today'),
  getWakaTime: () => request<any>('/productivity/wakatime'),
  getCalendar: () => request<any>('/productivity/calendar'),
  getReadwise: () => request<any>('/learning/readwise'),

  // Phase 5: Advanced Dimensions (Energy & Archaeology)
  getFragmentation: () => request<any>('/analytics/fragmentation'),
  getEnergyAccounting: (days = 14) => request<any>(`/analytics/energy-accounting?days=${days}`),
  logEnergyTransaction: (data: { activity: string; impact: number; category?: string; tags?: string[] }) =>
    request<any>('/analytics/energy-transactions', { method: 'POST', body: JSON.stringify(data) }),
  getOnThisDay: () => request<any>('/archaeology/on-this-day'),
  getPeakPatterns: (metric = 'mood') => request<any>(`/archaeology/peaks?metric=${metric}`),
};
