"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RECITERS,
  RECITER_ITEMS,
  DEFAULT_RECITER_FOLDER,
  ENGLISH_TRANSLATION_AUDIO_FOLDER,
  URDU_TRANSLATION_AUDIO_FOLDER,
} from "@/lib/editions";
import { buildAyahAudioUrl } from "@/lib/audio-url";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SegmentKind = "arabic" | "english" | "urdu";

interface AyahRow {
  numberInSurah: number;
  globalAyahNumber: number;
}

interface Segment {
  kind: SegmentKind;
  url: string;
}

const SEGMENT_LABEL: Record<SegmentKind, string> = {
  arabic: "Recitation",
  english: "English translation",
  urdu: "Urdu translation",
};

/** Arabic recitation, followed by spoken English/Urdu translation if toggled on. */
function buildSegments(
  row: AyahRow,
  folder: string,
  surahNumber: number,
  showEnglish: boolean,
  showUrdu: boolean
): Segment[] {
  const segments: Segment[] = [
    { kind: "arabic", url: buildAyahAudioUrl(folder, surahNumber, row.numberInSurah) },
  ];
  if (showEnglish) {
    segments.push({
      kind: "english",
      url: buildAyahAudioUrl(ENGLISH_TRANSLATION_AUDIO_FOLDER, surahNumber, row.numberInSurah),
    });
  }
  if (showUrdu) {
    segments.push({
      kind: "urdu",
      url: buildAyahAudioUrl(URDU_TRANSLATION_AUDIO_FOLDER, surahNumber, row.numberInSurah),
    });
  }
  return segments;
}

export function AudioPlayer({
  ayahs,
  surahNumber,
  reciterFolder,
  onReciterChange,
  showEnglish,
  showUrdu,
  onToggleEnglish,
  onToggleUrdu,
  currentAyahNumberInSurah,
  onCurrentAyahChange,
  onAyahCompleted,
  onSegmentKindChange,
}: {
  ayahs: AyahRow[];
  surahNumber: number;
  reciterFolder: string | undefined;
  onReciterChange: (folder: string) => void;
  showEnglish: boolean;
  showUrdu: boolean;
  onToggleEnglish: (value: boolean) => void;
  onToggleUrdu: (value: boolean) => void;
  currentAyahNumberInSurah: number | null;
  onCurrentAyahChange: (numberInSurah: number) => void;
  onAyahCompleted: (row: AyahRow) => void;
  onSegmentKindChange?: (kind: SegmentKind | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null);

  const folder = reciterFolder ?? DEFAULT_RECITER_FOLDER;
  const currentIndex = Math.max(
    0,
    ayahs.findIndex(
      (a) => a.numberInSurah === (currentAyahNumberInSurah ?? ayahs[0]?.numberInSurah)
    )
  );
  const currentRow = ayahs[currentIndex];

  const currentSegments = useMemo(
    () => (currentRow ? buildSegments(currentRow, folder, surahNumber, showEnglish, showUrdu) : []),
    [currentRow, folder, surahNumber, showEnglish, showUrdu]
  );

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentResetFor, setSegmentResetFor] = useState<number | null>(null);
  // Resets the segment queue back to the Arabic recitation whenever the
  // current ayah changes (render-time adjustment, not an effect — avoids an
  // extra render/flicker for what is effectively derived state).
  if (currentRow && segmentResetFor !== currentRow.numberInSurah) {
    setSegmentResetFor(currentRow.numberInSurah);
    setSegmentIndex(0);
  }
  const safeSegmentIndex = Math.min(segmentIndex, Math.max(0, currentSegments.length - 1));
  const currentSegment = currentSegments[safeSegmentIndex];

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onSegmentKindChange?.(currentSegment?.kind ?? null);
  }, [currentSegment?.kind, onSegmentKindChange]);

  // Loads whichever segment is "current" into the <audio> element, unless it
  // was already loaded imperatively by handleEnded (tracked via
  // loadedKeyRef) — that avoids a source reset/glitch when React re-renders
  // after ended fires.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSegment) return;
    if (loadedKeyRef.current === currentSegment.url) return;
    loadedKeyRef.current = currentSegment.url;
    audio.src = currentSegment.url;
    if (isPlayingRef.current) audio.play().catch(() => {});
  }, [currentSegment]);

  useEffect(() => {
    let nextUrl = currentSegments[safeSegmentIndex + 1]?.url;
    if (!nextUrl) {
      const nextRow = ayahs[currentIndex + 1];
      if (nextRow) nextUrl = buildSegments(nextRow, folder, surahNumber, showEnglish, showUrdu)[0].url;
    }
    if (!nextUrl) return;
    const preload = new Audio(nextUrl);
    preload.preload = "auto";
  }, [currentSegments, safeSegmentIndex, ayahs, currentIndex, folder, surahNumber, showEnglish, showUrdu]);

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }

  function goToIndex(index: number) {
    const row = ayahs[index];
    if (!row) return;
    onCurrentAyahChange(row.numberInSurah);
  }

  function handleEnded() {
    if (currentSegment?.kind === "arabic" && currentRow) {
      onAyahCompleted(currentRow);
    }

    const audio = audioRef.current;
    const nextSegment = currentSegments[safeSegmentIndex + 1];
    if (nextSegment && audio) {
      loadedKeyRef.current = nextSegment.url;
      audio.src = nextSegment.url;
      audio.play().catch(() => {});
      setSegmentIndex(safeSegmentIndex + 1);
      return;
    }

    const nextRow = ayahs[currentIndex + 1];
    if (nextRow && audio) {
      const firstSegment = buildSegments(nextRow, folder, surahNumber, showEnglish, showUrdu)[0];
      loadedKeyRef.current = firstSegment.url;
      audio.src = firstSegment.url;
      audio.play().catch(() => {});
      setSegmentIndex(0);
      onCurrentAyahChange(nextRow.numberInSurah);
    } else {
      setIsPlaying(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-4">
        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
        />
        <div className="flex items-center justify-between gap-3">
          <Select items={RECITER_ITEMS} value={folder} onValueChange={(v) => onReciterChange(v as string)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECITERS.map((r) => (
                <SelectItem key={r.folder} value={r.folder}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleEnglish(!showEnglish)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                showEnglish
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onToggleUrdu(!showUrdu)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                showUrdu
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              UR
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => goToIndex(currentIndex - 1)}>
              <SkipBack className="size-4" />
            </Button>
            <Button size="icon-lg" onClick={handlePlayPause}>
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => goToIndex(currentIndex + 1)}>
              <SkipForward className="size-4" />
            </Button>
          </div>
        </div>
        {currentRow && (
          <p className="text-center text-xs text-muted-foreground">
            Ayah {currentRow.numberInSurah} of {ayahs.length}
            {currentSegment && (showEnglish || showUrdu) && ` · ${SEGMENT_LABEL[currentSegment.kind]}`}
          </p>
        )}
      </div>
    </div>
  );
}
