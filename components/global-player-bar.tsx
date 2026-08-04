"use client";

import Link from "next/link";
import { Play, Pause, SkipBack, SkipForward, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RECITERS, RECITER_ITEMS } from "@/lib/editions";
import { usePlayer } from "@/lib/player-context";
import { getSurahMeta } from "@/lib/quran-meta";

const SEGMENT_LABEL: Record<string, string> = {
  arabic: "Recitation",
  english: "English translation",
  urdu: "Urdu translation",
};

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function GlobalPlayerBar() {
  const player = usePlayer();

  if (player.surahNumber === null || player.ayahNumberInSurah === null) return null;

  const surahMeta = getSurahMeta(player.surahNumber);
  const duration = player.sessionDurationSeconds;
  const position = player.sessionPositionSeconds;
  const remaining = duration !== null ? Math.max(0, duration - position) : null;
  const percent = duration && duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-3">
        <Link
          href={`/surah/${player.surahNumber}?ayah=${player.ayahNumberInSurah}`}
          scroll={false}
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

        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-right text-[0.65rem] tabular-nums text-muted-foreground">
            {formatTime(position)}
          </span>
          <Progress value={percent} className="flex-1" />
          <span className="w-10 shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
            {remaining !== null ? `-${formatTime(remaining)}` : "--:--"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={player.cyclePlaybackRate}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            title="Playback speed"
          >
            {player.playbackRate}x
          </button>

          <div className="flex items-center gap-1">
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

          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="icon" />}>
              <SlidersHorizontal className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Reciter</Label>
                <Select
                  items={RECITER_ITEMS}
                  value={player.reciterFolder}
                  onValueChange={(v) => player.setReciterFolder(v as string)}
                >
                  <SelectTrigger size="sm" className="w-full">
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
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <Label htmlFor="bar-english-toggle" className="text-sm font-normal">
                  English translation
                </Label>
                <Switch
                  id="bar-english-toggle"
                  checked={player.showEnglish}
                  onCheckedChange={player.setShowEnglish}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bar-urdu-toggle" className="text-sm font-normal">
                  Urdu translation
                </Label>
                <Switch
                  id="bar-urdu-toggle"
                  checked={player.showUrdu}
                  onCheckedChange={player.setShowUrdu}
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <Label htmlFor="bar-pause-toggle" className="text-sm font-normal">
                  Pause after each ayah
                </Label>
                <Switch
                  id="bar-pause-toggle"
                  checked={player.pauseAfterAyah}
                  onCheckedChange={player.setPauseAfterAyah}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
