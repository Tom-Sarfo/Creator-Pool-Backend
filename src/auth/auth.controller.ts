import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Inject,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
// import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AddFundsDto } from "./dto/add-funds.dto";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 registrations per minute
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  // @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  // @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 refresh attempts per minute
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers() headers: any,
    @Body() body: { refreshToken: string }
  ) {
    // Extract token from request headers
    const authHeader = headers.authorization;
    const accessToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : "";

    return this.authService.logout(accessToken, body.refreshToken);
  }

  @Post("logout-all")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(@CurrentUser() user: User) {
    return this.authService.logoutAllDevices(user.id);
  }

  @Get("profile")
  @UseGuards(AuthGuard("jwt"))
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Put("profile")
  @UseGuards(AuthGuard("jwt"))
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Get("wallet/balance")
  @UseGuards(AuthGuard("jwt"))
  async getWalletBalance(@CurrentUser() user: User) {
    return this.authService.getWalletBalance(user.id);
  }

  @Post("wallet/add-funds")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  async addFundsToWallet(
    @CurrentUser() user: User,
    @Body() addFundsDto: AddFundsDto
  ) {
    return this.authService.addFundsToWallet(user.id, addFundsDto.amount);
  }

  // ===== ROLE-BASED ENDPOINTS =====

  // Admin-only: Get all users
  @Get("admin/users")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  // Admin-only: Get user by ID
  @Get("admin/users/:id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserById(@Param("id") id: string) {
    return this.authService.getUserById(id);
  }

  // Creator-only: Creator dashboard
  @Get("creator/dashboard")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  async getCreatorDashboard(@CurrentUser() user: User) {
    // For now, we'll use placeholder data
    // In a real implementation, you'd get this from the authenticated user
    return {
      message: "Welcome to Creator Dashboard!",
      creator: {
        id: "placeholder-id",
        name: "Placeholder Creator",
        email: "creator@example.com",
        walletBalance: "7000",
        youtubeChannelId: "UC123456789",
        totalViews: 1250,
        totalLikes: 89,
        totalComments: 23,
        totalSubscribers: 456,
        recentVideos: [
          {
            id: "video1",
            title: "My First Video",
            views: 500,
            likes: 45,
            publishedAt: "2025-10-28T10:00:00.000Z",
          },
        ],
      },
    };
  }

  // Creator-only: Update YouTube integration
  @Put("creator/youtube")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  async updateYouTubeIntegration(
    @CurrentUser() user: User,
    @Body()
    body: {
      youtubeChannelId: string;
      accessToken: string;
      refreshToken: string;
    }
  ) {
    return this.authService.updateYouTubeIntegration(user.id, body);
  }

  // Creator + Admin: Get creator analytics
  @Get("creator/analytics")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getCreatorAnalytics(@CurrentUser() user: User) {
    // For now, we'll use placeholder data
    // In a real implementation, you'd get this from the authenticated user
    return {
      message: "Analytics for Placeholder User",
      role: "creator",
      analytics: {
        views: 1250,
        likes: 89,
        comments: 23,
        subscribers: 456,
        revenue: 12.5,
        topVideos: [
          {
            id: "video1",
            title: "My First Video",
            views: 500,
            likes: 45,
            publishedAt: "2025-10-28T10:00:00.000Z",
          },
        ],
      },
    };
  }

  // Public profile (any authenticated user can view)
  @Get("public/:id")
  @UseGuards(AuthGuard("jwt"))
  async getPublicProfile(@Param("id") id: string) {
    return this.authService.getPublicProfile(id);
  }
}
