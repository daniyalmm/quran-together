"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SegmentKind } from "@/lib/player-context";

interface AyahRow {
  numberInSurah: number;
  arabicText: string;
  englishText?: string;
  urduText?: string;
}

export function AyahLine({
  row,
  active,
  activeKind,
  listened,
  onToggleManual,
  onPlayFromHere,
  setRef,
}: {
  row: AyahRow;
  active: boolean;
  activeKind: SegmentKind | null;
  listened: boolean;
  onToggleManual: () => void;
  onPlayFromHere: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={setRef}
      role="button"
      tabIndex={0}
      onClick={onPlayFromHere}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlayFromHere();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-xl border border-transparent p-3 transition-colors hover:bg-accent/60",
        active && "border-border bg-accent"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground">
          {row.numberInSurah}
        </span>
        <p
          dir="rtl"
          className={cn(
            "flex-1 text-right font-quran text-3xl leading-loose transition-colors",
            active && activeKind === "arabic" && "text-primary"
          )}
        >
          {row.arabicText}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleManual();
          }}
          className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-primary"
          aria-label={listened ? "Mark as not listened" : "Mark as listened"}
        >
          {listened ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5" />}
        </button>
      </div>
      {row.englishText && (
        <p
          className={cn(
            "text-sm text-muted-foreground transition-colors",
            active && activeKind === "english" && "font-medium text-primary"
          )}
        >
          {row.englishText}
        </p>
      )}
      {row.urduText && (
        <p
          dir="rtl"
          className={cn(
            "text-right text-sm text-muted-foreground transition-colors",
            active && activeKind === "urdu" && "font-medium text-primary"
          )}
        >
          {row.urduText}
        </p>
      )}
    </div>
  );
}
