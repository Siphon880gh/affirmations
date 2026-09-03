# Affirmation Lab

Practice affirmations by typing, recalling, rebuilding sentences, reflecting, and listening with the browser's speech voices.

Sets, voice choices, and reflections stay in **this browser** (`localStorage`). There is no server database.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Next.js prints (usually `http://localhost:3000`).

## Scripts

- `npm run dev` — Next.js development server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint

## Deploy (Vercel and similar)

This is a standard Next.js App Router app. On Vercel, import the repo and use the Next.js preset (`next build`, output `.next`). No Wrangler, D1, or vinext settings are required.
