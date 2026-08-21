import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "full" | "icon" | "wordmark";
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: "text-sm", gap: "gap-1.5" },
  md: { icon: 32, text: "text-base", gap: "gap-2" },
  lg: { icon: 40, text: "text-xl", gap: "gap-2.5" },
  xl: { icon: 56, text: "text-2xl", gap: "gap-3" },
};

export function Logo({ size = "md", showText = true, variant = "full", className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <LogoIcon size={s.icon} />
      {showText && variant !== "icon" && (
        <div className="flex flex-col">
          <span className={cn("font-bold tracking-tight leading-none", s.text)}>
            Dispatch<span className="text-primary">OS</span>
          </span>
          {variant === "full" && size !== "sm" && (
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground leading-none mt-0.5">
              Operations Platform
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Shield shape */}
      <path
        d="M24 2L4 10v12c0 11.11 8.56 21.54 20 24 11.44-2.46 20-12.89 20-24V10L24 2z"
        fill="url(#shield-grad)"
        opacity="0.95"
      />
      <path
        d="M24 2L4 10v12c0 11.11 8.56 21.54 20 24 11.44-2.46 20-12.89 20-24V10L24 2z"
        fill="none"
        stroke="url(#shield-stroke)"
        strokeWidth="1.5"
        opacity="0.6"
      />
      {/* Road line at bottom */}
      <line x1="12" y1="33" x2="36" y2="33" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="3 2" />
      {/* Truck body */}
      <rect x="14" y="20" width="14" height="8" rx="1.5" fill="rgba(255,255,255,0.95)" />
      {/* Truck cab */}
      <path
        d="M28 21.5h3.5c.83 0 1.5.67 1.5 1.5v5c0 .55-.45 1-1 1H28V21.5z"
        fill="rgba(255,255,255,0.85)"
      />
      {/* Cab window */}
      <rect x="29" y="22.5" width="2.5" height="2.5" rx="0.5" fill="rgba(79, 140, 255, 0.6)" />
      {/* Front wheel */}
      <circle cx="19" cy="29.5" r="1.8" fill="var(--background, #0B0D0F)" />
      <circle cx="19" cy="29.5" r="0.8" fill="rgba(255,255,255,0.3)" />
      {/* Rear wheel */}
      <circle cx="25" cy="29.5" r="1.8" fill="var(--background, #0B0D0F)" />
      <circle cx="25" cy="29.5" r="0.8" fill="rgba(255,255,255,0.3)" />
      {/* Front wheel on cab */}
      <circle cx="30.5" cy="29.5" r="1.8" fill="var(--background, #0B0D0F)" />
      <circle cx="30.5" cy="29.5" r="0.8" fill="rgba(255,255,255,0.3)" />
      {/* Headlight glow */}
      <circle cx="33" cy="25" r="1" fill="#4F8CFF" opacity="0.5" />
      <defs>
        <linearGradient id="shield-grad" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A2A4A" />
          <stop offset="1" stopColor="#0F1828" />
        </linearGradient>
        <linearGradient id="shield-stroke" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F8CFF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#F5A623" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export { LogoIcon };
