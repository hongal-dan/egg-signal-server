import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { User, Friend } from '../entities/user.entity'
import { Model, Types, ObjectId } from 'mongoose'
import { AddFriendDto } from './dto/request/notification.dto'
import { ChatRoom } from '../entities/chat-room.entity'
import { Notification } from '../entities/notification.entity'

@Injectable()
export class CommonRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async getNotification(nickname: String): Promise<Notification[]> {
    await this.userModel.findOneAndUpdate(
      { nickname },
      {
        $set: { newNotification: false },
      },
    )

    const user = await this.userModel
      .findOne({ nickname })
      .populate<{ notifications: Notification[] }>('notifications')
      .lean()

    return user.notifications
  }

  async markNotification(data: AddFriendDto): Promise<Notification> {
    const { userNickname, friendNickname } = data
    const notification = new this.notificationModel({
      from: userNickname,
    })

    await this.userModel.findOneAndUpdate(
      { nickname: friendNickname },
      {
        $push: { notifications: notification._id },
      },
    )

    await notification.save()
    return notification
  }

  async getFriends(nickname: string): Promise<ObjectId[]> {
    return await this.userModel
      .findOne({ nickname }, { friends: 1, _id: 0 })
      .lean()
  }
  async acceptFriend(data: AddFriendDto): Promise<User> {
    const { userNickname, friendNickname } = data
    const friend = await this.userModel.findOne({ nickname: friendNickname })
    if (!friend) throw new Error('없는 유저랍니다.')

    try {
      await this.userModel.findOneAndUpdate(
        { nickname: userNickname },
        { $pull: { notifications: { from: friendNickname } } },
        { new: true },
      )

      const newChatRoom = new this.chatRoomModel({ chats: [] })
      await newChatRoom.save()

      const newFriend: Friend = {
        friend: friendNickname,
        chatRoomId: newChatRoom._id,
        newMessage: false,
      }

      const newFriendForFriend: Friend = {
        friend: userNickname,
        chatRoomId: newChatRoom._id,
        newMessage: false,
      }

      await this.userModel.findOneAndUpdate(
        { nickname: friendNickname },
        { $push: { friends: newFriendForFriend } },
        { new: true },
      )

      const updatedUser = await this.userModel
        .findOneAndUpdate(
          { nickname: userNickname },
          { $push: { friends: newFriend } },
          { new: true },
        )
        .lean()

      return updatedUser
    } catch (error) {
      throw new Error('친구 추가 실패했어용.')
    }
  }
}
