import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TruckHeroProps {
  width?: number;
  height?: number;
  showRoute?: boolean;
  showMarkers?: boolean;
  className?: string;
  status?: "idle" | "moving" | "arrived";
}

/** Animated truck + route visual used in dashboard heroes and portals. */
export function TruckHero({
  width = 480,
  height = 200,
  showRoute = true,
  showMarkers = true,
  className,
  status = "moving",
}: TruckHeroProps) {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shouldAnimate = mounted && !prefersReduced && status === "moving";

  return (
    <div className={className} style={{ width, height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Road surface */}
        <rect x="20" y="110" width={width - 40} height="4" rx="2" fill="var(--foreground)" opacity="0.06" />

        {/* Road dashes */}
        {showRoute && (
          <motion.line
            x1="30"
            y1="112"
            x2={width - 30}
            y2="112"
            stroke="var(--foreground)"
            strokeWidth="1"
            strokeDasharray="8 6"
            opacity="0.12"
            initial={shouldAnimate ? { strokeDashoffset: 0 } : undefined}
            animate={shouldAnimate ? { strokeDashoffset: -56 } : undefined}
            transition={shouldAnimate ? { duration: 3, repeat: Infinity, ease: "linear" } : undefined}
          />
        )}

        {/* Route glow trail */}
        {showRoute && (
          <motion.line
            x1="30"
            y1="112"
            x2={width - 30}
            y2="112"
            stroke="url(#route-glow)"
            strokeWidth="2"
            opacity="0.15"
            initial={shouldAnimate ? { pathLength: 0 } : { pathLength: 1 }}
            animate={shouldAnimate ? { pathLength: 1 } : undefined}
            transition={shouldAnimate ? { duration: 2, ease: "easeOut" } : undefined}
          />
        )}

        {/* Origin marker */}
        {showMarkers && (
          <g>
            <circle cx="50" cy="112" r="5" fill="var(--primary)" opacity="0.15" />
            <motion.circle
              cx="50"
              cy="112"
              r="3"
              fill="var(--primary)"
              opacity="0.6"
              animate={shouldAnimate ? { scale: [1, 1.3, 1], opacity: [0.6, 0.3, 0.6] } : {}}
              transition={shouldAnimate ? { duration: 2, repeat: Infinity } : {}}
            />
            <circle cx="50" cy="112" r="1.5" fill="var(--primary)" />
          </g>
        )}

        {/* Destination marker */}
        {showMarkers && (
          <g>
            <circle cx={width - 50} cy="112" r="5" fill="#F5A623" opacity="0.15" />
            <motion.circle
              cx={width - 50}
              cy="112"
              r="3"
              fill="#F5A623"
              opacity="0.5"
              animate={shouldAnimate ? { scale: [1, 1.2, 1], opacity: [0.5, 0.25, 0.5] } : {}}
              transition={shouldAnimate ? { duration: 2.5, repeat: Infinity, delay: 0.5 } : {}}
            />
            <circle cx={width - 50} cy="112" r="1.5" fill="#F5A623" />
          </g>
        )}

        {/* Truck group */}
        <motion.g
          initial={shouldAnimate ? { x: 0 } : { x: width * 0.5 - 70 }}
          animate={shouldAnimate ? { x: [0, width - 160, 0] } : { x: width * 0.5 - 70 }}
          transition={shouldAnimate ? { duration: 8, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          {/* Truck shadow */}
          <ellipse cx="70" cy="122" rx="35" ry="3" fill="var(--foreground)" opacity="0.04" />

          {/* Truck body */}
          <rect x="40" y="88" width="48" height="20" rx="3" fill="var(--primary)" />
          <rect x="40" y="88" width="48" height="20" rx="3" fill="url(#truck-body-grad)" />

          {/* Cargo area detail */}
          <rect x="42" y="90" width="44" height="8" rx="1" fill="rgba(255,255,255,0.08)" />
          <line x1="42" y1="94" x2="86" y2="94" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

          {/* Cab */}
          <path
            d="M88 92h10c2 0 3.5 1.5 3.5 3.5v9c0 .5-.4 1-1 1H88V92z"
            fill="var(--primary)"
            opacity="0.85"
          />
          <path
            d="M88 92h10c2 0 3.5 1.5 3.5 3.5v9c0 .5-.4 1-1 1H88V92z"
            fill="url(#cab-grad)"
          />

          {/* Window */}
          <rect x="90.5" y="93.5" width="7" height="5" rx="1" fill="rgba(79, 140, 255, 0.3)" />
          <rect x="90.5" y="93.5" width="7" height="5" rx="1" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" fill="none" />

          {/* Headlight */}
          <motion.circle
            cx="101.5"
            cy="97"
            r="1.5"
            fill="#F5A623"
            animate={shouldAnimate ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.8 }}
            transition={shouldAnimate ? { duration: 1.5, repeat: Infinity } : undefined}
          />

          {/* Headlight beam */}
          <motion.path
            d="M103 95l10-4v10l-10-4z"
            fill="#F5A623"
            opacity="0.06"
            animate={shouldAnimate ? { opacity: [0.04, 0.08, 0.04] } : { opacity: 0.06 }}
            transition={shouldAnimate ? { duration: 1.5, repeat: Infinity } : undefined}
          />

          {/* Wheels */}
          <circle cx="55" cy="110" r="5.5" fill="#0B0D0F" />
          <circle cx="55" cy="110" r="3.5" fill="#1A2030" />
          <circle cx="55" cy="110" r="1.5" fill="rgba(255,255,255,0.15)" />

          <circle cx="72" cy="110" r="5.5" fill="#0B0D0F" />
          <circle cx="72" cy="110" r="3.5" fill="#1A2030" />
          <circle cx="72" cy="110" r="1.5" fill="rgba(255,255,255,0.15)" />

          <circle cx="95" cy="110" r="5.5" fill="#0B0D0F" />
          <circle cx="95" cy="110" r="3.5" fill="#1A2030" />
          <circle cx="95" cy="110" r="1.5" fill="rgba(255,255,255,0.15)" />

          {/* Wheel rotation indicators */}
          <motion.line
            x1="55" y1="107" x2="55" y2="113"
            stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"
            animate={shouldAnimate ? { rotate: [0, 360] } : {}}
            transition={shouldAnimate ? { duration: 1, repeat: Infinity, ease: "linear" } : undefined}
            style={{ transformOrigin: "55px 110px" }}
          />
          <motion.line
            x1="72" y1="107" x2="72" y2="113"
            stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"
            animate={shouldAnimate ? { rotate: [0, 360] } : {}}
            transition={shouldAnimate ? { duration: 1, repeat: Infinity, ease: "linear" } : undefined}
            style={{ transformOrigin: "72px 110px" }}
          />
        </motion.g>

        <defs>
          <linearGradient id="route-glow" x1="30" y1="112" x2={width - 30} y2="112" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="1" stopColor="#F5A623" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="truck-body-grad" x1="40" y1="88" x2="88" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.08)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.1)" />
          </linearGradient>
          <linearGradient id="cab-grad" x1="88" y1="92" x2="101.5" y2="105" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.06)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.08)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
