# Affirmation Lab

Practice affirmations by typing, recalling, rebuilding sentences, reflecting, listening with the browser's speech voices, and (optionally) looking at a mood board of pictures.

If images are more effective at drilling in a statement, open the mood board on that line. You can look at the images, or look at the images with the affirmation. Choose a photo, paste one, or drop it onto the board; drag to rearrange; delete what you no longer need.

Sets, voice choices, and reflections stay in **this browser** (`localStorage`). Mood board photos stay in **this browser** (`IndexedDB`). There is no server database.

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
