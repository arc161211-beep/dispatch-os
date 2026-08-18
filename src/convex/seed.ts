// Demo data for development. All records are flagged demo: true and the org
// settings are marked demoMode — the UI shows a "Demo data" banner. Never used
// as production data. Guarded: refuses to run when the org already has carriers
// unless force is passed.

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { requireWrite } from "./lib/context";

const DAY = 864e5;
const HOUR = 36e5;

export const seedDemoData = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const existingCarriers = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (existingCarriers.length > 0 && !args.force) {
      throw new Error("Demo data already exists in this workspace. Pass force to re-seed.");
    }

    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    if (settings) await ctx.db.patch(settings._id, { demoMode: true });
    const now = Date.now();

    // Carriers
    const c1 = await ctx.db.insert("carriers", {
      orgId: s.orgId as never,
      companyName: "Lone Star Logistics",
      legalName: "Lone Star Logistics LLC",
      contactName: "Marcus Webb",
      email: "marcus@lonestarlogistics.example",
      phone: "(512) 555-0142",
      mcNumber: "MC-883102",
      usdot: "USDOT 3118830",
      equipment: ["Dry Van", "Reefer"],
      fleetSize: 3,
      preferredLanes: ["Dallas", "Houston", "San Antonio", "Laredo"],
      avoidedLanes: ["New York"],
      feeType: "percentage",
      feeRatePercent: 7,
      status: "Active",
      agreementStatus: "Signed",
      insuranceExpiry: now + 120 * DAY,
      demo: true,
    });
    const c2 = await ctx.db.insert("carriers", {
      orgId: s.orgId as never,
      companyName: "Riverbend Transport",
      contactName: "Dana Price",
      phone: "(901) 555-0177",
      mcNumber: "MC-441209",
      usdot: "USDOT 2210345",
      equipment: ["Flatbed", "Step Deck"],
      fleetSize: 2,
      feeType: "percentage",
      feeRatePercent: 10,
      feeMinCents: 15000,
      status: "Active",
      agreementStatus: "Signed",
      demo: true,
    });
    const c3 = await ctx.db.insert("carriers", {
      orgId: s.orgId as never,
      companyName: "Cascade Freight Co.",
      contactName: "Tony Alvarez",
      phone: "(503) 555-0119",
      mcNumber: "MC-772651",
      usdot: "USDOT 1288841",
      equipment: ["Dry Van"],
      fleetSize: 1,
      feeType: "flat",
      flatFeeCents: 15000,
      status: "Onboarding",
      agreementStatus: "Sent",
      demo: true,
    });

    // Trucks
    const trucks = [
      { carrierId: c1, unit: "LS-101", type: "Dry Van", loc: "Dallas, TX" },
      { carrierId: c1, unit: "LS-102", type: "Dry Van", loc: "Houston, TX" },
      { carrierId: c1, unit: "LS-103", type: "Reefer", loc: "Fort Worth, TX" },
      { carrierId: c2, unit: "RB-201", type: "Flatbed", loc: "Memphis, TN" },
      { carrierId: c2, unit: "RB-202", type: "Step Deck", loc: "Nashville, TN" },
      { carrierId: c3, unit: "CF-301", type: "Dry Van", loc: "Portland, OR" },
    ];
    const truckIds: Record<string, Id<"trucks">> = {};
    const truckStatuses = ["Available", "Available", "In Transit", "Available", "Booked", "Available"];
    for (let i = 0; i < trucks.length; i++) {
      const t = trucks[i];
      truckIds[t.unit] = await ctx.db.insert("trucks", {
        orgId: s.orgId as never,
        carrierId: t.carrierId,
        unitNumber: t.unit,
        type: t.type,
        make: "Freightliner",
        model: "Cascadia",
        year: 2021,
        plate: `TX-${1000 + i}`,
        currentLocation: t.loc,
        availability: truckStatuses[i] as never,
        maxWeight: 45000,
        demo: true,
      });
    }

    // Drivers
    const drivers = [
      { carrierId: c1, name: "Jorge Ramos", phone: "(214) 555-0101", truck: "LS-101" },
      { carrierId: c1, name: "Tyler Brooks", phone: "(713) 555-0120", truck: "LS-102" },
      { carrierId: c1, name: "Andre Wilson", phone: "(817) 555-0133", truck: "LS-103" },
      { carrierId: c2, name: "Sam Callahan", phone: "(901) 555-0144", truck: "RB-201" },
      { carrierId: c2, name: "Nina Patel", phone: "(615) 555-0155", truck: "RB-202" },
      { carrierId: c3, name: "Ken Okafor", phone: "(503) 555-0166", truck: "CF-301" },
    ];
    const driverIds: Record<string, Id<"drivers">> = {};
    const driverStatuses = ["Available", "Driving", "In Transit", "Available", "At Pickup", "Available"];
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      driverIds[d.name] = await ctx.db.insert("drivers", {
        orgId: s.orgId as never,
        carrierId: d.carrierId,
        name: d.name,
        phone: d.phone,
        truckId: truckIds[d.truck] as never,
        currentLocation: i % 2 ? "On the road" : undefined,
        availability: driverStatuses[i] as never,
        licenseExpiry: now + 400 * DAY,
        medicalCardExpiry: now + 200 * DAY,
        demo: true,
      });
    }

    // Brokers
    const brokers = [
      { company: "Summit Freight Solutions", mc: "MC-991201", contact: "Rachel Kim", status: "Preferred" },
      { company: "Blue Ridge Logistics", mc: "MC-552390", contact: "Paul Dreher", status: "Active" },
      { company: "Harbor Bridge Carriers", mc: "MC-311774", contact: "Lisa Tran", status: "Active" },
      { company: "Northline Brokerage", mc: "MC-778120", contact: "Greg Hall", status: "Review" },
      { company: "Prairie State Freight", mc: "MC-402988", contact: "Amy Chen", status: "New" },
    ];
    const brokerIds: Record<string, Id<"brokers">> = {};
    for (const b of brokers) {
      brokerIds[b.company] = await ctx.db.insert("brokers", {
        orgId: s.orgId as never,
        company: b.company,
        mc: b.mc,
        contactName: b.contact,
        status: b.status as never,
        riskFlag: b.status === "Review" ? "Review" : "None",
        riskNotes: b.status === "Review" ? "Risk Flag — Requires Review: limited payment history on file." : undefined,
        demo: true,
      });
    }

    // Conversations for brokers + carriers
    const convIds: Record<string, Id<"conversations">> = {};
    for (const b of brokers) {
      convIds[b.company] = await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Broker: ${b.company}`,
        entityType: "broker",
        entityId: brokerIds[b.company],
        status: "active",
        demo: true,
      });
    }
    const carrierConvs: Record<string, Id<"conversations">> = {};
    for (const [name, id] of [
      ["Lone Star Logistics", c1],
      ["Riverbend Transport", c2],
    ] as const) {
      carrierConvs[name] = await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Carrier: ${name}`,
        entityType: "carrier",
        entityId: id,
        status: "active",
        demo: true,
      });
    }

    // Leads
    const leadData = [
      { company: "Ironhorse Freight", contact: "Chris Dalton", source: "Facebook", status: "Interested", city: "Oklahoma City", state: "OK" },
      { company: "Gulf Coast Carriers", contact: "Mia Rodriguez", source: "Referral", status: "Qualified", city: "Mobile", state: "AL" },
      { company: "Prairie Winds Express", contact: "Ben Carter", source: "Cold Call", status: "Contacted", city: "Wichita", state: "KS" },
      { company: "Summit Ridge Transport", contact: "Ella Nguyen", source: "LinkedIn", status: "Documents Requested", city: "Denver", state: "CO" },
      { company: "Badger State Freight", contact: "Owen Miller", source: "Website", status: "New", city: "Milwaukee", state: "WI" },
      { company: "Coastal Hauling Co.", contact: "Rosa Delgado", source: "Cold Email", status: "Agreement Sent", city: "Savannah", state: "GA" },
      { company: "Mesquite Express", contact: "Hank Doyle", source: "Referral", status: "Onboarding", city: "Amarillo", state: "TX" },
      { company: "Great Lakes Dispatch Group", contact: "Priya Shah", source: "WhatsApp", status: "Interested", city: "Cleveland", state: "OH" },
      { company: "Sunbelt Motor Freight", contact: "Lee Simmons", source: "Facebook", status: "Lost", city: "Phoenix", state: "AZ" },
      { company: "Northstar Trucking", contact: "Viktor Petrov", source: "Manual", status: "New", city: "Minneapolis", state: "MN" },
    ];
    for (const l of leadData) {
      await ctx.db.insert("leads", {
        orgId: s.orgId as never,
        companyName: l.company,
        contactName: l.contact,
        source: l.source as never,
        status: l.status as never,
        city: l.city,
        state: l.state,
        nextFollowUpAt: now + (l.status === "New" ? 2 * DAY : 5 * DAY),
        demo: true,
      });
    }

    // Loads across the lifecycle
    const loadSpecs = [
      { broker: "Summit Freight Solutions", carrier: c1, truck: "LS-101", driver: "Jorge Ramos", origin: "Dallas, TX", dest: "Houston, TX", pickup: now + 4 * HOUR, delivery: now + 28 * HOUR, miles: 240, rate: 1450, status: "Booked" },
      { broker: "Blue Ridge Logistics", carrier: c1, truck: "LS-102", driver: "Tyler Brooks", origin: "Houston, TX", dest: "San Antonio, TX", pickup: now + 26 * HOUR, delivery: now + 48 * HOUR, miles: 200, rate: 1250, status: "Awaiting Confirmation" },
      { broker: "Summit Freight Solutions", carrier: c1, truck: "LS-103", driver: "Andre Wilson", origin: "Fort Worth, TX", dest: "Laredo, TX", pickup: now - 6 * HOUR, delivery: now + 14 * HOUR, miles: 310, rate: 1680, status: "In Transit" },
      { broker: "Harbor Bridge Carriers", carrier: c2, truck: "RB-201", driver: "Sam Callahan", origin: "Memphis, TN", dest: "Little Rock, AR", pickup: now + 30 * HOUR, delivery: now + 50 * HOUR, miles: 140, rate: 950, status: "Negotiating" },
      { broker: "Harbor Bridge Carriers", carrier: c2, truck: "RB-202", driver: "Nina Patel", origin: "Nashville, TN", dest: "Birmingham, AL", pickup: now - 12 * HOUR, delivery: now + 6 * HOUR, miles: 190, rate: 1100, status: "At Delivery" },
      { broker: "Northline Brokerage", carrier: c1, truck: "LS-101", driver: "Jorge Ramos", origin: "Dallas, TX", dest: "Austin, TX", pickup: now + 4 * DAY, delivery: now + 5 * DAY, miles: 195, rate: 1050, status: "Offered" },
      { broker: "Prairie State Freight", carrier: c3, truck: "CF-301", driver: "Ken Okafor", origin: "Portland, OR", dest: "Seattle, WA", pickup: now + 2 * DAY, delivery: now + 3 * DAY, miles: 175, rate: 1150, status: "Under Review" },
      { broker: "Blue Ridge Logistics", carrier: c2, truck: "RB-201", driver: "Sam Callahan", origin: "Memphis, TN", dest: "Atlanta, GA", pickup: now + 6 * DAY, delivery: now + 7 * DAY, miles: 390, rate: 2100, status: "Draft" },
      { broker: "Summit Freight Solutions", carrier: c1, truck: "LS-102", driver: "Tyler Brooks", origin: "Houston, TX", dest: "El Paso, TX", pickup: now - 3 * DAY, delivery: now - 2 * DAY, miles: 745, rate: 3200, status: "Completed" },
      { broker: "Harbor Bridge Carriers", carrier: c1, truck: "LS-103", driver: "Andre Wilson", origin: "Dallas, TX", dest: "Kansas City, MO", pickup: now - 5 * DAY, delivery: now - 4 * DAY, miles: 500, rate: 2400, status: "Completed" },
      { broker: "Blue Ridge Logistics", carrier: c2, truck: "RB-202", driver: "Nina Patel", origin: "Nashville, TN", dest: "Charlotte, NC", pickup: now - 8 * DAY, delivery: now - 7 * DAY, miles: 420, rate: 2050, status: "Completed" },
      { broker: "Summit Freight Solutions", carrier: c1, truck: "LS-101", driver: "Jorge Ramos", origin: "Dallas, TX", dest: "Shreveport, LA", pickup: now - 10 * DAY, delivery: now - 9 * DAY, miles: 190, rate: 1000, status: "POD Pending" },
      { broker: "Northline Brokerage", carrier: c2, truck: "RB-201", driver: "Sam Callahan", origin: "Memphis, TN", dest: "St. Louis, MO", pickup: now + 1 * DAY, delivery: now + 2 * DAY, miles: 285, rate: 1350, status: "Driver Notified" },
      { broker: "Prairie State Freight", carrier: c3, truck: "CF-301", driver: "Ken Okafor", origin: "Seattle, WA", dest: "Spokane, WA", pickup: now + 8 * DAY, delivery: now + 9 * DAY, miles: 280, rate: 1300, status: "Draft" },
      { broker: "Harbor Bridge Carriers", carrier: c1, truck: "LS-103", driver: "Andre Wilson", origin: "Laredo, TX", dest: "Dallas, TX", pickup: now + 3 * DAY, delivery: now + 4 * DAY, miles: 430, rate: 1850, status: "TONU Requested" },
    ];

    let loadNum = (settings?.lastLoadNumber ?? 0);
    for (const spec of loadSpecs) {
      loadNum++;
      const carrier = await ctx.db.get(spec.carrier);
      const gross = spec.rate * 100;
      const fee = carrier?.feeType === "flat" ? (carrier.flatFeeCents ?? 0) : Math.round(gross * ((carrier?.feeRatePercent ?? 0) / 100));
      const loadId = await ctx.db.insert("loads", {
        orgId: s.orgId as never,
        loadNumber: `LD-${1000 + loadNum}`,
        brokerId: brokerIds[spec.broker] as never,
        carrierId: spec.carrier as never,
        truckId: truckIds[spec.truck] as never,
        driverId: driverIds[spec.driver] as never,
        equipment: "Dry Van",
        commodity: "General freight",
        weight: 42000,
        pieces: 2,
        origin: spec.origin,
        destination: spec.dest,
        pickupDate: spec.pickup,
        deliveryDate: spec.delivery,
        loadedMiles: spec.miles,
        deadheadMiles: Math.round(spec.miles * 0.1),
        grossRateCents: gross,
        fuelSurchargeCents: Math.round(gross * 0.08),
        feeType: carrier?.feeType ?? "percentage",
        feeRatePercent: carrier?.feeRatePercent,
        flatFeeCents: carrier?.flatFeeCents,
        feeCents: fee,
        carrierAmountCents: gross + Math.round(gross * 0.08) - fee,
        rpm: Math.round((gross / 100 / spec.miles) * 100) / 100,
        effectiveRpm: Math.round((gross / 100 / (spec.miles * 1.1)) * 100) / 100,
        priority: "Normal",
        status: spec.status as never,
        source: "manual",
        demo: true,
      });
      await ctx.db.insert("loadStatusHistory", {
        orgId: s.orgId as never,
        loadId,
        to: spec.status as never,
        actorId: s.userId as never,
        actorName: s.name,
        note: "Demo data",
        at: now,
      });
      if (spec.status === "Completed" || spec.status === "POD Pending") {
        const settingsRow = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
        const invN = (settingsRow?.lastInvoiceNumber ?? 0) + 1;
        if (settingsRow) await ctx.db.patch(settingsRow._id, { lastInvoiceNumber: invN });
        await ctx.db.insert("invoices", {
          orgId: s.orgId as never,
          invoiceNumber: `INV-${1000 + invN}`,
          carrierId: spec.carrier as never,
          loadId,
          status: spec.status === "Completed" ? "Sent" : "Draft",
          issueDate: now - 6 * DAY,
          dueDate: now + 8 * DAY,
          amountCents: fee,
          paidCents: 0,
          notes: `Dispatcher fee for LD-${1000 + loadNum}`,
          demo: true,
        });
      }
      if (truckIds[spec.truck] && spec.status !== "Completed" && spec.status !== "Draft") {
        await ctx.db.patch(truckIds[spec.truck], { currentLoadId: loadId as never });
      }
    }
    if (settings) await ctx.db.patch(settings._id, { lastLoadNumber: loadNum });

    // Messages
    const msgSpecs: { conv: string; dir: "in" | "out"; body: string; status: string; priority: string; cat?: string }[] = [
      { conv: "Summit Freight Solutions", dir: "in", body: "Load 88412 — Dallas, TX to Houston, TX, dry van, 42,000 lbs, pickup tomorrow 8am. Rate $1,450. Can you cover?", status: "needs_reply", priority: "high", cat: "Load Offer" },
      { conv: "Summit Freight Solutions", dir: "out", body: "We can cover that with LS-101. Sending rate confirmation now.", status: "read", priority: "normal" },
      { conv: "Summit Freight Solutions", dir: "in", body: "Confirmed — RC 88412 attached. Pickup window 8–10am tomorrow.", status: "read", priority: "normal", cat: "Rate Confirmation" },
      { conv: "Blue Ridge Logistics", dir: "in", body: "Checking on pickup for load 77503. Driver running late?", status: "needs_reply", priority: "urgent", cat: "Pickup Update" },
      { conv: "Harbor Bridge Carriers", dir: "in", body: "Delivery completed. POD attached — please confirm receipt.", status: "needs_reply", priority: "normal", cat: "POD Request" },
      { conv: "Northline Brokerage", dir: "in", body: "We have a reefer load Dallas → Austin, 40,000 lbs, $1,050. Interesado?", status: "unread", priority: "normal", cat: "Load Offer" },
      { conv: "Prairie State Freight", dir: "in", body: "Load 55210 got delayed at the shipper. New delivery window tomorrow 2pm.", status: "needs_reply", priority: "normal", cat: "Schedule Change" },
      { conv: "Lone Star Logistics", dir: "in", body: "Jorge needs the rate confirmation for next week's Dallas → Austin load.", status: "needs_reply", priority: "normal", cat: "Document Request" },
      { conv: "Riverbend Transport", dir: "in", body: "Detention at the Memphis shipper — 3 hours waiting. Filing detention claim.", status: "unread", priority: "high", cat: "Detention" },
      { conv: "Summit Freight Solutions", dir: "in", body: "TONU on load 90110 — appointment cancelled at origin. TONU requested at $150.", status: "needs_reply", priority: "high", cat: "TONU" },
    ];
    for (let i = 0; i < 10; i++) {
      const m = msgSpecs[i];
      await ctx.db.insert("messages", {
        orgId: s.orgId as never,
        conversationId: convIds[m.conv] ?? convIds["Summit Freight Solutions"],
        senderName: m.dir === "in" ? undefined : s.name,
        direction: m.dir,
        channel: m.dir === "in" ? "email" : "internal",
        body: m.body,
        status: m.status as never,
        priority: m.priority as never,
        aiCategory: m.cat as never,
        aiCategoryConfidence: m.cat ? 0.85 : undefined,
        demo: true,
      });
      const conv = await ctx.db.get(convIds[m.conv] ?? convIds["Summit Freight Solutions"]);
      if (conv) {
        await ctx.db.patch(conv._id, { lastMessageAt: now - i * HOUR, lastMessagePreview: m.body.slice(0, 120) });
      }
    }

    // Tasks
    const tasks = [
      { title: "Follow up on Summit load 88412 rate confirmation", type: "Rate Confirmation Check", priority: "High", due: now + 6 * HOUR },
      { title: "Request POD from driver for LD-1012", type: "POD Request", priority: "High", due: now + DAY },
      { title: "Call Blue Ridge about pickup delay", type: "Broker Follow-up", priority: "Urgent", due: now + 2 * HOUR },
      { title: "File detention claim with Riverbend", type: "Detention Follow-up", priority: "Normal", due: now + 2 * DAY },
      { title: "Cascade Freight onboarding — verify insurance docs", type: "Onboarding", priority: "High", due: now + 3 * DAY },
      { title: "Follow up Mesquite Express agreement", type: "Client Follow-up", priority: "Normal", due: now + DAY },
    ];
    for (const t of tasks) {
      await ctx.db.insert("tasks", {
        orgId: s.orgId as never,
        title: t.title,
        type: t.type as never,
        status: "Pending",
        priority: t.priority as never,
        dueAt: t.due,
        createdBy: s.userId as never,
        demo: true,
      });
    }

    // Demo document records (no actual file — flagged demo)
    const demoDocs = [
      { type: "Carrier Agreement" as const, entityType: "carrier", entityId: c1, fileName: "lone-star-agreement.pdf" },
      { type: "Insurance" as const, entityType: "carrier", entityId: c1, fileName: "lone-star-insurance.pdf" },
      { type: "W-9" as const, entityType: "carrier", entityId: c2, fileName: "riverbend-w9.pdf" },
    ];
    for (const d of demoDocs) {
      await ctx.db.insert("documents", {
        orgId: s.orgId as never,
        entityType: d.entityType,
        entityId: d.entityId,
        type: d.type,
        fileName: d.fileName,
        uploadedBy: s.userId as never,
        uploadedByName: s.name,
        demo: true,
      });
    }

    await audit(ctx, s, { action: "demo.seeded", entity: "organization", metadata: { counts: { carriers: 3, trucks: 6, drivers: 6, brokers: 5, loads: 15, leads: 10, invoices: 5, messages: 10, tasks: 6 } } });
    return { ok: true };
  },
});

export const clearDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    const tables = ["carriers", "trucks", "drivers", "brokers", "shippers", "leads", "loads", "conversations", "messages", "tasks", "invoices", "payments", "documents", "loadStatusHistory", "rateHistory", "carrierAgreements", "aiConversations", "aiMessages", "notifications"] as const;
    for (const table of tables) {
      const rows = (await (ctx.db.query(table) as any).collect()) as { _id: string; orgId?: string; demo?: boolean }[];
      for (const row of rows) {
        if (row.orgId === s.orgId && row.demo) await ctx.db.delete(row._id as never);
      }
    }
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    if (settings) await ctx.db.patch(settings._id, { demoMode: false, lastLoadNumber: 0, lastInvoiceNumber: 0 });
    await audit(ctx, s, { action: "demo.cleared", entity: "organization" });
    return { ok: true };
  },
});
