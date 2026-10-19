import { IMAGE_STYLES, type ImageStyle } from "@/components/image-card";
import { DEFAULT_EFFECTS, DEFAULT_SIZE, FRAME_STYLES, type CardEffects, type CardOptions } from "@/components/profile-card";
import {
  BACKDROPS,
  DEFAULT_BACKDROP,
  defaultTune,
  type Backdrop,
  type BackdropChoice,
  type BackdropTune,
} from "./backdrops";
import { isCardImage, type CardImage } from "./card-image";
import { FORMATS } from "./formats";
import { isPlatformId, SOURCES, type PlatformId, type Profile, type Source } from "./platforms";

export interface SavedStudio {
  /** The tab picked above the studio. */
  source: Source;
  /** The platform picked in the Profile tab. */
  platform: PlatformId;
  input: string;
  profile: Profile;
  /** Shown in place of the profile when set. */
  image: CardImage | null;
  imageStyle: ImageStyle;
  options: CardOptions;
  backdrop: BackdropChoice;
  tune: BackdropTune;
  effects: CardEffects;
  formatId: string;
}

// Bump the version whenever the saved shape changes, so old saves are dropped instead of misread.
const STORAGE_KEY = "kado:studio:v1";

// Size was S, M or L before it became a slider; these give the same cards.
const LEGACY_SIZES: Record<string, number> = { S: 25, M: 50, L: 75 };

function isProfile(value: unknown): value is Profile {
  const p = value as Profile | null;
  return (
    typeof p === "object" &&
    p !== null &&
    isPlatformId(p.platform) &&
    typeof p.handle === "string" &&
    typeof p.name === "string" &&
    typeof p.bio === "string" &&
    Array.isArray(p.stats)
  );
}

/** Takes each saved field whose type matches the default, so saves from before a field existed still load. */
function withDefaults<T extends object>(defaults: T, saved: unknown): T {
  const out = { ...defaults };
  if (typeof saved !== "object" || saved === null) return out;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (saved as T)[key];
    if (typeof value === typeof defaults[key]) out[key] = value;
  }
  return out;
}

/**
 * The tab and platform a save was left on. Before the Profile tab, `platform` held the tab itself: a platform id,
 * "image" or "website". A tab that no longer exists, such as LinkedIn, falls back to Image.
 */
function restoreSource(saved: Partial<SavedStudio>): { source: Source; platform: PlatformId } {
  const legacy = String(saved.platform);
  const platform = isPlatformId(legacy) ? legacy : "x";
  if (SOURCES.includes(saved.source!)) return { source: saved.source!, platform };
  if (legacy === "image" || legacy === "website") return { source: legacy, platform };
  return { source: isPlatformId(legacy) ? "profile" : "image", platform };
}

/** A restored session. `profile` is null when the saved one belongs to a platform that's gone, such as LinkedIn. */
export type RestoredStudio = Omit<SavedStudio, "profile"> & { profile: Profile | null };

/** Reads the last session's studio, or null when there is none or it no longer fits the current shape. */
export function loadStudio(): RestoredStudio | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedStudio> | null;
    if (!saved) return null;
    // Presets are saved by id, so a tweaked gradient shows its current look rather than a stale copy.
    const backdrop =
      saved.backdrop && "upload" in saved.backdrop
        ? saved.backdrop
        : (BACKDROPS.find((b) => b.id === (saved.backdrop as Backdrop | undefined)?.id) ?? DEFAULT_BACKDROP);
    const effects = withDefaults(DEFAULT_EFFECTS, saved.effects);
    if (!FRAME_STYLES.includes(effects.frame)) effects.frame = DEFAULT_EFFECTS.frame;
    const options = { ...saved.options } as CardOptions;
    if (typeof options.size !== "number") options.size = LEGACY_SIZES[String(options.size)] ?? DEFAULT_SIZE;
    return {
      ...restoreSource(saved),
      input: typeof saved.input === "string" ? saved.input : "",
      // An unreadable profile is dropped on its own; the background, effects, format and image still come back.
      profile: isProfile(saved.profile) ? saved.profile : null,
      image: isCardImage(saved.image) ? saved.image : null,
      imageStyle: IMAGE_STYLES.includes(saved.imageStyle!) ? saved.imageStyle! : IMAGE_STYLES[0],
      options,
      backdrop,
      tune: withDefaults(defaultTune(backdrop), saved.tune),
      effects,
      formatId: FORMATS.some((f) => f.id === saved.formatId) ? saved.formatId! : FORMATS[0].id,
    };
  } catch {
    return null;
  }
}

function withoutUploads(studio: SavedStudio): SavedStudio {
  const strip = (url: string | null) => (url?.startsWith("data:") ? null : url);
  return {
    ...studio,
    profile: { ...studio.profile, avatarUrl: strip(studio.profile.avatarUrl), bannerUrl: strip(studio.profile.bannerUrl) },
    image: null,
    ...("upload" in studio.backdrop && { backdrop: DEFAULT_BACKDROP, tune: defaultTune(DEFAULT_BACKDROP) }),
  };
}

export function saveStudio(studio: SavedStudio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studio));
  } catch {
    // Uploaded images can blow the ~5MB quota; keep the typed details at least.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutUploads(studio)));
    } catch {
      // Storage is blocked (private mode, disabled cookies). Nothing to save into.
    }
  }
}
