import { bridge } from '../bridge'
import { createLiveActivitySource } from './live-source'

/** The one place the island's data comes from. */
export const activitySource = createLiveActivitySource(bridge)
