"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { getSurahMeta } from "@/lib/quran-meta";
import { OverallProgressRing } from "@/components/overall-progress-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { userId } = useIdentity();
  const overall = useQuery(api.progress.getOverallProgress, userId ? { userId } : "skip");
  const lastPosition = useQuery(api.progress.getLastPosition, userId ? { userId } : "skip");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6 pb-24">
      <header className="pt-4">
        <h1 className="text-2xl font-semibold">Quran Together</h1>
        <p className="text-sm text-muted-foreground">Your listening progress</p>
      </header>

      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-8">
          {overall === undefined ? (
            <Skeleton className="size-40 rounded-full" />
          ) : (
            <div className="relative flex items-center justify-center">
              <OverallProgressRing percent={overall.percent} />
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-semibold">{overall.percent}%</span>
                <span className="text-xs text-muted-foreground">
                  {overall.totalListened} / {overall.totalAyahs} ayahs
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {lastPosition ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Continue listening</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{getSurahMeta(lastPosition.surahNumber).englishName}</p>
              <p className="text-sm text-muted-foreground">Ayah {lastPosition.ayahNumberInSurah}</p>
            </div>
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/surah/${lastPosition.surahNumber}?ayah=${lastPosition.ayahNumberInSurah}`}
                />
              }
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start listening</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" nativeButton={false} render={<Link href="/surah/1" />}>
              Begin with Al-Fatiha
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Button className="h-16" nativeButton={false} render={<Link href="/surahs" />}>
          Browse Surahs
        </Button>
        <Button className="h-16" nativeButton={false} render={<Link href="/settings" />}>
          Settings
        </Button>
      </div>
    </main>
  );
}
