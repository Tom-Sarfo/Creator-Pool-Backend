import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
// import { CacheModule } from "@nestjs/cache-manager";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./guards/roles.guard";
// import { RefreshTokenService } from "./services/refresh-token.service";
// import { TokenBlacklistService } from "./services/token-blacklist.service";
import { User } from "../entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: "creator-pool-super-secret-jwt-key-2024",
      signOptions: { expiresIn: "15m" },
    }),
    // CacheModule.register({
    //   ttl: 60 * 60 * 1000, // 1 hour
    //   max: 1000, // Maximum number of items in cache
    // }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    // RefreshTokenService,
    // TokenBlacklistService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
