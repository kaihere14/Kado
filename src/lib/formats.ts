import type { PlatformId } from "./platforms";

export interface ExportFormat {
  id: string;
  label: string;
  ratio: string;
  /** Logical frame size in CSS px; exports render at 2x this. */
  width: number;
  height: number;
}

// Sizes each platform displays without cropping in the feed.
export const FORMATS: ExportFormat[] = [
  { id: "x", label: "X post", ratio: "16:9", width: 1200, height: 675 },
  { id: "linkedin", label: "LinkedIn post", ratio: "1.91:1", width: 1200, height: 627 },
  { id: "portrait", label: "Instagram post", ratio: "4:5", width: 1080, height: 1350 },
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { id: "github", label: "GitHub social preview", ratio: "2:1", width: 1280, height: 640 },
];

export const DEFAULT_FORMAT: Record<PlatformId, string> = {
  x: "x",
  linkedin: "linkedin",
  github: "github",
  instagram: "portrait",
};

export const EXPORT_SCALE = 2;

export function getFormat(id: string): ExportFormat {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
