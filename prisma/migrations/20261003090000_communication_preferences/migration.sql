-- Phase 15.8: customer communication preferences and consent-control boundary
CREATE TYPE "CommunicationCategory" AS ENUM ('REQUIRED_TRANSACTIONAL','OPTIONAL_SERVICE','MARKETING_PROMOTIONAL');
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL');
CREATE TYPE "CommunicationPreferenceState" AS ENUM ('OPTED_IN','OPTED_OUT');
CREATE TYPE "CommunicationPreferenceSource" AS ENUM ('CUSTOMER_SETTINGS','UNSUBSCRIBE','ADMIN','SYSTEM');
CREATE TYPE "CommunicationPreferenceActorType" AS ENUM ('CUSTOMER','ADMIN','SYSTEM');
CREATE TYPE "CommunicationSuppressionReason" AS ENUM ('CUSTOMER_OPTED_OUT','CONSENT_NOT_PRESENT','CHANNEL_UNAVAILABLE','POLICY_RESTRICTION','CUSTOMER_DELETED');

ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'SUPPRESSED';

ALTER TABLE "NotificationEvent"
  ADD COLUMN "communicationCategory" "CommunicationCategory" NOT NULL DEFAULT 'REQUIRED_TRANSACTIONAL';

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "suppressionReason" "CommunicationSuppressionReason";

CREATE TABLE "CustomerCommunicationPreference" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "category" "CommunicationCategory" NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "state" "CommunicationPreferenceState" NOT NULL,
  "source" "CommunicationPreferenceSource" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerCommunicationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerCommunicationPreferenceAudit" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "category" "CommunicationCategory" NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "previousState" "CommunicationPreferenceState",
  "newState" "CommunicationPreferenceState" NOT NULL,
  "source" "CommunicationPreferenceSource" NOT NULL,
  "actorType" "CommunicationPreferenceActorType" NOT NULL,
  "correlationId" VARCHAR(128),
  "idempotencyKey" VARCHAR(255),
  "reason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCommunicationPreferenceAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationUnsubscribeToken" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "category" "CommunicationCategory" NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationUnsubscribeToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCommunicationPreference_customerId_category_channel_key"
  ON "CustomerCommunicationPreference" ("customerId","category","channel");
CREATE INDEX "CustomerCommunicationPreference_customerId_updatedAt_idx"
  ON "CustomerCommunicationPreference" ("customerId","updatedAt");
CREATE INDEX "CustomerCommunicationPreference_category_channel_state_idx"
  ON "CustomerCommunicationPreference" ("category","channel","state");

CREATE UNIQUE INDEX "CustomerCommunicationPreferenceAudit_idempotencyKey_key" ON "CustomerCommunicationPreferenceAudit" ("idempotencyKey");

CREATE INDEX "CustomerCommunicationPreferenceAudit_customerId_createdAt_idx"
  ON "CustomerCommunicationPreferenceAudit" ("customerId","createdAt");
CREATE INDEX "CustomerCommunicationPreferenceAudit_category_channel_createdAt_idx"
  ON "CustomerCommunicationPreferenceAudit" ("category","channel","createdAt");
CREATE INDEX "CustomerCommunicationPreferenceAudit_correlationId_createdAt_idx"
  ON "CustomerCommunicationPreferenceAudit" ("correlationId","createdAt");

CREATE UNIQUE INDEX "CommunicationUnsubscribeToken_tokenHash_key"
  ON "CommunicationUnsubscribeToken" ("tokenHash");
CREATE INDEX "CommunicationUnsubscribeToken_customerId_expiresAt_idx"
  ON "CommunicationUnsubscribeToken" ("customerId","expiresAt");
CREATE INDEX "CommunicationUnsubscribeToken_expiresAt_usedAt_idx"
  ON "CommunicationUnsubscribeToken" ("expiresAt","usedAt");

ALTER TABLE "CustomerCommunicationPreference"
  ADD CONSTRAINT "CustomerCommunicationPreference_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCommunicationPreferenceAudit"
  ADD CONSTRAINT "CustomerCommunicationPreferenceAudit_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationUnsubscribeToken"
  ADD CONSTRAINT "CommunicationUnsubscribeToken_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
