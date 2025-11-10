import {
  Controller,
  Get,
  Post,
  Put,
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
import {
  PoolService,
  CreatePoolDto,
  UpdatePoolDto,
  DepositPledgeDto,
} from "./pool.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PoolStatus } from "../entities/pool.entity";
import { QuestionSuggestionService } from "./services/question-suggestion.service";

@Controller("pools")
export class PoolController {
  constructor(
    @Inject(PoolService) private poolService: PoolService,
    @Inject(QuestionSuggestionService)
    private questionSuggestionService: QuestionSuggestionService
  ) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createPool(
    @CurrentUser() user: User,
    @Body() createPoolDto: CreatePoolDto
  ) {
    return this.poolService.createPool(user.id, createPoolDto);
  }

  @Get()
  async getPools(
    @Query("status") status?: PoolStatus,
    @Query("creatorId") creatorId?: string,
    @Query("videoId") videoId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const filters = {
      status,
      creatorId,
      videoId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    };

    return this.poolService.getPools(filters);
  }

  @Get("trending")
  async getTrendingPools(@Query("limit") limit?: string) {
    return this.poolService.getTrendingPools(limit ? parseInt(limit) : 10);
  }

  @Get("search")
  async searchPools(@Query("q") query: string, @Query("limit") limit?: string) {
    return this.poolService.searchPools(query, limit ? parseInt(limit) : 20);
  }

  @Get("creator/:creatorId")
  async getCreatorPools(@Param("creatorId") creatorId: string) {
    return this.poolService.getCreatorPools(creatorId);
  }

  @Get(":id")
  async getPoolById(@Param("id") id: string) {
    return this.poolService.getPoolById(id);
  }

  @Get(":id/stats")
  async getPoolStats(@Param("id") id: string) {
    return this.poolService.getPoolStats(id);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updatePool(
    @Param("id") id: string,
    @Body() updatePoolDto: UpdatePoolDto
  ) {
    return this.poolService.updatePool(id, updatePoolDto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePool(@Param("id") id: string) {
    await this.poolService.deletePool(id);
  }

  @Post(":id/close-prediction-window")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async closePredictionWindow(@Param("id") id: string) {
    return this.poolService.closePredictionWindow(id);
  }

  @Post(":id/start-live-tracking")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async startLiveTracking(@Param("id") id: string) {
    return this.poolService.startLiveTracking(id);
  }

  @Post(":id/close-tracking-period")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async closeTrackingPeriod(@Param("id") id: string) {
    return this.poolService.closeTrackingPeriod(id);
  }

  @Post(":id/settle")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async settlePool(@Param("id") id: string) {
    return this.poolService.settlePool(id);
  }

  @Post(":id/deposit-pledge")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async depositPledge(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() depositPledgeDto: DepositPledgeDto
  ) {
    return this.poolService.depositPledge(id, depositPledgeDto.amount, user.id);
  }

  @Get("creators/:creatorId/suggestions")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getSuggestions(
    @Param("creatorId") creatorId: string,
    @Query("videoId") videoId?: string
  ) {
    return this.questionSuggestionService.generateSuggestions(
      creatorId,
      videoId
    );
  }
}
