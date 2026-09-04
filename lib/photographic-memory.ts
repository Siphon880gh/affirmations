export const PIECE_PHASES = [
  "full",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
  "hidden",
] as const;

export type PiecePhase = (typeof PIECE_PHASES)[number];

export const PIECE_PHASE_LABELS: Record<PiecePhase, string> = {
  full: "Full picture",
  topLeft: "Top left",
  topRight: "Top right",
  bottomLeft: "Bottom left",
  bottomRight: "Bottom right",
  hidden: "No picture",
};

export type MemoryMode = "piece" | "review";

export const SPOTLIGHT_RADIUS_MIN = 8;
export const SPOTLIGHT_RADIUS_MAX = 48;
export const SPOTLIGHT_RADIUS_DEFAULT = 18;

export const DRAG_THRESHOLD_PX = 8;

export type PointerPoint = { x: number; y: number };

export function nextPiecePhase(phase: PiecePhase): PiecePhase {
  const index = PIECE_PHASES.indexOf(phase);
  return PIECE_PHASES[(index + 1) % PIECE_PHASES.length]!;
}

export function prevPiecePhase(phase: PiecePhase): PiecePhase {
  const index = PIECE_PHASES.indexOf(phase);
  return PIECE_PHASES[(index - 1 + PIECE_PHASES.length) % PIECE_PHASES.length]!;
}

export function piecePhaseClipPath(phase: PiecePhase): string {
  switch (phase) {
    case "full":
      return "none";
    case "topLeft":
      return "inset(0 50% 50% 0)";
    case "topRight":
      return "inset(0 0 50% 50%)";
    case "bottomLeft":
      return "inset(50% 50% 0 0)";
    case "bottomRight":
      return "inset(50% 0 0 50%)";
    case "hidden":
      return "inset(100%)";
  }
}

export function spotlightRadiusPx(percent: number, width: number, height: number): number {
  const clamped = Math.min(SPOTLIGHT_RADIUS_MAX, Math.max(SPOTLIGHT_RADIUS_MIN, percent));
  return (Math.min(width, height) * clamped) / 100;
}

export function spotlightMaskImage(point: PointerPoint | null, radiusPx: number): string {
  if (!point || radiusPx <= 0) {
    return "linear-gradient(transparent, transparent)";
  }
  return `radial-gradient(${radiusPx}px at ${point.x}px ${point.y}px, #000 92%, transparent 100%)`;
}

export function wrapIndex(index: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

export function movedPastThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return dx * dx + dy * dy >= threshold * threshold;
}

export function containedPhotoSize(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  return { width: naturalWidth * scale, height: naturalHeight * scale };
}
