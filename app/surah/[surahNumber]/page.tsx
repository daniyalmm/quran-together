import { Suspense } from "react";
import { SURAHS } from "@/lib/quran-meta";
import { SurahPlayerClient } from "./surah-player-client";

export async function generateStaticParams() {
  return SURAHS.map((s) => ({ surahNumber: String(s.number) }));
}

export default async function SurahPlayerPage({
  params,
}: {
  params: Promise<{ surahNumber: string }>;
}) {
  const { surahNumber } = await params;
  return (
    <Suspense fallback={null}>
      <SurahPlayerClient key={surahNumber} surahNumber={Number(surahNumber)} />
    </Suspense>
  );
}
