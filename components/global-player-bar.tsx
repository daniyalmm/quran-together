"use client";

import Link from "next/link";
import { Play, Pause, SkipBack, SkipForward, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECITERS, RECITER_ITEMS } from "@/lib/editions";
import { usePlayer } from "@/lib/player-context";
import { getSurahMeta } from "@/lib/quran-meta";
import { cn } from "@/lib/utils";

const SEGMENT_LABEL: Record<string, string> = {
  arabic: "Recitation",
  english: "English translation",
  urdu: "Urdu translation",
};

export function GlobalPlayerBar() {
  const player = usePlayer();

  if (player.surahNumber === null || player.ayahNumberInSurah === null) return null;

  const surahMeta = getSurahMeta(player.surahNumber);

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-3">
        <Link
          href={`/surah/${player.surahNumber}`}
          className="flex items-center justify-between gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="truncate">
            <span className="font-medium text-foreground">{surahMeta.englishName}</span>
            {" · Ayah "}
            {player.ayahNumberInSurah} of {surahMeta.numberOfAyahs}
            {player.playingKind && (player.showEnglish || player.showUrdu) && (
              <> · {SEGMENT_LABEL[player.playingKind]}</>
            )}
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <Select
              items={RECITER_ITEMS}
              value={player.reciterFolder}
              onValueChange={(v) => player.setReciterFolder(v as string)}
            >
              <SelectTrigger size="sm" className="shrink-0">
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

            <button
              type="button"
              onClick={() => player.setShowEnglish(!player.showEnglish)}
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                player.showEnglish
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => player.setShowUrdu(!player.showUrdu)}
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                player.showUrdu
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              UR
            </button>

            <button
              type="button"
              onClick={player.cyclePlaybackRate}
              className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              title="Playback speed"
            >
              {player.playbackRate}x
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={player.skipPrev}>
              <SkipBack className="size-4" />
            </Button>
            <Button size="icon-lg" onClick={player.togglePlayPause}>
              {player.isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={player.skipNext}>
              <SkipForward className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
