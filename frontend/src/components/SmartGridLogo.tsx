import React from 'react';

export interface SmartGridLogoProps {
  /**
   * 'primary' renders the geometric symbol + "SmartGrid AI" wordmark.
   * 'icon' renders only the square geometric symbol.
   */
  variant?: 'primary' | 'icon';
  /**
   * 'light' is designed for light/ivory surfaces (#F7F6EF / #FFFFFF).
   * 'dark' is designed for dark charcoal surfaces (#171717 / #292929).
   * 'mono-light' and 'mono-dark' render single-ink monochrome versions.
   */
  theme?: 'light' | 'dark' | 'mono-light' | 'mono-dark';
  /**
   * Controls the size of the icon mark and accompanying wordmark.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Optional subtitle below the wordmark (when variant === 'primary').
   */
  subtitle?: string;
  /**
   * Show the "AI" suffix beside SmartGrid wordmark (default: true).
   */
  showAiBadge?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: {
    iconPx: 26,
    wordmarkClass: 'text-[15.5px]',
    aiClass: 'text-[14px]',
    subtitleClass: 'text-[9.5px]',
    gapClass: 'gap-2'
  },
  sm: {
    iconPx: 32,
    wordmarkClass: 'text-[18px]',
    aiClass: 'text-[16px]',
    subtitleClass: 'text-[10px]',
    gapClass: 'gap-2.5'
  },
  md: {
    iconPx: 38,
    wordmarkClass: 'text-[20px]',
    aiClass: 'text-[18px]',
    subtitleClass: 'text-[10.5px]',
    gapClass: 'gap-2.5'
  },
  lg: {
    iconPx: 44,
    wordmarkClass: 'text-[23px]',
    aiClass: 'text-[20px]',
    subtitleClass: 'text-[11px]',
    gapClass: 'gap-3'
  }
};

/**
 * SmartGrid AI Brand Identity Component.
 *
 * Symbol Concept: "The Modular S-Grid"
 * A symmetrical 3x3 architectural timetable matrix (38x38 grid inside a 64x64 squircle)
 * composed of 5 interlocking schedule blocks:
 *  - Two horizontal 2-slot lecture spans (top-right and bottom-left)
 *  - Two vertical 2-slot lab spans (upper-left and lower-right)
 *  - One central 1-slot optimization pivot node (center)
 * Together, all 9 cells of the 3x3 timetable grid are filled with 180-degree rotational
 * symmetry, forming a structured grid and a subtle geometric letter "S".
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
  const isDarkSurface = theme === 'dark' || theme === 'mono-dark';
  const isMono = theme === 'mono-light' || theme === 'mono-dark';

  // Tile & block palette
  const tileFill =
    theme === 'mono-dark'
      ? '#FFFFFF'
      : theme === 'dark'
      ? '#202020'
      : '#171717';

  const tileStroke =
    theme === 'mono-dark'
      ? '#E4E2DA'
      : theme === 'dark'
      ? '#383838'
      : '#2E2E2E';

  const horizontalSpanFill = isMono
    ? theme === 'mono-dark'
      ? '#171717'
      : '#FFFFFF'
    : '#F7F6EF';

  const verticalSpanFill = isMono
    ? theme === 'mono-dark'
      ? '#171717'
      : '#FFFFFF'
    : '#B8EEEE';

  const centerNodeFill = isMono
    ? theme === 'mono-dark'
      ? '#171717'
      : '#FFFFFF'
    : '#B7F77C';

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
      {/* Architectural Squircle Container */}
      <rect width="64" height="64" rx="15" fill={tileFill} />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="14"
        stroke={tileStroke}
        strokeWidth="1.25"
      />

      {/* 1. Top-Right Horizontal 2-Slot Lecture Span (C2..C3, R1) */}
      <rect
        x="27"
        y="13"
        width="24"
        height="10"
        rx="3"
        fill={horizontalSpanFill}
      />

      {/* 2. Upper-Left Vertical 2-Slot Lab Span (C1, R1..R2) */}
      <rect
        x="13"
        y="13"
        width="10"
        height="24"
        rx="3"
        fill={verticalSpanFill}
      />

      {/* 3. Central 1-Slot Optimization Core Node (C2, R2) */}
      <rect
        x="27"
        y="27"
        width="10"
        height="10"
        rx="3"
        fill={centerNodeFill}
      />

      {/* 4. Lower-Right Vertical 2-Slot Lab Span (C3, R2..R3) */}
      <rect
        x="41"
        y="27"
        width="10"
        height="24"
        rx="3"
        fill={verticalSpanFill}
      />

      {/* 5. Bottom-Left Horizontal 2-Slot Lecture Span (C1..C2, R3) */}
      <rect
        x="13"
        y="41"
        width="24"
        height="10"
        rx="3"
        fill={horizontalSpanFill}
      />
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
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={`font-sans font-bold tracking-[-0.025em] leading-none ${cfg.wordmarkClass} ${
              isDarkSurface ? 'text-white' : 'text-[#171717]'
            }`}
          >
            SmartGrid
          </span>
          {showAiBadge && (
            <span
              className={`font-sans font-semibold tracking-[-0.01em] leading-none ${cfg.aiClass} ${
                isMono
                  ? isDarkSurface
                    ? 'text-white/80'
                    : 'text-[#171717]/80'
                  : isDarkSurface
                  ? 'text-[#B8EEEE]'
                  : 'text-[#57564F]'
              }`}
            >
              AI
            </span>
          )}
        </span>
        {subtitle && (
          <span
            className={`font-sans font-medium tracking-normal truncate mt-1 ${cfg.subtitleClass} ${
              isDarkSurface ? 'text-[#9E9D96]' : 'text-[#77766F]'
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
};
