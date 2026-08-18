import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
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
  viewport: { once: true, margin: "-80px" },
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">D</div>
            <span className="text-lg font-semibold tracking-tight">DispatchOS</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth?returnTo=%2Fdashboard">
              <Button size="sm" className="gap-1.5">
                Launch app <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Built for solo dispatchers and small dispatch agencies
            </span>
          </motion.div>
          <motion.h1
            {...fadeUp}
            className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
          >
            Run your freight dispatch business from{" "}
            <span className="text-primary">one command center</span>
          </motion.h1>
          <motion.p
            {...fadeUp}
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
          >
            DispatchOS manages the entire operational lifecycle — carrier clients, trucks, drivers,
            brokers, loads, rates, documents, communications, invoicing, and payments — so nothing
            falls through the cracks between the load board and the bank deposit.
          </motion.p>
          <motion.div {...fadeUp} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Start dispatching <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Explore features
              </Button>
            </a>
          </motion.div>
          <motion.div {...fadeUp} className="mx-auto mt-10 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-500" /> Multi-tenant security</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> No fake data — real records</span>
            <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-emerald-500" /> AI assists, humans approve</span>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Everything a dispatch operation needs</h2>
            <p className="mt-3 text-muted-foreground">
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
                className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">From lead to paid, end to end</h2>
            <p className="mt-3 text-muted-foreground">
              One continuous workflow — no more sticky notes, spreadsheets, and voicemail trails.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((w, i) => (
              <motion.div key={w.step} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }} className="relative rounded-xl border bg-card p-5">
                <span className="text-3xl font-semibold text-primary/25">{w.step}</span>
                <h3 className="mt-3 font-medium">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{w.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security / compliance */}
      <section id="security" className="border-t bg-muted/30 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Security-first architecture
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Your data is isolated, audited, and yours</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              DispatchOS is built as a dispatch service — not a broker. Every organization gets
              strict tenant isolation, role-based access control, an append-only audit trail, and
              integer-precision financial records. Rate changes and load status transitions are
              never silently overwritten; they are history.
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
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span className="text-muted-foreground">{item}</span>
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
              <div key={c.label} className="rounded-xl border bg-card p-5">
                <c.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-medium">{c.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-semibold tracking-tight">Ready to run your dispatch like a business?</h2>
            <p className="mt-3 text-muted-foreground">
              Sign in to your workspace. Your first carrier, truck, and load can be live in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth?returnTo=%2Fdashboard" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Open DispatchOS <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">D</div>
            <span className="font-medium text-foreground">DispatchOS</span>
          </div>
          <p className="text-xs">Freight dispatch management for solo dispatchers and agencies.</p>
          <div className="flex items-center gap-4 text-xs">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
