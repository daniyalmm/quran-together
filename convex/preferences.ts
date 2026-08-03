import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    reciterFolder: v.optional(v.string()),
    showUrdu: v.optional(v.boolean()),
    showEnglish: v.optional(v.boolean()),
    urduEdition: v.optional(v.string()),
    englishEdition: v.optional(v.string()),
    playbackRate: v.optional(v.number()),
    pauseAfterAyah: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, ...patch } = args;
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) throw new Error("Preferences not found for user");
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
  },
});
