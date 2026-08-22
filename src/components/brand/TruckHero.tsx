import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TruckHeroProps {
  width?: number;
  height?: number;
  showRoute?: boolean;
  showMarkers?: boolean;
  className?: string;
  status?: "idle" | "moving" | "arrived";
  variant?: "full" | "compact";
}

/**
 * Premium realistic Class 8 semi-truck hero visual.
 * Cinematic dark environment with road, route, and atmospheric lighting.
 */
export function TruckHero({
  width = 700,
  height = 340,
  showRoute = true,
  showMarkers = true,
  className,
  status = "moving",
  variant = "full",
}: TruckHeroProps) {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shouldAnimate = mounted && !prefersReduced && status === "moving";
  const isCompact = variant === "compact";

  return (
    <div className={className} style={{ width: "100%", maxWidth: width, height: isCompact ? height * 0.7 : height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.4))" }}
      >
        <defs>
          {/* Road gradient */}
          <linearGradient id="road-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1f2e" />
            <stop offset="100%" stopColor="#0d1117" />
          </linearGradient>
          {/* Truck body gradient - dark graphite */}
          <linearGradient id="truck-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2f3a" />
            <stop offset="30%" stopColor="#1e222b" />
            <stop offset="100%" stopColor="#14181f" />
          </linearGradient>
          {/* Chrome/metallic gradient */}
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4d8e0" />
            <stop offset="40%" stopColor="#a0a8b8" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          {/* Trailer body */}
          <linearGradient id="trailer-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2330" />
            <stop offset="50%" stopColor="#161a24" />
            <stop offset="100%" stopColor="#0f1218" />
          </linearGradient>
          {/* Windshield reflection */}
          <linearGradient id="windshield" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(79,140,255,0.15)" />
            <stop offset="50%" stopColor="rgba(79,140,255,0.08)" />
            <stop offset="100%" stopColor="rgba(100,120,160,0.12)" />
          </linearGradient>
          {/* Route glow */}
          <linearGradient id="route-glow-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#4F8CFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0.5" />
          </linearGradient>
          {/* Headlight beam */}
          <radialGradient id="headlight-beam" cx="0" cy="0.5" r="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.12" />
            <stop offset="60%" stopColor="#F5A623" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </radialGradient>
          {/* Blue ambient glow */}
          <radialGradient id="blue-ambient" cx="0.5" cy="0.8" r="0.5">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#4F8CFF" stopOpacity="0" />
          </radialGradient>
          {/* Horizon glow */}
          <linearGradient id="horizon-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.03" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          {/* Tire gradient */}
          <radialGradient id="tire" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#2a2e36" />
            <stop offset="60%" stopColor="#1a1e26" />
            <stop offset="100%" stopColor="#0f1218" />
          </radialGradient>
          {/* Road reflection */}
          <linearGradient id="road-reflection" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(79,140,255,0.04)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* ═══════════════════════════════════════════════════
            BACKGROUND ENVIRONMENT
            ═══════════════════════════════════════════════════ */}

        {/* Sky / atmosphere */}
        <rect x="0" y="0" width={width} height={height * 0.55} fill="#080B0F" />

        {/* Horizon glow */}
        <rect x="0" y={height * 0.35} width={width} height={height * 0.2} fill="url(#horizon-glow)" />

        {/* Blue ambient glow */}
        <rect x="0" y="0" width={width} height={height} fill="url(#blue-ambient)" />

        {/* ═══════════════════════════════════════════════════
            ROAD / GROUND
            ═══════════════════════════════════════════════════ */}

        {/* Road surface */}
        <rect x="0" y={height * 0.52} width={width} height={height * 0.48} fill="url(#road-surface)" />

        {/* Road edge line */}
        <line x1="0" y1={height * 0.55} x2={width} y2={height * 0.55} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* Lane markings */}
        {[0.3, 0.42, 0.54, 0.66].map((yFrac, i) => (
          <motion.line
            key={`lane-${i}`}
            x1={width * 0.05}
            y1={height * yFrac}
            x2={width * 0.95}
            y2={height * yFrac}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
            strokeDasharray="12 8"
            initial={shouldAnimate ? { strokeDashoffset: 0 } : undefined}
            animate={shouldAnimate ? { strokeDashoffset: -80 } : undefined}
            transition={shouldAnimate ? { duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 } : undefined}
          />
        ))}

        {/* Road reflection (subtle) */}
        <rect x={width * 0.2} y={height * 0.55} width={width * 0.6} height={height * 0.15} fill="url(#road-reflection)" opacity="0.3" />

        {/* ═══════════════════════════════════════════════════
            ROUTE LINE
            ═══════════════════════════════════════════════════ */}

        {showRoute && (
          <>
            {/* Route base line */}
            <line
              x1={width * 0.08}
              y1={height * 0.47}
              x2={width * 0.92}
              y2={height * 0.47}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1.5"
            />

            {/* Route glow */}
            <motion.line
              x1={width * 0.08}
              y1={height * 0.47}
              x2={width * 0.92}
              y2={height * 0.47}
              stroke="url(#route-glow-grad)"
              strokeWidth="2"
              initial={shouldAnimate ? { pathLength: 0 } : { pathLength: 1 }}
              animate={shouldAnimate ? { pathLength: 1 } : undefined}
              transition={shouldAnimate ? { duration: 1.8, ease: "easeOut" } : undefined}
            />

            {/* Moving dot on route */}
            {shouldAnimate && (
              <motion.circle
                r="3"
                fill="#4F8CFF"
                opacity="0.8"
                initial={{ cx: width * 0.1, cy: height * 0.47 }}
                animate={{ cx: [width * 0.1, width * 0.85, width * 0.1] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            ORIGIN / DESTINATION MARKERS
            ═══════════════════════════════════════════════════ */}

        {showMarkers && (
          <>
            {/* Origin marker */}
            <g>
              <circle cx={width * 0.08} cy={height * 0.47} r="6" fill="rgba(79,140,255,0.15)" />
              <motion.circle
                cx={width * 0.08}
                cy={height * 0.47}
                r="3.5"
                fill="#4F8CFF"
                opacity="0.7"
                animate={shouldAnimate ? { scale: [1, 1.4, 1], opacity: [0.7, 0.3, 0.7] } : {}}
                transition={shouldAnimate ? { duration: 2, repeat: Infinity } : {}}
              />
              <circle cx={width * 0.08} cy={height * 0.47} r="1.5" fill="#fff" opacity="0.9" />
            </g>

            {/* Destination marker */}
            <g>
              <circle cx={width * 0.92} cy={height * 0.47} r="8" fill="rgba(245,166,35,0.12)" />
              <motion.circle
                cx={width * 0.92}
                cy={height * 0.47}
                r="4.5"
                fill="#F5A623"
                opacity="0.6"
                animate={shouldAnimate ? { scale: [1, 1.3, 1], opacity: [0.6, 0.25, 0.6] } : {}}
                transition={shouldAnimate ? { duration: 2.5, repeat: Infinity, delay: 0.5 } : {}}
              />
              <circle cx={width * 0.92} cy={height * 0.47} r="2" fill="#fff" opacity="0.9" />
              {/* Destination label */}
              <text x={width * 0.92} y={height * 0.47 - 14} textAnchor="middle" fill="#F5A623" fontSize="9" fontWeight="700" fontFamily="Manrope, sans-serif" opacity="0.6" letterSpacing="0.1em">
                DESTINATION
              </text>
            </g>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            HEADLIGHT BEAM (on road)
            ═══════════════════════════════════════════════════ */}

        <motion.ellipse
          cx={width * 0.54}
          cy={height * 0.58}
          rx={width * 0.15}
          ry={height * 0.06}
          fill="url(#headlight-beam)"
          opacity="0.5"
          animate={shouldAnimate ? { opacity: [0.4, 0.6, 0.4] } : {}}
          transition={shouldAnimate ? { duration: 2, repeat: Infinity } : {}}
        />

        {/* ═══════════════════════════════════════════════════
            TRUCK GROUP — CLASS 8 SEMI
            ═══════════════════════════════════════════════════ */}

        <motion.g
          initial={shouldAnimate ? { x: 0 } : { x: 0 }}
          animate={shouldAnimate ? { x: [0, width * 0.02, 0] } : undefined}
          transition={shouldAnimate ? { duration: 8, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          {/* Truck shadow on road */}
          <ellipse
            cx={width * 0.43}
            cy={height * 0.62}
            rx={width * 0.17}
            ry={height * 0.03}
            fill="rgba(0,0,0,0.5)"
          />

          {/* ─── TRAILER ─── */}
          <g>
            {/* Trailer body */}
            <rect
              x={width * 0.22}
              y={height * 0.30}
              width={width * 0.28}
              height={height * 0.24}
              rx="2"
              fill="url(#trailer-body)"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
            {/* Trailer top edge highlight */}
            <line
              x1={width * 0.22}
              y1={height * 0.30}
              x2={width * 0.50}
              y2={height * 0.30}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.5"
            />
            {/* Trailer side panel lines */}
            <line
              x1={width * 0.22}
              y1={height * 0.38}
              x2={width * 0.50}
              y2={height * 0.38}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.5"
            />
            <line
              x1={width * 0.22}
              y1={height * 0.46}
              x2={width * 0.50}
              y2={height * 0.46}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.5"
            />
            {/* Trailer rear */}
            <rect
              x={width * 0.50}
              y={height * 0.31}
              width={width * 0.005}
              height={height * 0.22}
              fill="rgba(255,255,255,0.04)"
            />
            {/* Trailer rivet dots */}
            {[0.24, 0.28, 0.32, 0.36, 0.40, 0.44, 0.48].map((xFrac) => (
              <circle key={`rivet-${xFrac}`} cx={width * xFrac} cy={height * 0.34} r="0.8" fill="rgba(255,255,255,0.06)" />
            ))}
            {/* Trailer landing gear */}
            <rect x={width * 0.24} y={height * 0.54} width={width * 0.008} height={height * 0.04} fill="#14181f" rx="1" />
            <rect x={width * 0.30} y={height * 0.54} width={width * 0.008} height={height * 0.04} fill="#14181f" rx="1" />
            {/* Trailer bottom rail */}
            <line
              x1={width * 0.22}
              y1={height * 0.54}
              x2={width * 0.50}
              y2={height * 0.54}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </g>

          {/* ─── TRACTOR (CAB) ─── */}
          <g>
            {/* Tractor body - main */}
            <path
              d={`M${width * 0.50} ${height * 0.32}
                  L${width * 0.60} ${height * 0.32}
                  Q${width * 0.62} ${height * 0.32} ${width * 0.62} ${height * 0.34}
                  L${width * 0.62} ${height * 0.42}
                  L${width * 0.60} ${height * 0.42}
                  L${width * 0.60} ${height * 0.54}
                  L${width * 0.50} ${height * 0.54}
                  Z`}
              fill="url(#truck-body)"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
            />

            {/* Hood / front */}
            <path
              d={`M${width * 0.60} ${height * 0.34}
                  L${width * 0.66} ${height * 0.36}
                  L${width * 0.66} ${height * 0.50}
                  L${width * 0.60} ${height * 0.54}
                  Z`}
              fill="#1c2029"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />

            {/* Windshield */}
            <path
              d={`M${width * 0.505} ${height * 0.33}
                  L${width * 0.58} ${height * 0.33}
                  L${width * 0.58} ${height * 0.41}
                  L${width * 0.505} ${height * 0.41}
                  Z`}
              fill="url(#windshield)"
              stroke="rgba(79,140,255,0.15)"
              strokeWidth="0.5"
            />
            {/* Windshield reflection */}
            <line
              x1={width * 0.51}
              y1={height * 0.34}
              x2={width * 0.53}
              y2={height * 0.40}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />

            {/* Side window */}
            <rect
              x={width * 0.505}
              y={height * 0.33}
              width={width * 0.06}
              height={height * 0.08}
              rx="1"
              fill="url(#windshield)"
              stroke="rgba(79,140,255,0.1)"
              strokeWidth="0.5"
            />

            {/* Grille */}
            <rect
              x={width * 0.645}
              y={height * 0.38}
              width={width * 0.012}
              height={height * 0.10}
              rx="1"
              fill="url(#chrome)"
              opacity="0.7"
            />
            {/* Grille bars */}
            {[0.40, 0.42, 0.44, 0.46].map((yFrac) => (
              <line
                key={`grille-${yFrac}`}
                x1={width * 0.646}
                y1={height * yFrac}
                x2={width * 0.655}
                y2={height * yFrac}
                stroke="rgba(20,24,31,0.8)"
                strokeWidth="0.5"
              />
            ))}

            {/* Bumper */}
            <rect
              x={width * 0.645}
              y={height * 0.50}
              width={width * 0.015}
              height={height * 0.03}
              rx="1"
              fill="url(#chrome)"
              opacity="0.5"
            />

            {/* Headlights */}
            <motion.g
              animate={shouldAnimate ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.9 }}
              transition={shouldAnimate ? { duration: 2, repeat: Infinity } : {}}
            >
              {/* Upper headlight */}
              <rect
                x={width * 0.655}
                y={height * 0.37}
                width={width * 0.006}
                height={height * 0.02}
                rx="1"
                fill="#F5A623"
                opacity="0.9"
              />
              {/* Lower headlight */}
              <rect
                x={width * 0.655}
                y={height * 0.41}
                width={width * 0.006}
                height={height * 0.02}
                rx="1"
                fill="#F5A623"
                opacity="0.7"
              />
              {/* Headlight glow */}
              <circle
                cx={width * 0.66}
                cy={height * 0.39}
                r={height * 0.04}
                fill="#F5A623"
                opacity="0.04"
              />
            </motion.g>

            {/* Side mirror */}
            <rect
              x={width * 0.49}
              y={height * 0.34}
              width={width * 0.012}
              height={height * 0.04}
              rx="1"
              fill="#14181f"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.3"
            />

            {/* Fuel tank */}
            <rect
              x={width * 0.50}
              y={height * 0.46}
              width={width * 0.08}
              height={height * 0.06}
              rx="2"
              fill="#1a1e26"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
            />
            {/* Fuel tank chrome band */}
            <line
              x1={width * 0.50}
              y1={height * 0.49}
              x2={width * 0.58}
              y2={height * 0.49}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.5"
            />

            {/* Steps */}
            <rect
              x={width * 0.52}
              y={height * 0.52}
              width={width * 0.04}
              height={height * 0.02}
              rx="0.5"
              fill="rgba(255,255,255,0.04)"
            />

            {/* Exhaust stack */}
            <rect
              x={width * 0.505}
              y={height * 0.20}
              width={width * 0.008}
              height={height * 0.13}
              rx="1"
              fill="#1a1e26"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.3"
            />
            {/* Exhaust top */}
            <rect
              x={width * 0.503}
              y={height * 0.19}
              width={width * 0.012}
              height={height * 0.015}
              rx="1"
              fill="url(#chrome)"
              opacity="0.4"
            />
          </g>

          {/* ─── WHEELS ─── */}

          {/* Trailer tandem wheels */}
          {[0.26, 0.30, 0.42, 0.46].map((xFrac, i) => (
            <g key={`twheel-${i}`}>
              <circle cx={width * xFrac} cy={height * 0.56} r={height * 0.04} fill="url(#tire)" />
              <circle cx={width * xFrac} cy={height * 0.56} r={height * 0.028} fill="#1a1e26" />
              <circle cx={width * xFrac} cy={height * 0.56} r={height * 0.012} fill="url(#chrome)" opacity="0.3" />
              <circle cx={width * xFrac} cy={height * 0.56} r={height * 0.006} fill="#2a2f3a" />
              {/* Lug nuts */}
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <circle
                  key={`lug-${i}-${angle}`}
                  cx={width * xFrac + Math.cos(angle * Math.PI / 180) * height * 0.018}
                  cy={height * 0.56 + Math.sin(angle * Math.PI / 180) * height * 0.018}
                  r="0.6"
                  fill="rgba(255,255,255,0.1)"
                />
              ))}
            </g>
          ))}

          {/* Steer wheel */}
          <g>
            <circle cx={width * 0.58} cy={height * 0.56} r={height * 0.04} fill="url(#tire)" />
            <circle cx={width * 0.58} cy={height * 0.56} r={height * 0.028} fill="#1a1e26" />
            <circle cx={width * 0.58} cy={height * 0.56} r={height * 0.012} fill="url(#chrome)" opacity="0.35" />
            <circle cx={width * 0.58} cy={height * 0.56} r={height * 0.006} fill="#2a2f3a" />
          </g>

          {/* Mud flaps */}
          <rect
            x={width * 0.215}
            y={height * 0.53}
            width={width * 0.005}
            height={height * 0.04}
            fill="rgba(255,255,255,0.03)"
            rx="0.5"
          />

          {/* Blue accent lighting on tractor body */}
          <motion.rect
            x={width * 0.50}
            y={height * 0.42}
            width={width * 0.10}
            height={height * 0.003}
            fill="#4F8CFF"
            opacity="0.15"
            animate={shouldAnimate ? { opacity: [0.1, 0.2, 0.1] } : {}}
            transition={shouldAnimate ? { duration: 3, repeat: Infinity } : {}}
          />

          {/* Chrome trim line */}
          <line
            x1={width * 0.50}
            y1={height * 0.44}
            x2={width * 0.60}
            y2={height * 0.44}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        </motion.g>
      </svg>
    </div>
  );
}
