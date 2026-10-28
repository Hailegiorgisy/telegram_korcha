import React from 'react';

interface KorchaSaddleIconProps {
  className?: string;
  size?: number;
}

/**
 * Traditional Ethiopian Horse Saddle (ኮርቻ) Icon
 * Handcrafted vector icon representing the authentic Ethiopian leather saddle
 * with curved seat, raised pommel & cantle, brass stud ornaments, saddle blanket,
 * and hanging stirrup iron (እርካብ).
 */
export const KorchaSaddleIcon: React.FC<KorchaSaddleIconProps> = ({
  className = 'w-6 h-6',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="ኮርቻ (Traditional Horse Saddle)"
      role="img"
    >
      <defs>
        {/* Rich Ethiopian Leather Gradient */}
        <linearGradient id="korchaLeather" x1="6" y1="8" x2="42" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="45%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>

        {/* Seat Padding Leather */}
        <linearGradient id="korchaSeat" x1="12" y1="14" x2="36" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        {/* Brass / Gold Ornaments */}
        <linearGradient id="korchaBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Saddle Blanket Accent (ሊጃም / ምንጣፍ) */}
        <linearGradient id="korchaBlanket" x1="10" y1="26" x2="38" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="50%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>

        {/* Stirrup Steel / Metal */}
        <linearGradient id="korchaMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>

      {/* Saddle Blanket Base (ምንጣፍ) with Ethiopian decorative edge */}
      <path
        d="M9 25 C14 23 34 23 39 25 L37 32 C31 33 17 33 11 32 Z"
        fill="url(#korchaBlanket)"
        stroke="#991b1b"
        strokeWidth="1"
      />
      {/* Blanket gold fringe dots */}
      <circle cx="13" cy="31" r="0.9" fill="url(#korchaBrass)" />
      <circle cx="18" cy="31.5" r="0.9" fill="url(#korchaBrass)" />
      <circle cx="24" cy="32" r="0.9" fill="url(#korchaBrass)" />
      <circle cx="30" cy="31.5" r="0.9" fill="url(#korchaBrass)" />
      <circle cx="35" cy="31" r="0.9" fill="url(#korchaBrass)" />

      {/* Main Saddle Tree & Flap (የኮርቻው ዋና ቅርጽ) */}
      <path
        d="M10 20 C10 13 13 8 16 8 C18 8 19 12 21 15 C24 18 28 18 31 15 C33 13 35 10 38 10 C41 10 43 14 41 21 C39 26 36 28 29 28 C19 28 11 26 10 20 Z"
        fill="url(#korchaLeather)"
        stroke="#78350f"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Curved Inner Seat (መቀመጫ) */}
      <path
        d="M16 14 C19 17 29 17 32 14 C30 20 18 20 16 14 Z"
        fill="url(#korchaSeat)"
        stroke="#92400e"
        strokeWidth="1"
      />

      {/* Raised Front Horn / Pommel Crest (የኮርቻው ራስ / ጭረት) */}
      <path
        d="M13 10 C14 7 16 6 17 7 C18 8 17 12 15 13 C13 13 12 11 13 10 Z"
        fill="url(#korchaBrass)"
        stroke="#b45309"
        strokeWidth="0.8"
      />

      {/* Raised Back Cantle (የኋላ መደገፊያ) */}
      <path
        d="M37 10 C39 10 40 12 39 14 C37 15 35 14 36 12 C36 11 36.5 10.5 37 10 Z"
        fill="url(#korchaBrass)"
        stroke="#b45309"
        strokeWidth="0.8"
      />

      {/* Large Traditional Brass Medallion on Side Flap (የጎን ጌጥ) */}
      <circle cx="24" cy="23" r="3.2" fill="url(#korchaBrass)" stroke="#78350f" strokeWidth="0.8" />
      <circle cx="24" cy="23" r="1.4" fill="#78350f" />
      {/* Medallion Cross Studs */}
      <circle cx="24" cy="20.8" r="0.6" fill="#fef08a" />
      <circle cx="24" cy="25.2" r="0.6" fill="#fef08a" />
      <circle cx="21.8" cy="23" r="0.6" fill="#fef08a" />
      <circle cx="26.2" cy="23" r="0.6" fill="#fef08a" />

      {/* Leather Flap Extension (የኮርቻው ጭራሽ መሸፈኛ) */}
      <path
        d="M16 26 C15 31 16 36 19 39 C21 39 23 37 23 30"
        stroke="#78350f"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Stirrup Leather Strap (የእርካብ ማሰሪያ ቆዳ) */}
      <path
        d="M26 26 L28 37"
        stroke="#451a03"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Strap Brass Buckle */}
      <rect x="26.2" y="32" width="2.2" height="1.6" rx="0.5" fill="url(#korchaBrass)" />

      {/* Stirrup Iron (እርካብ) */}
      <path
        d="M25 37 C25 41 31 41 31 37 L29 37 C29 39.5 27 39.5 27 37 Z"
        fill="url(#korchaMetal)"
        stroke="#334155"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Stirrup Footbed */}
      <line x1="24.5" y1="41" x2="31.5" y2="41" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};
