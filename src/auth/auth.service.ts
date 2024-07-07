import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common'
import { AuthRepository } from './auth.repository'
import { CreateUserDto } from './dto/request/create-user.dto'
import { SignInUserDto } from './dto/request/signin-user.dto'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { KakaoUserDocument } from '../entities/user.entity'
import { Types } from 'mongoose'

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const hashedCreateUserDto = await this.hashPassword(createUserDto)
      const user = await this.authRepository.create(hashedCreateUserDto)
      return user._id
    } catch (error) {
      throw new InternalServerErrorException('Error creating user')
    }
  }

  async signIn(signInUserDto: SignInUserDto) {
    try {
      const user = await this.authRepository.findOne({ id: signInUserDto.id })
      if (!user) {
        throw new UnauthorizedException('Id not found')
      }

      const passwordMatch = await bcrypt.compare(
        signInUserDto.password,
        user.password,
      )

      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid credentials')
      }

      const payload = {
        _id: user._id,
        id: user.id,
        nickname: user.nickname,
        gender: user.gender,
      }

      return {
        access_token: this.jwtService.sign(payload),
      }
    } catch (error) {
      throw new InternalServerErrorException('Error signing in')
    }
  }

  private async hashPassword(
    createUserDto: CreateUserDto,
  ): Promise<CreateUserDto> {
    try {
      return {
        ...createUserDto,
        password: await bcrypt.hash(createUserDto.password, 10),
      }
    } catch (error) {
      throw new InternalServerErrorException('Error hashing password')
    }
  }

  generateAccessToken(user: KakaoUserDocument): string {
    const payload = {
      userId:
        user._id instanceof Types.ObjectId ? user._id.toHexString() : user._id,
    }
    return this.jwtService.sign(payload)
  }
  async generateRefreshToken(user: KakaoUserDocument): Promise<string> {
    try {
      const payload = {
        userId:
          user._id instanceof Types.ObjectId
            ? user._id.toHexString()
            : (user._id as string),
      }

      const refreshToken = this.jwtService.sign(payload)

      const saltOrRounds = 10
      const currentRefreshToken = await bcrypt.hash(refreshToken, saltOrRounds)

      await this.authRepository.setCurrentRefreshToken(
        currentRefreshToken,
        payload.userId,
      )
      console.log('refreshToken = ', refreshToken)
      return refreshToken
    } catch (error) {
      throw new InternalServerErrorException('Error generating refresh token')
    }
  }
  async getJWT(kakaoId: number) {
    try {
      const user = await this.kakaoValidateUser(kakaoId) // 카카오 정보 검증 및 회원가입 로직
      const accessToken = this.generateAccessToken(user) // AccessToken 생성
      const refreshToken = await this.generateRefreshToken(user) // refreshToken 생성
      return { accessToken, refreshToken }
    } catch (error) {
      throw new InternalServerErrorException('Error getting JWT')
    }
  }
  async kakaoValidateUser(kakaoId: number): Promise<KakaoUserDocument> {
    try {
      let user: KakaoUserDocument = (await this.authRepository.findOne({
        kakaoId,
      })) as KakaoUserDocument // 유저 조회
      if (!user) {
        // 회원 가입 로직
        const defaultUserData = {
          kakaoId,
          provider: 'kakao',
          id: `kakao_${kakaoId}`,
          nickname: `kakao_user_${kakaoId}`,
          password: await bcrypt.hash('default_password', 10),
          gender: 'MALE', // 기본 값 설정
        }
        user = await this.authRepository.createKakaoUser(defaultUserData)
      }
      return user
    } catch (error) {
      throw new InternalServerErrorException('Error validating Kakao user')
    }
  }
}
