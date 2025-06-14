-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastWebhookError" TEXT,
ADD COLUMN     "lastWebhookErrorAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionName" TEXT,
ADD COLUMN     "syncMode" TEXT NOT NULL DEFAULT 'PUSH',
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "topicName" TEXT,
ADD COLUMN     "webhookFailureCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GmailWebhookEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "publishTime" TIMESTAMP(3) NOT NULL,
    "processingTime" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "GmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailWebhookEvent_messageId_key" ON "GmailWebhookEvent"("messageId");

-- CreateIndex
CREATE INDEX "GmailWebhookEvent_accountId_idx" ON "GmailWebhookEvent"("accountId");

-- CreateIndex
CREATE INDEX "GmailWebhookEvent_status_idx" ON "GmailWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "GmailWebhookEvent_createdAt_idx" ON "GmailWebhookEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "GmailWebhookEvent" ADD CONSTRAINT "GmailWebhookEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
