import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo, LogoIcon } from "@/components/brand/Logo";
import { TruckHero } from "@/components/brand/TruckHero";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Handshake,
  ListTodo,
  MessageSquare,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Wallet,
  Bell,
  MapPin,
  Clock,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" } as const,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

function SectionDivider() {
  return <div className="h-px bg-white/[0.04] mx-auto max-w-6xl" />;
}

function StepNumber({ n }: { n: string }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-electric/10 text-xs font-bold text-electric">
      {n}
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#080B0F] text-white">
      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080B0F]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size="sm" variant="full" className="[&_span]:!text-white [&_span]:font-bold" />
          <nav className="hidden items-center gap-6 text-sm text-white/40 md:flex">
            <a href="#operation" className="transition-colors hover:text-white/70">Platform</a>
            <a href="#fleet" className="transition-colors hover:text-white/70">Fleet</a>
            <a href="#load-flow" className="transition-colors hover:text-white/70">Workflow</a>
            <a href="#security" className="transition-colors hover:text-white/70">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/[0.06]">Sign in</Button>
            </Link>
            <Link to="/auth?returnTo=%2Fdashboard">
              <Button size="sm" className="gap-1.5 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20">
                Launch app <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════ 01 HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,140,255,0.06) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-32">
          <motion.div {...fadeUp} className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/50">
              <span className="size-1.5 rounded-full bg-[#22C55E]" />
              Private dispatch operations platform
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            className="mx-auto mt-8 max-w-3xl text-center text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Run your freight dispatch business
            <br />
            from <span className="text-electric">one command center</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            className="mx-auto mt-6 max-w-2xl text-center text-base leading-7 text-white/40 sm:text-lg"
          >
            Carriers, trucks, drivers, loads, brokers, documents, messages, invoices, and reports —
            connected through one secure database with role-based access and full audit logging.
          </motion.p>

          <motion.div {...fadeUp} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20 sm:w-auto">
                Start dispatching <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#operation" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-white/[0.08] text-white/50 hover:bg-white/[0.04] hover:text-white sm:w-auto">
                Explore features
              </Button>
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div {...fadeUp} className="mx-auto mt-10 flex max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/30">
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[#22C55E]/60" /> Multi-tenant security</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-[#22C55E]/60" /> Real records, no fake data</span>
            <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-electric/60" /> AI assists, humans approve</span>
          </motion.div>

          {/* Truck hero */}
          <motion.div {...fadeUp} className="mx-auto mt-14 max-w-2xl">
            <TruckHero width={700} height={200} status="moving" />
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 02 THE OPERATION ═══════════════ */}
      <section id="operation" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepNumber n="02" /> The Platform
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Everything a dispatch operation needs</h2>
            <p className="mt-3 text-white/40 leading-7">
              One connected system replacing spreadsheets, sticky notes, and voicemail trails.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, title: "Lead & CRM", text: "Track carrier leads from first contact to signed agreement, then convert them into active clients." },
              { icon: Building2, title: "Carrier clients", text: "Onboarding, agreements, fee configs, equipment preferences, and fleet management." },
              { icon: Truck, title: "Trucks & drivers", text: "Fleet and driver management with availability, locations, credentials, and lane preferences." },
              { icon: Package, title: "Load lifecycle", text: "Offer → book → dispatch → pickup → transit → delivery → POD → complete. Every step audited." },
              { icon: Sparkles, title: "Load matching", text: "A 0–100 operational match score for every truck against every load, with plain-language reasons." },
              { icon: MessageSquare, title: "Unified inbox", text: "Broker, carrier, driver, and internal conversations with AI classification and reply drafting." },
              { icon: FileText, title: "Documents & POD", text: "Rate confirmations, BOLs, PODs, insurance, and agreements in secure private storage." },
              { icon: Wallet, title: "Invoices & payments", text: "Dispatcher fees auto-calculated, invoiced on completion, and tracked to payment." },
              { icon: BarChart3, title: "Real reports", text: "Operations, financial, CRM, and dispatcher reports computed from your actual records." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.04]"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-electric/10 text-electric">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-white/35">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 03 LIVE FLEET ═══════════════ */}
      <section id="fleet" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
                <StepNumber n="03" /> Live Fleet
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Know where every truck is</h2>
              <p className="mt-3 text-white/40 leading-7">
                Real-time GPS tracking, availability status, and load assignments — all in one map view.
                Drivers share location from their phone. Fleet status updates instantly.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { icon: MapPin, label: "GPS Tracking", sub: "Real-time locations" },
                  { icon: Truck, label: "Fleet Status", sub: "Available · Booked · In Transit" },
                  { icon: Clock, label: "Live Updates", sub: "15-minute freshness" },
                  { icon: Route, label: "Route History", sub: "Location log per truck" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <item.icon className="size-4 text-electric" />
                    <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-white/35">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <TruckHero width={440} height={220} status="moving" showMarkers />
            </div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 04 LOAD FLOW ═══════════════ */}
      <section id="load-flow" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepNumber n="04" /> Load Flow
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From offer to paid, end to end</h2>
            <p className="mt-3 text-white/40">
              Every load follows a validated workflow. No step can be skipped. Every transition is recorded.
            </p>
          </motion.div>
          <div className="mt-12 relative">
            {/* Route line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-electric/30 via-electric/10 to-transparent hidden sm:block" />
            <div className="space-y-4">
              {[
                { step: "01", status: "OFFERED", text: "Load enters the system from broker, email, or manual entry.", icon: Package },
                { step: "02", status: "BOOKED", text: "Rate confirmed, carrier assigned, driver dispatched.", icon: CheckCircle2 },
                { step: "03", status: "PICKUP", text: "Driver arrives at origin, loads cargo, confirms BOL.", icon: MapPin },
                { step: "04", status: "IN TRANSIT", text: "Cargo is moving. GPS tracking active. Status visible to all parties.", icon: Route },
                { step: "05", status: "DELIVERY", text: "Arrived at destination. POD collected and uploaded.", icon: Truck },
                { step: "06", status: "COMPLETED", text: "Load finished. Dispatcher fee calculated. Invoice generated.", icon: Wallet },
              ].map((s, i) => (
                <motion.div key={s.step} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="relative flex items-start gap-4 sm:pl-12"
                >
                  <div className="hidden sm:flex shrink-0 size-8 items-center justify-center rounded-full border-2 border-electric/20 bg-[#080B0F] z-10">
                    <s.icon className="size-3.5 text-electric" />
                  </div>
                  <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-electric/40">{s.step}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-electric">{s.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/40">{s.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 05 DOCUMENTS + FINANCE ═══════════════ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepNumber n="05" /> Documents & Finance
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Financial precision, document control</h2>
            <p className="mt-3 text-white/40">
              Integer-precision financial records. Per-load document checklists. Secure storage.
              Nothing is estimated or rounded.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <motion.div {...fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <Wallet className="size-6 text-[#F5A623]" />
              <h3 className="mt-4 text-lg font-bold text-white">Dispatcher Revenue</h3>
              <p className="mt-2 text-sm text-white/35 leading-6">
                Fees calculated automatically from rate, equipment, and carrier agreement.
                Percentage or flat fee with min/max bounds. Every fee change recorded.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["Gross rate", "Dispatcher fee", "Carrier amount", "RPM"].map((m) => (
                  <div key={m} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/50">{m}</div>
                ))}
              </div>
            </motion.div>
            <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <FileText className="size-6 text-electric" />
              <h3 className="mt-4 text-lg font-bold text-white">Document Control</h3>
              <p className="mt-2 text-sm text-white/35 leading-6">
                Per-load checklists for rate confirmation, BOL, POD, and invoice.
                Insurance and credential expiry tracking. Version control on every upload.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["Rate Confirmation", "Bill of Lading", "Proof of Delivery", "Invoice"].map((d) => (
                  <div key={d} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/50">{d}</div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 06 AI DISPATCH INTELLIGENCE ═══════════════ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1 flex justify-center">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-electric/10">
                    <Sparkles className="size-4 text-electric" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">Dispatch Intelligence</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-electric/5 border border-electric/10 p-3 text-sm text-white/60">
                    Which trucks are available for a Chicago → Dallas load?
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-3 text-sm text-white/40">
                    3 trucks match: TX-421 (92 score, available in Dallas), IL-087 (88 score, available in Joliet), ...
                  </div>
                  <div className="rounded-lg bg-electric/5 border border-electric/10 p-3 text-sm text-white/60">
                    What loads need attention today?
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-3 text-sm text-white/40">
                    2 loads awaiting POD upload. 1 overdue invoice. 1 carrier insurance expiring in 5 days.
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
                <StepNumber n="06" /> Intelligence
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">AI that understands freight</h2>
              <p className="mt-3 text-white/40 leading-7">
                Ask operational questions in plain language. Get answers grounded in your actual data.
                AI drafts replies, suggests actions, and surfaces insights — but humans always approve.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-white/50">
                {[
                  "Which trucks are available for this lane?",
                  "What's the best RPM load this week?",
                  "Draft a reply to this broker",
                  "What needs my attention today?",
                ].map((q) => (
                  <li key={q} className="flex items-start gap-2.5">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-electric/50" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 07 SECURITY ═══════════════ */}
      <section id="security" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
                <StepNumber n="07" /> Security
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Your data is isolated, audited, and yours</h2>
              <p className="mt-3 text-white/40 leading-7">
                DispatchOS is built as a private dispatch service. Every organization gets
                strict tenant isolation, role-based access, and an append-only audit trail.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Multi-tenant data isolation on every query and mutation",
                  "Role-based access: admin, dispatcher, operations, carrier, driver, read-only",
                  "Financial integrity: integer cents, rate history, audited payment tracking",
                  "Secure document storage with type and size validation",
                  "AI is advisory only — high-impact actions always require human approval",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#22C55E]" />
                    <span className="text-white/50">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <motion.div {...fadeUp} className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, label: "Tenant Isolation", text: "Each organization's data is completely separated." },
                { icon: Users, label: "Role Control", text: "Seven roles with server-enforced permissions." },
                { icon: Bell, label: "Audit Trail", text: "Every action logged with actor, time, and context." },
                { icon: Lock, label: "Secure Access", text: "Email OTP authentication. No public signup." },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <c.icon className="size-5 text-electric" />
                  <h3 className="mt-3 text-sm font-semibold text-white">{c.label}</h3>
                  <p className="mt-1 text-sm text-white/35">{c.text}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 08 FINAL CTA ═══════════════ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-extrabold tracking-tight">Ready to run your dispatch like a business?</h2>
            <p className="mt-3 text-white/40">
              Sign in to your workspace. Your first carrier, truck, and load can be live in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20 sm:w-auto">
                  Open DispatchOS <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/30 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <LogoIcon size={20} />
            <span className="font-semibold text-white/60">DispatchOS</span>
          </div>
          <p className="text-xs text-white/20">Freight dispatch management for solo dispatchers and agencies.</p>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <span className="hover:text-white/40 cursor-pointer">Privacy</span>
            <span className="hover:text-white/40 cursor-pointer">Terms</span>
            <span className="hover:text-white/40 cursor-pointer">Help</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Icon component — only needed for the Security section */
function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
