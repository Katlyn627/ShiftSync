import React from 'react';

export interface BusinessLogoProps {
  siteName?: string;
  siteType?: string;
  size?: number;
  withText?: boolean;
  className?: string;
}

export function BusinessLogo({
  siteName = '',
  siteType = 'nonprofit',
  size = 36,
  withText = false,
  className = '',
}: BusinessLogoProps) {
  const normalized = siteName.toLowerCase().trim();

  // 1. Global Impact Initiative (Nonprofit / Humanitarian)
  if (normalized.includes('global') || normalized.includes('impact') || normalized.includes('initiative') || siteType === 'nonprofit') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-xs"
        >
          <defs>
            <linearGradient id="gii-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#0D9488" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="gii-glow" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {/* Rounded base */}
          <rect width="48" height="48" rx="12" fill="url(#gii-grad)" />
          {/* Globe grid lines */}
          <circle cx="24" cy="24" r="14" stroke="white" strokeWidth="1.8" strokeOpacity="0.9" />
          <ellipse cx="24" cy="24" rx="7.5" ry="14" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
          <line x1="10" y1="24" x2="38" y2="24" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
          <line x1="13" y1="17" x2="35" y2="17" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="13" y1="31" x2="35" y2="31" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
          {/* Olive branch / humanitarian leaves */}
          <path
            d="M 12 36 C 18 33, 24 37, 24 41 C 24 37, 30 33, 36 36"
            stroke="#A7F3D0"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Heart / Aid Star */}
          <circle cx="24" cy="24" r="3.2" fill="#FDE047" />
        </svg>
        {withText && (
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight text-sm tracking-tight">Global Impact Initiative</span>
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Humanitarian NGO</span>
          </div>
        )}
      </div>
    );
  }

  // 2. Bella Napoli (Artisanal Neapolitan Pizzeria & Ristorante)
  if (normalized.includes('bella') || normalized.includes('napoli')) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-xs"
        >
          <defs>
            <linearGradient id="bella-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="60%" stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </linearGradient>
          </defs>
          {/* Rounded base */}
          <rect width="48" height="48" rx="12" fill="url(#bella-grad)" />
          {/* Outer wood-fired oven arch / golden crust ring */}
          <circle cx="24" cy="24" r="15" stroke="#FBBF24" strokeWidth="2" strokeDasharray="3 1.5" />
          {/* Italian tricolor accent arc */}
          <path d="M 14 18 A 12 12 0 0 1 20 13" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 21 12.5 A 12 12 0 0 1 27 12.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 28 13 A 12 12 0 0 1 34 18" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
          {/* Chef Toque / Pizza Slice emblem */}
          <path
            d="M 18 31 L 24 16 L 30 31 C 27 33, 21 33, 18 31 Z"
            fill="#FEF08A"
            stroke="#D97706"
            strokeWidth="1.2"
          />
          {/* Basil & Pepperoni garnish */}
          <circle cx="24" cy="22" r="1.8" fill="#EF4444" />
          <circle cx="21" cy="27" r="1.5" fill="#EF4444" />
          <circle cx="26.5" cy="26.5" r="1.5" fill="#16A34A" />
        </svg>
        {withText && (
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight text-sm tracking-tight">Bella Napoli</span>
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cucina & Pizzeria</span>
          </div>
        )}
      </div>
    );
  }

  // 3. The Blue Door (Artisanal Taphouse & Modern Bistro)
  if (normalized.includes('blue') || normalized.includes('door')) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-xs"
        >
          <defs>
            <linearGradient id="door-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>
          {/* Rounded base */}
          <rect width="48" height="48" rx="12" fill="url(#door-grad)" />
          {/* Classical Doorway Arch */}
          <path
            d="M 16 36 V 20 C 16 15.5 19.5 12 24 12 C 28.5 12 32 15.5 32 20 V 36"
            stroke="#93C5FD"
            strokeWidth="2.2"
            fill="#1E3A8A"
          />
          {/* Door panels */}
          <rect x="18.5" y="19" width="4.5" height="6.5" rx="1" fill="#3B82F6" stroke="#93C5FD" strokeWidth="0.8" />
          <rect x="25" y="19" width="4.5" height="6.5" rx="1" fill="#3B82F6" stroke="#93C5FD" strokeWidth="0.8" />
          <rect x="18.5" y="27.5" width="4.5" height="6.5" rx="1" fill="#3B82F6" stroke="#93C5FD" strokeWidth="0.8" />
          <rect x="25" y="27.5" width="4.5" height="6.5" rx="1" fill="#3B82F6" stroke="#93C5FD" strokeWidth="0.8" />
          {/* Brass handle */}
          <circle cx="28.5" cy="27" r="1.2" fill="#FBBF24" />
          {/* Welcome lantern light */}
          <circle cx="24" cy="8" r="2" fill="#FDE047" />
        </svg>
        {withText && (
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight text-sm tracking-tight">The Blue Door</span>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Bistro & Taphouse</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback Generic Site Logo
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-xs"
      >
        {siteName ? siteName.slice(0, 2).toUpperCase() : 'SS'}
      </div>
      {withText && <span className="font-bold text-foreground text-sm">{siteName || 'ShiftSync Site'}</span>}
    </div>
  );
}

export default BusinessLogo;
