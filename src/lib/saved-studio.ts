import { DEFAULT_EFFECTS, FRAME_STYLES, type CardEffects, type CardOptions } from "@/components/profile-card";
import {
  BACKDROPS,
  DEFAULT_BACKDROP,
  defaultTune,
  type Backdrop,
  type BackdropChoice,
  type BackdropTune,
} from "./backdrops";
import { FORMATS } from "./formats";
import { isPlatformId, type PlatformId, type Profile } from "./platforms";

export interface SavedStudio {
  platform: PlatformId;
  input: string;
  profile: Profile;
  options: CardOptions;
  backdrop: BackdropChoice;
  tune: BackdropTune;
  effects: CardEffects;
  formatId: string;
}

// Bump the version whenever the saved shape changes, so old saves are dropped instead of misread.
const STORAGE_KEY = "kado:studio:v1";

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

/** Reads the last session's studio, or null when there is none or it no longer fits the current shape. */
export function loadStudio(): SavedStudio | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedStudio> | null;
    if (!saved || !isPlatformId(saved.platform as string) || !isProfile(saved.profile)) return null;
    // Presets are saved by id, so a tweaked gradient shows its current look rather than a stale copy.
    const backdrop =
      saved.backdrop && "upload" in saved.backdrop
        ? saved.backdrop
        : (BACKDROPS.find((b) => b.id === (saved.backdrop as Backdrop | undefined)?.id) ?? DEFAULT_BACKDROP);
    const effects = withDefaults(DEFAULT_EFFECTS, saved.effects);
    if (!FRAME_STYLES.includes(effects.frame)) effects.frame = DEFAULT_EFFECTS.frame;
    return {
      platform: saved.platform as PlatformId,
      input: typeof saved.input === "string" ? saved.input : "",
      profile: saved.profile,
      options: saved.options as CardOptions,
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
