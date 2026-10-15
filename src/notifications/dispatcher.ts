import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

export interface DispatchResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface DispatchSummary {
  id: string;
  dispatchedAt: string;
  channels: DispatchResult[];
  overallSuccess: boolean;
  contentSample: string;
}

/**
 * Sends a notification message via Telegram Bot API
 */
export async function sendTelegramMessage(text: string): Promise<DispatchResult> {
  const timestamp = new Date().toISOString();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return {
      channel: 'telegram',
      success: false,
      error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in .env',
      timestamp,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        channel: 'telegram',
        success: false,
        error: `Telegram API error (${res.status}): ${errText}`,
        timestamp,
      };
    }

    const json: any = await res.json();
    return {
      channel: 'telegram',
      success: true,
      messageId: json.result?.message_id?.toString(),
      timestamp,
    };
  } catch (err: any) {
    return {
      channel: 'telegram',
      success: false,
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Sends a notification message via Discord Webhook
 */
export async function sendDiscordWebhook(text: string): Promise<DispatchResult> {
  const timestamp = new Date().toISOString();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      channel: 'discord',
      success: false,
      error: 'DISCORD_WEBHOOK_URL is not configured in .env',
      timestamp,
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        channel: 'discord',
        success: false,
        error: `Discord Webhook error (${res.status}): ${errText}`,
        timestamp,
      };
    }

    return {
      channel: 'discord',
      success: true,
      timestamp,
    };
  } catch (err: any) {
    return {
      channel: 'discord',
      success: false,
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Dispatches content across specified notification channels and audits the dispatch
 */
export async function dispatchBriefing(
  text: string,
  preferredChannel: 'telegram' | 'discord' | 'log' | 'all' = 'all'
): Promise<DispatchSummary> {
  const dispatchId = uuidv4();
  const timestamp = new Date().toISOString();
  const results: DispatchResult[] = [];

  // Log channel is always recorded
  console.log(`\n📢 [Notification Dispatch ${dispatchId}]\n${text}\n`);
  results.push({
    channel: 'log',
    success: true,
    timestamp,
  });

  if (preferredChannel === 'telegram' || preferredChannel === 'all') {
    const tgResult = await sendTelegramMessage(text);
    results.push(tgResult);
  }

  if (preferredChannel === 'discord' || preferredChannel === 'all') {
    const discordResult = await sendDiscordWebhook(text);
    results.push(discordResult);
  }

  // Audit in SQLite database
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO raw_events (id, source_id, event_type, payload, recorded_at)
      VALUES (?, 'notification_dispatcher', 'briefing_dispatch', ?, ?)
    `).run(dispatchId, JSON.stringify({ text, results, channel: preferredChannel }), timestamp);
  } catch (err) {
    console.warn('Failed to audit dispatch in raw_events:', err);
  }

  const overallSuccess = results.some(r => r.success);

  return {
    id: dispatchId,
    dispatchedAt: timestamp,
    channels: results,
    overallSuccess,
    contentSample: text.slice(0, 160) + '...',
  };
}
