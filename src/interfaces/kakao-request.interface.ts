import { Request } from '@nestjs/common'

interface KaKaoUser {
  kakaoId: string
  username: string
  nickname: string
  gender: string
  accessToken: string
}

export interface KakaoRequest extends Request {
  user: KaKaoUser
}
