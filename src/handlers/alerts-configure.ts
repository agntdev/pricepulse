import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton, registerMainMenuItem } from "../toolkit/index.js";
import { getStore, type WatchlistItem } from "../store.js";

// Register this feature in the main menu
registerMainMenuItem({ label: "⚙️ Configure Alerts", data: "alerts:configure", order: 40 });

const composer = new Composer<Ctx>();

// Step 1: Show watchlist items to configure
composer.callbackQuery("alerts:configure", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Manage alert types for selected watchlist items");

  const store = getStore();
  const watchlist = await store.getUserWatchlist(ctx.from?.id ?? 0);

  if (watchlist.length === 0) {
    await ctx.reply(
      "Your watchlist is empty. Add coins first to configure alerts.",
      { reply_markup: inlineKeyboard([[inlineButton("➕ Add Coin", "watchlist:common")]]) }
    );
    return;
  }

  // Show watchlist items as buttons
  const keyboard = inlineKeyboard(
    watchlist.map(item => [
      inlineButton(
        `${item.ticker_symbol} – ${item.friendly_name}`,
        `alert:${item.ticker_symbol}`
      )
    ])
  );

  await ctx.reply("Select a coin to configure its alerts:", { reply_markup: keyboard });
});

// Step 2: Show alert options for a specific coin
composer.callbackQuery(/^alert:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker || !ctx.from) return;

  const store = getStore();
  const item = await store.getWatchlistItem(ctx.from.id, ticker);
  if (!item) {
    await ctx.reply("Coin not found in your watchlist.");
    return;
  }

  // Show alert configuration options
  const thresholdStatus = item.threshold_alerts ? "ON" : "OFF";
  const percentStatus = item.percent_change_alert_flag ? "ON" : "OFF";
  const percentValue = item.percent_change_value ?? 5;

  await ctx.reply(
    `Configure alerts for ${item.friendly_name} (${ticker}):\n\n` +
    `• Price threshold: ${thresholdStatus}\n` +
    `• Percent change (${percentValue}%): ${percentStatus}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton(
          `Price threshold: ${thresholdStatus}`,
          `toggle:threshold:${ticker}`
        )],
        [inlineButton(
          `Percent change: ${percentStatus}`,
          `toggle:percent:${ticker}`
        )],
        [inlineButton(
          "Set percent value",
          `set:percent:${ticker}`
        )],
        [inlineButton("⬅️ Back to watchlist", "alerts:configure")],
      ]),
    }
  );
});

// Toggle threshold alerts
composer.callbackQuery(/^toggle:threshold:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker || !ctx.from) return;

  const store = getStore();
  const item = await store.getWatchlistItem(ctx.from.id, ticker);
  if (!item) return;

  item.threshold_alerts = !item.threshold_alerts;
  await store.saveWatchlistItem(ctx.from.id, item);

  // Refresh the configuration view
  const thresholdStatus = item.threshold_alerts ? "ON" : "OFF";
  const percentStatus = item.percent_change_alert_flag ? "ON" : "OFF";
  const percentValue = item.percent_change_value ?? 5;

  await ctx.editMessageText(
    `Configure alerts for ${item.friendly_name} (${ticker}):\n\n` +
    `• Price threshold: ${thresholdStatus}\n` +
    `• Percent change (${percentValue}%): ${percentStatus}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton(
          `Price threshold: ${thresholdStatus}`,
          `toggle:threshold:${ticker}`
        )],
        [inlineButton(
          `Percent change: ${percentStatus}`,
          `toggle:percent:${ticker}`
        )],
        [inlineButton(
          "Set percent value",
          `set:percent:${ticker}`
        )],
        [inlineButton("⬅️ Back to watchlist", "alerts:configure")],
      ]),
    }
  );
});

// Toggle percent change alerts
composer.callbackQuery(/^toggle:percent:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker || !ctx.from) return;

  const store = getStore();
  const item = await store.getWatchlistItem(ctx.from.id, ticker);
  if (!item) return;

  item.percent_change_alert_flag = !item.percent_change_alert_flag;
  await store.saveWatchlistItem(ctx.from.id, item);

  // Refresh the configuration view
  const thresholdStatus = item.threshold_alerts ? "ON" : "OFF";
  const percentStatus = item.percent_change_alert_flag ? "ON" : "OFF";
  const percentValue = item.percent_change_value ?? 5;

  await ctx.editMessageText(
    `Configure alerts for ${item.friendly_name} (${ticker}):\n\n` +
    `• Price threshold: ${thresholdStatus}\n` +
    `• Percent change (${percentValue}%): ${percentStatus}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton(
          `Price threshold: ${thresholdStatus}`,
          `toggle:threshold:${ticker}`
        )],
        [inlineButton(
          `Percent change: ${percentStatus}`,
          `toggle:percent:${ticker}`
        )],
        [inlineButton(
          "Set percent value",
          `set:percent:${ticker}`
        )],
        [inlineButton("⬅️ Back to watchlist", "alerts:configure")],
      ]),
    }
  );
});

// Set percent value
composer.callbackQuery(/^set:percent:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker || !ctx.from) return;

  // Prompt for percent value input
  await ctx.reply(
    "Enter the percent change threshold (e.g. 5 for 5%):",
    {
      reply_markup: { force_reply: true, input_field_placeholder: "Enter percent value…" },
    }
  );

  // Store that we're waiting for percent input
  (ctx as any).session = { ...(ctx as any).session, awaiting_percent: ticker };
});

// Handle percent value input
composer.on("message:text", async (ctx, next) => {
  if (!(ctx as any).session?.awaiting_percent) {
    return next();
  }

  const ticker = (ctx as any).session.awaiting_percent;
  const value = parseFloat(ctx.message.text.trim());

  if (isNaN(value) || value <= 0 || value > 100) {
    await ctx.reply("Please enter a valid percentage (1-100).");
    return;
  }

  // Clear the awaiting state
  (ctx as any).session = { ...(ctx as any).session, awaiting_percent: false };

  const store = getStore();
  const item = await store.getWatchlistItem(ctx.from.id, ticker);
  if (!item) {
    await ctx.reply("Coin not found in your watchlist.");
    return;
  }

  item.percent_change_value = value;
  await store.saveWatchlistItem(ctx.from.id, item);

  await ctx.reply(`✅ Percent change alert for ${ticker} set to ${value}%.`);
});

export default composer;
