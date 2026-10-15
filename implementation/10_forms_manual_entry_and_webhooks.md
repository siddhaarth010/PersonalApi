# 📝 Step 10: Forms, Manual Entry & Inbound Webhooks

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Forms, Streak Hooks, Inbound Webhooks & Audit History)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
1. Provide zero-friction subjective logging for metrics that cannot be automatically captured via API (energy audit, mood, gratitude, symptoms).
2. Enable external third-party services and iOS Shortcuts to push real-time events via inbound webhooks.

---

## 🖊️ 1. Interactive Check-In Forms

Implemented on the dashboard (`dashboard/src/App.tsx`) and via API:
- **`POST /api/v1/entries`** payload:
```json
{
  "type": "mood",
  "value": 8,
  "label": "Evening reflection",
  "notes": "Had a fantastic coding flow session after working out",
  "tags": ["flow", "gym", "deep-work"]
}
```
Logging an entry automatically advances the corresponding consecutive streak.

---

## 🔔 2. Inbound Webhook Listener (`POST /api/v1/webhooks/:source`)

Permits real-time data push from:
1. **iOS Shortcuts / Automations**: When wake alarm dismisses, push sleep duration and wake time.
2. **GitHub Webhooks**: Instant notification of commits/PR merges instead of polling.
3. **Telegram Bot Webhooks**: Direct check-in via mobile chat.

Audit history is exposed at `GET /api/v1/webhooks/history`.

---

## 🧪 Verification & Checklist
- [x] Submitting quick check-in from dashboard saves to database and refreshes charts.
- [x] Add generic webhook route `POST /api/v1/webhooks/:source`.
- [x] Test pushing an event from curl or Postman.

---

## 🔮 Advanced Enhancements & Additions

### 1. Cryptographic HMAC Webhook Verification
Guard inbound webhook listeners against spoofed payloads:
```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```
Support native signatures for GitHub (`X-Hub-Signature-256`) and custom API signature tokens for mobile shortcuts.

### 2. Pre-Packaged iOS Shortcuts Templates
Provide ready-to-install Apple Shortcuts for seamless mobile logging:
- **Morning Wakeup Shortcut**: Triggered automatically when bedtime alarm turns off; extracts Apple Health sleep metrics and pushes them to `POST /api/v1/webhooks/apple-health`.
- **Quick Voice Reflection**: Dictate a 30-second audio journal entry; Siri converts to text and posts to `POST /api/v1/entries` with tags `['voice', 'reflection']`.
- **Evening Checklist Widget**: 3-tap widget on the iOS lock screen logging mood (1-10), energy (1-10), and workout completion.

### 3. Rich Schema Tagging & Qualitative Journaling
Expand manual entry fields beyond numerical 1–10 scores:
- **Symptoms & Bio-markers**: `tags: ['headache', 'caffeine-late', 'fasting', 'sauna']`.
- **Structured Gratitude Prompt**: Morning 3 things grateful for / Evening 1 win.
- Correlate tags against next-day sleep and cognitive scores.

