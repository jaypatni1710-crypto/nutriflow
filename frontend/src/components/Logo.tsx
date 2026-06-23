interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function NutriFlowLogoIcon({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16 2C16 2 8 8 8 16C8 21 11 26 16 28C21 26 24 21 24 16C24 8 16 2 16 2Z" fill="#0f766e" />
      <path d="M16 6C16 6 12 10 12 16C12 19 13 22 16 24C19 22 20 19 20 16C20 10 16 6 16 6Z" fill="#14b8a6" />
      <path d="M16 24L16 30" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="12" r="1.5" fill="white" opacity="0.8" />
      <circle cx="18" cy="14" r="1" fill="white" opacity="0.6" />
      <circle cx="15" cy="18" r="1" fill="white" opacity="0.7" />
    </svg>
  );
}

export function NutriFlowLogo({ className = '', size = 32, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <NutriFlowLogoIcon size={size} />
      {showText && (
        <span className="font-bold text-xl text-slate-900 tracking-tight dark:text-white">
          NutriFlow
        </span>
      )}
    </div>
  );
}