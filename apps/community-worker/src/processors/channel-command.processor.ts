import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { prisma } from "@creator-hub/database";
import type { CommunityChannelCommand } from "@creator-hub/shared-types";
import { ChannelManagerService } from "../channel-manager.service";

/**
 * Executes channel lifecycle commands issued by the API (connect /
 * disconnect). Keeping these in a queue — instead of calling the worker
 * over HTTP — preserves the platform's event-driven convention and gives
 * free retries when a channel handshake fails transiently.
 */
@Processor("community-channel-commands")
export class ChannelCommandProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelCommandProcessor.name);

  constructor(
    @Inject(ChannelManagerService)
    private readonly channelManager: ChannelManagerService,
  ) {
    super();
  }

  async process(job: Job<CommunityChannelCommand>): Promise<void> {
    const command = job.data;

    switch (command.action) {
      case "CONNECT": {
        // WhatsApp requires the user to scan a QR code — this can take
        // 10-60 s. We fire-and-forget so the BullMQ job completes
        // immediately; status updates flow back through Redis pub/sub.
        const connectPromise = this.channelManager.connectChannel(
          command.channelId,
        );
        if (command.channelType === "WHATSAPP") {
          connectPromise.catch((error: Error) => {
            this.logger.error(
              `WhatsApp connect failed for ${command.channelId}: ${error.message}`,
            );
          });
        } else {
          await connectPromise;
        }
        break;
      }

      case "DISCONNECT": {
        await this.channelManager.disconnectChannel(command.channelId);
        await prisma.communityChannel.update({
          where: { id: command.channelId },
          data: { status: "DISCONNECTED", lastError: null },
        });
        this.logger.log(`Channel ${command.channelId} disconnected by command`);
        break;
      }

      case "REFRESH_STATUS":
        // No-op placeholder for future status polling; the API reads
        // channel state from the DB directly.
        break;
    }
  }
}
