import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo, LogoIcon } from "@/components/brand/Logo";
import heroTruckImg from "/hero-truck.png";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  MessageSquare,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
  MapPin,
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

function StepBadge({ n }: { n: string }) {
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
                Launch DispatchOS <ArrowRight className="size-3.5" />
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
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,140,255,0.06) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-32">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Left: text */}
            <div>
              <motion.div {...fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/50">
                  <span className="size-1.5 rounded-full bg-[#22C55E]" />
                  Private dispatch operations platform
                </span>
              </motion.div>

              <motion.h1
                {...fadeUp}
                className="mt-7 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-5xl"
              >
                Your dispatch operation,
                <br />
                <span className="text-electric">in one place.</span>
              </motion.h1>

              <motion.p
                {...fadeUp}
                className="mt-5 max-w-lg text-base leading-7 text-white/40"
              >
                Manage carriers, trucks, drivers, loads, documents, communication and
                dispatch operations from one secure command center.
              </motion.p>

              <motion.div {...fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/auth?returnTo=%2Fdashboard">
                  <Button size="lg" className="gap-2 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20">
                    Launch DispatchOS <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a href="#operation">
                  <Button size="lg" variant="outline" className="border-white/[0.08] text-white/50 hover:bg-white/[0.04] hover:text-white">
                    See how it works
                  </Button>
                </a>
              </motion.div>

              <motion.div {...fadeUp} className="mt-8 flex items-center gap-5 text-xs text-white/30">
                <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[#22C55E]/60" /> Multi-tenant security</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-[#22C55E]/60" /> Real records</span>
                <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-electric/60" /> AI assists</span>
              </motion.div>
            </div>

            {/* Right: large realistic truck hero */}
            <motion.div {...fadeUp} className="flex justify-end">
              <div className="relative w-full">
                {/* Cinematic road environment with raster truck */}
                <div className="relative">
                  <img
                    src={heroTruckImg}
                    alt="DispatchOS — premium semi-truck on dark highway"
                    className="w-full h-auto rounded-2xl object-cover"
                    style={{ maxHeight: 520, filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.5))" }}
                    loading="eager"
                  />
                  {/* Route overlay line */}
                  <div className="absolute bottom-[18%] left-[8%] right-[8%] h-px" style={{ background: "linear-gradient(90deg, #4F8CFF, transparent 20%, transparent 80%, #F5A623)" }} />
                </div>
                {/* Floating badges */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                  className="absolute -left-2 top-6 rounded-lg border border-electric/20 bg-[#111821]/90 px-3 py-1.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-electric">
                    <span className="size-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    In Transit
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2, duration: 0.5 }}
                  className="absolute -right-2 bottom-16 rounded-lg border border-[#F5A623]/20 bg-[#111821]/90 px-3 py-1.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F5A623]">
                    Load #1042
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 02 THE OPERATION ═══════════════ */}
      <section id="operation" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepBadge n="02" /> The Platform
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From carrier to delivery — one system</h2>
            <p className="mt-3 text-white/40 leading-7">
              Every part of your dispatch operation connected through one database, one permission system, one interface.
            </p>
          </motion.div>

          {/* Visual journey: Carrier → Truck → Load → Driver → Delivery */}
          <div className="mt-14">
            <div className="relative hidden sm:flex items-center justify-between">
              {/* Route line */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute left-[10%] right-[10%] top-1/2 h-px origin-left"
                style={{ background: "linear-gradient(90deg, #4F8CFF, #F5A623)" }}
              />
              {[
                { icon: Building2, label: "Carrier", desc: "Client onboarded" },
                { icon: Truck, label: "Truck", desc: "Fleet assigned" },
                { icon: Package, label: "Load", desc: "Freight booked" },
                { icon: Users, label: "Driver", desc: "Driver dispatched" },
                { icon: MapPin, label: "Delivery", desc: "POD collected" },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  {...fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-full border-2 border-electric/20 bg-[#080B0F]">
                    <step.icon className="size-5 text-electric" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{step.label}</p>
                  <p className="text-xs text-white/35">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Feature grid */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, title: "Lead & CRM", text: "Track carrier leads from first contact to signed agreement, then convert into active clients." },
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

      {/* ═══════════════ 03 FLEET ═══════════════ */}
      <section id="fleet" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepBadge n="03" /> Fleet
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Know where every truck is</h2>
            <p className="mt-3 text-white/40">
              Real-time GPS tracking, availability status, and load assignments — all in one view.
            </p>
          </motion.div>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
            {/* Fleet status nodes */}
            <motion.div {...fadeUp} className="flex justify-center">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { status: "AVAILABLE", color: "#22C55E", count: "—" },
                  { status: "BOOKED", color: "#4F8CFF", count: "—" },
                  { status: "IN TRANSIT", color: "#8B5CF6", count: "—" },
                  { status: "DELIVERED", color: "#F5A623", count: "—" },
                ].map((s, i) => (
                  <motion.div
                    key={s.status}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center"
                  >
                    <div className="mx-auto size-3 rounded-full" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}40` }} />
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.status}</p>
                    <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">{s.count}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp}>
              <img src={heroTruckImg} alt="DispatchOS fleet tracking" className="w-full h-auto max-h-[200px] rounded-xl object-cover" style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.4))" }} loading="lazy" />
              <p className="mt-4 text-sm text-white/40 leading-6">
                Drivers share GPS from their phone. Fleet status updates instantly.
                Click any truck to see location history, current load, and next action.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════ 04 LOAD FLOW ═══════════════ */}
      <section id="load-flow" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
              <StepBadge n="04" /> Load Flow
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From offer to paid, end to end</h2>
            <p className="mt-3 text-white/40">
              Every load follows a validated workflow. No step can be skipped. Every transition is recorded.
            </p>
          </motion.div>
          <div className="mt-12 relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-electric/30 via-electric/10 to-transparent hidden sm:block" />
            <div className="space-y-3">
              {[
                { step: "01", status: "OFFERED", text: "Load enters the system from broker, email, or manual entry.", icon: Package },
                { step: "02", status: "REVIEW", text: "Rate analysis, broker evaluation, and operational assessment.", icon: FileText },
                { step: "03", status: "BOOKED", text: "Rate confirmed, carrier assigned, driver dispatched.", icon: CheckCircle2 },
                { step: "04", status: "PICKUP", text: "Driver arrives at origin, loads cargo, confirms BOL.", icon: MapPin },
                { step: "05", status: "TRANSIT", text: "Cargo is moving. GPS tracking active. Status visible to all parties.", icon: Route },
                { step: "06", status: "DELIVERY", text: "Arrived at destination. POD collected and uploaded.", icon: Truck },
                { step: "07", status: "COMPLETED", text: "Load finished. Dispatcher fee calculated. Invoice generated.", icon: Wallet },
              ].map((s, i) => (
                <motion.div key={s.step} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.05 }}
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
              <StepBadge n="05" /> Documents & Finance
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Financial precision, document control</h2>
            <p className="mt-3 text-white/40">
              Integer-precision financial records. Per-load document checklists. Secure storage.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <motion.div {...fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <Wallet className="size-6 text-[#F5A623]" />
              <h3 className="mt-4 text-lg font-bold text-white">Dispatcher Revenue</h3>
              <p className="mt-2 text-sm text-white/35 leading-6">
                Fees calculated automatically from rate, equipment, and carrier agreement.
                Percentage or flat fee with min/max bounds.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["Gross Booked", "Dispatcher Revenue", "Outstanding", "Paid"].map((m) => (
                  <div key={m} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/50">{m}</div>
                ))}
              </div>
            </motion.div>
            <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <FileText className="size-6 text-electric" />
              <h3 className="mt-4 text-lg font-bold text-white">Document Control</h3>
              <p className="mt-2 text-sm text-white/35 leading-6">
                Per-load checklists for rate confirmation, BOL, POD, and invoice.
                Insurance and credential expiry tracking.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["Rate Confirmation", "Bill of Lading", "Proof of Delivery", "Invoice"].map((d) => (
                  <div key={d} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/50">{d}</div>
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
                    3 trucks match: TX-421 (92 score, available in Dallas), IL-087 (88 score, available in Joliet)…
                  </div>
                  <div className="rounded-lg bg-electric/5 border border-electric/10 p-3 text-sm text-white/60">
                    What loads need attention today?
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-3 text-sm text-white/40">
                    2 loads awaiting POD upload. 1 overdue invoice. 1 carrier insurance expiring.
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-electric/60">
                <StepBadge n="06" /> Intelligence
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">AI that understands freight</h2>
              <p className="mt-3 text-white/40 leading-7">
                Ask operational questions in plain language. Get answers grounded in your actual data.
                AI drafts replies and suggests actions — humans always approve.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-white/50">
                {[
                  "Which trucks are available for this lane?",
                  "Which load has the best RPM?",
                  "What needs my attention today?",
                  "Draft a reply to this broker",
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
                <StepBadge n="07" /> Security
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Your data is isolated, audited, and yours</h2>
              <p className="mt-3 text-white/40 leading-7">
                Every organization gets strict tenant isolation, role-based access, and an append-only audit trail.
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
                { icon: ShieldCheck, label: "Private Access", text: "No public signup. Admin-invited accounts only." },
                { icon: Users, label: "Role Control", text: "Seven roles with server-enforced permissions." },
                { icon: Route, label: "Tenant Isolation", text: "Each organization's data is completely separated." },
                { icon: FileText, label: "Audited Activity", text: "Every action logged with actor, time, and context." },
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
            <div className="mx-auto mb-8 max-w-2xl">
              <img
                src={heroTruckImg}
                alt="DispatchOS — truck at destination"
                className="w-full h-auto rounded-xl object-cover"
                style={{ maxHeight: 220, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.4))" }}
                loading="lazy"
              />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">Control the road ahead.</h2>
            <p className="mt-3 text-white/40">
              Sign in to your workspace. Your first carrier, truck, and load can be live in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20 sm:w-auto">
                  Launch DispatchOS <ArrowRight className="size-4" />
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
