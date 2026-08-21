import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/Logo";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/** Subtle animated route lines in the background */
function BackgroundRoutes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Horizontal road lines */}
      {[25, 50, 75].map((y) => (
        <motion.div
          key={y}
          className="absolute left-0 h-px w-full"
          style={{
            top: `${y}%`,
            background: "linear-gradient(90deg, transparent 0%, rgba(79,140,255,0.06) 30%, rgba(79,140,255,0.1) 50%, rgba(79,140,255,0.06) 70%, transparent 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: y * 0.01 }}
        />
      ))}
      {/* Vertical subtle grid lines */}
      {[20, 40, 60, 80].map((x) => (
        <div
          key={x}
          className="absolute top-0 h-full w-px"
          style={{
            left: `${x}%`,
            background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)",
          }}
        />
      ))}
      {/* Moving dots */}
      {[15, 35, 55, 75, 90].map((y, i) => (
        <motion.div
          key={`dot-${y}`}
          className="absolute size-1 rounded-full bg-electric/20"
          style={{ top: `${y}%`, left: "-2%" }}
          animate={{ x: ["0%", "6000%"] }}
          transition={{ duration: 20 + i * 5, repeat: Infinity, ease: "linear", delay: i * 3 }}
        />
      ))}
    </div>
  );
}

/** Animated truck silhouette */
function AuthTruckVisual() {
  return (
    <div className="relative h-48 w-full">
      <svg viewBox="0 0 400 160" fill="none" className="w-full h-full opacity-40">
        {/* Road */}
        <line x1="20" y1="100" x2="380" y2="100" stroke="rgba(79,140,255,0.15)" strokeWidth="1" />
        <line x1="20" y1="100" x2="380" y2="100" stroke="rgba(79,140,255,0.05)" strokeWidth="1" strokeDasharray="6 4" />

        {/* Route glow */}
        <motion.line
          x1="30" y1="100" x2="370" y2="100"
          stroke="url(#auth-glow)" strokeWidth="1.5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
        />

        {/* Origin */}
        <circle cx="50" cy="100" r="4" fill="rgba(79,140,255,0.3)" />
        <motion.circle cx="50" cy="100" r="2" fill="rgba(79,140,255,0.6)"
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }} />

        {/* Destination */}
        <circle cx="350" cy="100" r="4" fill="rgba(245,166,35,0.3)" />
        <motion.circle cx="350" cy="100" r="2" fill="rgba(245,166,35,0.5)"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />

        {/* Truck */}
        <motion.g initial={{ x: 0 }} animate={{ x: [0, 260, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}>
          <rect x="100" y="78" width="36" height="16" rx="2" fill="rgba(79,140,255,0.6)" />
          <path d="M136 80h8c1.5 0 2.5 1 2.5 2.5v8c0 .5-.4 1-1 1h-9.5V80z" fill="rgba(79,140,255,0.5)" />
          <rect x="138" y="81.5" width="5" height="3.5" rx="0.5" fill="rgba(79,140,255,0.3)" />
          <circle cx="112" cy="96" r="3.5" fill="rgba(11,13,15,0.8)" />
          <circle cx="112" cy="96" r="1.5" fill="rgba(255,255,255,0.1)" />
          <circle cx="125" cy="96" r="3.5" fill="rgba(11,13,15,0.8)" />
          <circle cx="125" cy="96" r="1.5" fill="rgba(255,255,255,0.1)" />
          <circle cx="143" cy="96" r="3.5" fill="rgba(11,13,15,0.8)" />
          <circle cx="143" cy="96" r="1.5" fill="rgba(255,255,255,0.1)" />
          <motion.circle cx="146.5" cy="83" r="1" fill="#F5A623"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }} />
        </motion.g>

        <defs>
          <linearGradient id="auth-glow" x1="30" y1="100" x2="370" y2="100">
            <stop stopColor="#4F8CFF" stopOpacity="0.3" />
            <stop offset="1" stopColor="#F5A623" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send verification code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch {
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0B0D0F] overflow-hidden">
      <BackgroundRoutes />

      <div className="relative z-10 grid w-full max-w-4xl gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-14">
        {/* Brand panel — desktop only */}
        <div className="hidden flex-col justify-center lg:flex">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size="lg" variant="full" className="[&_span]:text-white [&_span]:font-extrabold [&_span]:text-xl" />
          </Link>
          <h1 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight text-white">
            Your dispatch operation,
            <br />
            <span className="text-electric">in one place.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
            Sign in to manage carriers, trucks, drivers, loads, brokers, documents, and invoices —
            with secure, audited, tenant-isolated records.
          </p>

          <AuthTruckVisual />

          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              "Email verification codes — no stored passwords",
              "Private platform — admin-invited accounts only",
              "Role-based access and full audit trail",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-white/40">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-electric/60" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Auth card */}
        <div className="mx-auto flex w-full max-w-sm items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" as const }}
            className="w-full rounded-2xl border border-white/[0.06] bg-[#11161F]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            {/* Mobile logo */}
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <Logo size="sm" variant="icon" />
              <span className="text-sm font-bold text-white">DispatchOS</span>
            </div>

            {step === "signIn" ? (
              <>
                <h2 className="text-xl font-bold text-white">Sign in</h2>
                <p className="mt-1 text-sm text-white/40">Enter your email to receive a verification code</p>

                <form onSubmit={handleEmailSubmit} className="mt-6">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 size-4 text-white/30" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="h-11 border-white/[0.08] bg-white/[0.04] pl-9 text-white placeholder:text-white/25 focus:border-electric/40 focus:ring-electric/20"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isLoading}
                      className="h-11 w-11 shrink-0 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20"
                    >
                      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-2.5 text-xs text-red-400">{error}</p>
                  )}
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Check your email</h2>
                <p className="mt-1 text-sm text-white/40">We sent a 6-digit code to <span className="text-white/70">{step.email}</span></p>

                <form onSubmit={handleOtpSubmit} className="mt-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          (e.target as HTMLElement).closest("form")?.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} className="h-12 w-10 border-white/[0.08] bg-white/[0.04] text-white" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
                  <p className="mt-4 text-center text-sm text-white/40">
                    Didn't receive a code?{" "}
                    <button type="button" className="text-electric hover:underline" onClick={() => setStep("signIn")}>
                      Try again
                    </button>
                  </p>

                  <Button
                    type="submit"
                    className="mt-5 h-11 w-full bg-electric hover:bg-electric/90 text-white font-semibold shadow-lg shadow-electric/20"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 size-4 animate-spin" /> Verifying…</>
                    ) : (
                      <>Verify Code <ArrowRight className="ml-2 size-4" /></>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 w-full text-white/40 hover:text-white/60"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                  >
                    Use a different email
                  </Button>
                </form>
              </>
            )}

            <div className="mt-6 border-t border-white/[0.06] pt-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/25">
                <Lock className="size-3" />
                Private platform — access requires administrator invitation
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
