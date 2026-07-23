import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { getStore } from "../store.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

// Common timezones for crypto traders
const COMMON_TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "US Eastern (ET)", value: "America/New_York" },
  { label: "US Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Singapore", value: "Asia/Singapore" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
];

composer.command("start", async (ctx) => {
  // Always show the welcome message with main menu (matches test spec)
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });

  // Check if user needs onboarding (new user without timezone)
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await store.getUserProfile(userId);
  if (!profile.timezone) {
    // New user: prompt for timezone setup
    const timezoneKeyboard = inlineKeyboard(
      COMMON_TIMEZONES.map(tz => [inlineButton(tz.label, `tz:${tz.value}`)])
    );
    
    await ctx.reply(
      "It looks like this is your first time! Set your timezone so alerts arrive at the right time.",
      { reply_markup: timezoneKeyboard }
    );
  }
});

// Timezone selection callback
composer.callbackQuery(/^tz:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const timezone = ctx.match?.[1];
  if (!timezone || !ctx.from) return;

  const store = getStore();
  const profile = await store.getUserProfile(ctx.from.id);
  profile.timezone = timezone;
  profile.cooldown_length = 60; // Default 1 hour cooldown
  profile.enabled_alert_types = ["threshold", "percent"]; // Enable both by default
  await store.saveUserProfile(profile);

  // Show quiet hours configuration
  const quietHoursKeyboard = inlineKeyboard([
    [inlineButton("No quiet hours", "qh:none")],
    [inlineButton("10 PM – 8 AM", "qh:22-8")],
    [inlineButton("11 PM – 7 AM", "qh:23-7")],
    [inlineButton("12 AM – 6 AM", "qh:0-6")],
  ]);

  await ctx.editMessageText(
    "✅ Timezone set!\n\nNow, would you like to set quiet hours? " +
    "During quiet hours, alerts won't disturb you.",
    { reply_markup: quietHoursKeyboard }
  );
});

// Quiet hours callback
composer.callbackQuery(/^qh:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const hours = ctx.match?.[1];
  if (!ctx.from) return;

  const store = getStore();
  const profile = await store.getUserProfile(ctx.from.id);

  if (hours === "none") {
    profile.quiet_hours_start = undefined;
    profile.quiet_hours_end = undefined;
  } else {
    const [start, end] = hours.split("-").map(Number);
    profile.quiet_hours_start = start;
    profile.quiet_hours_end = end;
  }

  await store.saveUserProfile(profile);

  // Show confirmation and return to menu
  await ctx.editMessageText(
    "✅ Quiet hours configured!",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
  );
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
