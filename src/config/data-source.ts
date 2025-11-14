import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "../entities/user.entity";
import { Video } from "../entities/video.entity";
import { Pool } from "../entities/pool.entity";
import { Prediction } from "../entities/prediction.entity";

// Load environment variables
config();

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;

// Create DataSource configuration
const dataSourceConfig = databaseUrl
  ? {
      type: "postgres" as const,
      url: databaseUrl,
      ssl: isProduction
        ? {
            rejectUnauthorized: false,
          }
        : false,
    }
  : {
      type: "postgres" as const,
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USERNAME || "",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "",
    };

export const AppDataSource = new DataSource({
  ...dataSourceConfig,
  entities: [User, Video, Pool, Prediction],
  migrations: ["src/migrations/*.ts"],
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === "development",
});
