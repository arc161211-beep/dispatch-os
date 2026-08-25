import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Loader2, Mail, ShieldCheck, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense, useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Role } from "@/convex/constants";
import { resolveLoginDestination } from "@/lib/roles";
import heroTruckImg from "/assets/publichero.png";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const navigate = useNavigate();
  const provision = useMutation(api.users.provision);
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  /**
   * After authentication, wait for provisioning, then resolve the
   * fresh role from the database and redirect accordingly.
   *
   * Uses the role returned directly from the provision mutation
   * to avoid waiting for the reactive Convex query to update.
   */
  const handlePostAuthRedirect = useCallback(async () => {
    if (!isAuthenticated || redirecting) return;

    let resolvedRole: Role | undefined;

    // If user has no orgId yet, trigger provisioning and use returned role
    if (!user?.orgId) {
      try {
        const result = await provision();
        // provision() returns { role, driverId, ... } — use it immediately
        if (result?.role) {
          resolvedRole = result.role as Role;
        }
      } catch {
        // Provisioning failed — the AppInit component will show the error
        return;
      }
    }

    // Use the role from provisioning if available, otherwise from reactive user
    const effectiveRole = resolvedRole ?? (user?.role as Role | undefined);

    if (effectiveRole) {
      setRedirecting(true);
      const dest = resolveLoginDestination(effectiveRole, returnTo);
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, provision, returnTo, navigate, redirecting]);

  // Primary effect: redirect when authenticated and role is available
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      handlePostAuthRedirect();
    }
  }, [authLoading, isAuthenticated, handlePostAuthRedirect]);

  // Safety net: if role is still not available after provisioning,
  // poll the reactive user object for up to 5 seconds.
  // This handles the rare case where the Convex reactive query
   // hasn't updated yet after provisioning completed.
  useEffect(() => {
    if (redirecting || !isAuthenticated || authLoading) return;
    if (user?.role) return; // already have the role
    const timer = setTimeout(() => {
      handlePostAuthRedirect();
    }, 500);
    return () => clearTimeout(timer);
  }, [user, isAuthenticated, authLoading, redirecting, handlePostAuthRedirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch {
      setError("Unable to send your verification code. Please try again or contact your administrator.");
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
    } catch {
      setError("The verification code you entered is incorrect. Please try again.");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#080B0F] overflow-hidden">
      {/* Full-screen cinematic truck background */}
      <div className="absolute inset-0">
        <img
          src={heroTruckImg}
          alt=""
          className="h-full w-full object-cover object-center"
          style={{ filter: "brightness(0.3) blur(2px)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080B0F] via-[#080B0F]/80 to-[#080B0F]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080B0F]/90 via-transparent to-[#080B0F]/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-16">
        {/* Brand panel — desktop only */}
        <div className="hidden flex-col justify-center lg:flex">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size="lg" variant="full" className="[&_span]:text-white [&_span]:font-extrabold [&_span]:text-xl" />
          </Link>
          <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-white">
            Your dispatch operation,
            <br />
            <span className="text-electric">in one place.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-white/50">
            Sign in to manage carriers, trucks, drivers, loads, brokers, documents, and invoices —
            with secure, audited, tenant-isolated records.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Email verification codes — no stored passwords",
              "Private platform — admin-invited accounts only",
              "Role-based access and full audit trail",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-white/40">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-electric/60" />
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
            className="w-full rounded-2xl border border-white/[0.06] bg-[#111821]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
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
