import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck, UserX } from "lucide-react";
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

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (e) {
      setError(`Failed to sign in as guest: ${e instanceof Error ? e.message : "Unknown error"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Brand panel */}
          <div className="hidden flex-col justify-center lg:flex">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">D</div>
              <span className="text-xl font-semibold tracking-tight">DispatchOS</span>
            </Link>
            <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
              Your dispatch operation, in one place.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Sign in to manage carriers, trucks, drivers, loads, brokers, documents, and invoices —
              with secure, audited, tenant-isolated records.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {["Email verification codes — no stored passwords", "Workspace created automatically for new sign-ups", "Role-based access and full audit trail"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Auth card */}
          <div className="mx-auto w-full max-w-sm">
            <Card className="border shadow-sm">
              {step === "signIn" ? (
                <>
                  <CardHeader>
                    <div className="mb-1 flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate("/")} aria-label="Back to landing">
                        <ArrowLeft className="size-4" />
                      </Button>
                      <span className="text-sm font-medium lg:hidden">DispatchOS</span>
                    </div>
                    <CardTitle className="text-xl">Get started</CardTitle>
                    <CardDescription>Enter your email to log in or sign up</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleEmailSubmit}>
                    <CardContent>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                          <Input
                            name="email"
                            placeholder="name@example.com"
                            type="email"
                            className="pl-9"
                            disabled={isLoading}
                            required
                          />
                        </div>
                        <Button type="submit" variant="outline" size="icon" disabled={isLoading}>
                          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                        </Button>
                      </div>
                      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                      <div className="mt-4">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or</span>
                          </div>
                        </div>
                        <Button type="button" variant="outline" className="mt-4 w-full" onClick={handleGuestLogin} disabled={isLoading}>
                          <UserX className="mr-2 size-4" />
                          Continue as guest
                        </Button>
                      </div>
                    </CardContent>
                  </form>
                </>
              ) : (
                <>
                  <CardHeader className="mt-2">
                    <CardTitle>Check your email</CardTitle>
                    <CardDescription>We sent a 6-digit code to {step.email}</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleOtpSubmit}>
                    <CardContent className="pb-4">
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
                              <InputOTPSlot key={index} index={index} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        Didn't receive a code?{" "}
                        <Button variant="link" className="h-auto p-0" onClick={() => setStep("signIn")}>
                          Try again
                        </Button>
                      </p>
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                      <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" /> Verifying…
                          </>
                        ) : (
                          <>
                            Verify code <ArrowRight className="ml-2 size-4" />
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("signIn")} disabled={isLoading}>
                        Use a different email
                      </Button>
                    </CardFooter>
                  </form>
                </>
              )}
              <div className="border-t bg-muted/40 px-6 py-3 text-center text-xs text-muted-foreground">
                By continuing you agree to the{" "}
                <a href="#" className="underline hover:text-foreground">Privacy Policy</a> and{" "}
                <a href="#" className="underline hover:text-foreground">Terms of Service</a>.
              </div>
            </Card>
          </div>
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
