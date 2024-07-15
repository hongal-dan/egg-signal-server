// src/meeting/services/filterQueueWorker.ts
import { parentPort, workerData } from 'worker_threads'
import { buildFriendsMap, findMatchingGroups } from './utils'
import { BipartiteGraph } from './queue.service'
import { CommonService } from '../../common/common.service'
import { CommonRepository } from '../../common/common.repository' // 실제 경로에 맞게 수정 필요

const commonService = new CommonService(new CommonRepository()) // 실제 인스턴스 생성 필요

interface Participant {
  name: string
  socketId: string
}

interface QueueData {
  maleQueue: Participant[]
  femaleQueue: Participant[]
}

parentPort.on('message', async (data: QueueData) => {
  const { maleQueue, femaleQueue } = data

  // 친구 맵 빌드
  const [maleFriendsMap, femaleFriendsMap] = await Promise.all([
    buildFriendsMap(maleQueue, commonService),
    buildFriendsMap(femaleQueue, commonService),
  ])

  // 이분 그래프 생성
  const graph = new BipartiteGraph()
  for (const male of maleQueue) {
    for (const female of femaleQueue) {
      if (
        !maleFriendsMap.get(male.name).has(female.name) &&
        !femaleFriendsMap.get(female.name).has(male.name)
      ) {
        graph.addEdge(male.name, female.name)
      }
    }
  }

  // 매칭 그룹 찾기
  const result = findMatchingGroups(graph, maleFriendsMap, femaleFriendsMap)

  // 부모 스레드로 결과 전송
  parentPort.postMessage(result)
})
