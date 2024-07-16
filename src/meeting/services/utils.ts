// src/meeting/services/utils.ts
import { CommonService } from '../../common/common.service'
import { BipartiteGraph } from './queue.service'

export async function buildFriendsMap(
  queue: { name: string; socketId: string }[],
  commonService: CommonService,
) {
  const friendsMap = new Map<string, Set<string>>()
  await Promise.all(
    queue.map(async participant => {
      const friends = await commonService.sortFriend(participant.name)
      friendsMap.set(participant.name, new Set(friends))
    }),
  )
  return friendsMap
}

export function findMatchingGroups(
  graph: BipartiteGraph,
  maleFriendsMap: Map<string, Set<string>>,
  femaleFriendsMap: Map<string, Set<string>>,
) {
  const males = graph.getMales()
  const females = graph.getFemales()

  const maleCombos = getCombinations(males, 3)
  const femaleCombos = getCombinations(females, 3)

  for (const maleGroup of maleCombos) {
    console.log('test!!!')
    for (const femaleGroup of femaleCombos) {
      if (
        isGroupValid(
          maleGroup,
          femaleGroup,
          graph,
          maleFriendsMap,
          femaleFriendsMap,
        )
      ) {
        console.log('유효한 그룹 발견:', {
          males: maleGroup,
          females: femaleGroup,
        })
        return {
          males: maleGroup,
          females: femaleGroup,
        }
      }
    }
  }
  console.log('유효한 그룹을 찾지 못했습니다.')
  return null
}

export async function getFriends(
  name: string,
  commonService: CommonService,
): Promise<string[]> {
  return await commonService.sortFriend(name)
}

function getCombinations(arr: string[], size: number): string[][] {
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
  return result
}

function isGroupValid(
  males: string[],
  females: string[],
  graph: BipartiteGraph,
  maleFriendsMap: Map<string, Set<string>>,
  femaleFriendsMap: Map<string, Set<string>>,
): boolean {
  console.log('잘 들어오니??')
  for (const male of males) {
    console.log('잘 들어오니222222??')
    const neighbors = graph.getMaleNeighbors(male)
    console.log('잘 들어오니33333??', neighbors)
    const maleFriends = maleFriendsMap.get(male) || new Set()
    console.log('잘 들어오니4444444??', maleFriends)
    for (const female of females) {
      console.log('남성:', male, '여성:', female)
      if (!neighbors.has(female) || maleFriends.has(female)) {
        console.log('유효하지 않은 조합:', {
          male,
          female,
        })
        return false
      }
    }
  }
  // for (const female of females) {
  //   const neighbors = graph.getFemaleNeighbors(female)
  //   const femaleFriends = femaleFriendsMap.get(female) || new Set()
  //   for (const male of males) {
  //     console.log('테스트 1번의 내용.', male)
  //     if (!neighbors.has(male) || femaleFriends.has(male)) {
  //       console.log('테스트 1번입니다.')
  //       return false
  //     }
  //   }
  // }
  return true
}
