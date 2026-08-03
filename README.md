# Quran Together

Listen to the Quran and track your completion — Arabic recitation with optional spoken and on-screen English/Urdu translation, ayah-by-ayah progress tracking, and a clean, minimal interface. Rooms with synced group listening are planned for a future version.

Live at: https://daniyalmm.github.io/quran-together/

## Stack

Next.js 16 (App Router, static export) + React 19 + TypeScript + Tailwind v4 + [Convex](https://convex.dev) (reactive backend) + shadcn/ui v4.

Content sources: [everyayah.com](https://everyayah.com) for recitation and spoken-translation audio, [alquran.cloud](https://alquran.cloud) for Arabic/translation text.

## Development

```bash
npm install
npx convex dev   # in one terminal — pushes Convex functions and watches for changes
npm run dev       # in another terminal
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Pushes to `main` build a static export (`output: 'export'`) and publish it to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The Convex backend is a separately hosted deployment — the static site just talks to it over the network, same as any client app.
