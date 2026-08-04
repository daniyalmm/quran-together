"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { getGlobalAyahNumber, getSurahMeta, TOTAL_SURAHS } from "@/lib/quran-meta";
import {
  DEFAULT_RECITER_FOLDER,
  ENGLISH_TRANSLATION_AUDIO_FOLDER,
  URDU_TRANSLATION_AUDIO_FOLDER,
  RECITERS,
} from "@/lib/editions";
import { buildAyahAudioUrl } from "@/lib/audio-url";

export type SegmentKind = "arabic" | "english" | "urdu";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

interface Segment {
  surahNumber: number;
  ayahNumberInSurah: number;
  kind: SegmentKind;
  url: string;
}

function segmentUrl(
  surahNumber: number,
  ayahNumberInSurah: number,
  kind: SegmentKind,
  reciterFolder: string
): string {
  const folder =
    kind === "arabic"
      ? reciterFolder
      : kind === "english"
        ? ENGLISH_TRANSLATION_AUDIO_FOLDER
        : URDU_TRANSLATION_AUDIO_FOLDER;
  return buildAyahAudioUrl(folder, surahNumber, ayahNumberInSurah);
}

function makeSegment(
  surahNumber: number,
  ayahNumberInSurah: number,
  kind: SegmentKind,
  reciterFolder: string
): Segment {
  return {
    surahNumber,
    ayahNumberInSurah,
    kind,
    url: segmentUrl(surahNumber, ayahNumberInSurah, kind, reciterFolder),
  };
}

/** The segment that immediately follows `segment` in the playback sequence, or null past the end of the Quran. */
function getNextSegment(
  segment: Segment,
  showEnglish: boolean,
  showUrdu: boolean,
  reciterFolder: string
): Segment | null {
  const { surahNumber, ayahNumberInSurah, kind } = segment;
  if (kind === "arabic" && showEnglish) {
    return makeSegment(surahNumber, ayahNumberInSurah, "english", reciterFolder);
  }
  if (kind !== "urdu" && showUrdu) {
    return makeSegment(surahNumber, ayahNumberInSurah, "urdu", reciterFolder);
  }
  const totalAyahs = getSurahMeta(surahNumber).numberOfAyahs;
  if (ayahNumberInSurah < totalAyahs) {
    return makeSegment(surahNumber, ayahNumberInSurah + 1, "arabic", reciterFolder);
  }
  if (surahNumber < TOTAL_SURAHS) {
    return makeSegment(surahNumber + 1, 1, "arabic", reciterFolder);
  }
  return null;
}

/** How many segments remain from (and including) `segment` through the end of its surah. */
function countRemainingSegmentsInSurah(
  segment: Segment,
  showEnglish: boolean,
  showUrdu: boolean
): number {
  const kindsPerAyah = 1 + (showEnglish ? 1 : 0) + (showUrdu ? 1 : 0);
  const totalAyahs = getSurahMeta(segment.surahNumber).numberOfAyahs;
  const fullAyahsAfterThis = totalAyahs - segment.ayahNumberInSurah;
  const kindsLeftInThisAyah =
    segment.kind === "arabic" ? kindsPerAyah - 1 : segment.kind === "english" ? (showUrdu ? 1 : 0) : 0;
  return 1 + kindsLeftInThisAyah + fullAyahsAfterThis * kindsPerAyah;
}

const FALLBACK_SEGMENT_SECONDS = 4;

interface PlayerContextValue {
  surahNumber: number | null;
  ayahNumberInSurah: number | null;
  playingKind: SegmentKind | null;
  isPlaying: boolean;
  reciterFolder: string;
  showEnglish: boolean;
  showUrdu: boolean;
  playbackRate: number;
  pauseAfterAyah: boolean;
  /** Seconds elapsed in the current surah-wide listening session (since the last manual jump). */
  sessionPositionSeconds: number;
  /** Estimated total seconds for the rest of this listening session — refines as more segments are measured. */
  sessionDurationSeconds: number | null;
  playFromAyah: (surahNumber: number, ayahNumberInSurah: number) => void;
  togglePlayPause: () => void;
  skipPrev: () => void;
  skipNext: () => void;
  setReciterFolder: (folder: string) => void;
  setShowEnglish: (value: boolean) => void;
  setShowUrdu: (value: boolean) => void;
  cyclePlaybackRate: () => void;
  setPauseAfterAyah: (value: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useIdentity();
  const preferences = useQuery(api.preferences.getPreferences, userId ? { userId } : "skip");
  const updatePreferences = useMutation(api.preferences.updatePreferences);
  const reportAyahPlayback = useMutation(api.progress.reportAyahPlayback);

  const reciterFolder = preferences?.reciterFolder ?? DEFAULT_RECITER_FOLDER;
  const showEnglish = preferences?.showEnglish ?? false;
  const showUrdu = preferences?.showUrdu ?? false;
  const playbackRate = preferences?.playbackRate ?? 1;
  const pauseAfterAyah = preferences?.pauseAfterAyah ?? false;

  // Mirrors of the values above, kept current so the imperative audio-event
  // handlers (bound once per render but invoked by browser media events at
  // unpredictable times) never act on a stale closure.
  const reciterFolderRef = useRef(reciterFolder);
  const showEnglishRef = useRef(showEnglish);
  const showUrduRef = useRef(showUrdu);
  const pauseAfterAyahRef = useRef(pauseAfterAyah);
  const playbackRateRef = useRef(playbackRate);
  const userIdRef = useRef(userId);
  useEffect(() => {
    reciterFolderRef.current = reciterFolder;
    showEnglishRef.current = showEnglish;
    showUrduRef.current = showUrdu;
    pauseAfterAyahRef.current = pauseAfterAyah;
    playbackRateRef.current = playbackRate;
    userIdRef.current = userId;
  }, [reciterFolder, showEnglish, showUrdu, pauseAfterAyah, playbackRate, userId]);

  const audioRef0 = useRef<HTMLAudioElement | null>(null);
  const audioRef1 = useRef<HTMLAudioElement | null>(null);
  const slotEl = (slot: 0 | 1) => (slot === 0 ? audioRef0.current : audioRef1.current);
  const activeSlotRef = useRef<0 | 1>(0);

  const [currentSegment, setCurrentSegmentState] = useState<Segment | null>(null);
  const currentSegmentRef = useRef<Segment | null>(null);
  function setCurrentSegment(segment: Segment | null) {
    currentSegmentRef.current = segment;
    setCurrentSegmentState(segment);
  }

  const [isPlaying, setIsPlaying] = useState(false);

  // Whole-surah-session position/duration: real audio files are one short
  // clip per ayah (and per translation), so instead of reporting each tiny
  // clip's own duration to the OS media session / our own progress bar, we
  // treat the run from the last manual jump through to the end of the surah
  // as one continuous "track" — `elapsedSecondsRef` accumulates the real,
  // now-known duration of every segment already finished, and
  // `segmentDurationsRef` caches every measured duration by URL so the
  // estimate for not-yet-played segments (their average) keeps improving.
  const elapsedSecondsRef = useRef(0);
  const segmentDurationsRef = useRef<Map<string, number>>(new Map());
  const [sessionPositionSeconds, setSessionPositionSeconds] = useState(0);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number | null>(null);

  function averageKnownSegmentSeconds(): number {
    const values = Array.from(segmentDurationsRef.current.values());
    if (values.length === 0) return FALLBACK_SEGMENT_SECONDS;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function updateSessionTiming() {
    const segment = currentSegmentRef.current;
    const el = slotEl(activeSlotRef.current);
    if (!segment || !el) return;
    const currentKnown = Number.isFinite(el.duration) ? el.duration : undefined;
    const avg = averageKnownSegmentSeconds();
    const remaining = countRemainingSegmentsInSurah(segment, showEnglishRef.current, showUrduRef.current);
    const estimatedDuration =
      elapsedSecondsRef.current + (currentKnown ?? avg) + Math.max(0, remaining - 1) * avg;
    const position = elapsedSecondsRef.current + (Number.isFinite(el.currentTime) ? el.currentTime : 0);

    setSessionPositionSeconds(position);
    setSessionDurationSeconds(estimatedDuration);

    if (typeof navigator !== "undefined" && "mediaSession" in navigator && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: estimatedDuration,
          position: Math.min(position, estimatedDuration),
          playbackRate: playbackRateRef.current,
        });
      } catch {
        // Duration/position can transiently be inconsistent right as a segment swaps — safe to ignore.
      }
    }
  }

  useEffect(() => {
    if (audioRef0.current) audioRef0.current.playbackRate = playbackRate;
    if (audioRef1.current) audioRef1.current.playbackRate = playbackRate;
  }, [playbackRate]);

  function preloadIntoInactiveSlot(after: Segment) {
    const next = getNextSegment(after, showEnglishRef.current, showUrduRef.current, reciterFolderRef.current);
    if (!next) return;
    const inactive = activeSlotRef.current === 0 ? 1 : 0;
    const el = slotEl(inactive);
    if (!el) return;
    el.src = next.url;
    el.playbackRate = playbackRate;
    el.load();
  }

  /** Loads `segment` into the active slot and optionally starts it — a manual jump, so the session timer resets here. */
  function loadSegment(segment: Segment, autoplay: boolean) {
    const slot = activeSlotRef.current;
    const el = slotEl(slot);
    if (!el) return;
    elapsedSecondsRef.current = 0;
    el.src = segment.url;
    el.playbackRate = playbackRate;
    setCurrentSegment(segment);
    setIsPlaying(autoplay);
    if (autoplay) {
      el.play().catch(() => {});
    } else {
      el.load();
    }
    preloadIntoInactiveSlot(segment);
  }

  function playFromAyah(surahNumber: number, ayahNumberInSurah: number) {
    loadSegment(makeSegment(surahNumber, ayahNumberInSurah, "arabic", reciterFolderRef.current), true);
  }

  function togglePlayPause() {
    const el = slotEl(activeSlotRef.current);
    if (!el || !currentSegmentRef.current) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function skipByAyah(offset: 1 | -1) {
    const current = currentSegmentRef.current;
    if (!current) return;
    let surahNumber = current.surahNumber;
    let ayahNumberInSurah = current.ayahNumberInSurah + offset;
    if (ayahNumberInSurah < 1) {
      surahNumber -= 1;
      if (surahNumber < 1) return;
      ayahNumberInSurah = getSurahMeta(surahNumber).numberOfAyahs;
    } else if (ayahNumberInSurah > getSurahMeta(surahNumber).numberOfAyahs) {
      surahNumber += 1;
      if (surahNumber > TOTAL_SURAHS) return;
      ayahNumberInSurah = 1;
    }
    loadSegment(
      makeSegment(surahNumber, ayahNumberInSurah, "arabic", reciterFolderRef.current),
      isPlaying
    );
  }

  function handleSlotEnded(slot: 0 | 1) {
    if (slot !== activeSlotRef.current) return;
    const finished = currentSegmentRef.current;
    const finishedEl = slotEl(slot);
    if (!finished) return;

    const finishedDuration = finishedEl && Number.isFinite(finishedEl.duration) ? finishedEl.duration : null;
    if (finishedDuration !== null) {
      segmentDurationsRef.current.set(finished.url, finishedDuration);
      elapsedSecondsRef.current += finishedDuration;
    }

    if (finished.kind === "arabic" && userIdRef.current) {
      reportAyahPlayback({
        userId: userIdRef.current,
        surahNumber: finished.surahNumber,
        ayahNumberInSurah: finished.ayahNumberInSurah,
        globalAyahNumber: getGlobalAyahNumber(finished.surahNumber, finished.ayahNumberInSurah),
        completed: true,
        source: "auto",
      });
    }

    const next = getNextSegment(finished, showEnglishRef.current, showUrduRef.current, reciterFolderRef.current);
    if (!next) {
      setIsPlaying(false);
      return;
    }

    const crossedAyah =
      next.surahNumber !== finished.surahNumber || next.ayahNumberInSurah !== finished.ayahNumberInSurah;
    const shouldAutoplay = !crossedAyah || !pauseAfterAyahRef.current;

    // The inactive slot already has `next` preloaded (from the previous
    // preload call) — swap to it for a near-instant, gapless transition.
    const newActiveSlot = activeSlotRef.current === 0 ? 1 : 0;
    activeSlotRef.current = newActiveSlot;
    const el = slotEl(newActiveSlot);
    setCurrentSegment(next);
    if (shouldAutoplay && el) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
    preloadIntoInactiveSlot(next);
    updateSessionTiming();
  }

  function setReciterFolder(folder: string) {
    if (userId) updatePreferences({ userId, reciterFolder: folder });
  }
  function setShowEnglish(value: boolean) {
    if (userId) updatePreferences({ userId, showEnglish: value });
  }
  function setShowUrdu(value: boolean) {
    if (userId) updatePreferences({ userId, showUrdu: value });
  }
  function setPauseAfterAyah(value: boolean) {
    if (userId) updatePreferences({ userId, pauseAfterAyah: value });
  }
  function cyclePlaybackRate() {
    if (!userId) return;
    const idx = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    updatePreferences({ userId, playbackRate: next });
  }

  // Lock-screen / OS media control surface: shows the surah (not the tiny
  // per-ayah clip) as the "track", and wires physical/lock-screen transport
  // buttons back to our ayah-level controls. Re-runs every render so the
  // handlers always close over the latest functions/state — cheap to reassign.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
    navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
    navigator.mediaSession.setActionHandler("previoustrack", () => skipByAyah(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => skipByAyah(1));
    navigator.mediaSession.setActionHandler("seekbackward", () => skipByAyah(-1));
    navigator.mediaSession.setActionHandler("seekforward", () => skipByAyah(1));
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!currentSegment) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const surahMeta = getSurahMeta(currentSegment.surahNumber);
    const reciterLabel = RECITERS.find((r) => r.folder === reciterFolder)?.label ?? "Quran Together";
    navigator.mediaSession.metadata = new MediaMetadata({
      title: surahMeta.englishName,
      artist: reciterLabel,
      album: "Quran Together",
    });
    // Only the surah (not every ayah) should refresh the lock-screen metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegment?.surahNumber, reciterFolder]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const value: PlayerContextValue = {
    surahNumber: currentSegment?.surahNumber ?? null,
    ayahNumberInSurah: currentSegment?.ayahNumberInSurah ?? null,
    playingKind: currentSegment?.kind ?? null,
    isPlaying,
    reciterFolder,
    showEnglish,
    showUrdu,
    playbackRate,
    pauseAfterAyah,
    sessionPositionSeconds,
    sessionDurationSeconds,
    playFromAyah,
    togglePlayPause,
    skipPrev: () => skipByAyah(-1),
    skipNext: () => skipByAyah(1),
    setReciterFolder,
    setShowEnglish,
    setShowUrdu,
    cyclePlaybackRate,
    setPauseAfterAyah,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef0} onEnded={() => handleSlotEnded(0)} onTimeUpdate={updateSessionTiming} />
      <audio ref={audioRef1} onEnded={() => handleSlotEnded(1)} onTimeUpdate={updateSessionTiming} />
    </PlayerContext.Provider>
  );
}
