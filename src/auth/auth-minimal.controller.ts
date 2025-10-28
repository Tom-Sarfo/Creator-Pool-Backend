import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in",
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("test")
  @ApiOperation({ summary: "Test endpoint" })
  @ApiResponse({
    status: 200,
    description: "Test response",
  })
  async test() {
    return { message: "Test endpoint working" };
  }
}
