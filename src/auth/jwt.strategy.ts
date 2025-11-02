import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService, JwtPayload } from "./auth.service";
// import { TokenBlacklistService } from "./services/token-blacklist.service";
import { User } from "../entities/user.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AuthService) private authService: AuthService
    // private tokenBlacklistService: TokenBlacklistService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: "creator-pool-super-secret-jwt-key-2024",
      passReqToCallback: true, // Allow access to request object
    });
  }

  async validate(req: any, payload: JwtPayload): Promise<User> {
    console.log("JWT Strategy - Payload received:", payload);

    // Extract token from request
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // Check if token is blacklisted (simplified - in production you'd use proper blacklist)
    // if (token && (await this.tokenBlacklistService.isBlacklisted(token))) {
    //   console.log("JWT Strategy - Token is blacklisted");
    //   throw new UnauthorizedException("Token has been revoked");
    // }

    const user = await this.authService.validateUser(payload);
    console.log("JWT Strategy - User found:", user ? user.email : "null");
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
