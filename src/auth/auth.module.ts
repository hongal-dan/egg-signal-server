import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { User, UserSchema } from '../entities/user.entity'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthRepository } from './auth.repository'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { KakaoStrategy } from './oauth/oauth-kakao.strategy'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from '../users/users.module'
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema, collection: 'Users' },
    ]),
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => UsersModule), // UsersModule 임포트
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, KakaoStrategy],
  exports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema, collection: 'Users' },
    ]),
  ],
})
export class AuthModule {}
