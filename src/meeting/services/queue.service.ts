import { Injectable, Inject } from '@nestjs/common'
import { Socket } from 'socket.io'
import { MeetingService } from './meeting.service'
import Redis from 'ioredis'
import { CommonService } from '../../common/common.service'
import { SessionService } from './session.service'
import { Worker } from 'worker_threads'
import * as redis from 'redis' // redis 클라이언트 사용
import { performance } from 'perf_hooks'
import { buildFriendsMap, findMatchingGroups, getFriends } from './utils' // 유틸리티 함수들 경로 수정 필요

export class BipartiteGraph {
  private maleEdges: Map<string, Set<string>> = new Map()
  private femaleEdges: Map<string, Set<string>> = new Map()

  addEdge(male: string, female: string) {
    if (!this.maleEdges.has(male)) {
      this.maleEdges.set(male, new Set())
    }
    this.maleEdges.get(male).add(female)

    if (!this.femaleEdges.has(female)) {
      this.femaleEdges.set(female, new Set())
    }
    this.femaleEdges.get(female).add(male)
  }

  getMaleNeighbors(male: string): Set<string> {
    return this.maleEdges.get(male) || new Set()
  }

  getFemaleNeighbors(female: string): Set<string> {
    return this.femaleEdges.get(female) || new Set()
  }

  getMales(): string[] {
    return Array.from(this.maleEdges.keys())
  }

  getFemales(): string[] {
    return Array.from(this.femaleEdges.keys())
  }
}

@Injectable()
export class QueueService {
  private redis: Redis
  public userQueueCount = 3
  constructor(
    private readonly meetingService: MeetingService,
    private readonly sessionService: SessionService,
    private readonly commonService: CommonService,
    @Inject('REDIS') redis: Redis,
  ) {
    this.redis = redis
  }

  /* 참여자 대기열 추가 */
  async addParticipant(name: string, socket: Socket, gender: string) {
    const participant = JSON.stringify({ name, socketId: socket.id })
    const genderQueue = gender === 'MALE' ? 'maleQueue' : 'femaleQueue'

    const queue = await this.redis.lrange(genderQueue, 0, -1)

    /**중복 유저 제거과정 최적화 필요 */
    for (const item of queue) {
      const parsedItem = JSON.parse(item)
      if (parsedItem.name === name) {
        await this.redis.lrem(genderQueue, 0, item)
      }
    }

    await this.redis.rpush(genderQueue, participant)
    console.log(
      `${gender} Queue : `,
      (await this.redis.lrange(genderQueue, 0, -1)).map(
        item => JSON.parse(item).name,
      ),
    )
    await this.filterQueues()
    const end = performance.now()
    console.log(`addParticipant 실행 시간: ${(end - start).toFixed(2)}ms`)
  }

  async removeParticipant(name: string, gender: string) {
    const genderQueue = gender === 'MALE' ? 'maleQueue' : 'femaleQueue'
    const queue = await this.redis.lrange(genderQueue, 0, -1)
    for (const item of queue) {
      const parsedItem = JSON.parse(item)
      if (parsedItem.name === name) {
        await this.redis.lrem(genderQueue, 0, item)
        break
      }
    }
  }

  async findOrCreateNewSession(): Promise<string> {
    const start = performance.now()
    const newSessionId = this.sessionService.generateSessionId()
    await this.sessionService.createSession(newSessionId)
    console.log(`Creating and returning new session: ${newSessionId}`)
    const end = performance.now()
    console.log(
      `findOrCreateNewSession 실행 시간: ${(end - start).toFixed(2)}ms`,
    )
    return newSessionId
  }

  async handleJoinQueue(
    participantName: string,
    client: Socket,
    gender: string,
  ) {
    let sessionId = ''
    try {
      const start = performance.now()
      await this.addParticipant(participantName, client, gender)

      const maleQueue = await this.redis.lrange(
        'maleQueue',
        0,
        this.userQueueCount - 1,
      )
      const femaleQueue = await this.redis.lrange(
        'femaleQueue',
        0,
        this.userQueueCount - 1,
      )

      if (
        maleQueue.length >= this.userQueueCount &&
        femaleQueue.length >= this.userQueueCount
      ) {
        sessionId = await this.findOrCreateNewSession()

        const readyMales = maleQueue
          .splice(0, this.userQueueCount)
          .map(item => JSON.parse(item))
        const readyFemales = femaleQueue
          .splice(0, this.userQueueCount)
          .map(item => JSON.parse(item))

        const readyUsers = [...readyMales, ...readyFemales]
        for (const user of readyUsers) {
          this.sessionService.addParticipant(
            sessionId,
            user.name,
            user.socketId,
          )
        }

        await this.redis.ltrim('maleQueue', this.userQueueCount, -1)
        await this.redis.ltrim('femaleQueue', this.userQueueCount, -1)

        console.log('현재 큐 시작진입합니다 세션 이름은 : ', sessionId)
        await this.meetingService.startVideoChatSession(sessionId)
        return { sessionId, readyUsers }
      }

      return { sessionId }
    } catch (error) {
      console.error('Error joining queue:', error)
      await this.sessionService.deleteSession(sessionId)
    }
  }

  async filterQueues() {
    // 매칭 가능성 확인
    if (this.maleQueue.length >= 3 && this.femaleQueue.length >= 3) {
      for (let i = 0; i < this.maleQueue.length; i++) {
        const male = this.maleQueue[i]
        const maleFriends = await this.commonRepository.getFriendNicknames(
          male.name,
        )
        const potentialFemales = this.femaleQueue.filter(
          female => !maleFriends.includes(female.name),
        )

        if (potentialFemales.length >= 3) {
          const readyMales = [male]
          const readyFemales = potentialFemales.slice(0, 3)
          const remainingMales = this.maleQueue.filter(
            m => m.name !== male.name,
          )
          const remainingFemales = this.femaleQueue.filter(
            f => !readyFemales.includes(f),
          )

          // 남은 남성 큐에서 추가로 2명 선택
          const additionalMales = remainingMales.slice(0, 2)
          readyMales.push(...additionalMales)
          this.maleQueue = remainingMales.slice(2)
          this.femaleQueue = remainingFemales

          const sessionId = await this.findOrCreateNewSession()

          readyMales.forEach(male => {
            this.meetingService.addParticipant(
              sessionId,
              male.name,
              male.socket,
            )
          })

          readyFemales.forEach(female => {
            this.meetingService.addParticipant(
              sessionId,
              female.name,
              female.socket,
            )
          })

          console.log('현재 큐 시작진입합니다 세션 이름은 : ', sessionId)
          await this.meetingService.startVideoChatSession(sessionId)

          return { sessionId, readyMales, readyFemales }
        } else {
          return
        }
      }
    }
    return null
  }

  private getCombinations(arr: string[], size: number): string[][] {
    const start = performance.now()
    const result: string[][] = []
    const combine = (start: number, chosen: string[]) => {
      if (chosen.length === size) {
        result.push([...chosen])
        return
      }
      for (let i = start; i < arr.length; i++) {
        chosen.push(arr[i])
        combine(i + 1, chosen)
        chosen.pop()
      }
    }
    combine(0, [])
    const end = performance.now()
    console.log(`getCombinations 실행 시간: ${(end - start).toFixed(2)}ms`)
    return result
  }

  private isGroupValid(
    males: string[],
    females: string[],
    graph: BipartiteGraph,
    maleFriendsMap: Map<string, Set<string>>,
    femaleFriendsMap: Map<string, Set<string>>,
  ): boolean {
    const start = performance.now()
    const allMales = new Set(males)
    const allFemales = new Set(females)

    for (const male of males) {
      const neighbors = graph.getMaleNeighbors(male)
      const maleFriends = maleFriendsMap.get(male) || new Set()
      for (const female of females) {
        if (!neighbors.has(female) || maleFriends.has(female)) {
          const end = performance.now()
          console.log(`isGroupValid 실행 시간: ${(end - start).toFixed(2)}ms`)
          return false
        }
      }
    }

    for (const female of females) {
      const neighbors = graph.getFemaleNeighbors(female)
      const femaleFriends = femaleFriendsMap.get(female) || new Set()
      for (const male of males) {
        if (!neighbors.has(male) || femaleFriends.has(male)) {
          const end = performance.now()
          console.log(`isGroupValid 실행 시간: ${(end - start).toFixed(2)}ms`)
          return false
        }
      }
    }

    const end = performance.now()
    console.log(`isGroupValid 실행 시간: ${(end - start).toFixed(2)}ms`)
    return true
  }
}
