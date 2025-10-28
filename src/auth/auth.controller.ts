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
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { User, UserRole } from "../entities/user.entity";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  async refreshToken(@CurrentUser() user: User) {
    return this.authService.refreshToken(user.id);
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
  async getUserById(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.authService.getUserById(id);
  }

  // Creator-only: Creator dashboard
  @Get("creator/dashboard")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  async getCreatorDashboard(@CurrentUser() creator: User) {
    return {
      message: "Welcome to Creator Dashboard!",
      creator: {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        walletBalance: creator.walletBalance,
        youtubeChannelId: creator.youtubeChannelId,
      },
      stats: {
        totalEarnings: creator.walletBalance,
        videosUploaded: 0, // Placeholder
        subscribers: 0, // Placeholder
      },
    };
  }

  // Creator-only: Update YouTube integration
  @Put("creator/youtube")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  async updateYouTubeIntegration(
    @CurrentUser() creator: User,
    @Body()
    body: {
      youtubeChannelId: string;
      accessToken: string;
      refreshToken: string;
    }
  ) {
    return this.authService.updateYouTubeIntegration(creator.id, body);
  }

  // Creator or Admin: Access creator features
  @Get("creator/analytics")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getCreatorAnalytics(@CurrentUser() user: User) {
    return {
      message: `Analytics for ${user.name}`,
      role: user.role,
      analytics: {
        views: 1250,
        likes: 89,
        comments: 23,
        shares: 12,
      },
    };
  }

  // Any authenticated user: Public profile
  @Get("public/:id")
  @UseGuards(AuthGuard("jwt"))
  async getPublicProfile(@Param("id") id: string) {
    return this.authService.getPublicProfile(id);
  }
}
