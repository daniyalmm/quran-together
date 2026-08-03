"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { getGlobalAyahNumber, getSurahMeta } from "@/lib/quran-meta";
import { ARABIC_TEXT_EDITION, buildEditionsCsv } from "@/lib/editions";
import { AudioPlayer, type SegmentKind } from "@/components/audio-player";
import { AyahLine } from "@/components/ayah-line";
import { Skeleton } from "@/components/ui/skeleton";

interface EditionResult {
  ayahs: { number: number; text: string; numberInSurah: number }[];
  edition: { identifier: string };
}

interface AyahRow {
  numberInSurah: number;
  globalAyahNumber: number;
  arabicText: string;
  englishText?: string;
  urduText?: string;
}

export function SurahPlayerClient({ surahNumber }: { surahNumber: number }) {
  const searchParams = useSearchParams();
  const surahMeta = getSurahMeta(surahNumber);

  const { userId } = useIdentity();
  const preferences = useQuery(api.preferences.getPreferences, userId ? { userId } : "skip");
  const surahProgress = useQuery(
    api.progress.getSurahProgress,
    userId ? { userId, surahNumber } : "skip"
  );
  const reportAyahPlayback = useMutation(api.progress.reportAyahPlayback);
  const unmarkAyah = useMutation(api.progress.unmarkAyah);
  const updatePreferences = useMutation(api.preferences.updatePreferences);

  const editionsKey = useMemo(
    () => buildEditionsCsv(preferences?.showEnglish ?? false, preferences?.showUrdu ?? false),
    [preferences?.showEnglish, preferences?.showUrdu]
  );

  const cachedPayload = useQuery(api.quranContent.getCachedSurah, { surahNumber, editionsKey });
  const fetchAndCacheSurah = useAction(api.quranContent.fetchAndCacheSurah);
  const contentKey = `${surahNumber}:${editionsKey}`;
  const [fetchedPayload, setFetchedPayload] = useState<{ key: string; payload: string } | null>(
    null
  );

  useEffect(() => {
    if (cachedPayload === null) {
      fetchAndCacheSurah({ surahNumber, editionsKey }).then((payload) => {
        setFetchedPayload({ key: contentKey, payload });
      });
    }
  }, [cachedPayload, surahNumber, editionsKey, contentKey, fetchAndCacheSurah]);

  const payload =
    cachedPayload ?? (fetchedPayload?.key === contentKey ? fetchedPayload.payload : null);

  const ayahs: AyahRow[] | null = useMemo(() => {
    if (!payload) return null;
    const results: EditionResult[] = JSON.parse(payload);
    const arabic = results.find((r) => r.edition.identifier === ARABIC_TEXT_EDITION);
    const english = results.find((r) => r.edition.identifier === preferences?.englishEdition);
    const urdu = results.find((r) => r.edition.identifier === preferences?.urduEdition);
    if (!arabic) return null;
    return arabic.ayahs.map((a, i) => ({
      numberInSurah: a.numberInSurah,
      globalAyahNumber: getGlobalAyahNumber(surahNumber, a.numberInSurah),
      arabicText: a.text,
      englishText: english?.ayahs[i]?.text,
      urduText: urdu?.ayahs[i]?.text,
    }));
  }, [payload, preferences?.englishEdition, preferences?.urduEdition, surahNumber]);

  const listenedSet = useMemo(
    () => new Set(surahProgress?.listenedAyahNumbers ?? []),
    [surahProgress]
  );

  const initialAyahNumberInSurah = Number(searchParams.get("ayah")) || null;
  const [currentAyahNumberInSurah, setCurrentAyahNumberInSurah] = useState<number | null>(null);
  const [playingKind, setPlayingKind] = useState<SegmentKind | null>(null);
  const ayahRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const hasScrolledToInitial = useRef(false);

  useEffect(() => {
    if (!ayahs || hasScrolledToInitial.current) return;
    const target = initialAyahNumberInSurah ?? 1;
    hasScrolledToInitial.current = true;
    setCurrentAyahNumberInSurah(target);
    requestAnimationFrame(() => {
      ayahRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahs]);

  function handleAyahCompleted(row: { numberInSurah: number; globalAyahNumber: number }) {
    if (!userId) return;
    reportAyahPlayback({
      userId,
      surahNumber,
      ayahNumberInSurah: row.numberInSurah,
      globalAyahNumber: row.globalAyahNumber,
      completed: true,
      source: "auto",
    });
  }

  function handleToggleManual(row: AyahRow) {
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
              active={row.numberInSurah === currentAyahNumberInSurah}
              activeKind={playingKind}
              listened={listenedSet.has(row.numberInSurah)}
              onToggleManual={() => handleToggleManual(row)}
            />
          ))
        )}
      </div>

      {ayahs && (
        <AudioPlayer
          ayahs={ayahs}
          surahNumber={surahNumber}
          reciterFolder={preferences?.reciterFolder}
          onReciterChange={(folder) => userId && updatePreferences({ userId, reciterFolder: folder })}
          showEnglish={preferences?.showEnglish ?? false}
          showUrdu={preferences?.showUrdu ?? false}
          onToggleEnglish={(value) => userId && updatePreferences({ userId, showEnglish: value })}
          onToggleUrdu={(value) => userId && updatePreferences({ userId, showUrdu: value })}
          currentAyahNumberInSurah={currentAyahNumberInSurah}
          onCurrentAyahChange={(n) => {
            setCurrentAyahNumberInSurah(n);
            ayahRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onAyahCompleted={handleAyahCompleted}
          onSegmentKindChange={setPlayingKind}
        />
      )}
    </main>
  );
}
