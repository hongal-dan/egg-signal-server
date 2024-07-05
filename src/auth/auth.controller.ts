import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
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

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoCallback(@Req() req, @Res() res: Response) {
    try {
      if (!req.user) {
        console.log('콜백 에러입니다')
      }
      // 유저 조회
      const user = await this.usersService.findOne(req.user.nickname)
      if (!user) {
        // 유저가 없으면 회원가입 처리
        const newUser = {
          kakaoId: req.user.kakaoId,
          provider: 'kakao',
          id: `kakao_${req.user.kakaoId}`,
          nickname: req.user.nickname,
          password: await bcrypt.hash('default_password', 10),
          gender: 'MALE', // 기본 값 설정
        }
        await this.authService.create(newUser)
      }

      const { accessToken, refreshToken } = await this.authService.getJWT(
        Number(req.user.kakaoId),
      )
      res.setHeader('Authorization', `${accessToken}`)
      res.cookie('access_token', accessToken, { httpOnly: false })
      res.cookie('refreshToken', refreshToken, { httpOnly: true })
      res.cookie('isLoggedIn', true, { httpOnly: false })

      // 클라이언트로 리다이렉션
      return res.redirect(this.configService.get('CLIENT_URL') + '/main')
    } catch (error) {
      console.log('Error during Kakao callback', error)
    }
  }
}
