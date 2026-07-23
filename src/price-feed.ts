/**
 * Price feed module - fetches cryptocurrency prices from CoinGecko API.
 * Uses free API without authentication (rate limited to 10-30 calls/minute).
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Common coin IDs mapping (ticker → CoinGecko ID)
export const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDC: "usd-coin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  DOT: "polkadot",
  TRX: "tron",
  LINK: "chainlink",
  MATIC: "matic-network",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
  ALGO: "algorand",
};

export interface PriceData {
  ticker: string;
  name: string;
  price_usd: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  last_updated: string;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
}

/**
 * Search for coins by ticker symbol. Returns top matches.
 */
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  try {
    const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(r => setTimeout(r, 1000));
        return searchCoins(query);
      }
      return [];
    }

    const data = await response.json() as { coins?: Array<{ id: string; symbol: string; name: string }> };
    return (data.coins || []).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Get price data for a single coin by CoinGecko ID.
 */
export async function getCoinPrice(coinId: string): Promise<PriceData | null> {
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        return getCoinPrice(coinId);
      }
      return null;
    }

    const data = await response.json() as Record<string, {
      usd?: number;
      usd_24h_change?: number;
      usd_market_cap?: number;
      last_updated_at?: number;
    }>;
    
    const coinData = data[coinId];
    if (!coinData || coinData.usd === undefined) return null;

    // Find the ticker symbol from our mapping
    const ticker = Object.keys(COIN_IDS).find(key => COIN_IDS[key] === coinId) || coinId.toUpperCase();

    return {
      ticker,
      name: coinId,
      price_usd: coinData.usd,
      price_change_24h: 0,
      price_change_percentage_24h: coinData.usd_24h_change ?? 0,
      market_cap: coinData.usd_market_cap ?? 0,
      last_updated: new Date((coinData.last_updated_at ?? 0) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Get price data for multiple coins at once (batch request).
 */
export async function getBatchPrices(coinIds: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  
  if (coinIds.length === 0) return results;

  try {
    // CoinGecko allows up to 250 IDs per request
    const idsParam = coinIds.join(",");
    const url = `${COINGECKO_BASE}/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        return getBatchPrices(coinIds);
      }
      return results;
    }

    const data = await response.json() as Record<string, {
      usd?: number;
      usd_24h_change?: number;
      usd_market_cap?: number;
      last_updated_at?: number;
    }>;

    for (const [coinId, coinData] of Object.entries(data)) {
      if (!coinData || coinData.usd === undefined) continue;

      const ticker = Object.keys(COIN_IDS).find(key => COIN_IDS[key] === coinId) || coinId.toUpperCase();
      
      results.set(ticker, {
        ticker,
        name: coinId,
        price_usd: coinData.usd,
        price_change_24h: 0,
        price_change_percentage_24h: coinData.usd_24h_change ?? 0,
        market_cap: coinData.usd_market_cap ?? 0,
        last_updated: new Date((coinData.last_updated_at ?? 0) * 1000).toISOString(),
      });
    }
  } catch {
    // Return empty on error
  }

  return results;
}

/**
 * Get CoinGecko ID for a ticker symbol.
 */
export function getCoinId(ticker: string): string | null {
  const upperTicker = ticker.toUpperCase();
  return COIN_IDS[upperTicker] ?? null;
}

/**
 * Check if a ticker is a known common coin.
 */
export function isCommonCoin(ticker: string): boolean {
  return ticker.toUpperCase() in COIN_IDS;
}