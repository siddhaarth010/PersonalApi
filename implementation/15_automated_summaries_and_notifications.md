# 📬 Step 15: Automated Summaries & Notification Dispatcher

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Generate daily morning briefings and weekly retrospective digests, then dispatch them automatically to Telegram, Discord, or Email webhooks.

---

## 🌅 Morning Briefing Template

Sent at 08:00 AM daily:
```markdown
🌅 Good morning, Haris! Here is your daily life brief:

😴 Sleep: 7.4 hours (82% quality score, +0.4h above baseline)
🏋️ Yesterday's Workout: 45 min Upper Body ✅
💻 Coding: 6 commits across 5 repos (23-day streak 🔥)
🎯 Daily Goal: Meditate 10 min & review 30 Anki cards
💡 Insight: You write 40% more code when exercising before noon.

Have a productive day!
```

---

## 📡 Dispatch Channels

1. **Telegram Bot API**: Instant push notification on your phone.
2. **Discord Webhook**: Post to a private personal `#life-feed` channel.
3. **Email (Nodemailer / Resend)**: Clean weekly Sunday summary email.

---

## 💻 Implementation (`src/notifications/dispatcher.ts`)

```typescript
export async function sendTelegramBriefing(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}
```

---

## 🧪 Verification & Checklist
- [x] Build daily recap template compiler in `src/notifications/briefing.ts`.
- [x] Test sending a message to a personal Telegram chat or Discord webhook.
- [x] Schedule automatic morning delivery in cron scheduler.

---

## 🔮 Advanced Enhancements & Additions

### 1. Dynamic Wake-Up Triggered Delivery
Instead of firing notifications at an arbitrary static time (e.g., 08:00 AM) when you may still be asleep:
- Trigger the briefing instantly upon receiving a wake event webhook from iOS Sleep Focus dismissal or Apple Watch wake detection.
- Delivery is always precisely timed to when you pick up your phone in the morning.

### 2. Sunday Evening Weekly Preview Digest
Complement the retrospective daily briefs with a forward-looking Sunday evening strategic preview:
- Calendar meeting load analysis for the upcoming week.
- Highlighting potential danger zones (e.g. days with $> 4.5$ hours of meetings).
- Reviewing open goals needing velocity boosts this week.
- Proposed focus blocks to protect before the week gets scheduled over.

### 3. Multi-Tier Notification Routing & Quiet Hours
- Priority-based dispatch: Anomaly warnings (critical burnout alerts) buzz the Telegram bot immediately.
- Regular briefings respect iOS Focus modes / Do Not Disturb windows.
- Digest channels: send technical metrics to Discord `#dev-logs`, health and briefings to personal Telegram, and long-form weekly summaries to personal email.

