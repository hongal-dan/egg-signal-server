import { Prop, Schema } from '@nestjs/mongoose'
import { Types } from 'mongoose'

export enum NotificationTypes {
  FRIEND = 'FRIEND',
  PARTY = 'PARTY',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId })
  from: Types.ObjectId

  @Prop({ type: String, enum: NotificationTypes })
  notificationType: string
}
