import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TOTAL_AYAHS } from "../lib/quran-meta";

export const reportAyahPlayback = mutation({
  args: {
    userId: v.id("users"),
    surahNumber: v.number(),
    ayahNumberInSurah: v.number(),
    globalAyahNumber: v.number(),
    completed: v.boolean(),
    source: v.union(v.literal("auto"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      lastPlayedSurahNumber: args.surahNumber,
      lastPlayedAyahNumberInSurah: args.ayahNumberInSurah,
      lastPlayedAt: now,
    });

    if (!args.completed) return;

    const existing = await ctx.db
      .query("ayahProgress")
      .withIndex("by_user_global", (q) =>
        q.eq("userId", args.userId).eq("globalAyahNumber", args.globalAyahNumber)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { listenedAt: now, source: args.source });
      return;
    }

    await ctx.db.insert("ayahProgress", {
      userId: args.userId,
      surahNumber: args.surahNumber,
      ayahNumberInSurah: args.ayahNumberInSurah,
      globalAyahNumber: args.globalAyahNumber,
      listenedAt: now,
      source: args.source,
    });
  },
});

export const unmarkAyah = mutation({
  args: { userId: v.id("users"), globalAyahNumber: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ayahProgress")
      .withIndex("by_user_global", (q) =>
        q.eq("userId", args.userId).eq("globalAyahNumber", args.globalAyahNumber)
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getSurahProgress = query({
  args: { userId: v.id("users"), surahNumber: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ayahProgress")
      .withIndex("by_user_surah", (q) =>
        q.eq("userId", args.userId).eq("surahNumber", args.surahNumber)
      )
      .collect();
    return {
      listenedAyahNumbers: rows.map((r) => r.ayahNumberInSurah),
    };
  },
});

export const getOverallProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ayahProgress")
      .withIndex("by_user_global", (q) => q.eq("userId", args.userId))
      .collect();

    const perSurahCounts: Record<number, number> = {};
    for (const row of rows) {
      perSurahCounts[row.surahNumber] = (perSurahCounts[row.surahNumber] ?? 0) + 1;
    }

    return {
      totalListened: rows.length,
      totalAyahs: TOTAL_AYAHS,
      percent: Math.round((rows.length / TOTAL_AYAHS) * 1000) / 10,
      perSurahCounts,
    };
  },
});

export const getLastPosition = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.lastPlayedSurahNumber || !user.lastPlayedAyahNumberInSurah) return null;
    return {
      surahNumber: user.lastPlayedSurahNumber,
      ayahNumberInSurah: user.lastPlayedAyahNumberInSurah,
      lastPlayedAt: user.lastPlayedAt ?? null,
    };
  },
});

export const resetProgress = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ayahProgress")
      .withIndex("by_user_global", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.patch(args.userId, {
      lastPlayedSurahNumber: undefined,
      lastPlayedAyahNumberInSurah: undefined,
      lastPlayedAt: undefined,
    });
  },
});
