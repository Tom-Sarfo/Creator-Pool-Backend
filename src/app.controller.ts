import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return { message: "Welcome to Creator Pool API!" };
  }

  @Get("health")
  healthCheck() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Creator Pool API",
    };
  }
}
