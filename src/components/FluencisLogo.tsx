import React from 'react';

export interface FluencisLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  badgeText?: string;
}

export const FluencisLogo: React.FC<FluencisLogoProps> = ({
  size = 36,
  className = '',
  showText = false,
  textClassName = 'text-xl',
  badgeText = 'Student',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Symbol Logo: Interlocking Vocal Resonance & Conversational Waves */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl p-1 bg-gradient-to-br from-[rgba(32,245,162,0.18)] to-[rgba(0,207,255,0.18)] border border-[rgba(32,245,162,0.4)] shadow-[0_0_20px_rgba(32,245,162,0.25)] group-hover:shadow-[0_0_28px_rgba(0,207,255,0.45)] transition-all duration-300"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_8px_rgba(32,245,162,0.6)]"
        >
          <defs>
            <linearGradient id="fluencisTealGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#20f5a2" />
              <stop offset="50%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#0088ff" />
            </linearGradient>
            <linearGradient id="fluencisWaveGrad" x1="12" y1="14" x2="36" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#20f5a2" />
              <stop offset="100%" stopColor="#00cfff" />
            </linearGradient>
            <filter id="fluencisGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Rounded Shield Contour */}
          <rect
            x="3.5"
            y="3.5"
            width="41"
            height="41"
            rx="12"
            stroke="url(#fluencisTealGrad)"
            strokeWidth="2.5"
            strokeOpacity="0.85"
            fill="rgba(2, 14, 28, 0.75)"
          />

          {/* Left Conversational Speech Ring Arc */}
          <path
            d="M15 16C12.5 19 12 23 13.5 27C15 31 18.5 34 23 35C24.5 35.3 26 35.2 27.5 34.8"
            stroke="url(#fluencisWaveGrad)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Right Conversational Speech Ring Arc */}
          <path
            d="M33 32C35.5 29 36 25 34.5 21C33 17 29.5 14 25 13C23.5 12.7 22 12.8 20.5 13.2"
            stroke="url(#fluencisWaveGrad)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Dynamic Equalizer / Vocal Audio Waves in Center */}
          <line
            x1="18"
            y1="21"
            x2="18"
            y2="27"
            stroke="#20f5a2"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <line
            x1="24"
            y1="16"
            x2="24"
            y2="32"
            stroke="#00ffff"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <line
            x1="30"
            y1="20"
            x2="30"
            y2="28"
            stroke="#20f5a2"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Acoustic Resonance Sparks */}
          <circle cx="24" cy="11" r="1.6" fill="#20f5a2" />
          <circle cx="24" cy="37" r="1.6" fill="#00cfff" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-center gap-1.5">
          <span className={`font-bold text-white tracking-tight ${textClassName}`}>
            Fluen<span className="text-[#20f5a2] drop-shadow-[0_0_12px_rgba(32,245,162,0.6)]">cis</span>
          </span>
          {badgeText && (
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest text-[#00cfff] border border-[rgba(0,207,255,0.35)] bg-[rgba(0,207,255,0.12)] px-2 py-0.5 rounded-full ml-1">
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const SpeakMateLogo = FluencisLogo;
export type SpeakMateLogoProps = FluencisLogoProps;
