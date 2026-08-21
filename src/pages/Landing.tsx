import { motion } from "framer-motion";
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
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" } as const,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const features = [
  { icon: Users, title: "Lead & client CRM", text: "Track carrier leads from first contact to signed agreement, then convert them into active clients without re-entering data." },
  { icon: Truck, title: "Trucks & drivers", text: "Fleet and driver management with availability, locations, credential expiry, and lane preferences on every unit." },
  { icon: Package, title: "Load lifecycle", text: "Offer → negotiate → book → dispatch → pickup → transit → delivery → POD → complete. Every transition validated and audited." },
  { icon: Route, title: "RPM & fee math", text: "Backend-computed RPM, effective RPM with deadhead, and configurable dispatcher fees (percentage, flat, min/max). No spreadsheets." },
  { icon: Sparkles, title: "Load matching", text: "A 0–100 operational match score for every truck against every load, with plain-language reasons for each score." },
  { icon: MessageSquare, title: "Unified inbox", text: "Broker, carrier, driver, and internal conversations in one place — with AI classification and human-approved reply drafting." },
  { icon: FileText, title: "Documents & POD", text: "Rate confirmations, BOLs, PODs, insurance, W-9s and agreements in secure private storage with per-load checklists." },
  { icon: Wallet, title: "Invoices & payments", text: "Dispatcher invoices auto-generated on load completion, with payment tracking that never marks anything paid without a record." },
  { icon: BarChart3, title: "Real reports", text: "Operations, financial, CRM, and dispatcher reports computed from your actual records — nothing invented." },
  { icon: ListTodo, title: "Tasks & next actions", text: "Follow-ups, POD requests, and renewals with a 'next action' on every record so you always know what to do next." },
  { icon: CalendarDays, title: "Calendar", text: "Pickups, deliveries, follow-ups, document expirations, and invoice deadlines in one timezone-aware calendar." },
  { icon: ShieldCheck, title: "Security first", text: "Multi-tenant isolation, role-based access, audit logging, append-only financial history, and secure file storage." },
];

const workflow = [
  { step: "01", title: "Find the client", text: "Capture carrier leads from any source, qualify them, and onboard with documents and an agreement." },
  { step: "02", title: "Book the load", text: "Enter or import loads, run rate analysis, match available trucks, and negotiate with brokers." },
  { step: "03", title: "Run the trip", text: "Dispatch drivers, track pickup → delivery, and collect PODs against a per-load checklist." },
  { step: "04", title: "Get paid", text: "Dispatcher fees are calculated automatically, invoiced on completion, and tracked to payment." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0D0F]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size="sm" variant="full" className="[&_span]:!text-white [&_span]:font-bold" />
          <nav className="hidden items-center gap-6 text-sm text-white/40 md:flex">
            <a href="#features" className="transition-colors hover:text-white/70">Features</a>
            <a href="#workflow" className="transition-colors hover:text-white/70">Workflow</a>
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

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,140,255,0.08) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
          <motion.div {...fadeUp} className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/50">
              <span className="size-1.5 rounded-full bg-[#22C55E]" />
              Built for solo dispatchers and dispatch agencies
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            className="mx-auto mt-7 max-w-3xl text-center text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl"
          >
            Run your freight dispatch business
            <br />
            from <span className="text-electric">one command center</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            className="mx-auto mt-5 max-w-2xl text-center text-base leading-7 text-white/40 sm:text-lg"
          >
            DispatchOS manages the entire operational lifecycle — carrier clients, trucks, drivers,
            brokers, loads, rates, documents, communications, invoicing, and payments — so nothing
            falls through the cracks between the load board and the bank deposit.
          </motion.p>

          <motion.div {...fadeUp} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 bg-electric hover:bg-electric/90 text-white shadow-lg shadow-electric/20 sm:w-auto">
                Start dispatching <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-white/[0.1] text-white/60 hover:bg-white/[0.04] hover:text-white sm:w-auto">
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
          <motion.div {...fadeUp} className="mx-auto mt-12 max-w-2xl">
            <TruckHero width={700} height={200} status="moving" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Everything a dispatch operation needs</h2>
            <p className="mt-3 text-white/40">
              Leads, carriers, trucks, drivers, brokers, loads, rates, documents, messages, tasks,
              finance, reports — connected to one database with one permission system.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
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

      {/* ═══════════════ WORKFLOW ═══════════════ */}
      <section id="workflow" className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">From lead to paid, end to end</h2>
            <p className="mt-3 text-white/40">
              One continuous workflow — no more sticky notes, spreadsheets, and voicemail trails.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((w, i) => (
              <motion.div key={w.step} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }} className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <span className="text-3xl font-extrabold text-electric/20">{w.step}</span>
                <h3 className="mt-3 font-semibold text-white">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-white/35">{w.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECURITY ═══════════════ */}
      <section id="security" className="border-t border-white/[0.06] py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/50">
              <ShieldCheck className="size-3.5" /> Security-first architecture
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Your data is isolated, audited, and yours</h2>
            <p className="mt-3 leading-7 text-white/40">
              DispatchOS is built as a dispatch service — not a broker. Every organization gets
              strict tenant isolation, role-based access control, an append-only audit trail, and
              integer-precision financial records.
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
          </motion.div>
          <motion.div {...fadeUp} className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Building2, label: "Carrier clients", text: "Onboarding, agreements, fee configs, and fleet." },
              { icon: Handshake, label: "Brokers", text: "Contacts, lanes, and advisory risk flags." },
              { icon: UserRound, label: "Drivers", text: "Assignments, status, and credential expiry." },
              { icon: Wallet, label: "Finance", text: "Fees, invoices, payments, outstanding balances." },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <c.icon className="size-5 text-electric" />
                <h3 className="mt-3 text-sm font-semibold text-white">{c.label}</h3>
                <p className="mt-1 text-sm text-white/35">{c.text}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="border-t border-white/[0.06] py-20">
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
      <footer className="border-t border-white/[0.06] py-10">
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
