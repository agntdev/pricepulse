import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { getStore, type WatchlistItem } from "../store.js";
import { getBatchPrices, getCoinId } from "../price-feed.js";

/**
 * Scheduler handler - manages morning summaries and alert delivery.
 * 
 * In production, this would be triggered by a cron job or scheduled task.
 * For testing, it provides manual trigger buttons.
 */
const composer = new Composer<Ctx>();

// Manual trigger for morning summary (for testing)
composer.callbackQuery("scheduler:summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendMorningSummary(ctx.from?.id ?? 0, ctx);
});

// Manual trigger for alert check (for testing)
composer.callbackQuery("scheduler:alerts", async (ctx) => {
  await ctx.answerCallbackQuery();
  await checkAndSendAlerts(ctx.from?.id ?? 0, ctx);
});

/**
 * Send morning summary to a user
 */
export async function sendMorningSummary(userId: number, ctx?: any): Promise<void> {
  const store = getStore();
  const profile = await store.getUserProfile(userId);

  // Check if summary is enabled
  if (!profile.summary_enabled) return;

  // Check if it's quiet hours (don't send during quiet hours)
  if (isQuietHours(profile)) return;

  // Get watchlist
  const watchlist = await store.getUserWatchlist(userId);
  if (watchlist.length === 0) return;

  // Get prices for all watchlist items
  const coinIds = watchlist
    .map(item => getCoinId(item.ticker_symbol))
    .filter((id): id is string => id !== null);

  if (coinIds.length === 0) return;

  const prices = await getBatchPrices(coinIds);

  // Build summary message
  let message = "🌅 **Morning Summary**\n\n";

  for (const item of watchlist) {
    const priceData = prices.get(item.ticker_symbol);
    if (priceData) {
      const changeSymbol = priceData.price_change_percentage_24h >= 0 ? "▲" : "▼";
      const changePercent = Math.abs(priceData.price_change_percentage_24h).toFixed(2);
      message += `${item.ticker_symbol}: $${formatPrice(priceData.price_usd)} ${changeSymbol}${changePercent}%\n`;
    } else {
      message += `${item.ticker_symbol}: Price unavailable\n`;
    }
  }

  message += "\nHave a great day! 📈";

  // Send the summary
  if (ctx) {
    await ctx.reply(message, { parse_mode: "Markdown" });
  }
  // In production, this would use ctx.api.sendMessage() to send to the user
}

/**
 * Check prices against alert thresholds and send alerts if needed
 */
export async function checkAndSendAlerts(userId: number, ctx?: any): Promise<void> {
  const store = getStore();
  const profile = await store.getUserProfile(userId);
  const watchlist = await store.getUserWatchlist(userId);

  if (watchlist.length === 0) return;

  // Get prices
  const coinIds = watchlist
    .map(item => getCoinId(item.ticker_symbol))
    .filter((id): id is string => id !== null);

  if (coinIds.length === 0) return;

  const prices = await getBatchPrices(coinIds);

  // Check each watchlist item for alert conditions
  for (const item of watchlist) {
    const priceData = prices.get(item.ticker_symbol);
    if (!priceData) continue;

    // Check threshold alerts
    if (item.threshold_alerts && item.threshold_price) {
      if (priceData.price_usd >= item.threshold_price) {
        await sendAlert(userId, item.ticker_symbol, "threshold", 
          `Price reached $${formatPrice(priceData.price_usd)} (threshold: $${formatPrice(item.threshold_price)})`,
          ctx
        );
      }
    }

    // Check percent change alerts
    if (item.percent_change_alert_flag && item.percent_change_value) {
      const absChange = Math.abs(priceData.price_change_percentage_24h);
      if (absChange >= item.percent_change_value) {
        const direction = priceData.price_change_percentage_24h >= 0 ? "up" : "down";
        await sendAlert(userId, item.ticker_symbol, "percent",
          `Price ${direction} ${absChange.toFixed(2)}% in 24h (threshold: ${item.percent_change_value}%)`,
          ctx
        );
      }
    }

    // Update last notified price and time
    item.last_notified_price = priceData.price_usd;
    item.last_notified_time = Date.now();
    await store.saveWatchlistItem(userId, item);
  }
}

/**
 * Send an alert to a user
 */
async function sendAlert(
  userId: number,
  ticker: string,
  alertType: string,
  message: string,
  ctx?: any
): Promise<void> {
  const store = getStore();
  const profile = await store.getUserProfile(userId);

  // Check quiet hours
  if (isQuietHours(profile)) return;

  // Check cooldown
  if (profile.cooldown_length) {
    // Implementation would check last alert time
    // For now, just send the alert
  }

  // Record the alert
  const anonymizedId = anonymizeUserId(userId);
  await store.saveAlertRecord({
    anonymized_user_id: anonymizedId,
    ticker,
    alert_type: alertType,
    trigger_timestamp: Date.now(),
  });

  // Increment analytics counter
  await store.incrementAlertCount(userId, ticker);

  // Send the alert
  if (ctx) {
    await ctx.reply(
      `🔔 **${ticker} Alert**\n\n${message}`,
      { parse_mode: "Markdown" }
    );
  }
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(profile: any): boolean {
  if (!profile.quiet_hours_start || !profile.quiet_hours_end) return false;

  const now = new Date();
  const currentHour = now.getHours();

  const start = profile.quiet_hours_start;
  const end = profile.quiet_hours_end;

  if (start <= end) {
    // Same day range (e.g., 22-8 means 10pm-8am)
    return currentHour >= start || currentHour < end;
  } else {
    // Overnight range (e.g., 22-8 means 10pm-8am)
    return currentHour >= start || currentHour < end;
  }
}

/**
 * Anonymize user ID for analytics (salted hash)
 */
function anonymizeUserId(userId: number): string {
  // Simple hash for anonymization - in production use a proper salted hash
  return `user_${(userId * 2654435761) >>> 0}`;
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

export default composer;