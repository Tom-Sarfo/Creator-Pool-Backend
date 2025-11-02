import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../entities/user.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
// import { RefreshTokenService } from "./services/refresh-token.service";
// import { TokenBlacklistService } from "./services/token-blacklist.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  googleId?: string;
  youtubeChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(JwtService) private jwtService: JwtService
    // private refreshTokenService: RefreshTokenService,
    // private tokenBlacklistService: TokenBlacklistService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Validate and sanitize role - only allow valid UserRole values
    let userRole = UserRole.USER; // Default to USER role

    // Map "predictor" to "user" for backward compatibility
    if (role && role === ("predictor" as any)) {
      userRole = UserRole.USER;
    } else if (role && Object.values(UserRole).includes(role as UserRole)) {
      userRole = role as UserRole;
    }

    // Create new user
    const user = this.userRepository.create({
      email,
      password, // Will be hashed by @BeforeInsert() in entity
      name: [firstName, lastName].filter(Boolean).join(" ") || email,
      role: userRole,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user with password (since it's excluded by default)
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "password",
        "name",
        "role",
        "walletBalance",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Simple refresh token validation - in production, you'd want proper token validation
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: "creator-pool-super-secret-jwt-key-2024",
      }) as JwtPayload;

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);
      return tokens;
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(
    accessToken: string,
    refreshToken: string
  ): Promise<{ message: string }> {
    // Simple logout - in production, you'd want to blacklist tokens
    return { message: "Successfully logged out" };
  }

  async logoutAllDevices(userId: string): Promise<{ message: string }> {
    // Simple logout all - in production, you'd want to revoke all tokens
    return { message: "Successfully logged out from all devices" };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Promise<PublicUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if email is being changed and if it's already taken
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateProfileDto.email },
      });
      if (existingUser) {
        throw new ConflictException("Email already taken");
      }
    }

    // Update user
    Object.assign(user, updateProfileDto);
    const updatedUser = await this.userRepository.save(user);

    return this.sanitizeUser(updatedUser);
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }

  private async generateTokens(
    user: User
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Map "user" role to "predictor" for frontend compatibility
    const roleForToken = user.role === UserRole.USER ? "predictor" : user.role;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: roleForToken,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: "15m" }),
      this.jwtService.signAsync(payload, { expiresIn: "7d" }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): PublicUser {
    // Map "user" role to "predictor" for frontend compatibility
    const roleForResponse =
      user.role === UserRole.USER ? "predictor" : user.role;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleForResponse as any, // Cast to any since PublicUser expects UserRole but we're returning "predictor"
      walletBalance: Number(user.walletBalance),
      googleId: user.googleId,
      youtubeChannelId: user.youtubeChannelId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ===== ROLE-BASED METHODS =====

  async getAllUsers(): Promise<PublicUser[]> {
    const users = await this.userRepository.find({
      select: [
        "id",
        "email",
        "name",
        "role",
        "walletBalance",
        "googleId",
        "youtubeChannelId",
        "createdAt",
        "updatedAt",
      ],
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async getUserById(id: string): Promise<PublicUser> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "email",
        "name",
        "role",
        "walletBalance",
        "googleId",
        "youtubeChannelId",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.sanitizeUser(user);
  }

  async updateYouTubeIntegration(
    userId: string,
    data: {
      youtubeChannelId: string;
      accessToken: string;
      refreshToken: string;
    }
  ): Promise<PublicUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.youtubeChannelId = data.youtubeChannelId;
    user.youtubeAccessToken = data.accessToken;
    user.youtubeRefreshToken = data.refreshToken;
    user.youtubeTokenExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    const updatedUser = await this.userRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  async getPublicProfile(id: string): Promise<Partial<PublicUser>> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "name",
        "role",
        "walletBalance",
        "youtubeChannelId",
        "createdAt",
      ],
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Return only public information
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      walletBalance: Number(user.walletBalance),
      youtubeChannelId: user.youtubeChannelId,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get user wallet balance
   */
  async getWalletBalance(userId: string): Promise<{ balance: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["walletBalance"],
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return { balance: Number(user.walletBalance) };
  }

  /**
   * Add funds to user wallet (for testing/demo purposes)
   */
  async addFundsToWallet(userId: string, amount: number): Promise<PublicUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (amount <= 0) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    user.walletBalance = Number(user.walletBalance) + amount;
    const updatedUser = await this.userRepository.save(user);

    return this.sanitizeUser(updatedUser);
  }
}
