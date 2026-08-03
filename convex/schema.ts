import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    anonymousId: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    lastPlayedSurahNumber: v.optional(v.number()),
    lastPlayedAyahNumberInSurah: v.optional(v.number()),
    lastPlayedAt: v.optional(v.number()),
  }).index("by_anonymousId", ["anonymousId"]),

  preferences: defineTable({
    userId: v.id("users"),
    reciterFolder: v.string(),
    showUrdu: v.boolean(),
    showEnglish: v.boolean(),
    urduEdition: v.string(),
    englishEdition: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  ayahProgress: defineTable({
    userId: v.id("users"),
    surahNumber: v.number(),
    ayahNumberInSurah: v.number(),
    globalAyahNumber: v.number(),
    listenedAt: v.number(),
    source: v.union(v.literal("auto"), v.literal("manual")),
    // Reserved for Phase 2 room-scoped listens; unused and always absent in V1.
    roomId: v.optional(v.id("rooms")),
  })
    .index("by_user_global", ["userId", "globalAyahNumber"])
    .index("by_user_surah", ["userId", "surahNumber"]),

  quranContentCache: defineTable({
    surahNumber: v.number(),
    editionsKey: v.string(),
    payload: v.string(),
    fetchedAt: v.number(),
  }).index("by_surah_editions", ["surahNumber", "editionsKey"]),

  // Phase 2 (unbuilt in V1): synced-listening rooms. Declared now only so
  // `ayahProgress.roomId` above type-checks as a forward-compatible reference.
  rooms: defineTable({
    code: v.string(),
    hostUserId: v.id("users"),
  }).index("by_code", ["code"]),
});
