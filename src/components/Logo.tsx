export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${dim} flex items-center justify-center rounded-2xl bg-bc-elevated border border-bc-accent/30 shadow-glow`}
      >
        <svg viewBox="0 0 32 32" className="h-[55%] w-[55%]" aria-hidden>
          <path
            d="M16 6a8 8 0 0 0-8 8v4a8 8 0 0 0 16 0v-4a8 8 0 0 0-8-8Z"
            fill="none"
            stroke="#2ee59d"
            strokeWidth="2"
          />
          <rect x="13" y="12" width="6" height="10" rx="1" fill="#2ee59d" />
          <rect x="11" y="20" width="10" height="2" rx="1" fill="#5dffb8" opacity="0.7" />
        </svg>
      </div>
      <div>
        <span className={`font-display font-bold tracking-tight text-bc-text ${text}`}>BC</span>
        <span className={`font-display font-bold tracking-tight text-bc-accent ${text}`}> Charge</span>
      </div>
    </div>
  );
}
