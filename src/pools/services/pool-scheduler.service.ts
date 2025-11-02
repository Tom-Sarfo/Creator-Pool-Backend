import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { PoolLifecycleService } from "./pool-lifecycle.service";

@Injectable()
export class PoolSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PoolSchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PoolLifecycleService)
    private readonly poolLifecycleService: PoolLifecycleService
  ) {}

  onModuleInit() {
    this.logger.log("Starting pool lifecycle scheduler...");

    // Delay initialization slightly to ensure all dependencies are fully injected
    setTimeout(() => {
      // Verify service is injected
      if (!this.poolLifecycleService) {
        this.logger.error("PoolLifecycleService is not injected!");
        return;
      }

      // Call immediately on startup to handle any pending transitions
      this.poolLifecycleService.updatePoolStatuses().catch((error) => {
        this.logger.error("Error during initial pool status update:", error);
      });

      // Then schedule to run every 30 seconds
      this.intervalId = setInterval(() => {
        if (this.poolLifecycleService) {
          this.poolLifecycleService.updatePoolStatuses().catch((error) => {
            this.logger.error(
              "Error during scheduled pool status update:",
              error
            );
          });
        }
      }, 30000); // 30 seconds

      this.logger.log(
        "Pool lifecycle scheduler started (running every 30 seconds)"
      );
    }, 1000); // Delay by 1 second to ensure DI is complete
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log("Pool lifecycle scheduler stopped");
    }
  }
}
