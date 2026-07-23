import type { StorageAdapter } from "grammy";
import { MemorySessionStorage } from "./toolkit/session/memory.js";

/**
 * Durable domain data storage — wraps a grammY StorageAdapter for persisting
 * watchlist items, user profiles, alert records, and analytics data.
 *
 * Uses the same pattern as session storage but with a different key prefix
 * to keep domain data separate from session data.
 */

const DOMAIN_PREFIX = "domain:";

/** User profile settings and preferences */
export interface UserProfile {
  telegram_id: number;
  timezone?: string;
  quiet_hours_start?: number; // 0-23
  quiet_hours_end?: number;   // 0-23
  summary_time?: string;      // HH:MM
  summary_enabled?: boolean;
  cooldown_length?: number;   // minutes
  enabled_alert_types?: string[]; // ["threshold", "percent"]
  watchlist_index?: string[]; // array of ticker symbols
  owner?: boolean;
}

/** Watchlist item - monitored cryptocurrency */
export interface WatchlistItem {
  ticker_symbol: string;
  friendly_name: string;
  threshold_alerts?: boolean;
  threshold_price?: number;
  percent_change_alert_flag?: boolean;
  percent_change_value?: number; // percentage
  last_notified_price?: number;
  last_notified_time?: number; // epoch ms
  enabled_status?: boolean;
}

/** Alert record - analytics data for owner visibility */
export interface AlertRecord {
  anonymized_user_id: string; // salted hash
  ticker: string;
  alert_type: string; // "threshold" | "percent"
  trigger_timestamp: number; // epoch ms
}

/** Analytics summary for owner */
export interface AnalyticsSummary {
  total_users: number;
  total_alerts: number;
  top_tickers: Array<{ ticker: string; count: number }>;
  last_updated: number;
}

class DomainStore {
  private adapter: StorageAdapter<unknown>;

  constructor(adapter: StorageAdapter<unknown>) {
    this.adapter = adapter;
  }

  private key(type: string, id: string): string {
    return `${DOMAIN_PREFIX}${type}:${id}`;
  }

  // User Profile
  async getUserProfile(userId: number): Promise<UserProfile> {
    const key = this.key("profile", String(userId));
    const data = await this.adapter.read(key) as UserProfile | undefined;
    return data ?? { telegram_id: userId };
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const key = this.key("profile", String(profile.telegram_id));
    await this.adapter.write(key, profile);
  }

  // Watchlist Item
  async getWatchlistItem(userId: number, ticker: string): Promise<WatchlistItem | undefined> {
    const key = this.key("watchlist", `${userId}:${ticker}`);
    return await this.adapter.read(key) as WatchlistItem | undefined;
  }

  async saveWatchlistItem(userId: number, item: WatchlistItem): Promise<void> {
    const key = this.key("watchlist", `${userId}:${item.ticker_symbol}`);
    await this.adapter.write(key, item);

    // Update user's watchlist index
    const profile = await this.getUserProfile(userId);
    if (!profile.watchlist_index) profile.watchlist_index = [];
    if (!profile.watchlist_index.includes(item.ticker_symbol)) {
      profile.watchlist_index.push(item.ticker_symbol);
      await this.saveUserProfile(profile);
    }
  }

  async removeWatchlistItem(userId: number, ticker: string): Promise<boolean> {
    const key = this.key("watchlist", `${userId}:${ticker}`);
    const existed = await this.adapter.read(key) !== undefined;
    await this.adapter.delete(key);

    // Update user's watchlist index
    const profile = await this.getUserProfile(userId);
    if (profile.watchlist_index) {
      profile.watchlist_index = profile.watchlist_index.filter(t => t !== ticker);
      await this.saveUserProfile(profile);
    }

    return existed;
  }

  async getUserWatchlist(userId: number): Promise<WatchlistItem[]> {
    const profile = await this.getUserProfile(userId);
    if (!profile.watchlist_index || profile.watchlist_index.length === 0) return [];

    const items: WatchlistItem[] = [];
    for (const ticker of profile.watchlist_index) {
      const item = await this.getWatchlistItem(userId, ticker);
      if (item) items.push(item);
    }
    return items;
  }

  // Alert Records
  async saveAlertRecord(record: AlertRecord): Promise<void> {
    const key = this.key("alert", `${record.anonymized_user_id}:${record.ticker}:${record.trigger_timestamp}`);
    await this.adapter.write(key, record);
  }

  async getAlertRecords(): Promise<AlertRecord[]> {
    // Note: In production, this should use a more efficient approach
    // For now, we'll return an empty array and handle analytics differently
    return [];
  }

  // Analytics
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const key = this.key("analytics", "summary");
    const data = await this.adapter.read(key) as AnalyticsSummary | undefined;
    return data ?? { total_users: 0, total_alerts: 0, top_tickers: [], last_updated: 0 };
  }

  async saveAnalyticsSummary(summary: AnalyticsSummary): Promise<void> {
    const key = this.key("analytics", "summary");
    await this.adapter.write(key, summary);
  }

  async incrementAlertCount(userId: number, ticker: string): Promise<void> {
    const summary = await this.getAnalyticsSummary();
    summary.total_alerts++;

    // Update top tickers
    const existing = summary.top_tickers.find(t => t.ticker === ticker);
    if (existing) {
      existing.count++;
    } else {
      summary.top_tickers.push({ ticker, count: 1 });
    }

    // Keep only top 10
    summary.top_tickers.sort((a, b) => b.count - a.count);
    summary.top_tickers = summary.top_tickers.slice(0, 10);

    summary.last_updated = Date.now();
    await this.saveAnalyticsSummary(summary);
  }

  async incrementUserCount(userId: number): Promise<void> {
    const summary = await this.getAnalyticsSummary();
    summary.total_users++;
    await this.saveAnalyticsSummary(summary);
  }
}

// Singleton store instance
let storeInstance: DomainStore | null = null;

/**
 * Get or create the domain store. Uses the same storage adapter as session data.
 */
export function getStore(adapter?: StorageAdapter<unknown>): DomainStore {
  if (!storeInstance) {
    // Create a memory adapter for development/testing
    const memoryAdapter = new MemorySessionStorage<unknown>();
    storeInstance = new DomainStore(adapter ?? memoryAdapter);
  }
  return storeInstance;
}

/**
 * Reset store (for testing only)
 */
export function resetStore(): void {
  storeInstance = null;
}