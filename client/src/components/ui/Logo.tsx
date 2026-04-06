import { type CSSProperties } from 'react';

interface LogoProps {
  /** Pixel size of the icon mark. Defaults to 32. */
  size?: number;
  /** Show the "ShiftSync" wordmark beside the icon. Defaults to false. */
  withText?: boolean;
  /**
   * Colour variant:
   * - 'color'  – full-colour gradient (default, works on light backgrounds)
   * - 'white'  – white/transparent icon for dark/gradient backgrounds
   */
  variant?: 'color' | 'white';
  className?: string;
  style?: CSSProperties;
}

/**
 * ShiftSync brand logo mark (rounded square with sync-arrow clock).
 * Renders an inline SVG so it scales crisply at any size without network requests.
 */
export function Logo({
  size = 32,
  withText = false,
  variant = 'color',
  className,
  style,
}: LogoProps) {
  const isWhite = variant === 'white';

  const iconMark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={withText}
      aria-label={withText ? undefined : 'ShiftSync'}
      role={withText ? undefined : 'img'}
      style={{ flexShrink: 0 }}
    >
      <defs>
        {!isWhite && (
          <linearGradient
            id={`logo-grad-${size}`}
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#6B5FED" />
            <stop offset="55%"  stopColor="#5046E4" />
            <stop offset="100%" stopColor="#3B82C4" />
          </linearGradient>
        )}
      </defs>

      {/* Background */}
      <rect
        width="32"
        height="32"
        rx="7"
        fill={isWhite ? 'rgba(255,255,255,0.15)' : `url(#logo-grad-${size})`}
      />

      {/* Dashed clock ring */}
      <circle
        cx="16"
        cy="16"
        r="8.5"
        stroke={isWhite ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)'}
        strokeWidth="0.75"
        strokeDasharray="2.2 1.6"
        fill="none"
      />

      {/* 3-o'clock dot */}
      <circle cx="24.5" cy="16" r="0.9" fill={isWhite ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)'} />
      {/* 9-o'clock dot */}
      <circle cx="7.5"  cy="16" r="0.9" fill={isWhite ? 'rgba(255,255,255,0.5)' : '#22D3EE'} fillOpacity={isWhite ? 1 : 0.6} />

      {/* Clock hands */}
      <line x1="16" y1="16" x2="11.8" y2="10.5" stroke={isWhite ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.55)'} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="16" y1="16" x2="19.5" y2="12.5" stroke={isWhite ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.55)'} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.1" fill={isWhite ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'} />

      {/* Top-right white sync arrow */}
      <path
        d="M 9 9 A 9.5 9.5 0 0 1 24.5 12"
        stroke="white"
        strokeWidth="2.0"
        strokeLinecap="round"
        fill="none"
      />
      <polygon points="24.5,12 26.5,9.5 27.5,12.5" fill="white" />

      {/* Bottom-left cyan sync arrow */}
      <path
        d="M 23 23 A 9.5 9.5 0 0 1 7.5 20"
        stroke={isWhite ? 'rgba(255,255,255,0.85)' : '#22D3EE'}
        strokeWidth="2.0"
        strokeLinecap="round"
        fill="none"
      />
      <polygon
        points="7.5,20 5.5,22.5 4.5,19.5"
        fill={isWhite ? 'rgba(255,255,255,0.85)' : '#22D3EE'}
      />
    </svg>
  );

  if (!withText) {
    return (
      <span className={className} style={style}>
        {iconMark}
      </span>
    );
  }

  const textSize    = Math.round(size * 0.56);
  const lineHeight  = Math.round(textSize * 1.15);

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28), ...style }}
      aria-label="ShiftSync"
      role="img"
    >
      {iconMark}
      <span
        style={{
          fontFamily: "'Sora', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: textSize,
          lineHeight: `${lineHeight}px`,
          letterSpacing: '-0.03em',
          color: isWhite ? 'white' : 'inherit',
          userSelect: 'none',
        }}
        aria-hidden
      >
        ShiftSync
      </span>
    </span>
  );
}
