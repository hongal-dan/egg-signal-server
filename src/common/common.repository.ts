import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { User } from '../entities/user.entity'
import { Model } from 'mongoose'

@Injectable()
export class CommonRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}
}
