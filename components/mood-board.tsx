"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_MOOD_CLIPS,
  addClip,
  compressImageFile,
  countClips,
  deleteClip,
  listClipRecords,
  recordsToClips,
  reorderClips,
  revokeClipUrls,
  type MoodClip,
} from "@/lib/mood-board";

type MoodView = "images" | "with-words";

type MoodBoardProps = {
  affirmationId: string;
  affirmationText: string;
  onClipCountChange: (count: number) => void;
};

const TILT = ["-rotate-[2.4deg]", "rotate-[1.8deg]", "-rotate-[0.8deg]", "rotate-[2.2deg]"];

function filesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

function arrayMove<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return items;
  next.splice(to, 0, item);
  return next;
}

export function MoodBoard({ affirmationId, affirmationText, onClipCountChange }: MoodBoardProps) {
  const [clips, setClips] = useState<MoodClip[]>([]);
  const [view, setView] = useState<MoodView>("with-words");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fileOver, setFileOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<MoodClip[]>([]);
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const syncCount = useCallback(
    async (nextClips?: MoodClip[]) => {
      const count = nextClips ? nextClips.length : await countClips(affirmationId);
      onClipCountChange(count);
    },
    [affirmationId, onClipCountChange],
  );

  useEffect(() => {
    let cancelled = false;
    revokeClipUrls(clipsRef.current);
    setClips([]);
    setLoaded(false);
    setError("");

    void listClipRecords(affirmationId)
      .then((records) => {
        if (cancelled) return;
        const next = recordsToClips(records);
        setClips(next);
        onClipCountChange(next.length);
      })
      .catch(() => {
        if (!cancelled) setError("Could not open the mood board on this device.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
      revokeClipUrls(clipsRef.current);
    };
  }, [affirmationId, onClipCountChange]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (!images.length) {
        setError("Drop or paste a photo file.");
        return;
      }

      setBusy(true);
      setError("");
      try {
        let working = clipsRef.current;
        for (const file of images) {
          if (working.length >= MAX_MOOD_CLIPS) {
            setError(`This board holds ${MAX_MOOD_CLIPS} pictures.`);
            break;
          }
          const blob = await compressImageFile(file);
          const record = await addClip(affirmationId, blob);
          const next = [
            ...working,
            {
              id: record.id,
              affirmationId: record.affirmationId,
              order: record.order,
              url: URL.createObjectURL(record.blob),
            },
          ];
          working = next;
          setClips(next);
        }
        await syncCount(working);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add that picture.");
      } finally {
        setBusy(false);
      }
    },
    [affirmationId, syncCount],
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function removeClip(id: string) {
    setBusy(true);
    setError("");
    try {
      await deleteClip(id);
      const next = clipsRef.current.filter((clip) => clip.id !== id);
      const removed = clipsRef.current.find((clip) => clip.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      setClips(next);
      await syncCount(next);
    } catch {
      setError("Could not remove that picture.");
    } finally {
      setBusy(false);
    }
  }

  function persistOrder(next: MoodClip[]) {
    void reorderClips(
      affirmationId,
      next.map((clip) => clip.id),
    ).catch(() => setError("Could not save the new order."));
  }

  function onClipPointerDown(event: React.PointerEvent<HTMLElement>, index: number) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or stale pointer ids cannot capture; drag still works via move/up.
    }
    dragFromRef.current = index;
    dragOverRef.current = index;
    setDraggingId(clips[index]?.id ?? null);
  }

  function onClipPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (dragFromRef.current === null) return;
    const node = document.elementFromPoint(event.clientX, event.clientY);
    const host = node?.closest("[data-clip-index]");
    if (!host) return;
    const to = Number(host.getAttribute("data-clip-index"));
    if (Number.isNaN(to) || to === dragOverRef.current) return;
    const from = dragOverRef.current ?? dragFromRef.current;
    const next = arrayMove(clipsRef.current, from, to);
    dragOverRef.current = to;
    setClips(next);
  }

  function onClipPointerUp() {
    if (dragFromRef.current === null) return;
    dragFromRef.current = null;
    dragOverRef.current = null;
    setDraggingId(null);
    persistOrder(clipsRef.current);
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col rounded-[1.75rem] px-4 py-4 text-[#14151d] sm:px-6 sm:py-5",
        "bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.55),transparent_22rem),repeating-linear-gradient(-22deg,rgba(20,21,29,0.035)_0_1px,transparent_1px_12px),#efe6d0]",
      )}
      onDragEnter={(event) => {
        if (filesFromDataTransfer(event.dataTransfer).length) {
          event.preventDefault();
          setFileOver(true);
        }
      }}
      onDragOver={(event) => {
        if (filesFromDataTransfer(event.dataTransfer).length) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setFileOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setFileOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setFileOver(false);
        void addFiles(filesFromDataTransfer(event.dataTransfer));
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void addFiles(files);
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 pr-14">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a675c]">Mood board</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5f5c52]">
            If pictures lock a statement in better than words alone, look at the images, or look at
            them with the affirmation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-full bg-[#ded6c3] p-1 text-xs font-semibold">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5",
                view === "images" ? "bg-[#14151d] text-white" : "text-[#58564e]",
              )}
              onClick={() => setView("images")}
            >
              Images
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5",
                view === "with-words" ? "bg-[#14151d] text-white" : "text-[#58564e]",
              )}
              onClick={() => setView("with-words")}
            >
              Images + words
            </button>
          </div>
          <Button
            type="button"
            className="rounded-full bg-[#6d7cff] px-4 text-white hover:bg-[#5d6ded]"
            onClick={() => fileRef.current?.click()}
            disabled={busy || clips.length >= MAX_MOOD_CLIPS}
          >
            <Plus />
            Add pictures
          </Button>
        </div>
      </div>

      {view === "with-words" ? (
        <blockquote className="mt-4 font-serif text-xl leading-snug tracking-[-0.03em] text-[#1b1c18] sm:text-2xl">
          “{affirmationText}”
        </blockquote>
      ) : null}

      <div
        className={cn(
          "relative mt-4 min-h-0 flex-1 overflow-auto rounded-[1.35rem] border border-black/10 p-3 sm:p-4",
          fileOver ? "border-[#6d7cff] bg-[#6d7cff]/10" : "bg-white/35",
        )}
      >
        {!loaded ? (
          <p className="grid min-h-[16rem] place-items-center text-sm text-[#5f5c52]">
            Opening pictures…
          </p>
        ) : clips.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[16rem] w-full flex-col items-center justify-center gap-3 rounded-[1.1rem] border border-dashed border-black/20 px-6 text-center"
          >
            <Images className="size-8 text-[#6d7cff]" aria-hidden="true" />
            <span className="max-w-sm text-sm leading-6 text-[#5f5c52]">
              Pin a few pictures to this line. Choose a file, paste a photo, or drop it here.
            </span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {clips.map((clip, index) => (
              <li
                key={clip.id}
                data-clip-index={index}
                className={cn(
                  "group relative cursor-grab touch-none select-none active:cursor-grabbing",
                  TILT[index % TILT.length],
                  draggingId === clip.id && "z-10 scale-[1.03]",
                )}
                onPointerDown={(event) => onClipPointerDown(event, index)}
                onPointerMove={onClipPointerMove}
                onPointerUp={onClipPointerUp}
                onPointerCancel={onClipPointerUp}
              >
                <figure className="rounded-[0.65rem] bg-[#fffaf1] p-2 pb-5 shadow-[0_12px_24px_rgba(40,32,18,0.16)] ring-1 ring-black/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clip.url}
                    alt=""
                    draggable={false}
                    className="aspect-square w-full rounded-[0.35rem] object-cover"
                  />
                </figure>
                <button
                  type="button"
                  className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-[#14151d] text-white opacity-100 shadow-sm sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeClip(clip.id);
                  }}
                  aria-label="Remove picture"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-[#6d6a60]">
        {clips.length}/{MAX_MOOD_CLIPS} pictures · drag to rearrange · stays on this device
      </p>
      {error ? (
        <p className="mt-1 text-sm font-medium text-[#9a2f1c]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
