CREATE TYPE "AnalyticsConsentState" AS ENUM ('OPTED_OUT', 'OPTED_IN');
CREATE TYPE "AnalyticsConsentSource" AS ENUM ('CUSTOMER_SETTINGS', 'SYSTEM');
CREATE TYPE "AnalyticsEventSource" AS ENUM ('CLIENT', 'SERVER');

CREATE TABLE "CustomerAnalyticsConsent" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "state" "AnalyticsConsentState" NOT NULL DEFAULT 'OPTED_OUT',
  "source" "AnalyticsConsentSource" NOT NULL DEFAULT 'SYSTEM',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAnalyticsConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAnalyticsConsent_customerId_key" ON "CustomerAnalyticsConsent"("customerId");

CREATE TABLE "AnalyticsEvent" (
  "id" UUID NOT NULL,
  "eventId" VARCHAR(64) NOT NULL,
  "eventName" VARCHAR(64) NOT NULL,
  "eventVersion" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "anonymousId" VARCHAR(64),
  "sessionId" VARCHAR(64),
  "customerId" UUID,
  "locale" VARCHAR(16),
  "context" JSONB,
  "properties" JSONB NOT NULL,
  "source" "AnalyticsEventSource" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsEvent_eventId_key" ON "AnalyticsEvent"("eventId");
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");
CREATE INDEX "AnalyticsEvent_expiresAt_idx" ON "AnalyticsEvent"("expiresAt");
CREATE INDEX "AnalyticsEvent_customerId_occurredAt_idx" ON "AnalyticsEvent"("customerId", "occurredAt");
CREATE INDEX "AnalyticsEvent_eventName_occurredAt_idx" ON "AnalyticsEvent"("eventName", "occurredAt");

ALTER TABLE "CustomerAnalyticsConsent"
  ADD CONSTRAINT "CustomerAnalyticsConsent_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
