import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { User, Friend } from '../entities/user.entity'
import { Model, Types, ObjectId } from 'mongoose'
import { AcceptFriend, AddFriendDto } from './dto/request/notification.dto'
import { ChatRoom } from '../entities/chat-room.entity'
import { Notification } from '../entities/notification.entity'
import { Chat } from '../entities/chat.entity'
@Injectable()
export class CommonRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
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

  async acceptFriend(data: AcceptFriend): Promise<User> {
    const { userNickname, friendNickname, notificationId } = data
    const friend = await this.userModel.findOne({ nickname: friendNickname })
    if (!friend) throw new Error('없는 유저랍니다.')
    const notificationObjectId = new Types.ObjectId(notificationId)

    try {
      await this.userModel
        .findOneAndUpdate(
          { nickname: userNickname },
          { $pull: { notifications: notificationObjectId } },
          { new: true },
        )
        .exec()

      await this.notificationModel.deleteOne({ _id: notificationId })

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

  // async getChatRoomMessage(chatRoomObjectId: Types.ObjectId) {
  //   const chatRoom = await this.chatRoomModel
  //     .findByIdAndUpdate(
  //       chatRoomObjectId,
  //       { $set: { isRead: true } },
  //       { new: true },
  //     )
  //     .lean()
  //     .exec()

  //   if (chatRoom) {
  //     return await this.chatRoomModel.populate(chatRoom, {
  //       path: 'chats',
  //       model: 'Chat',
  //       options: { sort: { createAt: 1 } },
  //       populate: { path: 'sender', select: 'nickname' },
  //     })
  //   } else return null
  // }
  async getChatRoomMessage(chatRoomObjectId: Types.ObjectId, nickname: string) {
    const chatRoom = await this.chatRoomModel
      .findById(chatRoomObjectId)
      .populate<{ chats: { sender: { nickname: string }; message: string }[] }>({
        path: 'chats',
        model: 'Chat',
        options: { sort : { createdAt : 1 } }, // 오래된 순으로 정렬
        populate: { path : 'sender', select: 'nickname' },
      })
      .lean()
      .exec()

    if (chatRoom) {
      const lastChat = chatRoom.chats[chatRoom.chats.length - 1]
      const myId = nickname

      if (chatRoom.chats.length > 0 && lastChat.sender.nickname !== myId) {
        await this.chatRoomModel.findByIdAndUpdate(chatRoomObjectId,
          { $set : {isRead: true}}
        )
      }
      return chatRoom;
    } else {
      return null;
    }
  }

  async saveMessagetoChatRoom(
    sender: string,
    message: string,
    chatRoomId: string,
    isReceiverOnline: boolean,
  ): Promise<Chat> {
    const newChat = await this.chatModel.create({ sender, message })
    await this.chatRoomModel.findByIdAndUpdate(chatRoomId, {
      $push: { chats: newChat._id },
      isRead: isReceiverOnline,
    })
    return newChat
  }

  async setNewNotification(userId: string) {
    await this.userModel.findOneAndUpdate(
      { nickname: userId },
      { $set: { newNotification: true } },
    )
  }

  async getFriendIds(userId: string) {
    return await this.userModel.findOne({ nickname: userId }).lean().exec()
  }
}
