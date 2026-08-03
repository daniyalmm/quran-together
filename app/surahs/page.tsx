"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { SURAHS } from "@/lib/quran-meta";
import { Input } from "@/components/ui/input";
import { SurahProgressBar } from "@/components/surah-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";

export default function SurahsPage() {
  const { userId } = useIdentity();
  const overall = useQuery(api.progress.getOverallProgress, userId ? { userId } : "skip");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [search]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6 pb-44">
      <header className="pt-4">
        <h1 className="text-2xl font-semibold">Surahs</h1>
      </header>

      <Input
        placeholder="Search surahs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
        {filtered.map((surah) => {
          const listened = overall?.perSurahCounts[surah.number] ?? 0;
          return (
            <Link
              key={surah.number}
              href={`/surah/${surah.number}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-accent"
            >
              <span className="w-6 text-sm text-muted-foreground">{surah.number}</span>
              <div className="flex-1">
                <p className="font-medium">{surah.englishName}</p>
                <p className="text-xs text-muted-foreground">{surah.englishNameTranslation}</p>
              </div>
              <div className="w-24">
                {overall === undefined ? (
                  <Skeleton className="h-1.5 w-full" />
                ) : (
                  <SurahProgressBar listened={listened} total={surah.numberOfAyahs} />
                )}
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No surahs match your search.</p>
        )}
      </div>
    </main>
  );
}
