import Link from "next/link";
import { Globe, ImageIcon, Plus } from "lucide-react";
import { GitHubIcon, PLATFORM_ICONS } from "@/components/brand-icons";
import { KadoLogo } from "@/components/kado-logo";
import { Reveal } from "@/components/reveal";
import { Studio } from "@/components/studio";
import { PLATFORM_ORDER, PLATFORMS } from "@/lib/platforms";
import { GITHUB_URL, SITE_URL } from "@/lib/site";

const PLATFORM_NOTES: Record<string, string> = {
  x: "Name, bio, banner and counts, pulled live from the handle.",
  github: "Pulled from GitHub’s public API, repos included.",
  instagram: "Followers, following and posts from public profiles. Add your bio yourself.",
  youtube: "Subscribers, videos, views, banner and description, straight from the channel.",
};

const TILES = [
  {
    id: "image",
    label: "Image",
    Icon: ImageIcon,
    note: "Drop or paste any screenshot and frame it like a card. Nothing is uploaded.",
  },
  {
    id: "website",
    label: "Website",
    Icon: Globe,
    note: "Paste a link and kado captures the top of the page, ready to frame.",
  },
  ...PLATFORM_ORDER.map((id) => ({ id, label: PLATFORMS[id].label, Icon: PLATFORM_ICONS[id], note: PLATFORM_NOTES[id] })),
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Is kado free?",
    answer: "Yes. There is no account, no paywall and no sign-up. kado is open source under the MIT license.",
  },
  {
    question: "Which profiles can I turn into a card?",
    answer:
      "X, GitHub, YouTube and Instagram profiles are pulled in automatically from the handle. For anything else, paste a link under Website or drop a screenshot in under Image.",
  },
  {
    question: "Can I use a screenshot or a website instead of a profile?",
    answer:
      "Yes. Pick Image, then drop, paste or open any screenshot or picture; it stays in your browser. Or pick Website and paste a link, and kado captures the top of the page as a 1440 × 900 browser window shows it. Either one sits in a card, a window or on its own, with the same backgrounds, frames, shadow and tilt as a profile card.",
  },
  {
    question: "What sizes can I download?",
    answer:
      "X post (16:9), LinkedIn post (1.91:1), Instagram post (4:5), Square (1:1) and GitHub social preview (2:1). Every image is exported at 2× for sharp text, for example 2400 × 1350 for an X post. You can download a PNG or copy it to the clipboard.",
  },
  {
    question: "Can I change what the card shows?",
    answer:
      "Yes. Edit the name, bio and counts, upload your own photo or banner, and pick a card style, a background and a frame. Backgrounds include five grainy gradients, plain black, six soft tones, or an image of your own.",
  },
  {
    question: "What if my Instagram account is private?",
    answer: "kado can't read private profiles, so you get a blank Instagram card to fill in by hand instead.",
  },
  {
    question: "Is my data stored anywhere?",
    answer:
      "No. Nothing is saved on a server. Your last session stays in your own browser, so a refresh doesn't lose your work.",
  },
];

// Structured data for search engines: what the app is, who made it, and the questions answered on the page.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "kado",
      url: SITE_URL,
      description:
        "Turn any screenshot or website, or an X, GitHub, YouTube or Instagram profile, into a polished, share-ready card image sized for your feed.",
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      image: `${SITE_URL}/opengraph-image.jpg`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: {
        "@type": "Person",
        name: "Arman Thakur",
        url: "https://github.com/kaihere14",
        sameAs: ["https://x.com/ArmanKiyotaka", "https://github.com/kaihere14"],
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so nothing in the payload can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
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
            {TILES.map(({ id, label, Icon, note }, index) => (
              // An odd last tile spans both columns instead of sitting alone.
              <li key={id} className="sm:odd:last:col-span-2">
                {/* Outer radius = tile radius (8) + padding (20). */}
                <Reveal delay={index * 50} className="flex h-full gap-4 rounded-[28px] bg-well/70 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_rgba(42,42,39,.1)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="mt-0.5 block text-[15px] leading-snug text-pretty text-muted">{note}</span>
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-2xl px-4 pb-24">
          <Reveal>
            <h2 className="text-center text-[34px] leading-[1.1] font-medium tracking-[-0.035em] sm:text-[48px]">
              Questions, answered.
            </h2>
          </Reveal>
          <Reveal delay={50} className="mt-12 divide-y divide-black/[.06] border-y border-black/[.06]">
            {FAQS.map(({ question, answer }) => (
              <details key={question} className="faq group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-medium tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                  {question}
                  <Plus
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                    strokeWidth={1.75}
                  />
                </summary>
                <p className="-mt-1 pr-10 pb-5 text-[15px] leading-relaxed text-pretty text-muted">{answer}</p>
              </details>
            ))}
          </Reveal>
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
