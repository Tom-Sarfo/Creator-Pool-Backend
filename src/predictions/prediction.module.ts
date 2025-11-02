import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PredictionController } from "./prediction.controller";
import { PredictionService } from "./prediction.service";
import { Prediction } from "../entities/prediction.entity";
import { Pool } from "../entities/pool.entity";
import { User } from "../entities/user.entity";
import { PoolModule } from "../pools/pool.module";

@Module({
  imports: [TypeOrmModule.forFeature([Prediction, Pool, User]), PoolModule],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
