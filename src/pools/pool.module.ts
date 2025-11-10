import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PoolController } from "./pool.controller";
import { PoolService } from "./pool.service";
import { Pool } from "../entities/pool.entity";
import { Video } from "../entities/video.entity";
import { User } from "../entities/user.entity";
import { PoolLifecycleService } from "./services/pool-lifecycle.service";
import { PoolSchedulerService } from "./services/pool-scheduler.service";
import { ProbabilityService } from "./services/probability.service";
import { CreatorAnalyticsService } from "./services/creator-analytics.service";
import { QuestionSuggestionService } from "./services/question-suggestion.service";

@Module({
  imports: [TypeOrmModule.forFeature([Pool, Video, User])],
  controllers: [PoolController],
  providers: [
    // Order matters - PoolLifecycleService must be initialized before PoolSchedulerService
    PoolLifecycleService,
    PoolSchedulerService,
    PoolService,
    ProbabilityService,
    CreatorAnalyticsService,
    QuestionSuggestionService,
  ],
  exports: [PoolService, PoolLifecycleService, ProbabilityService],
})
export class PoolModule {}
