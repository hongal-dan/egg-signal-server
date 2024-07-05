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

      const payload = { _id: user._id, id: user.id, nickname: user.nickname }

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
    }
  }
}
