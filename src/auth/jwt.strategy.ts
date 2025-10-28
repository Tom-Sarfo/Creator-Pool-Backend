import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService, JwtPayload } from "./auth.service";
import { User } from "../entities/user.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: "creator-pool-super-secret-jwt-key-2024",
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    console.log("JWT Strategy - Payload received:", payload);
    const user = await this.authService.validateUser(payload);
    console.log("JWT Strategy - User found:", user ? user.email : "null");
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
