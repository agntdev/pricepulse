import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton, registerMainMenuItem } from "../toolkit/index.js";
import { getStore, type WatchlistItem } from "../store.js";
import { searchCoins, getCoinId } from "../price-feed.js";

// Register this feature in the main menu
registerMainMenuItem({ label: "🔍 Custom Ticker", data: "watchlist:custom", order: 31 });

const composer = new Composer<Ctx>();

// Step 1: Show the prompt to enter a ticker
composer.callbackQuery("watchlist:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Enter a custom cryptocurrency ticker symbol");

  // Now prompt for actual text input
  await ctx.reply("Type the ticker symbol (e.g. PEPE, SHIB, MATIC):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type ticker symbol…" },
  });

  // Store that we're waiting for ticker input
  if (ctx.from) {
    const store = getStore();
    const profile = await store.getUserProfile(ctx.from.id);
    // We'll use session for this transient state
    (ctx as any).session = { ...(ctx as any).session, awaiting_ticker: true };
  }
});

// Step 2: Handle the text input with the ticker symbol
composer.on("message:text", async (ctx, next) => {
  // Only process if we're in the ticker input state
  if (!(ctx as any).session?.awaiting_ticker) {
    return next();
  }

  const ticker = ctx.message.text.trim().toUpperCase();
  if (!ticker || ticker.length > 10) {
    await ctx.reply("Please enter a valid ticker symbol (1-10 characters).");
    return;
  }

  // Clear the awaiting state
  (ctx as any).session = { ...(ctx as any).session, awaiting_ticker: false };

  const store = getStore();

  // Check if already in watchlist
  const existing = await store.getWatchlistItem(ctx.from.id, ticker);
  if (existing) {
    await ctx.reply(`${ticker} is already in your watchlist.`);
    return;
  }

  // Try to find the coin on CoinGecko
  const coinId = getCoinId(ticker);
  const searchResults = await searchCoins(ticker);
  
  // Find matching result
  let matchedName = ticker;
  if (coinId) {
    // It's a known coin
    matchedName = searchResults.find(r => r.id === coinId)?.name ?? ticker;
  } else if (searchResults.length > 0) {
    // Use first search result
    matchedName = searchResults[0].name;
  }

  // Add to watchlist
  const item: WatchlistItem = {
    ticker_symbol: ticker,
    friendly_name: matchedName,
    threshold_alerts: true,
    percent_change_alert_flag: true,
    percent_change_value: 5,
    enabled_status: true,
  };

  await store.saveWatchlistItem(ctx.from.id, item);

  await ctx.reply(`✅ Added ${matchedName} (${ticker}) to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "watchlist:custom")],
      [inlineButton("⚙️ Configure alerts", "alerts:configure")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
