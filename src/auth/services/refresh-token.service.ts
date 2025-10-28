import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { User } from "../../entities/user.entity";
import { TokenBlacklistService } from "./token-blacklist.service";

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService
  ) {}

  async generateRefreshToken(user: User): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: 0, // Default version
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    return this.jwtService.sign(payload, {
      secret: "creator-pool-super-secret-jwt-key-2024",
    });
  }

  async validateRefreshToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: "creator-pool-super-secret-jwt-key-2024",
      }) as RefreshTokenPayload;

      // Check if token is blacklisted
      if (await this.tokenBlacklistService.isBlacklisted(token)) {
        return null;
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: "creator-pool-super-secret-jwt-key-2024",
      }) as RefreshTokenPayload;

      // Add to blacklist
      await this.tokenBlacklistService.addToBlacklist(token, payload.exp);
    } catch (error) {
      console.error("Error revoking refresh token:", error);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    // For now, just log - in a real implementation, you'd increment token version
    console.log(`Revoking all tokens for user: ${userId}`);
  }
}
