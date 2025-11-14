import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix("api", {
    exclude: ["/health"], // Exclude health check from prefix if needed
  });

  // Normalize URLs: Remove double slashes and ensure proper path format
  app.use((req, res, next) => {
    // Normalize the URL by removing double slashes (except after protocol)
    if (req.url) {
      req.url = req.url.replace(/([^:]\/)\/+/g, "$1");
    }
    if (req.path) {
      req.path = req.path.replace(/\/+/g, "/");
    }
    next();
  });

  // Backward compatibility: Rewrite old routes to /api routes (works for all HTTP methods)
  app.use((req, res, next) => {
    // Only rewrite if request doesn't already start with /api and isn't /health
    if (
      !req.path.startsWith("/api") &&
      req.path !== "/health" &&
      req.path !== "/"
    ) {
      req.url = `/api${req.path}`;
    }
    next();
  });

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Enhanced CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      // Build allowed origins from environment and defaults
      const allowedOrigins = [
        // Production frontend (Vercel)
        "https://creator-pool.vercel.app",
        // Environment variable for frontend URL
        process.env.FRONTEND_URL,
        // Local development origins
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173", // Vite default
        "http://localhost:5173", // Vite default
        "http://127.0.0.1:8080", // Common dev port
        "http://localhost:8080", // Common dev port
      ].filter(Boolean); // Remove undefined values

      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // In development, be more permissive
      if (process.env.NODE_ENV === "development") {
        // Allow any localhost or 127.0.0.1 origin in development
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Total-Count"],
  });

  // Enhanced validation pipe with sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === "production",
    })
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Creator Pool API running on http://localhost:${port}`);
  console.log(`📚 API endpoints available at http://localhost:${port}/api`);
}

bootstrap();
