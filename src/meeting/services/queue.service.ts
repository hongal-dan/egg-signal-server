import { Injectable, Inject } from '@nestjs/common'
import { Socket } from 'socket.io'
import Redis from 'ioredis'
import { CommonService } from '../../common/common.service'
import { SessionService } from './session.service'
import { Worker } from 'worker_threads'
import { performance } from 'perf_hooks'
import * as path from 'path'
import { buildFriendsMap, findMatchingGroups } from './utils'
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
    private readonly commonService: CommonService,
    private readonly sessionService: SessionService,
    @Inject('REDIS') redis: Redis,
  ) {
    this.redis = redis
  }

  async addParticipant(name: string, socket: Socket, gender: string) {
    const start = performance.now()
    const participant = JSON.stringify({ name, socketId: socket.id })
    const genderQueue = gender === 'MALE' ? 'maleQueue' : 'femaleQueue'

    const queue = await this.redis.lrange(genderQueue, 0, -1)

    // 중복 유저 제거과정 최적화 필요
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
          await this.sessionService.addParticipant(
            sessionId,
            user.name,
            user.socketId,
          )
        }

        await this.redis.ltrim('maleQueue', this.userQueueCount, -1)
        await this.redis.ltrim('femaleQueue', this.userQueueCount, -1)

        console.log('현재 큐 시작 진입합니다222. 세션 이름은: ', sessionId)
        // await this.meetingService.startVideoChatSession(sessionId); // meetingService와 관련된 코드는 주석 처리

        return { sessionId, readyUsers }
      }

      return { sessionId }
    } catch (error) {
      console.error('Error joining queue:', error)
      await this.sessionService.deleteSession(sessionId)
      throw error // 에러를 상위로 다시 throw하여 처리 가능하도록 함
    }
  }

  async filterQueues(): Promise<{
    sessionId?: string
    readyMales?: any[]
    readyFemales?: any[]
  } | null> {
    const start = performance.now()
    const maleQueue = await this.redis.lrange('maleQueue', 0, -1)
    const femaleQueue = await this.redis.lrange('femaleQueue', 0, -1)

    if (maleQueue.length >= 3 && femaleQueue.length >= 3) {
      // 워커를 생성하고 작업을 위임
      console.log('진짜 들어오는거니??')
      const workerPath = path.join(
        __dirname,
        '../../../dist/meeting/services/filterQueueWorker.js',
      )
      const worker = new Worker(workerPath, {
        workerData: {
          maleQueue: maleQueue.map(item => JSON.parse(item)),
          femaleQueue: femaleQueue.map(item => JSON.parse(item)),
        },
      })

      return new Promise((resolve, reject) => {
        worker.on('message', async result => {
          const end = performance.now()
          console.log(`filterQueues 실행 시간: ${(end - start).toFixed(2)}ms`)
          if (result) {
            const { males, females } = result

            const sessionId = await this.findOrCreateNewSession()

            await Promise.all([
              ...males.map(male =>
                this.sessionService.addParticipant(
                  sessionId,
                  male.name,
                  male.socketId,
                ),
              ),
              ...females.map(female =>
                this.sessionService.addParticipant(
                  sessionId,
                  female.name,
                  female.socketId,
                ),
              ),
            ])

            console.log('현재 큐 시작 진입합니다. 세션 이름은: ', sessionId)
            // await this.meetingService.startVideoChatSession(sessionId); // meetingService와 관련된 코드는 주석 처리

            await this.redis.ltrim('maleQueue', 3, -1)
            await this.redis.ltrim('femaleQueue', 3, -1)

            resolve({
              sessionId,
              readyMales: males,
              readyFemales: females,
            })
          } else {
            console.log(
              '충분한 매칭된 참여자가 없어 세션을 시작할 수 없습니다.',
            )
            resolve(null)
          }
        })

        worker.on('error', error => {
          console.error('Worker error:', error)
          reject(error)
        })

        worker.on('exit', code => {
          const end = performance.now()
          console.log(`filterQueues 실행 시간: ${(end - start).toFixed(2)}ms`)
          if (code !== 0) {
            console.error(`Worker가 종료 코드 ${code}와 함께 멈추었습니다.`)
            reject(new Error(`Worker가 종료 코드 ${code}와 함께 멈추었습니다.`))
          }
        })
      })
    } else {
      console.log('두 큐 모두 충분한 참여자가 없어 매칭을 시작할 수 없습니다.')
      const end = performance.now()
      console.log(`filterQueues 실행 시간: ${(end - start).toFixed(2)}ms`)
      return null
    }
  }
}
