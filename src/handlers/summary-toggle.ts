import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton, registerMainMenuItem } from "../toolkit/index.js";
import { getStore } from "../store.js";

// Register this feature in the main menu
registerMainMenuItem({ label: "🌅 Morning Summary", data: "summary:toggle", order: 50 });

const composer = new Composer<Ctx>();

composer.callbackQuery("summary:toggle", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Enable/disable daily price summary at configured time");

  const store = getStore();
  const profile = await store.getUserProfile(ctx.from?.id ?? 0);

  const isEnabled = profile.summary_enabled ?? false;
  const summaryTime = profile.summary_time ?? "08:00";

  await ctx.reply(
    `Morning summary is currently **${isEnabled ? "ON" : "OFF"}**.\n` +
    `Delivery time: ${summaryTime} (your local time).`,
    {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard([
        [inlineButton(
          isEnabled ? "🔕 Disable summary" : "🔔 Enable summary",
          "summary:enable"
        )],
        [inlineButton("⏰ Set time", "summary:settime")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

// Toggle summary enabled/disabled
composer.callbackQuery("summary:enable", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const profile = await store.getUserProfile(ctx.from?.id ?? 0);

  profile.summary_enabled = !(profile.summary_enabled ?? false);
  await store.saveUserProfile(profile);

  const isEnabled = profile.summary_enabled;
  const summaryTime = profile.summary_time ?? "08:00";

  await ctx.editMessageText(
    `Morning summary is now **${isEnabled ? "ON" : "OFF"}**.\n` +
    `Delivery time: ${summaryTime} (your local time).`,
    {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard([
        [inlineButton(
          isEnabled ? "🔕 Disable summary" : "🔔 Enable summary",
          "summary:enable"
        )],
        [inlineButton("⏰ Set time", "summary:settime")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

// Set summary time
composer.callbackQuery("summary:settime", async (ctx) => {
  await ctx.answerCallbackQuery();

  const timeOptions = [
    { label: "6:00 AM", value: "06:00" },
    { label: "7:00 AM", value: "07:00" },
    { label: "8:00 AM", value: "08:00" },
    { label: "9:00 AM", value: "09:00" },
    { label: "10:00 AM", value: "10:00" },
  ];

  const keyboard = inlineKeyboard(
    timeOptions.map(opt => [inlineButton(opt.label, `time:${opt.value}`)])
  );

  await ctx.reply("When should I send your morning summary?", {
    reply_markup: keyboard,
  });
});

// Handle time selection
composer.callbackQuery(/^time:([0-2]\d:[0-5]\d)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match?.[1];
  if (!time || !ctx.from) return;

  const store = getStore();
  const profile = await store.getUserProfile(ctx.from.id);
  profile.summary_time = time;
  profile.summary_enabled = true; // Enable when setting time
  await store.saveUserProfile(profile);

  await ctx.reply(
    `✅ Morning summary enabled at ${time} (your local time).`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

export default composer;
