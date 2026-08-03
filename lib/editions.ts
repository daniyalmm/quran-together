export interface ReciterOption {
  /** everyayah.com folder name */
  folder: string;
  label: string;
}

export const RECITERS: ReciterOption[] = [
  { folder: "Alafasy_128kbps", label: "Mishary Alafasy" },
  { folder: "Abdul_Basit_Murattal_192kbps", label: "Abdul Basit (Murattal)" },
  { folder: "Husary_128kbps", label: "Mahmoud Al-Husary" },
  { folder: "Abdurrahmaan_As-Sudais_192kbps", label: "Abdurrahmaan As-Sudais" },
];

export const DEFAULT_RECITER_FOLDER = RECITERS[0].folder;

/** value -> label map for Select's `items` prop, so SelectValue shows the friendly name. */
export const RECITER_ITEMS: Record<string, string> = Object.fromEntries(
  RECITERS.map((r) => [r.folder, r.label])
);

/** alquran.cloud translation edition identifiers (on-screen text) */
export const ENGLISH_TRANSLATION_EDITION = "en.sahih";
export const URDU_TRANSLATION_EDITION = "ur.jalandhry";
export const ARABIC_TEXT_EDITION = "quran-uthmani";

/** everyayah.com folders for spoken translation audio (played after the Arabic recitation) */
export const ENGLISH_TRANSLATION_AUDIO_FOLDER = "English/Sahih_Intnl_Ibrahim_Walk_192kbps";
export const URDU_TRANSLATION_AUDIO_FOLDER = "translations/urdu_shamshad_ali_khan_46kbps";

export function buildEditionsCsv(showEnglish: boolean, showUrdu: boolean): string {
  const editions = [ARABIC_TEXT_EDITION];
  if (showEnglish) editions.push(ENGLISH_TRANSLATION_EDITION);
  if (showUrdu) editions.push(URDU_TRANSLATION_EDITION);
  return editions.sort().join(",");
}
