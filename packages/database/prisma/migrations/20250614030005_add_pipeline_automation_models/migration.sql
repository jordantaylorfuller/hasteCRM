-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('STAGE_ENTER', 'STAGE_EXIT', 'DEAL_CREATED', 'DEAL_WON', 'DEAL_LOST', 'DEAL_STALLED', 'VALUE_CHANGED', 'PROBABILITY_CHANGED', 'OWNER_CHANGED', 'TAG_ADDED', 'TAG_REMOVED', 'CUSTOM_FIELD_CHANGED');

-- CreateEnum
CREATE TYPE "AutomationAction" AS ENUM ('SEND_EMAIL', 'CREATE_TASK', 'UPDATE_FIELD', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_OWNER', 'SEND_WEBHOOK', 'CREATE_ACTIVITY', 'MOVE_STAGE', 'UPDATE_PROBABILITY');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "daysInStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalDaysOpen" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DealStageTransition" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStageId" TEXT NOT NULL,
    "toStageId" TEXT NOT NULL,
    "transitionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeInStage" INTEGER NOT NULL,
    "transitionedById" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DealStageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineAutomation" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "triggerStageId" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" "AutomationAction"[],
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delay" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PipelineAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineMetrics" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dealsCreated" INTEGER NOT NULL DEFAULT 0,
    "dealsWon" INTEGER NOT NULL DEFAULT 0,
    "dealsLost" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "wonValue" DECIMAL(15,2) NOT NULL,
    "lostValue" DECIMAL(15,2) NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDealSize" DECIMAL(15,2) NOT NULL,
    "avgCycleLength" INTEGER NOT NULL DEFAULT 0,
    "stageMetrics" JSONB NOT NULL DEFAULT '[]',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealStageTransition_dealId_idx" ON "DealStageTransition"("dealId");

-- CreateIndex
CREATE INDEX "DealStageTransition_fromStageId_idx" ON "DealStageTransition"("fromStageId");

-- CreateIndex
CREATE INDEX "DealStageTransition_toStageId_idx" ON "DealStageTransition"("toStageId");

-- CreateIndex
CREATE INDEX "DealStageTransition_transitionTime_idx" ON "DealStageTransition"("transitionTime");

-- CreateIndex
CREATE INDEX "PipelineAutomation_pipelineId_idx" ON "PipelineAutomation"("pipelineId");

-- CreateIndex
CREATE INDEX "PipelineAutomation_trigger_idx" ON "PipelineAutomation"("trigger");

-- CreateIndex
CREATE INDEX "PipelineAutomation_isActive_idx" ON "PipelineAutomation"("isActive");

-- CreateIndex
CREATE INDEX "AutomationLog_automationId_idx" ON "AutomationLog"("automationId");

-- CreateIndex
CREATE INDEX "AutomationLog_dealId_idx" ON "AutomationLog"("dealId");

-- CreateIndex
CREATE INDEX "AutomationLog_status_idx" ON "AutomationLog"("status");

-- CreateIndex
CREATE INDEX "AutomationLog_triggeredAt_idx" ON "AutomationLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "PipelineMetrics_pipelineId_idx" ON "PipelineMetrics"("pipelineId");

-- CreateIndex
CREATE INDEX "PipelineMetrics_period_idx" ON "PipelineMetrics"("period");

-- CreateIndex
CREATE INDEX "PipelineMetrics_date_idx" ON "PipelineMetrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineMetrics_pipelineId_period_date_key" ON "PipelineMetrics"("pipelineId", "period", "date");

-- AddForeignKey
ALTER TABLE "DealStageTransition" ADD CONSTRAINT "DealStageTransition_transitionedById_fkey" FOREIGN KEY ("transitionedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageTransition" ADD CONSTRAINT "DealStageTransition_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageTransition" ADD CONSTRAINT "DealStageTransition_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageTransition" ADD CONSTRAINT "DealStageTransition_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineAutomation" ADD CONSTRAINT "PipelineAutomation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "PipelineAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
