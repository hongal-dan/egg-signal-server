import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { User } from '../entities/user.entity'
import { Model, Types, ObjectId } from 'mongoose'

@Injectable()
export class CommonRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getFriends(userId: Types.ObjectId): Promise<ObjectId[]> {
    return await this.userModel.findById(userId, { friends: 1 })
  }
}
