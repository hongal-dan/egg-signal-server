import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { ValidationPipe } from '../validation/validation.pipe'
import { CreateUserDto } from './dto/request/create-user.dto'
import { SignInUserDto } from './dto/request/signin-user.dto'
import { Response } from 'express'
import { MessageResponseDto } from '../common_dto/response/message.dto'
import { AuthGuard } from '@nestjs/passport'
import { KakaoAuthGuard } from './oauth/auth.guard'
import { ConfigService } from '@nestjs/config'
import { KakaoRequest } from '../interfaces/kakao-request.interface'
import { UsersService } from '../users/users.service'
import * as bcrypt from 'bcrypt'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post('signUp')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body(new ValidationPipe()) createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto)
  }

  @Post('signIn')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body(new ValidationPipe()) signInUserDto: SignInUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { access_token } = await this.authService.signIn(signInUserDto)
    response.setHeader('Authorization', `${access_token}`)


    return new MessageResponseDto('Sign-in successful')
  }
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLogin() {
    // KakaoStrategy로 리다이렉트
  }
}
