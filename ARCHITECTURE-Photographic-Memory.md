# Photographic memory preview

How the photographic memory tools work once the image preview modal is open. Storage, ingest, and the mood-board grid live in [ARCHITECTURE.md](ARCHITECTURE.md). This modal does not write to IndexedDB or `localStorage`. Mode, piece phase, spotlight radius, pointer position, and hold state exist only in React state for that session.

## Files

| File | Role |
| --- | --- |
| `components/photographic-memory-preview.tsx` | Preview modal UI and pointer/keyboard handling |
| `lib/photographic-memory.ts` | Piece phases, clip-path, spotlight mask, wrap index, contained photo size |

`MoodBoard` passes the current line’s clips, the active clip index, and the affirmation text. The preview reports index changes and close. It is a nested full-bleed layer (`absolute inset-0 z-40`) with `role="dialog"`.

## Shell

The modal is a column: header, affirmation, photo stage, then mode-specific controls.

**Header** — Close (X). Title “Photographic memory”. A two-option pill: **Piece by piece** (default) or **Mouse reviewing**. Copy under the title follows the active mode.

**Affirmation** — A blockquote of the current line’s text, always visible in both modes. It is not toggled with the board’s Images / Images + words control.

**Photo stage** — Previous/next chevrons flank a measured photo. The figure is sized with `containedPhotoSize` so `object-contain` matches the real picture box (no letterboxed quadrants). A `ResizeObserver` on the stage plus `img.onLoad` keep that size in sync. Until measured, the figure is 1×1 and hidden.

Escape (capture-phase `keydown` on `window`) closes the preview and does not reach the mood-board Escape handler. Arrow keys while the radius slider is focused are left to the slider.

## Modes

`MemoryMode` is `"piece"` | `"review"`. Switching to piece clears hold. Changing the current clip (chevrons or wrap) resets piece phase to **Full**, clears the pointer, and clears hold. Mode and radius stay.

```
Preview
├── mode: piece | review
├── piece → phase + CSS clip-path
└── review → pointer spotlight, or full photo while holding
```

## Piece by piece

One phase at a time. The composition does not zoom; uncovered parts of the `<img>` are clipped, and the figure’s dark background reads as cover.

Cycle order (`PIECE_PHASES`):

1. `full` — whole picture (`clip-path: none`)
2. `topLeft` — `inset(0 50% 50% 0)`
3. `topRight` — `inset(0 0 50% 50%)`
4. `bottomLeft` — `inset(50% 50% 0 0)`
5. `bottomRight` — `inset(50% 0 0 50%)`
6. `hidden` — no picture (`inset(100%)`)

Then wrap via `nextPiecePhase`. Advance with **Cycle**, a click on the photo, or Space (unless the target is a button). The six dots jump to a phase. Photo chevrons do not change phase; arriving on a new photo starts at **Full**.

## Mouse reviewing

The photo stays covered except a circular window, unless the user is holding.

**Spotlight** — Pointer coordinates are stored in image space (clamped to the img box). `spotlightMaskImage` builds a `radial-gradient` used as `-webkit-mask-image` / `mask-image`. No pointer means a fully transparent mask (nothing visible). Leaving the figure while not holding clears the pointer.

**Radius** — Slider only in this mode. Percent of `min(width, height)` of the measured photo. Range `SPOTLIGHT_RADIUS_MIN` (8) to `SPOTLIGHT_RADIUS_MAX` (48); default `SPOTLIGHT_RADIUS_DEFAULT` (18). `spotlightRadiusPx` converts percent to pixels.

**Hold to see the whole picture** — Pointer down (left mouse button, or tap) on the photo sets hold, captures the pointer, and shows the unmasked image. Pointer up or cancel clears hold. On up, the pointer is updated so the small-radius spotlight returns at the release point. Context menu on the photo is prevented so a long press does not steal the hold.

## Prev / next photos

Chevrons sit left and right of the stage. They wrap with `wrapIndex`. Disabled when there is only one clip. ArrowLeft / ArrowRight do the same, except when the event target is the radius slider.

The preview keeps the same mode and radius across photos. Piece phase, pointer, and hold reset as above.

## What this modal does not do

- Persist mode, phase, radius, or hold
- Quiz, score, or time the review
- Change clip blobs or order
