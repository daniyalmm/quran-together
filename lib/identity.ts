const ANONYMOUS_ID_KEY = "quran-together:anonymousId";
const DISPLAY_NAME_KEY = "quran-together:displayName";

export function getStoredAnonymousId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ANONYMOUS_ID_KEY);
}

export function createAndStoreAnonymousId(): string {
  const id = crypto.randomUUID();
  window.localStorage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

export function getStoredDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DISPLAY_NAME_KEY);
}

export function storeDisplayName(name: string): void {
  window.localStorage.setItem(DISPLAY_NAME_KEY, name);
}
