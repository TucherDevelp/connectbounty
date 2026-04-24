/**
 * Vector payout / Connect empty-state mark — stroke-based, no emoji.
 */
export function FintechPayoutMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Back plate — depth */}
      <rect
        x="11"
        y="7"
        width="30"
        height="19"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.2}
      />
      {/* Front card */}
      <rect x="7" y="13" width="30" height="19" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Chip */}
      <rect
        x="11.5"
        y="17.5"
        width="7"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={0.55}
      />
      {/* Ledger lines */}
      <path
        d="M21.5 19.5h11M21.5 22.5h7.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity={0.38}
      />
      {/* Incoming payout — minimal arrow */}
      <path
        d="M36.5 9.5v6.5M33 12.5l3.5-3.5 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.72}
      />
    </svg>
  );
}
