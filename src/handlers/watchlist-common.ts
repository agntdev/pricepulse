import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton, registerMainMenuItem } from "../toolkit/index.js";
import { getStore, type WatchlistItem } from "../store.js";
import { COIN_IDS, getCoinPrice } from "../price-feed.js";

// Register this feature in the main menu
registerMainMenuItem({ label: "➕ Add Coin", data: "watchlist:common", order: 30 });

const COMMON_COINS = [
  { ticker: "BTC", name: "Bitcoin" },
  { ticker: "ETH", name: "Ethereum" },
  { ticker: "SOL", name: "Solana" },
  { ticker: "BNB", name: "BNB" },
  { ticker: "XRP", name: "XRP" },
  { ticker: "ADA", name: "Cardano" },
  { ticker: "DOGE", name: "Dogecoin" },
  { ticker: "DOT", name: "Polkadot" },
];

const composer = new Composer<Ctx>();

composer.callbackQuery("watchlist:common", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Add one of the pre-seeded major cryptocurrencies to watchlist");

  // Show coin selection keyboard
  const keyboard = inlineKeyboard(
    COMMON_COINS.map(coin => [inlineButton(`${coin.ticker} – ${coin.name}`, `add:${coin.ticker}`)])
  );

  await ctx.reply("Pick a coin to add to your watchlist:", { reply_markup: keyboard });
});

// Handle coin addition
composer.callbackQuery(/^add:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker || !ctx.from) return;

  const store = getStore();
  const coinId = COIN_IDS[ticker];
  const coinName = COMMON_COINS.find(c => c.ticker === ticker)?.name ?? ticker;

  // Check if already in watchlist
  const existing = await store.getWatchlistItem(ctx.from.id, ticker);
  if (existing) {
    await ctx.reply(`${coinName} (${ticker}) is already in your watchlist.`);
    return;
  }

  // Add to watchlist
  const item: WatchlistItem = {
    ticker_symbol: ticker,
    friendly_name: coinName,
    threshold_alerts: true,
    percent_change_alert_flag: true,
    percent_change_value: 5, // Default 5% change alert
    enabled_status: true,
  };

  await store.saveWatchlistItem(ctx.from.id, item);

  // Get current price for confirmation
  const priceData = coinId ? await getCoinPrice(coinId) : null;
  const priceText = priceData ? ` (currently $${priceData.price_usd.toFixed(2)})` : '';

  await ctx.reply(`✅ Added ${coinName} (${ticker}) to your watchlist${priceText}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "watchlist:common")],
      [inlineButton("⚙️ Configure alerts", "alerts:configure")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
