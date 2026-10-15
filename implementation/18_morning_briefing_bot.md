# 🤖 Step 18: Morning Briefing Bot (Telegram)

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Create a two-way Telegram conversational bot that sends you an automated morning briefing and provides interactive inline buttons for logging mood, energy, and habit completion right from your phone.

---

## 📱 Bot Capabilities

1. **Daily Morning Wakeup Call (08:00 AM)**:
   - Summary of last night's sleep duration and recovery.
   - Pending meetings and daily goals.
2. **Interactive Inline Keyboard**:
   ```
   How is your morning energy?
   [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
   [ 6 ] [ 7 ] [ 8 ] [ 9 ] [ 10 ]
   ```
3. **Conversational Commands**:
   - `/status` — Sends snapshot.
   - `/log mood 8` — Logs entry directly into `metric_entries`.
   - `/ask <query>` — Queries Personal AI LLM.

---

## 💻 Implementation (`src/bot/telegram.ts`)

Using `telegraf` or `node-telegram-bot-api`:

```typescript
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.command('status', async (ctx) => {
  const me = await getMeData();
  await ctx.reply(`🧬 Commits: ${me.today.productivity.commits} | Mood: ${me.today.wellbeing.mood}/10`);
});

bot.command('checkin', async (ctx) => {
  await ctx.reply(
    'Rate your current energy level (1-10):',
    Markup.inlineKeyboard([
      [1, 2, 3, 4, 5].map(n => Markup.button.callback(String(n), `energy_${n}`)),
      [6, 7, 8, 9, 10].map(n => Markup.button.callback(String(n), `energy_${n}`))
    ])
  );
});

bot.action(/energy_(\d+)/, async (ctx) => {
  const rating = parseInt(ctx.match[1], 10);
  await saveMetricEntry('energy', rating);
  await ctx.answerCbQuery(`Recorded energy: ${rating}/10! ⚡`);
  await ctx.editMessageText(`✅ Energy logged: ${rating}/10`);
});
```

---

## 🧪 Verification & Checklist
- [x] Create Telegram bot via `@BotFather` and retrieve API token.
- [x] Implement bot commands and inline buttons.
- [x] Test bidirectional logging from your mobile Telegram app to local SQLite DB.

---

## 🔮 Advanced Enhancements & Additions

### 1. Voice Memo Transcription with Local Whisper
Allow recording natural thoughts while walking or driving:
- Send voice notes directly to the Telegram bot.
- Download `.ogg` audio and process through local `whisper.cpp` or OpenAI Whisper API.
- Use LLM entity extraction to automatically parse:
  * Emotional state (Mood: 7.5)
  * Activities completed (gym session, book chapter)
  * Gratitude notes
- Log structured entry into `metric_entries` and reply with a formatted confirmation card.

### 2. Telegram Mini App (Web App) Dashboard
Embed the React web dashboard directly inside Telegram:
- Add a persistent "Open Dashboard" keyboard button launching the web dashboard via Telegram WebApp SDK (`Telegram.WebApp.ready()`).
- Auto-authenticate using Telegram `initData` HMAC validation.
- Access full interactive charts without opening a standalone web browser.

### 3. Interactive Goal & Energy Wizards
- `/goal new`: Step-by-step chat wizard to define target, cadence, and unit.
- `/energy`: Instant inline matrix to log energy-giving (+) or draining (-) activities with quick tag buttons (`[Deep Work]`, `[1-on-1]`, `[Walk]`).

