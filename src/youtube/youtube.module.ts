import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { YouTubeController } from "./youtube.controller";
import { YouTubeService } from "./youtube.service";
import { User } from "../entities/user.entity";
import { Video } from "../entities/video.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, Video])],
  controllers: [YouTubeController],
  providers: [YouTubeService],
  exports: [YouTubeService],
})
export class YouTubeModule {}

