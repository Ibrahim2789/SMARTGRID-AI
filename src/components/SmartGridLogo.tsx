import React from 'react';

export interface SmartGridLogoProps {
  /**
   * 'primary' renders the geometric timetable symbol + "SmartGrid AI" wordmark.
   * 'icon' renders only the square geometric timetable symbol.
   */
  variant?: 'primary' | 'icon';
  /**
   * 'light' is designed for light/ivory surfaces (#F7F6EF / #FFFFFF).
   * 'dark' is designed for dark charcoal surfaces (#171717 / #292929).
   */
  theme?: 'light' | 'dark';
  /**
   * Controls the size of the icon mark and accompanying typography.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Optional subtitle below the wordmark (when variant === 'primary').
   */
  subtitle?: string;
  /**
   * Show the "AI" badge beside SmartGrid wordmark (default: true).
   */
  showAiBadge?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: {
    iconPx: 26,
    titleClass: 'text-base',
    badgeClass: 'text-[10px] px-1.5 py-0.5 rounded',
    subtitleClass: 'text-[9px]',
    gapClass: 'gap-2'
  },
  sm: {
    iconPx: 32,
    titleClass: 'text-xl',
    badgeClass: 'text-[10.5px] px-1.5 py-0.5 rounded-md',
    subtitleClass: 'text-[10px]',
    gapClass: 'gap-2.5'
  },
  md: {
    iconPx: 38,
    titleClass: 'text-[22px]',
    badgeClass: 'text-[11px] px-2 py-0.5 rounded-md',
    subtitleClass: 'text-[10.5px]',
    gapClass: 'gap-2.5'
  },
  lg: {
    iconPx: 44,
    titleClass: 'text-2xl',
    badgeClass: 'text-xs px-2 py-0.5 rounded-lg',
    subtitleClass: 'text-[11px]',
    gapClass: 'gap-3'
  }
};

/**
 * Original SmartGrid AI Brand Logo Component.
 * Combines a precision 3x3 timetable matrix symbol (representing continuous 3-hour labs,
 * morning/afternoon lecture spans, and solver optimization nodes) with the editorial wordmark.
 */
export const SmartGridLogo: React.FC<SmartGridLogoProps> = ({
  variant = 'primary',
  theme = 'light',
  size = 'sm',
  subtitle,
  showAiBadge = true,
  className = ''
}) => {
  const cfg = SIZE_MAP[size];
  const isDarkTheme = theme === 'dark';

  const tileFill = isDarkTheme ? '#242424' : '#171717';
  const tileStroke = isDarkTheme ? '#3E3E3E' : '#303030';
  const gridStroke = isDarkTheme ? '#363636' : '#2D2D2D';

  const iconMark = (
    <svg
      width={cfg.iconPx}
      height={cfg.iconPx}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none block"
      aria-hidden="true"
    >
      {/* Architectural Rounded Tile */}
      <rect width="64" height="64" rx="16" fill={tileFill} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" stroke={tileStroke} strokeWidth="1.5" />

      {/* Precision Timetable Grid Lines */}
      <line x1="25" y1="12" x2="25" y2="52" stroke={gridStroke} strokeWidth="1.25" strokeLinecap="round" />
      <line x1="39" y1="12" x2="39" y2="52" stroke={gridStroke} strokeWidth="1.25" strokeLinecap="round" />
      <line x1="12" y1="25" x2="52" y2="25" stroke={gridStroke} strokeWidth="1.25" strokeLinecap="round" />
      <line x1="12" y1="39" x2="52" y2="39" stroke={gridStroke} strokeWidth="1.25" strokeLinecap="round" />

      {/* Left Column: Continuous 3-Slot Lab Block (Lavender #F2D8FA) */}
      <rect x="13" y="13" width="9.5" height="38" rx="4.5" fill="#F2D8FA" />

      {/* Top Row: Morning Lecture Span (Cyan #B8EEEE) */}
      <rect x="27" y="13" width="24" height="9.5" rx="4.5" fill="#B8EEEE" />

      {/* Center Node: Optimization Pivot (Lime #B7F77C) */}
      <rect x="27" y="27.25" width="9.5" height="9.5" rx="3.5" fill="#B7F77C" />

      {/* Right Column: Afternoon Session Block (Mint #B8F2E6) */}
      <rect x="41.5" y="27.25" width="9.5" height="23.75" rx="4.5" fill="#B8F2E6" />

      {/* Bottom Center: Anchor Lecture Slot (Warm Ivory #F7F6EF) */}
      <rect x="27" y="41.5" width="9.5" height="9.5" rx="3.5" fill="#F7F6EF" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {iconMark}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${cfg.gapClass} shrink-0 select-none ${className}`}>
      {iconMark}
      <span className="flex flex-col justify-center min-w-0 leading-none">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`font-serif-editorial tracking-tight leading-none ${cfg.titleClass} ${
              isDarkTheme ? 'text-white' : 'text-[#171717]'
            }`}
          >
            SmartGrid
          </span>
          {showAiBadge && (
            <span
              className={`font-mono-tabular font-bold uppercase tracking-wider leading-none bg-[#B8EEEE] text-[#171717] ${
                isDarkTheme ? '' : 'border border-[#171717]/15'
              } ${cfg.badgeClass}`}
            >
              AI
            </span>
          )}
        </span>
        {subtitle && (
          <span
            className={`font-medium tracking-wide truncate mt-1 ${cfg.subtitleClass} ${
              isDarkTheme ? 'text-[#9E9D96]' : 'text-[#77766F]'
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
};
