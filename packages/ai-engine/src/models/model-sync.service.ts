import { Injectable, OnModuleInit } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import { ModelRegistryService } from "./model-registry.service";

/**
 * ModelSyncService - Periodically syncs models from OpenRouter + SiliconFlow to database.
 *
 * Features:
 * - Syncs every hour (configurable via SYNC_INTERVAL_MS)
 * - Manual sync via admin endpoint
 * - Graceful error handling
 * - Sync status tracking
 */
@Injectable()
export class ModelSyncService implements OnModuleInit {
  private logger = new Logger("ModelSyncService");
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncAt: Date | null = null;
  private isSyncing = false;
  private syncStatus: "idle" | "syncing" | "success" | "error" = "idle";

  // Default: 1 hour
  private readonly SYNC_INTERVAL_MS =
    parseInt(process.env.MODEL_SYNC_INTERVAL_MS || "3600000", 10) || 3600000;

  constructor(private modelRegistry: ModelRegistryService) {}

  onModuleInit() {
    // Start periodic sync if enabled
    if (process.env.ENABLE_MODEL_SYNC !== "false") {
      this.startPeriodicSync();
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(): void {
    if (this.syncInterval) {
      this.logger.warn("Periodic sync already running");
      return;
    }

    this.logger.info("Starting periodic model sync", {
      intervalMs: this.SYNC_INTERVAL_MS,
      intervalMinutes: Math.round(this.SYNC_INTERVAL_MS / 60000),
    });

    this.syncInterval = setInterval(() => {
      this.sync().catch((error) => {
        this.logger.error("Periodic sync failed", {
          error: (error as Error).message,
        });
      });
    }, this.SYNC_INTERVAL_MS);

    // Run initial sync after 5 seconds (don't block startup)
    setTimeout(() => {
      this.sync().catch((error) => {
        this.logger.error("Initial sync failed", {
          error: (error as Error).message,
        });
      });
    }, 5000);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info("Periodic model sync stopped");
    }
  }

  /**
   * Manual sync (triggered by admin)
   */
  async sync(): Promise<{
    success: boolean;
    total: number;
    created: number;
    updated: number;
    deactivated: number;
    duration: number;
    error?: string;
  }> {
    if (this.isSyncing) {
      this.logger.warn("Sync already in progress");
      return {
        success: false,
        total: 0,
        created: 0,
        updated: 0,
        deactivated: 0,
        duration: 0,
        error: "Sync already in progress",
      };
    }

    this.isSyncing = true;
    this.syncStatus = "syncing";
    const startTime = Date.now();

    try {
      this.logger.info("Starting model sync");

      const result = await this.modelRegistry.syncModels();

      const duration = Date.now() - startTime;
      this.lastSyncAt = new Date();
      this.syncStatus = "success";

      this.logger.info("Model sync completed", {
        ...result,
        duration,
      });

      return {
        success: true,
        ...result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.syncStatus = "error";
      const errorMessage = (error as Error).message;

      this.logger.error("Model sync failed", {
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        total: 0,
        created: 0,
        updated: 0,
        deactivated: 0,
        duration,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isSyncing: boolean;
    lastSyncAt: Date | null;
    syncStatus: string;
    nextSyncIn?: number;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      syncStatus: this.syncStatus,
    };
  }
}
