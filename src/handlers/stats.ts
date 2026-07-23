import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

// Owner-only stats command
composer.command("stats", async (ctx) => {
  await ctx.reply("View anonymized usage statistics and top alert tickers");

  const store = getStore();
  const summary = await store.getAnalyticsSummary();

  // Format top tickers
  let topTickersText = "No alerts fired yet.";
  if (summary.top_tickers.length > 0) {
    topTickersText = summary.top_tickers
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${t.ticker}: ${t.count} alerts`)
      .join("\n");
  }

  const lastUpdated = summary.last_updated > 0
    ? new Date(summary.last_updated).toLocaleString()
    : "Never";

  await ctx.reply(
    `📊 **Bot Statistics**\n\n` +
    `Total users: ${summary.total_users}\n` +
    `Total alerts fired: ${summary.total_alerts}\n` +
    `Last updated: ${lastUpdated}\n\n` +
    `**Top 10 Alert Tickers:**\n${topTickersText}`,
    {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "stats:refresh")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

// Refresh stats
composer.callbackQuery("stats:refresh", async (ctx) => {
  await ctx.answerCallbackQuery();

  const store = getStore();
  const summary = await store.getAnalyticsSummary();

  let topTickersText = "No alerts fired yet.";
  if (summary.top_tickers.length > 0) {
    topTickersText = summary.top_tickers
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${t.ticker}: ${t.count} alerts`)
      .join("\n");
  }

  const lastUpdated = summary.last_updated > 0
    ? new Date(summary.last_updated).toLocaleString()
    : "Never";

  await ctx.editMessageText(
    `📊 **Bot Statistics**\n\n` +
    `Total users: ${summary.total_users}\n` +
    `Total alerts fired: ${summary.total_alerts}\n` +
    `Last updated: ${lastUpdated}\n\n` +
    `**Top 10 Alert Tickers:**\n${topTickersText}`,
    {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "stats:refresh")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

export default composer;
