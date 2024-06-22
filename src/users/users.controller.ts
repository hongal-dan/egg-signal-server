import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { JwtAuthRestGuard } from '../guards/jwt-auth.rest.guard'
import { ResGetUserDto } from './dto/response/get-user.dto'
import { Types } from 'mongoose'

@UseGuards(JwtAuthRestGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUser(@Query() userid: Types.ObjectId): Promise<ResGetUserDto> {
    return this.usersService.findOne(userid)
  }

  @Patch('/avatar')
  @HttpCode(HttpStatus.OK)
  async patchUserAvatar(
    @Query() userid: Types.ObjectId,
    /**TODO: 아바타 obj 아니고 indexnumber면 나중에 바꿔야함 */
    @Body() avatar: Object,
  ): Promise<Object> {
    return this.usersService.patchAvatar(userid, avatar)
  }
}
