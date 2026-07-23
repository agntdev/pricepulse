# Crypto Alerts Bot — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that tracks cryptocurrency prices, sends threshold/percent-change alerts, and provides on-demand price checks. Users can customize quiet hours, cooldown periods, and optional morning summaries. The owner receives anonymized usage statistics and alert tallies for analytics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto traders
- casual crypto holders

## Success criteria

- Users can add/remove watchlist items with alerts
- Threshold and percent-change alerts trigger accurately
- Morning summaries are delivered at configured local times
- Owner receives anonymized daily stats with top 10 tickers
- Unknown ticker inputs are resolved with suggestions

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Begin onboarding and open main menu
- **Add Common Coin** (button, actor: user, callback: watchlist:common) — Add one of the pre-seeded major cryptocurrencies to watchlist
  - inputs: coin selection
  - outputs: updated watchlist
- **Add Custom Ticker** (button, actor: user, callback: watchlist:custom) — Enter a custom cryptocurrency ticker symbol
  - inputs: ticker symbol
  - outputs: watchlist item creation
- **Configure Alerts** (button, actor: user, callback: alerts:configure) — Manage alert types for selected watchlist items
  - inputs: alert type, price threshold, percent change
  - outputs: configured alert rules
- **/price** (command, actor: user, command: /price) — Request current price of specific ticker or full watchlist
  - inputs: ticker symbol or 'all'
  - outputs: price information with percent change
- **Toggle Morning Summary** (button, actor: user, callback: summary:toggle) — Enable/disable daily price summary at configured time
  - inputs: local time preference
  - outputs: summary schedule status
- **/stats** (command, actor: owner, command: /stats) — View anonymized usage statistics and top alert tickers
  - inputs: none
  - outputs: aggregated analytics data

## Flows

### onboarding_flow
_Trigger:_ /start

1. Display welcome message with feature overview
2. Prompt for timezone selection
3. Offer quiet hours configuration
4. Show initial watchlist options

_Data touched:_ user_profile

### watchlist_management
_Trigger:_ watchlist:common or watchlist:custom

1. Display coin selection interface
2. Validate ticker symbol
3. Add to user watchlist
4. Offer alert configuration options

_Data touched:_ watchlist_item

### alert_configuration
_Trigger:_ alerts:configure

1. Select watchlist item
2. Set threshold price
3. Configure percent-change alert
4. Save alert preferences

_Data touched:_ watchlist_item, alert_record

### price_check
_Trigger:_ /price

1. Parse ticker parameter
2. Fetch current price data
3. Format price response with % change
4. Send to user

_Data touched:_ watchlist_item, price_feed

### daily_summary
_Trigger:_ scheduled_event

1. Check summary enable status
2. Filter out quiet-hour users
3. Compile watchlist prices
4. Send formatted summary

_Data touched:_ user_profile, watchlist_item

### alert_delivery
_Trigger:_ price_threshold_crossed or percent_change_detected

1. Check quiet hours
2. Verify cooldown period
3. Send alert with trigger details
4. Record alert event

_Data touched:_ user_profile, watchlist_item, alert_record

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user_profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: telegram_id, timezone, quiet_hours_start, quiet_hours_end, summary_time, cooldown_length, enabled_alert_types
- **watchlist_item** _(retention: persistent)_ — Monitored cryptocurrency with alert rules
  - fields: ticker_symbol, friendly_name, threshold_alerts, percent_change_alert_flag, percent_change_value, last_notified_price, last_notified_time, enabled_status
- **alert_record** _(retention: persistent)_ — Analytics data for owner visibility
  - fields: anonymized_user_id, ticker, alert_type, trigger_timestamp

## Integrations

- **Telegram** (required) — Private chat communication and alert delivery
- **Price Feed API** (required) — Market price data with retry logic
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /stats command for daily usage analytics
- View top 10 most-fired tickers

## Notifications

- Price threshold alerts
- Percent-change alerts
- Daily morning summaries
- Owner analytics reports

## Permissions & privacy

- All user data stored privately with no sharing
- Anonymized user IDs in owner analytics
- No exchange account access or personal financial data collection

## Edge cases

- Unconfigured timezone during alert delivery
- Invalid ticker symbol input with auto-suggestions
- Quiet hours overlapping with scheduled summary
- Price feed failures with silent retries
- Multiple alert types on same ticker requiring separate cooldown tracking

## Required tests

- End-to-end alert triggering with cooldown suppression
- Morning summary delivery during non-quiet hours
- Watchlist management with both button and free-text inputs
- Owner stats aggregation with anonymization
- Quiet hours alert queuing and batch delivery

## Assumptions

- Price feed API details will be provided later
- Morning summary format is compact and non-intrusive
- Anonymization method for user stats is to be determined
- Basic retry logic for price feed failures is sufficient
