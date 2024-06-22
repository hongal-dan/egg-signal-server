import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Friend, User } from '../entities/user.entity'
import { Model, Types } from 'mongoose'

@Injectable()
export class CommonRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getFriends(userId: Types.ObjectId) {
    return await this.userModel.findById(userId, { friends: [Friend] })
  }
}
