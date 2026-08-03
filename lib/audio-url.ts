function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** Builds a direct everyayah.com CDN URL for a single ayah's recitation audio. */
export function buildAyahAudioUrl(
  reciterFolder: string,
  surahNumber: number,
  ayahNumberInSurah: number
): string {
  return `https://everyayah.com/data/${reciterFolder}/${pad3(surahNumber)}${pad3(
    ayahNumberInSurah
  )}.mp3`;
}
