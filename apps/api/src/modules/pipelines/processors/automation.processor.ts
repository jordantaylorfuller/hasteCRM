import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { PipelineAutomationService } from "../pipeline-automation.service";

@Processor("automations")
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(private automationService: PipelineAutomationService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing automation job ${job.id}`);

    switch (job.name) {
      case "execute":
        return this.executeAutomation(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async executeAutomation(job: Job) {
    const { automationId, dealId, context } = job.data;

    try {
      await this.automationService.executeAutomation(
        automationId,
        dealId,
        context,
      );

      this.logger.log(
        `Successfully executed automation ${automationId} for deal ${dealId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute automation ${automationId} for deal ${dealId}`,
        error,
      );
      throw error; // Re-throw to trigger retry
    }
  }
}
