import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton, registerMainMenuItem } from "../toolkit/index.js";
import { getStore, type WatchlistItem } from "../store.js";
import { getCoinPrice, getBatchPrices, getCoinId, isCommonCoin } from "../price-feed.js";

// Register this feature in the main menu
registerMainMenuItem({ label: "💰 Check Price", data: "price:check", order: 20 });

const composer = new Composer<Ctx>();

// /price command - check price of specific ticker or full watchlist
composer.command("price", async (ctx) => {
  await ctx.reply("Request current price of specific ticker or full watchlist");

  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);
  const ticker = args[0]?.toUpperCase();

  if (ticker) {
    // Check specific ticker
    await handlePriceCheck(ctx, ticker);
  } else {
    // Show watchlist or prompt for ticker
    const store = getStore();
    const watchlist = await store.getUserWatchlist(ctx.from?.id ?? 0);

    if (watchlist.length === 0) {
      await ctx.reply(
        "Your watchlist is empty. Add coins first, or type a ticker symbol.",
        { reply_markup: inlineKeyboard([[inlineButton("➕ Add Coin", "watchlist:common")]]) }
      );
    } else {
      // Show watchlist with current prices
      await showWatchlistPrices(ctx, watchlist);
    }
  }
});

// Button-triggered price check
composer.callbackQuery("price:check", async (ctx) => {
  await ctx.answerCallbackQuery();

  const store = getStore();
  const watchlist = await store.getUserWatchlist(ctx.from?.id ?? 0);

  if (watchlist.length === 0) {
    await ctx.reply(
      "Your watchlist is empty. Add coins first to check prices.",
      { reply_markup: inlineKeyboard([[inlineButton("➕ Add Coin", "watchlist:common")]]) }
    );
  } else {
    await showWatchlistPrices(ctx, watchlist);
  }
});

// Show prices for all watchlist items
async function showWatchlistPrices(ctx: any, watchlist: WatchlistItem[]): Promise<void> {
  const coinIds = watchlist
    .map(item => getCoinId(item.ticker_symbol))
    .filter((id): id is string => id !== null);

  if (coinIds.length === 0) {
    await ctx.reply("Could not fetch prices for your watchlist items.");
    return;
  }

  const prices = await getBatchPrices(coinIds);

  let message = "💰 **Watchlist Prices**\n\n";
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

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", "price:check")],
      [inlineButton("➕ Add Coin", "watchlist:common")],
    ]),
  });
}

// Handle price check for a specific ticker
async function handlePriceCheck(ctx: any, ticker: string): Promise<void> {
  const coinId = getCoinId(ticker);
  
  if (!coinId) {
    // Try to search for the ticker
    await ctx.reply(`Looking up ${ticker}...`);
    // For now, just inform the user
    await ctx.reply(
      `I couldn't find price data for "${ticker}". It might not be a valid ticker.`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
    return;
  }

  const priceData = await getCoinPrice(coinId);
  
  if (!priceData) {
    await ctx.reply(
      `Could not fetch price for ${ticker}. Please try again later.`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
    return;
  }

  const changeSymbol = priceData.price_change_percentage_24h >= 0 ? "▲" : "▼";
  const changePercent = Math.abs(priceData.price_change_percentage_24h).toFixed(2);

  await ctx.reply(
    `💰 **${ticker}**\n\n` +
    `Price: $${formatPrice(priceData.price_usd)}\n` +
    `24h Change: ${changeSymbol}${changePercent}%\n` +
    `Market Cap: $${formatMarketCap(priceData.market_cap)}`,
    {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", `price:refresh:${ticker}`)],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
}

// Refresh price for a specific ticker
composer.callbackQuery(/^price:refresh:([A-Z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker) return;
  
  await handlePriceCheck(ctx, ticker);
});

// Format price with appropriate decimals
function formatPrice(price: number): string {
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

// Format market cap in readable format
function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `${(cap / 1e6).toFixed(2)}M`;
  return cap.toFixed(0);
}

export default composer;
