"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { MoodClip } from "@/lib/mood-board";
import {
  PIECE_PHASES,
  PIECE_PHASE_LABELS,
  SPOTLIGHT_RADIUS_DEFAULT,
  SPOTLIGHT_RADIUS_MAX,
  SPOTLIGHT_RADIUS_MIN,
  containedPhotoSize,
  nextPiecePhase,
  piecePhaseClipPath,
  spotlightMaskImage,
  spotlightRadiusPx,
  wrapIndex,
  type MemoryMode,
  type PiecePhase,
  type PointerPoint,
} from "@/lib/photographic-memory";

type PhotographicMemoryPreviewProps = {
  clips: MoodClip[];
  index: number;
  affirmationText: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

function isSliderTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("[data-slot='slider']"));
}

export function PhotographicMemoryPreview({
  clips,
  index,
  affirmationText,
  onIndexChange,
  onClose,
}: PhotographicMemoryPreviewProps) {
  const clip = clips[index];
  const [mode, setMode] = useState<MemoryMode>("piece");
  const [phase, setPhase] = useState<PiecePhase>("full");
  const [radiusPercent, setRadiusPercent] = useState(SPOTLIGHT_RADIUS_DEFAULT);
  const [pointer, setPointer] = useState<PointerPoint | null>(null);
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [photoSize, setPhotoSize] = useState({ width: 0, height: 0 });
  const seenClipIdRef = useRef(clip?.id);

  if (clip?.id !== seenClipIdRef.current) {
    seenClipIdRef.current = clip?.id;
    setPhase("full");
    setPointer(null);
    holdingRef.current = false;
    setHolding(false);
  }

  const measurePhoto = useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || !img.naturalWidth) return;
    setPhotoSize(
      containedPhotoSize(
        img.naturalWidth,
        img.naturalHeight,
        stage.clientWidth,
        stage.clientHeight,
      ),
    );
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => measurePhoto());
    observer.observe(stage);
    measurePhoto();
    return () => observer.disconnect();
  }, [clip?.id, measurePhoto]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (isSliderTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (clips.length > 1) onIndexChange(wrapIndex(index, clips.length, -1));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (clips.length > 1) onIndexChange(wrapIndex(index, clips.length, 1));
        return;
      }
      if (event.key === " " && mode === "piece") {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("button")) return;
        event.preventDefault();
        setPhase((current) => nextPiecePhase(current));
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [clips.length, index, mode, onClose, onIndexChange]);

  if (!clip) return null;

  const many = clips.length > 1;
  const maskImage =
    mode === "review" && !holding
      ? spotlightMaskImage(
          pointer,
          spotlightRadiusPx(radiusPercent, photoSize.width, photoSize.height),
        )
      : undefined;

  function setHold(next: boolean) {
    holdingRef.current = next;
    setHolding(next);
  }

  function updatePointer(event: React.PointerEvent<HTMLElement>) {
    const node = imgRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPointer({
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
    });
  }

  return (
    <div
      className="absolute inset-0 z-40 flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] px-4 py-4 text-[#14151d] sm:px-6 sm:py-5"
      style={{
        backgroundColor: "#efe6d0",
        backgroundImage:
          "radial-gradient(circle at 18% 10%, rgba(255,255,255,0.55), transparent 22rem), repeating-linear-gradient(-22deg, rgba(20,21,29,0.035) 0 1px, transparent 1px 12px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-memory-title"
    >
      <div className="flex flex-col gap-3 pr-14 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-[#14151d] text-[#f7f4ea] shadow-[0_10px_20px_rgba(20,21,29,0.22)] transition hover:bg-black focus-visible:ring-2 focus-visible:ring-[#6d7cff]"
          >
            <X className="size-4" />
          </button>
          <div className="min-w-0">
            <p
              id="photo-memory-title"
              className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a675c]"
            >
              Photographic memory
            </p>
            <p className="mt-1 text-sm leading-6 text-[#5f5c52]">
              {mode === "piece"
                ? "Cycle pieces of the photo, including the whole picture and none of it."
                : "Move over the photo to review a circle of it. Hold to see the whole picture."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 rounded-full bg-[#ded6c3] p-1 text-xs font-semibold">
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1.5",
              mode === "piece" ? "bg-[#14151d] text-white" : "text-[#58564e]",
            )}
            onClick={() => {
              setHold(false);
              setMode("piece");
            }}
          >
            Piece by piece
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1.5",
              mode === "review" ? "bg-[#14151d] text-white" : "text-[#58564e]",
            )}
            onClick={() => setMode("review")}
          >
            Mouse reviewing
          </button>
        </div>
      </div>

      <blockquote className="mt-4 font-serif text-xl leading-snug tracking-[-0.03em] text-[#1b1c18] sm:text-2xl">
        “{affirmationText}”
      </blockquote>

      <div className="relative mt-4 flex min-h-0 flex-1 items-stretch gap-2 sm:gap-3">
        <button
          type="button"
          className="mt-auto mb-auto grid size-11 shrink-0 place-items-center rounded-full bg-[#14151d] text-[#f7f4ea] shadow-sm disabled:opacity-35"
          onClick={() => onIndexChange(wrapIndex(index, clips.length, -1))}
          disabled={!many}
          aria-label="Previous photo"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div ref={stageRef} className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <figure
              className={cn(
                "relative overflow-hidden bg-[#14151d]",
                mode === "piece" ? "cursor-pointer" : "cursor-crosshair touch-none select-none",
              )}
              style={
                photoSize.width > 0
                  ? { width: photoSize.width, height: photoSize.height }
                  : { width: 1, height: 1, opacity: 0 }
              }
              onClick={mode === "piece" ? () => setPhase((current) => nextPiecePhase(current)) : undefined}
              onContextMenu={mode === "review" ? (event) => event.preventDefault() : undefined}
              onPointerDown={
                mode === "review"
                  ? (event) => {
                      if (event.pointerType === "mouse" && event.button !== 0) return;
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        // Synthetic or stale pointer ids cannot capture.
                      }
                      event.preventDefault();
                      setHold(true);
                      updatePointer(event);
                    }
                  : undefined
              }
              onPointerMove={mode === "review" ? updatePointer : undefined}
              onPointerLeave={
                mode === "review"
                  ? () => {
                      if (!holdingRef.current) setPointer(null);
                    }
                  : undefined
              }
              onPointerUp={
                mode === "review"
                  ? (event) => {
                      setHold(false);
                      updatePointer(event);
                    }
                  : undefined
              }
              onPointerCancel={
                mode === "review"
                  ? () => {
                      setHold(false);
                    }
                  : undefined
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={clip.url}
                alt=""
                draggable={false}
                onLoad={measurePhoto}
                className="block size-full object-contain"
                style={
                  mode === "piece"
                    ? { clipPath: piecePhaseClipPath(phase) }
                    : {
                        WebkitMaskImage: maskImage,
                        maskImage,
                      }
                }
              />
            </figure>
          </div>
        </div>

        <button
          type="button"
          className="mt-auto mb-auto grid size-11 shrink-0 place-items-center rounded-full bg-[#14151d] text-[#f7f4ea] shadow-sm disabled:opacity-35"
          onClick={() => onIndexChange(wrapIndex(index, clips.length, 1))}
          disabled={!many}
          aria-label="Next photo"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {mode === "piece" ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a675c]">
              {PIECE_PHASE_LABELS[phase]}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PIECE_PHASES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={PIECE_PHASE_LABELS[item]}
                  aria-current={item === phase ? "true" : undefined}
                  className={cn(
                    "size-2.5 rounded-full",
                    item === phase ? "bg-[#14151d]" : "bg-[#14151d]/25",
                  )}
                  onClick={() => setPhase(item)}
                />
              ))}
            </div>
          </div>
          <Button
            type="button"
            className="rounded-full bg-[#6d7cff] px-4 text-white hover:bg-[#5d6ded]"
            onClick={() => setPhase((current) => nextPiecePhase(current))}
          >
            Cycle
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a675c]">
              Reveal radius
            </p>
            <p className="text-xs text-[#6d6a60]">{radiusPercent}%</p>
          </div>
          <Slider
            min={SPOTLIGHT_RADIUS_MIN}
            max={SPOTLIGHT_RADIUS_MAX}
            step={1}
            value={[radiusPercent]}
            onValueChange={(value) => setRadiusPercent(value[0] ?? SPOTLIGHT_RADIUS_DEFAULT)}
            aria-label="Reveal radius"
          />
        </div>
      )}
    </div>
  );
}
