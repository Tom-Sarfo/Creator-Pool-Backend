import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { PredictionService, CreatePredictionDto } from "./prediction.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PredictionResult } from "../entities/prediction.entity";

@Controller("predictions")
export class PredictionController {
  constructor(
    @Inject(PredictionService) private predictionService: PredictionService
  ) {}

  @Post()
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.CREATED)
  async createPrediction(
    @CurrentUser() user: User,
    @Body() createPredictionDto: CreatePredictionDto
  ) {
    return this.predictionService.createPrediction(
      user.id,
      createPredictionDto
    );
  }

  @Get()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPredictions(
    @Query("poolId") poolId?: string,
    @Query("predictorId") predictorId?: string,
    @Query("result") result?: PredictionResult,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const filters = {
      poolId,
      predictorId,
      result,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    };

    return this.predictionService.getPredictions(filters);
  }

  @Get("user/:userId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserPredictions(@Param("userId") userId: string) {
    return this.predictionService.getUserPredictions(userId);
  }

  @Get("pool/:poolId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPoolPredictions(@Param("poolId") poolId: string) {
    return this.predictionService.getPoolPredictions(poolId);
  }

  @Get("user/:userId/pool/:poolId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserPoolPrediction(
    @Param("userId") userId: string,
    @Param("poolId") poolId: string
  ) {
    return this.predictionService.getUserPoolPrediction(userId, poolId);
  }

  @Get("user/:userId/stats")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserPredictionStats(@Param("userId") userId: string) {
    return this.predictionService.getUserPredictionStats(userId);
  }

  @Get("leaderboard")
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async getPredictionLeaderboard(@Query("limit") limit?: string) {
    return this.predictionService.getPredictionLeaderboard(
      limit ? parseInt(limit) : 10
    );
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPredictionById(@Param("id") id: string) {
    return this.predictionService.getPredictionById(id);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelPrediction(@CurrentUser() user: User, @Param("id") id: string) {
    await this.predictionService.cancelPrediction(id, user.id);
  }
}
