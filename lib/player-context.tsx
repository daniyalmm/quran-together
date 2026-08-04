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
  skipBack10: () => void;
  skipForward10: () => void;
  previousSurah: () => void;
  nextSurah: () => void;
  /** Seeks to `percent` (0-100) of the current session timeline — used by the scrubber. */
  seekToPercent: (percent: number) => void;
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
  // Average measured duration per segment kind — kept separate because
  // spoken translation clips run noticeably longer than the Arabic
  // recitation of the same ayah, so one blended average would badly skew
  // estimates for whichever kind is actually still ahead.
  const kindTotalsRef = useRef<Record<SegmentKind, { sum: number; count: number }>>({
    arabic: { sum: 0, count: 0 },
    english: { sum: 0, count: 0 },
    urdu: { sum: 0, count: 0 },
  });
  const sessionStartRef = useRef<{ surahNumber: number; ayahNumberInSurah: number } | null>(null);
  const [sessionPositionSeconds, setSessionPositionSeconds] = useState(0);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number | null>(null);
  const sessionDurationRef = useRef<number | null>(null);

  function averageSecondsForKind(kind: SegmentKind): number {
    const totals = kindTotalsRef.current[kind];
    return totals.count > 0 ? totals.sum / totals.count : FALLBACK_SEGMENT_SECONDS;
  }

  function recordMeasuredDuration(segment: Segment, seconds: number) {
    segmentDurationsRef.current.set(segment.url, seconds);
    const totals = kindTotalsRef.current[segment.kind];
    totals.sum += seconds;
    totals.count += 1;
  }

  /** Estimated seconds for `segment` (using its known duration if measured) through the end of its surah. */
  function estimateSecondsFrom(segment: Segment, showEnglish: boolean, showUrdu: boolean): number {
    const totalAyahs = getSurahMeta(segment.surahNumber).numberOfAyahs;
    let total = segmentDurationsRef.current.get(segment.url) ?? averageSecondsForKind(segment.kind);

    if (segment.kind === "arabic") {
      if (showEnglish) total += averageSecondsForKind("english");
      if (showUrdu) total += averageSecondsForKind("urdu");
    } else if (segment.kind === "english" && showUrdu) {
      total += averageSecondsForKind("urdu");
    }

    const perAyah =
      averageSecondsForKind("arabic") +
      (showEnglish ? averageSecondsForKind("english") : 0) +
      (showUrdu ? averageSecondsForKind("urdu") : 0);
    const fullAyahsAfterThis = totalAyahs - segment.ayahNumberInSurah;
    return total + fullAyahsAfterThis * perAyah;
  }

  function updateSessionTiming() {
    const segment = currentSegmentRef.current;
    const el = slotEl(activeSlotRef.current);
    if (!segment || !el) return;
    const estimatedDuration =
      elapsedSecondsRef.current + estimateSecondsFrom(segment, showEnglishRef.current, showUrduRef.current);
    const position = elapsedSecondsRef.current + (Number.isFinite(el.currentTime) ? el.currentTime : 0);

    setSessionPositionSeconds(position);
    setSessionDurationSeconds(estimatedDuration);
    sessionDurationRef.current = estimatedDuration;

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
    sessionStartRef.current = { surahNumber: segment.surahNumber, ayahNumberInSurah: segment.ayahNumberInSurah };
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

  /**
   * Walks forward segment-by-segment from the current session's start point,
   * using real measured durations where known and the running average
   * elsewhere, until the accumulated time reaches `targetSeconds` — then
   * jumps there. This is how both the scrubber and the ±10s buttons seek,
   * since the underlying audio is many short per-ayah clips, not one
   * scrubbable track.
   */
  function seekToSeconds(targetSeconds: number) {
    if (!Number.isFinite(targetSeconds)) return;
    const start = sessionStartRef.current;
    if (!start) return;
    const showEn = showEnglishRef.current;
    const showUr = showUrduRef.current;
    const folder = reciterFolderRef.current;
    const clampedTarget = Math.max(0, targetSeconds);

    let cursor: Segment = makeSegment(start.surahNumber, start.ayahNumberInSurah, "arabic", folder);
    let accumulated = 0;
    // Bounded by the number of segments in the whole Quran — never actually reaches that in practice.
    for (let i = 0; i < 20000; i++) {
      const segDuration = segmentDurationsRef.current.get(cursor.url) ?? averageSecondsForKind(cursor.kind);
      if (accumulated + segDuration > clampedTarget) break;
      accumulated += segDuration;
      const next = getNextSegment(cursor, showEn, showUr, folder);
      if (!next) break;
      cursor = next;
    }

    const wasPlaying = isPlaying;
    loadSegment(makeSegment(cursor.surahNumber, cursor.ayahNumberInSurah, "arabic", folder), wasPlaying);
    // loadSegment resets the session anchor to this landing ayah — restore
    // the original anchor and elapsed time so the timeline keeps referring
    // to the same start point the user was scrubbing/skipping within.
    sessionStartRef.current = start;
    elapsedSecondsRef.current = accumulated;
  }

  function skipBack10() {
    seekToSeconds(sessionPositionSeconds - 10);
  }

  function skipForward10() {
    seekToSeconds(sessionPositionSeconds + 10);
  }

  function seekToPercent(percent: number) {
    const duration = sessionDurationRef.current;
    if (duration === null || !Number.isFinite(percent)) return;
    const clampedPercent = Math.min(100, Math.max(0, percent));
    seekToSeconds((clampedPercent / 100) * duration);
  }

  function previousSurah() {
    const current = currentSegmentRef.current;
    if (!current || current.surahNumber <= 1) return;
    loadSegment(makeSegment(current.surahNumber - 1, 1, "arabic", reciterFolderRef.current), isPlaying);
  }

  function nextSurah() {
    const current = currentSegmentRef.current;
    if (!current || current.surahNumber >= TOTAL_SURAHS) return;
    loadSegment(makeSegment(current.surahNumber + 1, 1, "arabic", reciterFolderRef.current), isPlaying);
  }

  function handleSlotEnded(slot: 0 | 1) {
    if (slot !== activeSlotRef.current) return;
    const finished = currentSegmentRef.current;
    const finishedEl = slotEl(slot);
    if (!finished) return;

    const finishedDuration = finishedEl && Number.isFinite(finishedEl.duration) ? finishedEl.duration : null;
    if (finishedDuration !== null) {
      recordMeasuredDuration(finished, finishedDuration);
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
    navigator.mediaSession.setActionHandler("previoustrack", () => previousSurah());
    navigator.mediaSession.setActionHandler("nexttrack", () => nextSurah());
    navigator.mediaSession.setActionHandler("seekbackward", () => skipBack10());
    navigator.mediaSession.setActionHandler("seekforward", () => skipForward10());
    try {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (typeof details.seekTime === "number") seekToSeconds(details.seekTime);
      });
    } catch {
      // Not all browsers support the "seekto" action.
    }
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
    skipBack10,
    skipForward10,
    previousSurah,
    nextSurah,
    seekToPercent,
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
