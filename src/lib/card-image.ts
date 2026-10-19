/** A screenshot or picture shown inside a card in place of a profile. */
export interface CardImage {
  /** A data URL, so the export and the saved session can both read it. */
  src: string;
  /** Pixel size; it sets the card's proportions. */
  width: number;
  height: number;
}

// A full-frame card exports at 2x a 1280px frame, so pixels past this never reach the PNG.
const MAX_EDGE = 2560;

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

/**
 * Reads a dropped, pasted or picked image. Anything larger than an export can use is scaled down first,
 * which keeps the export fast on phones and the saved session small.
 */
export async function readCardImage(file: File): Promise<CardImage> {
  const src = await readFile(file);
  const image = await decode(src);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) throw new Error("The image has no size");
  const shrink = Math.max(width, height) / MAX_EDGE;
  if (shrink <= 1) return { src, width, height };

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width / shrink);
  canvas.height = Math.round(height / shrink);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Photos stay JPEG; screenshots stay lossless so their text keeps its edges.
  const scaled = { src: canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.92), width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return scaled;
}

export function isCardImage(value: unknown): value is CardImage {
  const image = value as CardImage | null;
  return (
    typeof image === "object" &&
    image !== null &&
    typeof image.src === "string" &&
    image.src.startsWith("data:image/") &&
    image.width > 0 &&
    image.height > 0
  );
}
