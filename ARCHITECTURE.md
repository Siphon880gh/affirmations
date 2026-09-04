# Affirmation Lab architecture

Client-only Next.js app. Practice happens in the browser. There is no API route, no server database, and no file upload endpoint.

## Purpose

Affirmation Lab is a single-page practice tool. You keep sets of affirmation lines, then work a line through typing, recall, word rebuild, reflection, optional browser speech, and an optional mood board of photos.

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js `>=20.9.0` |
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS 4 (`app/globals.css`) |
| Components | shadcn/ui (New York), Base UI / Radix, Lucide icons |
| Persistence | `localStorage` (JSON state) and IndexedDB (photo blobs) |
| Speech | Web Speech API (`window.speechSynthesis`) |
| Deploy | Standard Next.js build (`.next`). No Wrangler, D1, or remote image host. |

The app is almost entirely a client component. `app/layout.tsx` is a server layout (metadata, `html`/`body`). `app/page.tsx` is `"use client"` and holds practice state.

## Layout of the codebase

```
app/
  layout.tsx          # document shell, title, favicon
  page.tsx            # all practice UI and JSON state
  globals.css         # Tailwind + theme tokens
components/
  mood-board.tsx                      # photo board UI
  photographic-memory-preview.tsx     # click-to-preview memory tools
  ui/                                 # shadcn primitives
lib/
  mood-board.ts                       # IndexedDB + image compression
  photographic-memory.ts              # piece cycle + spotlight helpers
  utils.ts                            # className helper
```

There is one route: `/`.

## Runtime shape

```
Browser
├── React state (practice session)
├── localStorage  "affirmation-lab-state-v1"
│     sets, activeSetId, voiceURI, speechRate, reflections
└── IndexedDB     "affirmation-lab-mood-v1"
      clips store → JPEG blobs keyed by clip id
```

On first paint, `page.tsx` hydrates from `localStorage`. After that, the same key is rewritten whenever sets, the active set, voice settings, or reflections change. Practice progress (`completedKeys`) and the open/closed mood board stay in memory only.

If the stored JSON is malformed, it is ignored and the built-in default sets load.

## Domain model

**Set** — `id`, `name`, list of lines.

**Line** — `id`, `text`. Line ids stay stable when you edit a set and keep the same text, so mood-board photos stay attached. Removing a line deletes its photos (`deleteClipsForAffirmations`).

**Reflection** — rating, optional note, optional “bridge” wording, timestamp. Stored with the affirmation *text*, not the line id.

**Practice modes** (one line at a time):

- `type` — type the line; compared with punctuation/case stripped
- `recall` — hide then type from memory
- `build` — tap shuffled word tiles in order

Speech uses the voices the OS exposes to the page. Rate is stored; playback is not recorded.

## How images are stored

Photos never leave the origin. They are not written to `localStorage` (quota and JSON size) and they are not sent to Next.js.

### Database

| | |
| --- | --- |
| API | IndexedDB |
| Name | `affirmation-lab-mood-v1` |
| Version | `1` |
| Store | `clips` (`keyPath: "id"`) |
| Index | `byAffirmation` on `affirmationId` |

Record shape (`MoodClipRecord`):

| Field | Role |
| --- | --- |
| `id` | `clip-` + UUID |
| `affirmationId` | line the photo belongs to |
| `order` | position on that board |
| `mime` | usually `image/jpeg` |
| `blob` | compressed image bytes |
| `createdAt` | timestamp |

Cap: **8** clips per line (`MAX_MOOD_CLIPS`).

### Ingest

1. File picker, drag-and-drop, or paste (`image/*`).
2. `compressImageFile` decodes the file, scales the long edge to at most **1400px**, and writes JPEG at quality **0.82** via canvas.
3. `addClip` stores the resulting `Blob` in IndexedDB.

### Display

`recordsToClips` builds a session `url` with `URL.createObjectURL(blob)`. Those object URLs are not persisted. They are revoked when the board unmounts, the line changes, or a clip is removed.

Reorder updates `order` in place. Delete removes the record and reindexes siblings.

Clicking a thumbnail (without dragging) opens a nested photographic memory preview on top of the board. Escape closes the preview first, then the board. The preview does not write to IndexedDB. Piece phase, review radius, and mode stay in component state for that preview session.

**Piece by piece** shows one of: the full photo, top left, top right, bottom left, bottom right, or none, in that cycle.

**Mouse reviewing** covers the photo except a circular window that follows the pointer. Radius is a slider.

Chevrons and arrow keys move between photos on the same line. The affirmation text stays visible in the preview.

### What clearing site data does

Clearing storage for this origin drops both `localStorage` state and IndexedDB photos. Another browser, private window, or device starts empty.

## What is not in this app

- Auth
- Server actions / Route Handlers for data
- CDN or object storage for images
- Sync between devices
