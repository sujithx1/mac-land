import { useSyncExternalStore } from 'react'
import { activitySource } from '../services/activity'
import type { IslandActions, IslandSnapshot } from '../types/activity'

export function useIslandActivity(): IslandSnapshot {
  return useSyncExternalStore(activitySource.subscribe, activitySource.getSnapshot)
}

export const islandActions: IslandActions = activitySource
