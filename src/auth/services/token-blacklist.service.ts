import { Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject } from "@nestjs/common";

@Injectable()
export class TokenBlacklistService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: any) {}

  async addToBlacklist(token: string, expirationTime: number): Promise<void> {
    const ttl = Math.max(0, expirationTime - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await this.cacheManager.set(`blacklist:${token}`, true, ttl * 1000);
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const isBlacklisted = await this.cacheManager.get(`blacklist:${token}`);
    return !!isBlacklisted;
  }

  async removeFromBlacklist(token: string): Promise<void> {
    await this.cacheManager.del(`blacklist:${token}`);
  }

  async clearExpiredTokens(): Promise<void> {
    // Cache manager handles TTL automatically, but we can add cleanup logic here if needed
    console.log("Clearing expired tokens from blacklist");
  }
}
