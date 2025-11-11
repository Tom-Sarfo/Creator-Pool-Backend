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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>("NODE_ENV");
        const isProduction = nodeEnv === "production";
        const isDevelopment = nodeEnv === "development";
        const databaseUrl = configService.get<string>("DATABASE_URL");
        const dbHost = configService.get<string>("DB_HOST");
        const dbPort = configService.get<string>("DB_PORT");
        const dbUsername = configService.get<string>("DB_USERNAME");
        const dbPassword = configService.get<string>("DB_PASSWORD");
        const dbName = configService.get<string>("DB_NAME");

        const fallbackConfig = {
          host: dbHost ?? "localhost",
          port: parseInt(dbPort ?? "5432", 10),
          username: dbUsername ?? "",
          password: dbPassword ?? "",
          database: dbName ?? "",
        };

        return {
          type: "postgres",
          ...(databaseUrl ? { url: databaseUrl } : fallbackConfig),
          ssl: isProduction ? { rejectUnauthorized: false } : false,
          entities: [User, Video, Pool, Prediction],
          synchronize: !isProduction,
          logging: isDevelopment,
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
