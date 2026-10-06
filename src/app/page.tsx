import Link from "next/link";
import { GitHubIcon, PLATFORM_ICONS } from "@/components/brand-icons";
import { KadoLogo } from "@/components/kado-logo";
import { Reveal } from "@/components/reveal";
import { Studio } from "@/components/studio";
import { PLATFORM_ORDER, PLATFORMS } from "@/lib/platforms";

const GITHUB_URL = "https://github.com/kaihere14/Kado";

const PLATFORM_NOTES: Record<string, string> = {
  x: "Name, bio, banner and counts, pulled live from the handle.",
  linkedin: "LinkedIn hides profile data, so you type your headline and numbers.",
  github: "Pulled from GitHub’s public API, repos included.",
  instagram: "Followers, following and posts from public profiles. Add your bio yourself.",
};

export default function Home() {
  return (
    <>
      <Reveal immediate>
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-medium tracking-[-0.03em]">
            <KadoLogo className="h-7 w-7" />
            kado
          </Link>
          {/* 2px less padding on the icon side keeps the label optically centred. */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="press flex items-center gap-2 rounded-full bg-ink py-2 ps-3.5 pe-4 text-sm font-medium text-white transition-[background-color,scale] hover:bg-black"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
        </header>
      </Reveal>

      <main className="flex flex-1 flex-col">
        <Studio />

        <section className="mx-auto w-full max-w-4xl px-4 pt-28 pb-24 text-center">
          <Reveal>
            <h2 className="text-[34px] leading-[1.1] font-medium tracking-[-0.035em] sm:text-[48px]">
              Made for where you post.
            </h2>
          </Reveal>
          <Reveal delay={50}>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed tracking-[-0.015em] text-muted">
              Each card follows the look of its platform, so it reads instantly in a feed.
            </p>
          </Reveal>
          <ul className="mt-12 grid gap-3 text-left sm:grid-cols-2">
            {PLATFORM_ORDER.map((id, index) => {
              const Icon = PLATFORM_ICONS[id];
              return (
                <li key={id}>
                  {/* Outer radius = tile radius (8) + padding (20). */}
                  <Reveal delay={index * 50} className="flex h-full gap-4 rounded-[28px] bg-well/70 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_rgba(42,42,39,.1)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-medium">{PLATFORMS[id].label}</span>
                      <span className="mt-0.5 block text-[15px] leading-snug text-pretty text-muted">
                        {PLATFORM_NOTES[id]}
                      </span>
                    </span>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <Reveal>
        <footer className="mx-auto flex w-full max-w-6xl items-center justify-between border-t border-black/[.06] px-4 py-6 text-sm text-muted sm:px-6">
          <span className="flex items-center gap-2">
            <KadoLogo className="h-5 w-5" />
            kado
          </span>
          <span>Your data stays in your browser.</span>
        </footer>
      </Reveal>
    </>
  );
}
