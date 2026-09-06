import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  AI_CATEGORIES,
  BROKER_STATUSES,
  CARRIER_STATUSES,
  DOCUMENT_TYPES,
  DRIVER_STATUSES,
  FEE_TYPES,
  INVOICE_STATUSES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOAD_SOURCES,
  LOAD_STATUSES,
  MESSAGE_PRIORITIES,
  MESSAGE_STATUSES,
  ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TRUCK_STATUSES,
} from "./constants";

const orgId = v.id("organizations");
const userId = v.id("users");

const schema = defineSchema(
  {
    // Default Convex Auth tables — do not remove.
    ...authTables,

    // users table from authTables, extended with DispatchOS profile fields.
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(v.union(...ROLES.map((r) => v.literal(r)))),
      orgId: v.optional(orgId),
      carrierId: v.optional(v.id("carriers")),
      driverId: v.optional(v.id("drivers")),
      phone: v.optional(v.string()),
      title: v.optional(v.string()),
      disabled: v.optional(v.boolean()),
      accountStatus: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("revoked"), v.literal("invited"))),
      lastLoginAt: v.optional(v.number()),
    }).index("email", ["email"])
      .index("by_org", ["orgId"]),

    organizations: defineTable({
      name: v.string(),
      contactEmail: v.optional(v.string()),
      phone: v.optional(v.string()),
      website: v.optional(v.string()),
      logo: v.optional(v.string()),
      demoMode: v.optional(v.boolean()),
    }),

    settings: defineTable({
      orgId,
      timezone: v.string(),
      currency: v.string(),
      businessHours: v.optional(v.string()),
      quietHoursEnabled: v.optional(v.boolean()),
      quietHoursStart: v.optional(v.string()),
      quietHoursEnd: v.optional(v.string()),
      feeDefaults: v.object({
        feeType: v.union(...FEE_TYPES.map((f) => v.literal(f))),
        feeRatePercent: v.optional(v.number()),
        feeMinCents: v.optional(v.number()),
        feeMaxCents: v.optional(v.number()),
        flatFeeCents: v.optional(v.number()),
      }),
      notificationPrefs: v.object({
        urgentOnlyDuringQuiet: v.optional(v.boolean()),
        emailDailyDigest: v.optional(v.boolean()),
        smsUrgent: v.optional(v.boolean()),
        push: v.optional(v.boolean()),
      }),
      lastLoadNumber: v.optional(v.number()),
      lastInvoiceNumber: v.optional(v.number()),
      demoMode: v.optional(v.boolean()),
      carrierFinancialVisibility: v.optional(v.union(v.literal("full"), v.literal("rate_only"), v.literal("fee_visible"), v.literal("none"))),
      dataRetention: v.optional(v.object({
        locationHistoryDays: v.optional(v.number()),
        messageRetentionDays: v.optional(v.number()),
        auditLogRetentionDays: v.optional(v.number()),
      })),
    }).index("by_org", ["orgId"]),

    pendingUsers: defineTable({
      email: v.string(),
      orgId,
      role: v.union(...ROLES.map((r) => v.literal(r))),
      invitedBy: userId,
      carrierId: v.optional(v.id("carriers")),
      driverId: v.optional(v.id("drivers")),
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
      createdAt: v.number(),
      expiresAt: v.number(),
    }).index("by_email", ["email"]).index("by_org", ["orgId"]),

    leads: defineTable({
      orgId,
      companyName: v.string(),
      contactName: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
      state: v.optional(v.string()),
      city: v.optional(v.string()),
      fleetSize: v.optional(v.number()),
      equipment: v.optional(v.array(v.string())),
      mc: v.optional(v.string()),
      usdot: v.optional(v.string()),
      source: v.optional(v.union(...LEAD_SOURCES.map((s) => v.literal(s)))),
      status: v.union(...LEAD_STATUSES.map((s) => v.literal(s))),
      assignedTo: v.optional(userId),
      lastContactedAt: v.optional(v.number()),
      nextFollowUpAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      convertedToCarrierId: v.optional(v.id("carriers")),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_company", ["orgId", "companyName"]),

    carriers: defineTable({
      orgId,
      companyName: v.string(),
      legalName: v.optional(v.string()),
      dba: v.optional(v.string()),
      contactName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      mcNumber: v.optional(v.string()),
      usdot: v.optional(v.string()),
      equipment: v.optional(v.array(v.string())),
      fleetSize: v.optional(v.number()),
      preferredLanes: v.optional(v.array(v.string())),
      avoidedLanes: v.optional(v.array(v.string())),
      homeTime: v.optional(v.string()),
      feeType: v.union(...FEE_TYPES.map((f) => v.literal(f))),
      feeRatePercent: v.optional(v.number()),
      feeMinCents: v.optional(v.number()),
      feeMaxCents: v.optional(v.number()),
      flatFeeCents: v.optional(v.number()),
      insuranceExpiry: v.optional(v.number()),
      status: v.union(...CARRIER_STATUSES.map((s) => v.literal(s))),
      agreementStatus: v.optional(v.union(v.literal("None"), v.literal("Draft"), v.literal("Sent"), v.literal("Signed"), v.literal("Expired"))),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_company", ["orgId", "companyName"]),

    carrierAgreements: defineTable({
      orgId,
      carrierId: v.id("carriers"),
      status: v.union(v.literal("Draft"), v.literal("Sent"), v.literal("Signed"), v.literal("Expired")),
      agreementText: v.optional(v.string()),
      signedAt: v.optional(v.number()),
      signedByName: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_carrier", ["carrierId"]),

    trucks: defineTable({
      orgId,
      carrierId: v.id("carriers"),
      unitNumber: v.string(),
      vin: v.optional(v.string()),
      type: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      plate: v.optional(v.string()),
      plateState: v.optional(v.string()),
      trailer: v.optional(v.string()),
      currentLocation: v.optional(v.string()),
      lat: v.optional(v.number()),
      lon: v.optional(v.number()),
      availability: v.union(...TRUCK_STATUSES.map((s) => v.literal(s))),
      currentLoadId: v.optional(v.id("loads")),
      preferredLanes: v.optional(v.array(v.string())),
      avoidedLanes: v.optional(v.array(v.string())),
      maxWeight: v.optional(v.number()),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
      // Live GPS tracking fields
      trackingActive: v.optional(v.boolean()),
      lastLocationUpdateAt: v.optional(v.number()),
      speed: v.optional(v.number()),
      heading: v.optional(v.number()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "availability"])
      .index("by_org_carrier", ["orgId", "carrierId"]),

    drivers: defineTable({
      orgId,
      carrierId: v.id("carriers"),
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      truckId: v.optional(v.id("trucks")),
      homeLocation: v.optional(v.string()),
      currentLocation: v.optional(v.string()),
      lat: v.optional(v.number()),
      lon: v.optional(v.number()),
      availability: v.union(...DRIVER_STATUSES.map((s) => v.literal(s))),
      licenseExpiry: v.optional(v.number()),
      medicalCardExpiry: v.optional(v.number()),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "availability"])
      .index("by_org_carrier", ["orgId", "carrierId"]),

    brokers: defineTable({
      orgId,
      company: v.string(),
      mc: v.optional(v.string()),
      contactName: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
      address: v.optional(v.string()),
      status: v.union(...BROKER_STATUSES.map((s) => v.literal(s))),
      riskFlag: v.optional(v.union(v.literal("None"), v.literal("Review"), v.literal("Blocked"))),
      riskNotes: v.optional(v.string()),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_company", ["orgId", "company"]),

    shippers: defineTable({
      orgId,
      company: v.string(),
      location: v.optional(v.string()),
      address: v.optional(v.string()),
      contactName: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_company", ["orgId", "company"]),

    loads: defineTable({
      orgId,
      loadNumber: v.string(),
      externalId: v.optional(v.string()),
      brokerId: v.optional(v.id("brokers")),
      shipperId: v.optional(v.id("shippers")),
      carrierId: v.optional(v.id("carriers")),
      truckId: v.optional(v.id("trucks")),
      driverId: v.optional(v.id("drivers")),
      equipment: v.optional(v.string()),
      commodity: v.optional(v.string()),
      weight: v.optional(v.number()),
      pieces: v.optional(v.number()),
      origin: v.optional(v.string()),
      originAddress: v.optional(v.string()),
      pickupDate: v.optional(v.number()),
      pickupTime: v.optional(v.string()),
      pickupRef: v.optional(v.string()),
      destination: v.optional(v.string()),
      destAddress: v.optional(v.string()),
      deliveryDate: v.optional(v.number()),
      deliveryTime: v.optional(v.string()),
      deliveryRef: v.optional(v.string()),
      loadedMiles: v.optional(v.number()),
      deadheadMiles: v.optional(v.number()),
      grossRateCents: v.optional(v.number()),
      fuelSurchargeCents: v.optional(v.number()),
      accessorialsCents: v.optional(v.number()),
      accessorialsNote: v.optional(v.string()),
      feeType: v.optional(v.union(...FEE_TYPES.map((f) => v.literal(f)))),
      feeRatePercent: v.optional(v.number()),
      feeMinCents: v.optional(v.number()),
      feeMaxCents: v.optional(v.number()),
      flatFeeCents: v.optional(v.number()),
      feeCents: v.optional(v.number()),
      carrierAmountCents: v.optional(v.number()),
      rpm: v.optional(v.number()),
      effectiveRpm: v.optional(v.number()),
      priority: v.optional(v.union(v.literal("Low"), v.literal("Normal"), v.literal("High"), v.literal("Urgent"))),
      status: v.union(...LOAD_STATUSES.map((s) => v.literal(s))),
      source: v.optional(v.union(...LOAD_SOURCES.map((s) => v.literal(s)))),
      sourceExternalId: v.optional(v.string()),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
      originLat: v.optional(v.number()),
      originLng: v.optional(v.number()),
      originFormatted: v.optional(v.string()),
      destinationLat: v.optional(v.number()),
      destinationLng: v.optional(v.number()),
      destinationFormatted: v.optional(v.string()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_pickup", ["orgId", "pickupDate"])
      .index("by_org_delivery", ["orgId", "deliveryDate"])
      .index("by_org_carrier", ["orgId", "carrierId"])
      .index("by_org_truck", ["orgId", "truckId"])
      .index("by_org_driver", ["orgId", "driverId"])
      .index("by_org_number", ["orgId", "loadNumber"]),

    loadStatusHistory: defineTable({
      orgId,
      loadId: v.id("loads"),
      from: v.optional(v.string()),
      to: v.string(),
      actorId: v.optional(userId),
      actorName: v.optional(v.string()),
      note: v.optional(v.string()),
      at: v.number(),
    })
      .index("by_load", ["loadId"])
      .index("by_org", ["orgId"]),

    rateHistory: defineTable({
      orgId,
      loadId: v.id("loads"),
      field: v.string(),
      previousCents: v.optional(v.number()),
      newCents: v.optional(v.number()),
      actorId: v.optional(userId),
      actorName: v.optional(v.string()),
      reason: v.optional(v.string()),
      at: v.number(),
    })
      .index("by_load", ["loadId"])
      .index("by_org", ["orgId"]),

    documents: defineTable({
      orgId,
      entityType: v.optional(v.string()),
      entityId: v.optional(v.string()),
      type: v.union(...DOCUMENT_TYPES.map((t) => v.literal(t))),
      fileName: v.string(),
      storageId: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      size: v.optional(v.number()),
      uploadedBy: userId,
      uploadedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      version: v.optional(v.number()),
      previousVersionId: v.optional(v.id("documents")),
      expiresAt: v.optional(v.number()),
      status: v.optional(v.union(v.literal("active"), v.literal("expiring"), v.literal("expired"), v.literal("superseded"))),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_entity", ["orgId", "entityType", "entityId"])
      .index("by_org_type", ["orgId", "type"])
      .index("by_org_expires", ["orgId", "expiresAt"]),

    conversations: defineTable({
      orgId,
      title: v.string(),
      entityType: v.union(v.literal("broker"), v.literal("carrier"), v.literal("driver"), v.literal("lead"), v.literal("internal"), v.literal("system")),
      entityId: v.optional(v.string()),
      lastMessageAt: v.optional(v.number()),
      lastMessagePreview: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("archived")),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_entity", ["orgId", "entityType", "entityId"])
      .index("by_org_recent", ["orgId", "lastMessageAt"]),

    messages: defineTable({
      orgId,
      conversationId: v.id("conversations"),
      senderId: v.optional(userId),
      senderName: v.optional(v.string()),
      direction: v.union(v.literal("in"), v.literal("out")),
      channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"), v.literal("internal"), v.literal("phone")),
      subject: v.optional(v.string()),
      body: v.string(),
      status: v.union(...MESSAGE_STATUSES.map((s) => v.literal(s))),
      priority: v.optional(v.union(...MESSAGE_PRIORITIES.map((p) => v.literal(p)))),
      aiCategory: v.optional(v.union(...AI_CATEGORIES.map((c) => v.literal(c)))),
      aiCategoryConfidence: v.optional(v.number()),
      aiExtraction: v.optional(v.object({
        origin: v.optional(v.string()),
        destination: v.optional(v.string()),
        rateCents: v.optional(v.number()),
        equipment: v.optional(v.string()),
        weight: v.optional(v.number()),
        pickup: v.optional(v.number()),
        delivery: v.optional(v.number()),
        reference: v.optional(v.string()),
        broker: v.optional(v.string()),
      })),
      needsReview: v.optional(v.boolean()),
      draftReply: v.optional(v.string()),
      messageRef: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_conversation", ["conversationId"])
      .index("by_org_status", ["orgId", "status"]),

    tasks: defineTable({
      orgId,
      title: v.string(),
      description: v.optional(v.string()),
      type: v.union(...TASK_TYPES.map((t) => v.literal(t))),
      entityType: v.optional(v.string()),
      entityId: v.optional(v.string()),
      status: v.union(...TASK_STATUSES.map((s) => v.literal(s))),
      priority: v.optional(v.union(...TASK_PRIORITIES.map((p) => v.literal(p)))),
      dueAt: v.optional(v.number()),
      assignedTo: v.optional(userId),
      createdBy: v.optional(userId),
      completedAt: v.optional(v.number()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_due", ["orgId", "dueAt"]),

    notifications: defineTable({
      orgId,
      userId,
      title: v.string(),
      body: v.optional(v.string()),
      link: v.optional(v.string()),
      type: v.optional(v.string()),
      readAt: v.optional(v.number()),
    })
      .index("by_org_user", ["orgId", "userId"])
      .index("by_org_user_unread", ["orgId", "userId", "readAt"]),

    invoices: defineTable({
      orgId,
      invoiceNumber: v.string(),
      carrierId: v.optional(v.id("carriers")),
      loadId: v.optional(v.id("loads")),
      status: v.union(...INVOICE_STATUSES.map((s) => v.literal(s))),
      issueDate: v.number(),
      dueDate: v.optional(v.number()),
      amountCents: v.number(),
      paidCents: v.number(),
      notes: v.optional(v.string()),
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_carrier", ["orgId", "carrierId"])
      .index("by_org_number", ["orgId", "invoiceNumber"]),

    payments: defineTable({
      orgId,
      invoiceId: v.id("invoices"),
      amountCents: v.number(),
      method: v.optional(v.string()),
      reference: v.optional(v.string()),
      receivedAt: v.number(),
      recordedBy: userId,
      demo: v.optional(v.boolean()),
    })
      .index("by_org", ["orgId"])
      .index("by_invoice", ["invoiceId"]),

    auditLogs: defineTable({
      orgId,
      actorId: v.optional(userId),
      actorName: v.optional(v.string()),
      action: v.string(),
      entity: v.string(),
      entityId: v.optional(v.string()),
      metadata: v.optional(v.any()),
      at: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_at", ["orgId", "at"]),

    aiConversations: defineTable({
      orgId,
      userId,
      title: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_org_user", ["orgId", "userId"])
      .index("by_org_user_recent", ["orgId", "userId", "createdAt"]),

    aiMessages: defineTable({
      orgId,
      conversationId: v.id("aiConversations"),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        args: v.optional(v.any()),
        summary: v.optional(v.string()),
      }))),
      suggestedAction: v.optional(v.any()),
      suggestedStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
      approvedBy: v.optional(userId),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_conversation", ["conversationId"]),

    integrations: defineTable({
      orgId,
      provider: v.string(),
      name: v.string(),
      status: v.union(v.literal("not_configured"), v.literal("configured"), v.literal("error")),
      config: v.optional(v.any()),
      updatedAt: v.optional(v.number()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_provider", ["orgId", "provider"]),

    importJobs: defineTable({
      orgId,
      entityType: v.string(),
      fileName: v.optional(v.string()),
      totalRows: v.number(),
      inserted: v.number(),
      errors: v.optional(v.array(v.object({ row: v.number(), error: v.string() }))),
      status: v.union(v.literal("success"), v.literal("partial"), v.literal("failed")),
      importedBy: userId,
      at: v.number(),
    })
      .index("by_org", ["orgId"]),

    webhooks: defineTable({
      orgId,
      provider: v.string(),
      eventType: v.optional(v.string()),
      externalId: v.optional(v.string()),
      payloadMeta: v.optional(v.any()),
      status: v.union(v.literal("received"), v.literal("processed"), v.literal("failed"), v.literal("unverified")),
      retryCount: v.optional(v.number()),
      error: v.optional(v.string()),
      receivedAt: v.number(),
      processedAt: v.optional(v.number()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_provider", ["orgId", "provider"]),

    locationHistory: defineTable({
      orgId,
      entityType: v.union(v.literal("truck"), v.literal("driver")),
      entityId: v.string(),
      lat: v.number(),
      lon: v.number(),
      location: v.optional(v.string()),
      source: v.optional(v.union(v.literal("driver_mobile"), v.literal("browser_geolocation"), v.literal("gps_telematics"), v.literal("manual"), v.literal("other"))),
      accuracy: v.optional(v.number()),
      speed: v.optional(v.number()),
      heading: v.optional(v.number()),
      at: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_entity", ["orgId", "entityType", "entityId"])
      .index("by_org_entity_at", ["orgId", "entityType", "entityId", "at"]),

    trackingTokens: defineTable({
      orgId,
      loadId: v.id("loads"),
      truckId: v.optional(v.id("trucks")),
      token: v.string(),
      active: v.boolean(),
      createdBy: userId,
      createdAt: v.number(),
      revokedAt: v.optional(v.number()),
    })
      .index("by_org", ["orgId"])
      .index("by_org_load", ["orgId", "loadId"])
      .index("by_token", ["token"]),

    userNotificationPrefs: defineTable({
      orgId,
      userId,
      prefs: v.object({
        urgent: v.optional(v.boolean()),
        loads: v.optional(v.boolean()),
        documents: v.optional(v.boolean()),
        messages: v.optional(v.boolean()),
        tasks: v.optional(v.boolean()),
        finance: v.optional(v.boolean()),
        location: v.optional(v.boolean()),
      }),
      updatedAt: v.number(),
    })
      .index("by_org_user", ["orgId", "userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
