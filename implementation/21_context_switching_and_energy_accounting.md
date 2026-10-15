# 🔋 Step 21: Context-Switching & Energy Accounting

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
1. Quantify the hidden cognitive toll of fragmented work by calculating a **Context Switching Fragmentation Score**.
2. Introduce **Energy Accounting**: tracking not just time, but whether activities fill your emotional energy tank or drain it.

---

## 🧩 1. Context Switching Fragmentation Score

Measures calendar and task fragmentation throughout the day:

### Metrics:
- **Number of Distinct Switches**: Context changes between coding, meetings, and email.
- **Deep Work Blocks**: Continuous blocks $\ge 90$ minutes without interruptions.
- **Fragmentation Index ($0 - 100$)**:
  $$\text{Fragmentation Index} = \min\left(100, \frac{\text{Interrupted Blocks} \times 15}{\text{Total Working Hours}}\right)$$

---

## ⚡ 2. Energy Accounting Model

Track whether activities were **Energy-Giving (+)** or **Energy-Draining (-)**:

```typescript
export interface EnergyTransaction {
  id: string;
  activity: string;       // '1-on-1 meeting', 'System design', 'Debugging race condition'
  impact: number;         // Range from -5 (draining) to +5 (energizing)
  timestamp: string;
  tags: string[];
}
```

### Insight Discovery:
- *"Writing greenfield features boosts energy by +3.2 on average."*
- *"Back-to-back status syncs cause an average energy drop of -4.1."*

---

## 🧪 Verification & Checklist
- [x] Implement fragmentation algorithm based on calendar events.
- [x] Add energy tag options in check-in form.
- [x] Surface Net Energy Balance chart on the dashboard.

---

## 🔮 Advanced Enhancements & Additions

### 1. Interruption Penalty & Focus Recovery Decay Curve
Incorporate empirical cognitive psychology research (Gloria Mark, UC Irvine):
- Every context switch incurs an average **23-minute focus re-acquisition penalty**.
- Calculate **True Focus Deficit**: If an 8-hour workday contains 6 isolated 30-minute meetings, the actual lost productive time is:
  $$\text{Lost Time} = 6 \times 30\text{m (meeting)} + 6 \times 23\text{m (refocus penalty)} = 318\text{ minutes (5.3 hours!)}$$
- Highlight "swiss cheese" calendar days where total working blocks between meetings are too short to enter flow state ($< 45$ min).

### 2. Automated Financial & Time "Cost of Meetings" Audit
Quantify meeting drag in executive dollar and energy terms:
- Calculate hourly wage or focus valuation ($/hr).
- Expose `GET /api/v1/analytics/meeting-audit` displaying:
  * Total meeting hours this month.
  * Estimated cognitive cost penalty.
  * Top recurrent meetings causing negative energy transactions.

### 3. Chronotype-Aligned Energy Scheduling
Correlate personal energy accounting logs with time of day:
- Map peak cognitive energy windows (e.g. 09:30–12:00 = Peak creative flow; 14:00–15:30 = Trough; 16:30–18:00 = Second wind).
- Proactively flag calendar invites scheduled during your documented peak deep work zones.


