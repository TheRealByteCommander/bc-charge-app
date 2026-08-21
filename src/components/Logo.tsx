import logoFull from '../assets/brand/bc-charge-logo.png';
import logoMark from '../assets/brand/bc-charge-mark.png';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
type LogoVariant = 'full' | 'mark' | 'wordmark';

const SIZE: Record<
  LogoSize,
  { mark: string; full: string; text: string; gap: string }
> = {
  sm: { mark: 'h-8 w-auto max-w-[2.5rem]', full: 'h-12 w-auto max-w-[7rem]', text: 'text-lg', gap: 'gap-2' },
  md: { mark: 'h-10 w-auto max-w-[3rem]', full: 'h-16 w-auto max-w-[9rem]', text: 'text-xl', gap: 'gap-2.5' },
  lg: { mark: 'h-14 w-auto max-w-[4rem]', full: 'h-24 w-auto max-w-[11rem]', text: 'text-3xl', gap: 'gap-3' },
  xl: { mark: 'h-20 w-auto max-w-[5rem]', full: 'h-32 w-auto max-w-[14rem]', text: 'text-4xl', gap: 'gap-3' },
};

/**
 * Official BC Charge logo — original raster asset (not redrawn).
 * - full: icon + wordmark image
 * - mark: icon only
 * - wordmark: icon + HTML "BC Charge" text in brand colors
 */
export function Logo({
  size = 'md',
  variant = 'wordmark',
  className = '',
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
}) {
  const s = SIZE[size];

  if (variant === 'full') {
    return (
      <img
        src={logoFull}
        alt="BC Charge"
        className={`${s.full} object-contain ${className}`}
        draggable={false}
      />
    );
  }

  if (variant === 'mark') {
    return (
      <img
        src={logoMark}
        alt="BC Charge"
        className={`${s.mark} object-contain ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <img
        src={logoMark}
        alt=""
        aria-hidden
        className={`${s.mark} object-contain`}
        draggable={false}
      />
      <div className="leading-none">
        <span className={`font-display font-bold tracking-tight text-bc-blue ${s.text}`}>BC</span>
        <span className={`font-display font-bold tracking-tight text-bc-accent ${s.text}`}>
          {' '}
          Charge
        </span>
      </div>
    </div>
  );
}
