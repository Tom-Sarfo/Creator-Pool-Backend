import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { MetricsTrackingService } from "./metrics-tracking.service";

@Injectable()
export class MetricsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsSchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @Inject(MetricsTrackingService)
    private readonly metricsTrackingService: MetricsTrackingService
  ) {}

  onModuleInit() {
    this.logger.log("Starting metrics scheduler...");

    setTimeout(() => {
      if (!this.metricsTrackingService) {
        this.logger.error("MetricsTrackingService is not injected!");
        return;
      }

      this.metricsTrackingService.updateVideoMetrics().catch((error) => {
        this.logger.error("Error during initial metrics update:", error);
      });

      this.intervalId = setInterval(() => {
        if (this.metricsTrackingService) {
          this.metricsTrackingService.updateVideoMetrics().catch((error) => {
            this.logger.error("Error during scheduled metrics update:", error);
          });
        }
      }, 120000); // 2 minutes - faster updates for better UX

      this.logger.log("Metrics scheduler started (running every 2 minutes)");
    }, 1000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log("Metrics scheduler stopped");
    }
  }
}
