import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DEFAULT_RECITER_FOLDER, ENGLISH_TRANSLATION_EDITION, URDU_TRANSLATION_EDITION } from "../lib/editions";

export const getUserByAnonymousId = query({
  args: { anonymousId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_anonymousId", (q) => q.eq("anonymousId", args.anonymousId))
      .unique();
  },
});

export const getOrCreateAnonymousUser = mutation({
  args: { anonymousId: v.string(), displayName: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_anonymousId", (q) => q.eq("anonymousId", args.anonymousId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      anonymousId: args.anonymousId,
      displayName: args.displayName,
      createdAt: now,
      lastSeenAt: now,
    });

    await ctx.db.insert("preferences", {
      userId,
      reciterFolder: DEFAULT_RECITER_FOLDER,
      showUrdu: false,
      showEnglish: true,
      urduEdition: URDU_TRANSLATION_EDITION,
      englishEdition: ENGLISH_TRANSLATION_EDITION,
      updatedAt: now,
    });

    return userId;
  },
});

export const updateDisplayName = mutation({
  args: { userId: v.id("users"), displayName: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { displayName: args.displayName });
  },
});
