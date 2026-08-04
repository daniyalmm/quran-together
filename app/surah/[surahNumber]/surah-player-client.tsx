"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { getSurahMeta } from "@/lib/quran-meta";
import { ENGLISH_TRANSLATION_EDITION, URDU_TRANSLATION_EDITION } from "@/lib/editions";
import { useSurahAyahs } from "@/lib/use-surah-ayahs";
import { usePlayer } from "@/lib/player-context";
import { AyahLine } from "@/components/ayah-line";
import { Skeleton } from "@/components/ui/skeleton";

export function SurahPlayerClient({ surahNumber }: { surahNumber: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const surahMeta = getSurahMeta(surahNumber);
  const player = usePlayer();

  const { userId } = useIdentity();
  const preferences = useQuery(api.preferences.getPreferences, userId ? { userId } : "skip");
  const surahProgress = useQuery(
    api.progress.getSurahProgress,
    userId ? { userId, surahNumber } : "skip"
  );
  const unmarkAyah = useMutation(api.progress.unmarkAyah);
  const reportAyahPlayback = useMutation(api.progress.reportAyahPlayback);

  const ayahs = useSurahAyahs(
    surahNumber,
    preferences?.englishEdition ?? ENGLISH_TRANSLATION_EDITION,
    preferences?.urduEdition ?? URDU_TRANSLATION_EDITION,
    preferences?.showEnglish ?? false,
    preferences?.showUrdu ?? false
  );

  const listenedSet = useMemo(
    () => new Set(surahProgress?.listenedAyahNumbers ?? []),
    [surahProgress]
  );

  const isThisSurahPlaying = player.surahNumber === surahNumber;
  const initialAyahNumberInSurah = Number(searchParams.get("ayah")) || null;
  const ayahRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const hasScrolledToInitial = useRef(false);

  // On first load, scroll to the requested/resumed ayah — unless this surah
  // is already the one playing, in which case the "follow along" effect
  // below takes over and scrolls to the actual playing position instead.
  useEffect(() => {
    if (!ayahs || hasScrolledToInitial.current) return;
    hasScrolledToInitial.current = true;
    if (isThisSurahPlaying) return;
    const target = initialAyahNumberInSurah ?? 1;
    requestAnimationFrame(() => {
      ayahRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahs, isThisSurahPlaying]);

  useEffect(() => {
    if (!isThisSurahPlaying || player.ayahNumberInSurah === null) return;
    ayahRefs.current[player.ayahNumberInSurah]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    // `ayahs` is intentionally a dependency (not read in the body): until it
    // loads, the AyahLine rows haven't rendered so ayahRefs is still empty
    // and the scroll above would silently no-op — this re-runs once they exist.
  }, [isThisSurahPlaying, player.ayahNumberInSurah, ayahs]);

  // Once this page is following the player (the user started or resumed
  // playback here), keep following it — including across an auto-advance to
  // the next surah, or skipping past this surah's boundary — by navigating
  // along. `wasSyncedRef` starts false so visiting an unrelated surah while
  // something else plays elsewhere never triggers an unwanted redirect.
  const wasSyncedRef = useRef(isThisSurahPlaying);
  useEffect(() => {
    if (isThisSurahPlaying) wasSyncedRef.current = true;
  }, [isThisSurahPlaying]);

  useEffect(() => {
    if (
      wasSyncedRef.current &&
      !isThisSurahPlaying &&
      player.surahNumber !== null &&
      player.surahNumber !== surahNumber
    ) {
      router.replace(`/surah/${player.surahNumber}`);
    }
  }, [isThisSurahPlaying, player.surahNumber, surahNumber, router]);

  function handleToggleManual(row: { numberInSurah: number; globalAyahNumber: number }) {
    if (!userId) return;
    if (listenedSet.has(row.numberInSurah)) {
      unmarkAyah({ userId, globalAyahNumber: row.globalAyahNumber });
    } else {
      reportAyahPlayback({
        userId,
        surahNumber,
        ayahNumberInSurah: row.numberInSurah,
        globalAyahNumber: row.globalAyahNumber,
        completed: true,
        source: "manual",
      });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-44">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 p-4 backdrop-blur">
        <Link href="/surahs" className="text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <div>
          <h1 className="font-semibold">{surahMeta.englishName}</h1>
          <p className="text-xs text-muted-foreground">{surahMeta.englishNameTranslation}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {ayahs === null ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          ayahs.map((row) => (
            <AyahLine
              key={row.numberInSurah}
              setRef={(el) => {
                ayahRefs.current[row.numberInSurah] = el;
              }}
              row={row}
              active={isThisSurahPlaying && row.numberInSurah === player.ayahNumberInSurah}
              activeKind={isThisSurahPlaying ? player.playingKind : null}
              listened={listenedSet.has(row.numberInSurah)}
              onToggleManual={() => handleToggleManual(row)}
              onPlayFromHere={() => player.playFromAyah(surahNumber, row.numberInSurah)}
            />
          ))
        )}
      </div>
    </main>
  );
}
