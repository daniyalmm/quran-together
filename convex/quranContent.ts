import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const getCachedSurah = query({
  args: { surahNumber: v.number(), editionsKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("quranContentCache")
      .withIndex("by_surah_editions", (q) =>
        q.eq("surahNumber", args.surahNumber).eq("editionsKey", args.editionsKey)
      )
      .unique();
    return row ? row.payload : null;
  },
});

export const cacheSurah = internalMutation({
  args: { surahNumber: v.number(), editionsKey: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("quranContentCache")
      .withIndex("by_surah_editions", (q) =>
        q.eq("surahNumber", args.surahNumber).eq("editionsKey", args.editionsKey)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { payload: args.payload, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("quranContentCache", {
        surahNumber: args.surahNumber,
        editionsKey: args.editionsKey,
        payload: args.payload,
        fetchedAt: Date.now(),
      });
    }
  },
});

export const fetchAndCacheSurah = action({
  args: { surahNumber: v.number(), editionsKey: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const cached: string | null = await ctx.runQuery(api.quranContent.getCachedSurah, {
      surahNumber: args.surahNumber,
      editionsKey: args.editionsKey,
    });
    if (cached) return cached;

    const url = `https://api.alquran.cloud/v1/surah/${args.surahNumber}/editions/${args.editionsKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`alquran.cloud request failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const payload = JSON.stringify(json.data);

    await ctx.runMutation(internal.quranContent.cacheSurah, {
      surahNumber: args.surahNumber,
      editionsKey: args.editionsKey,
      payload,
    });

    return payload;
  },
});
