import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { User } from "./entities/user.entity";
import { Video } from "./entities/video.entity";
import { Pool } from "./entities/pool.entity";
import { Prediction } from "./entities/prediction.entity";
import { AuthModule } from "./auth/auth.module";
import { YouTubeModule } from "./youtube/youtube.module";
import { PoolModule } from "./pools/pool.module";
import { PredictionModule } from "./predictions/prediction.module";
import { VideoModule } from "./videos/video.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: "medium",
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: "long",
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: (configService: ConfigService) => ({
    //     type: "postgres",
    //     host: configService.get("DB_HOST"),
    //     port: configService.get("DB_PORT"),
    //     username: configService.get("DB_USERNAME"),
    //     password: configService.get("DB_PASSWORD"),
    //     database: configService.get("DB_NAME"),
    //     entities: [User, Video, Pool, Prediction],
    //     synchronize: configService.get("NODE_ENV") !== "production",
    //     logging: configService.get("NODE_ENV") === "development",
    //   }),
    //   inject: [ConfigService],
    // }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Use the full DATABASE_URL if available (e.g., from Vercel/Neon)
        const databaseUrl = configService.get<string>("DATABASE_URL");

        if (databaseUrl) {
          return {
            type: "postgres" as const,
            url: databaseUrl,
            entities: [User, Video, Pool, Prediction],
            synchronize: configService.get<string>("NODE_ENV") !== "production",
            logging: configService.get<string>("NODE_ENV") === "development",
            ssl: {
              rejectUnauthorized: false,
            },
          };
        }

        // Fallback to individual variables for local development if needed
        return {
          type: "postgres" as const,
          host: configService.get<string>("DB_HOST"),
          port: configService.get<number>("DB_PORT"),
          username: configService.get<string>("DB_USERNAME"),
          password: configService.get<string>("DB_PASSWORD"),
          database: configService.get<string>("DB_NAME"),
          entities: [User, Video, Pool, Prediction],
          synchronize: configService.get<string>("NODE_ENV") !== "production",
          logging: configService.get<string>("NODE_ENV") === "development",
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    YouTubeModule,
    PoolModule,
    PredictionModule,
    VideoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
