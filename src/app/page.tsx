import Link from "next/link";
import { PLATFORM_ICONS } from "@/components/brand-icons";
import { Studio } from "@/components/studio";
import { PLATFORM_ORDER, PLATFORMS } from "@/lib/platforms";

const PLATFORM_NOTES: Record<string, string> = {
  x: "Name, bio, banner and counts, pulled live from the handle.",
  linkedin: "LinkedIn hides profile data, so you type your headline and numbers.",
  github: "Pulled from GitHub’s public API, repos included.",
  instagram: "Fill in your numbers and upload a photo.",
};

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-medium tracking-[-0.03em]">
          <span aria-hidden className="relative h-6 w-6">
            <span className="absolute inset-0 rotate-[-8deg] rounded-[6px] bg-[#c9b8ff]" />
            <span className="absolute inset-0 rotate-[6deg] rounded-[6px] bg-ink" />
          </span>
          kado
        </Link>
        <a
          href="#studio"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
        >
          Open the studio
        </a>
      </nav>

      <Studio />

      <section className="mx-auto w-full max-w-4xl px-4 pt-28 pb-24 text-center">
        <h2 className="text-[34px] leading-[1.1] font-medium tracking-[-0.035em] sm:text-[48px]">
          Made for where you post.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed tracking-[-0.015em] text-muted">
          Each card follows the look of its platform, so it reads instantly in a feed.
        </p>
        <ul className="mt-12 grid gap-3 text-left sm:grid-cols-2">
          {PLATFORM_ORDER.map((id) => {
            const Icon = PLATFORM_ICONS[id];
            return (
              <li key={id} className="flex gap-4 rounded-2xl bg-well/70 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_rgba(42,42,39,.1)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium">{PLATFORMS[id].label}</span>
                  <span className="mt-0.5 block text-[15px] leading-snug text-muted">{PLATFORM_NOTES[id]}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between border-t border-black/[.06] px-4 py-6 text-sm text-muted sm:px-6">
        <span>kado</span>
        <span>Your data stays in your browser.</span>
      </footer>
    </main>
  );
}
