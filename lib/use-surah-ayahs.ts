"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getGlobalAyahNumber } from "@/lib/quran-meta";
import { ARABIC_TEXT_EDITION, buildEditionsCsv } from "@/lib/editions";

interface EditionResult {
  ayahs: { number: number; text: string; numberInSurah: number }[];
  edition: { identifier: string };
}

export interface AyahRow {
  numberInSurah: number;
  globalAyahNumber: number;
  arabicText: string;
  englishText?: string;
  urduText?: string;
}

/**
 * Fetches (and Convex-caches) ayah text + translations for a surah. Shared by
 * the surah page (reading view) and the global player (playback), which may
 * be showing different surahs at once — each caller gets its own independent
 * subscription against the same underlying cache.
 */
export function useSurahAyahs(
  surahNumber: number | null,
  englishEdition: string,
  urduEdition: string,
  showEnglish: boolean,
  showUrdu: boolean
): AyahRow[] | null {
  const editionsKey = useMemo(
    () => buildEditionsCsv(showEnglish, showUrdu),
    [showEnglish, showUrdu]
  );

  const cachedPayload = useQuery(
    api.quranContent.getCachedSurah,
    surahNumber ? { surahNumber, editionsKey } : "skip"
  );
  const fetchAndCacheSurah = useAction(api.quranContent.fetchAndCacheSurah);
  const contentKey = surahNumber ? `${surahNumber}:${editionsKey}` : null;
  const [fetchedPayload, setFetchedPayload] = useState<{ key: string; payload: string } | null>(
    null
  );

  useEffect(() => {
    if (surahNumber && cachedPayload === null) {
      fetchAndCacheSurah({ surahNumber, editionsKey }).then((payload) => {
        setFetchedPayload({ key: `${surahNumber}:${editionsKey}`, payload });
      });
    }
  }, [cachedPayload, surahNumber, editionsKey, fetchAndCacheSurah]);

  const payload =
    cachedPayload ?? (fetchedPayload?.key === contentKey ? fetchedPayload.payload : null);

  return useMemo(() => {
    if (!payload || !surahNumber) return null;
    const results: EditionResult[] = JSON.parse(payload);
    const arabic = results.find((r) => r.edition.identifier === ARABIC_TEXT_EDITION);
    const english = results.find((r) => r.edition.identifier === englishEdition);
    const urdu = results.find((r) => r.edition.identifier === urduEdition);
    if (!arabic) return null;
    return arabic.ayahs.map((a, i) => ({
      numberInSurah: a.numberInSurah,
      globalAyahNumber: getGlobalAyahNumber(surahNumber, a.numberInSurah),
      arabicText: a.text,
      englishText: english?.ayahs[i]?.text,
      urduText: urdu?.ayahs[i]?.text,
    }));
  }, [payload, surahNumber, englishEdition, urduEdition]);
}
