import mongoose from 'mongoose'
import { parentPort, workerData } from 'worker_threads'
import { buildFriendsMap, findMatchingGroups } from './utils'
import { BipartiteGraph } from './queue.service'
import { CommonService } from '../../common/common.service'
import { CommonRepository } from '../../common/common.repository'
import { UsersRepository } from '../../users/users.repository'
import { User, UserSchema } from '../../entities/user.entity'
import { ChatRoom, ChatRoomSchema } from '../../entities/chat-room.entity'
import { NotificationSchema } from '../../entities/notification.entity'
import { Chat, ChatSchema } from '../../entities/chat.entity'

// QueueData 타입 정의
const { maleQueue, femaleQueue } = workerData

// UserModelType 정의
const UserModelType = { ...User, _id: mongoose.Types.ObjectId }

// 즉시 실행 함수로 변경
;(async () => {
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test'
    await mongoose.connect(mongoUri, {})

    console.log('Connected to MongoDB')

    // 모델 정의
    const userModel = mongoose.model('User', UserSchema)
    const chatRoomModel = mongoose.model('ChatRoom', ChatRoomSchema)
    const notificationModel = mongoose.model('Notification', NotificationSchema)
    const chatModel = mongoose.model('Chat', ChatSchema)

    const usersRepository = new UsersRepository(userModel)
    const commonRepository = new CommonRepository(
      userModel,
      chatRoomModel,
      chatModel,
      notificationModel,
    )
    const commonService = new CommonService(
      commonRepository,
      usersRepository,
      null,
    )

    // 친구 맵 빌드
    const [maleFriendsMap, femaleFriendsMap] = await Promise.all([
      buildFriendsMap(maleQueue, commonService),
      buildFriendsMap(femaleQueue, commonService),
    ])

    // 이분 그래프 생성 및 매칭 그룹 찾기 (기존 로직 유지)
    const graph = new BipartiteGraph()
    // ... 이분 그래프 생성 로직

    // 로그 추가: 데이터 확인
    console.log('Male Queue:', maleQueue)
    console.log('Female Queue:', femaleQueue)

    // 로그 추가: 함수 호출 확인
    console.log('Building male friends map...')
    console.log('Building female friends map...')
    console.log('Finding matching groups...')

    const result = findMatchingGroups(graph, maleFriendsMap, femaleFriendsMap)
    console.log('결과 값은 어떻게 돼??? ', result)
    // 결과 전송
    parentPort.postMessage(result)

    // MongoDB 연결 해제
    await mongoose.disconnect()
    console.log('MongoDB connection closed')
  } catch (error) {
    console.error('Error in filterQueueWorker:', error)
    process.exit(1) // 비정상 종료
  }
})()
