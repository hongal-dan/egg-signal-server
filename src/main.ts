import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as cookieParser from 'cookie-parser'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  app.use(cookieParser())
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://egg-signal-app.syeong.link',
      'https://temp-git-main-hyeong1s-projects.vercel.app',
    ], // 개발 서버와 배포 서버 허용
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  })
  await app.listen(80)
}

bootstrap()
