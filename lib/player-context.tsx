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
  const userIdRef = useRef(userId);
  useEffect(() => {
    reciterFolderRef.current = reciterFolder;
    showEnglishRef.current = showEnglish;
    showUrduRef.current = showUrdu;
    pauseAfterAyahRef.current = pauseAfterAyah;
    userIdRef.current = userId;
  }, [reciterFolder, showEnglish, showUrdu, pauseAfterAyah, userId]);

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

  /** Loads `segment` into the active slot and optionally starts it. */
  function loadSegment(segment: Segment, autoplay: boolean) {
    const slot = activeSlotRef.current;
    const el = slotEl(slot);
    if (!el) return;
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
    if (!finished) return;

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
      <audio ref={audioRef0} onEnded={() => handleSlotEnded(0)} />
      <audio ref={audioRef1} onEnded={() => handleSlotEnded(1)} />
    </PlayerContext.Provider>
  );
}
