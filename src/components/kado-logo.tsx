/**
 * The kado mark: a card-shaped tile holding an X whose second stroke curves like a git branch.
 * The white node nods to LinkedIn's dot, the lilac one to Instagram's lens.
 */
export function KadoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#2a2a27" />
      <path d="M9.5 23 22.5 9.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M9.5 9.5C9.5 15 14 16.5 16 16.5S22.5 18 22.5 23"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9.5" cy="9.5" r="2.7" fill="#fff" />
      <circle cx="22.5" cy="9.5" r="2.7" fill="#c9b8ff" />
    </svg>
  );
}
