import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { Video } from "../entities/video.entity";
import { User } from "../entities/user.entity";
import { Pool } from "../entities/pool.entity";
import { VideoStatusTransitionService } from "./services/video-status-transition.service";
import { MetricsTrackingService } from "./services/metrics-tracking.service";

@Module({
  imports: [TypeOrmModule.forFeature([Video, User, Pool])],
  controllers: [VideoController],
  providers: [
    VideoService,
    VideoStatusTransitionService,
    MetricsTrackingService,
  ],
  exports: [VideoService, VideoStatusTransitionService, MetricsTrackingService],
})
export class VideoModule {}
