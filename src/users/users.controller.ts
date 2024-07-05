import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Patch,
  Req,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { JwtAuthRestGuard } from '../guards/jwt-auth.rest.guard'
import { ResGetUserDto } from './dto/response/get-user.dto'

@UseGuards(JwtAuthRestGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUser(@Req() request: Request): Promise<ResGetUserDto> {
    const userId = request['user'].userId
    return this.usersService.findOneById(userId)
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  async patchUserAvatar(
    @Req() request: Request,
    @Body() avatar: Object,
  ): Promise<Object> {
    const userId = request['user'].userId
    return this.usersService.patchAvatar(userId, avatar)
  }
}
