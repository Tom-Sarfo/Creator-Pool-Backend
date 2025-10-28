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
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
// import { Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 registrations per minute
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
    schema: {
      example: {
        user: {
          id: "uuid",
          email: "user@example.com",
          name: "John Doe",
          role: "user",
          walletBalance: 0,
          createdAt: "2025-10-28T10:00:00.000Z",
          updatedAt: "2025-10-28T10:00:00.000Z",
        },
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "User with this email already exists",
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  // @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in",
    schema: {
      example: {
        user: {
          id: "uuid",
          email: "user@example.com",
          name: "John Doe",
          role: "creator",
          walletBalance: 0,
          createdAt: "2025-10-28T10:00:00.000Z",
          updatedAt: "2025-10-28T10:00:00.000Z",
        },
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  // @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 refresh attempts per minute
  @ApiOperation({ summary: "Refresh access token" })
  @ApiBody({
    schema: {
      example: {
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Token successfully refreshed",
    schema: {
      example: {
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Logout user" })
  @ApiBody({
    schema: {
      example: {
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Successfully logged out",
    schema: {
      example: {
        message: "Successfully logged out",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Logout from all devices" })
  @ApiResponse({
    status: 200,
    description: "Successfully logged out from all devices",
    schema: {
      example: {
        message: "Successfully logged out from all devices",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logoutAllDevices(@Headers() headers: any) {
    // For now, we'll need to extract user ID from JWT token
    // In a real implementation, you'd get this from the authenticated user
    return this.authService.logoutAllDevices("user-id");
  }

  @Get("profile")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    schema: {
      example: {
        id: "uuid",
        email: "user@example.com",
        name: "John Doe",
        role: "creator",
        walletBalance: 0,
        googleId: null,
        youtubeChannelId: "UC123456789",
        createdAt: "2025-10-28T10:00:00.000Z",
        updatedAt: "2025-10-28T10:00:00.000Z",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Headers() headers: any) {
    // For now, we'll need to extract user ID from JWT token
    // In a real implementation, you'd get this from the authenticated user
    return this.authService.getProfile("user-id");
  }

  @Put("profile")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    schema: {
      example: {
        id: "uuid",
        email: "updated@example.com",
        name: "John Updated",
        role: "creator",
        walletBalance: 0,
        googleId: null,
        youtubeChannelId: "UC123456789",
        createdAt: "2025-10-28T10:00:00.000Z",
        updatedAt: "2025-10-28T10:05:00.000Z",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 409, description: "Email already taken" })
  async updateProfile(
    @Headers() headers: any,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    // For now, we'll need to extract user ID from JWT token
    // In a real implementation, you'd get this from the authenticated user
    return this.authService.updateProfile("user-id", updateProfileDto);
  }

  // ===== ROLE-BASED ENDPOINTS =====

  // Admin-only: Get all users
  @Get("admin/users")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get all users (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "List of all users",
    schema: {
      example: [
        {
          id: "uuid1",
          email: "user1@example.com",
          name: "User One",
          role: "user",
          walletBalance: 0,
          createdAt: "2025-10-28T10:00:00.000Z",
          updatedAt: "2025-10-28T10:00:00.000Z",
        },
        {
          id: "uuid2",
          email: "creator@example.com",
          name: "Creator User",
          role: "creator",
          walletBalance: 0,
          createdAt: "2025-10-28T10:00:00.000Z",
          updatedAt: "2025-10-28T10:00:00.000Z",
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  // Admin-only: Get user by ID
  @Get("admin/users/:id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get user by ID (Admin only)" })
  @ApiParam({ name: "id", description: "User ID", example: "uuid" })
  @ApiResponse({
    status: 200,
    description: "User details",
    schema: {
      example: {
        id: "uuid",
        email: "user@example.com",
        name: "John Doe",
        role: "creator",
        walletBalance: 0,
        googleId: null,
        youtubeChannelId: "UC123456789",
        createdAt: "2025-10-28T10:00:00.000Z",
        updatedAt: "2025-10-28T10:00:00.000Z",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserById(@Headers() headers: any, @Param("id") id: string) {
    return this.authService.getUserById(id);
  }

  // Creator-only: Creator dashboard
  @Get("creator/dashboard")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get creator dashboard (Creator only)" })
  @ApiResponse({
    status: 200,
    description: "Creator dashboard data",
    schema: {
      example: {
        message: "Welcome to Creator Dashboard!",
        creator: {
          id: "uuid",
          name: "John Doe",
          email: "creator@example.com",
          walletBalance: "0.00",
          youtubeChannelId: "UC123456789",
        },
        stats: {
          totalEarnings: "0.00",
          videosUploaded: 0,
          subscribers: 0,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Creator role required",
  })
  async getCreatorDashboard(@Headers() headers: any) {
    // For now, we'll use placeholder data
    // In a real implementation, you'd get this from the authenticated user
    return {
      message: "Welcome to Creator Dashboard!",
      creator: {
        id: "placeholder-id",
        name: "Placeholder Creator",
        email: "creator@example.com",
        walletBalance: 0,
        youtubeChannelId: null,
      },
      stats: {
        totalEarnings: 0,
        videosUploaded: 0, // Placeholder
        subscribers: 0, // Placeholder
      },
    };
  }

  // Creator-only: Update YouTube integration
  @Put("creator/youtube")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update YouTube integration (Creator only)" })
  @ApiBody({
    schema: {
      example: {
        youtubeChannelId: "UC123456789",
        accessToken: "ya29.test_token",
        refreshToken: "1//test_refresh_token",
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "YouTube integration updated successfully",
    schema: {
      example: {
        id: "uuid",
        email: "creator@example.com",
        name: "John Doe",
        role: "creator",
        walletBalance: 0,
        googleId: null,
        youtubeChannelId: "UC123456789",
        createdAt: "2025-10-28T10:00:00.000Z",
        updatedAt: "2025-10-28T10:05:00.000Z",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Creator role required",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async updateYouTubeIntegration(
    @Headers() headers: any,
    @Body()
    body: {
      youtubeChannelId: string;
      accessToken: string;
      refreshToken: string;
    }
  ) {
    // For now, we'll use placeholder user ID
    // In a real implementation, you'd get this from the authenticated user
    return this.authService.updateYouTubeIntegration("user-id", body);
  }

  // Creator or Admin: Access creator features
  @Get("creator/analytics")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get creator analytics (Creator + Admin)" })
  @ApiResponse({
    status: 200,
    description: "Creator analytics data",
    schema: {
      example: {
        message: "Analytics for John Doe",
        role: "creator",
        analytics: {
          views: 1250,
          likes: 89,
          comments: 23,
          shares: 12,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Creator or Admin role required",
  })
  async getCreatorAnalytics(@Headers() headers: any) {
    // For now, we'll use placeholder data
    // In a real implementation, you'd get this from the authenticated user
    return {
      message: "Analytics for Placeholder User",
      role: "creator",
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
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get public user profile (Any authenticated user)" })
  @ApiParam({ name: "id", description: "User ID", example: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Public user profile",
    schema: {
      example: {
        id: "uuid",
        name: "John Doe",
        role: "creator",
        walletBalance: 0,
        youtubeChannelId: "UC123456789",
        createdAt: "2025-10-28T10:00:00.000Z",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getPublicProfile(@Param("id") id: string) {
    return this.authService.getPublicProfile(id);
  }
}
