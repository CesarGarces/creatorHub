import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@creator-hub/shared-utils";

@Processor("credits")
export class CreditProcessor extends WorkerHost {
  private logger = new Logger("CreditProcessor");

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "credit-depleted": {
        const { userId, balance } = job.data;
        this.logger.warn(`Credit depleted for user ${userId}`, { balance });
        // Send notification, alert admin, etc.
        break;
      }
      case "credit-expiring": {
        this.logger.info("Processing credit expiration", job.data);
        break;
      }
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }
}
