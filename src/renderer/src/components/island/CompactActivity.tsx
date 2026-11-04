import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownToLine } from 'lucide-react'
import type { IslandSnapshot } from '../../types/activity'
import { compactPresentation, sourceAccent } from '../../services/presentation'
import { contentEnter, contentExit, instant } from '../../services/motion'
import { AppIcon } from '../ui/AppIcon'
import { Artwork } from '../ui/Artwork'
import { CountBadge } from '../ui/CountBadge'
import { ProgressRing } from '../ui/ProgressRing'
import { Equalizer } from './Equalizer'

interface CompactActivityProps {
  snapshot: IslandSnapshot
  /** Width hidden behind the hardware notch; content stays clear of it. */
  notchWidth: number
}

/** Live activity tucked into the two "ears" either side of the notch. */
export function CompactActivity({ snapshot, notchWidth }: CompactActivityProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const { lead, notificationCount, topBadge, transferProgress } = compactPresentation(snapshot)
  const nowPlaying = snapshot.nowPlaying
  const accent = nowPlaying ? sourceAccent(nowPlaying.sourceApp) : '#fff'

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-between px-3"
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter }}
      exit={{ opacity: 0, filter: 'blur(4px)', transition: reduceMotion ? instant : contentExit }}
    >
      <div className="relative flex items-center">
        {lead === 'artwork' && nowPlaying && (
          <>
            <Artwork url={nowPlaying.track.artworkUrl} size={20} radius={5} />
            {/* Unread count rides on the artwork corner, like an app icon badge. */}
            {notificationCount > 0 && <CountBadge count={notificationCount} className="absolute -top-1.5 -right-2.5 scale-90" />}
          </>
        )}
        {lead === 'transfer' && <ArrowDownToLine size={15} className="text-sky-400" strokeWidth={2.4} />}
        {lead === 'notification' && <AppIcon icon={topBadge?.icon ?? null} size={20} />}
      </div>

      <div style={{ width: notchWidth }} className="shrink-0" />

      <div className="flex items-center gap-1.5">
        {lead === 'artwork' && nowPlaying && <Equalizer playing={nowPlaying.isPlaying} color={accent} />}
        {lead === 'transfer' && (
          <>
            {notificationCount > 0 && <CountBadge count={notificationCount} />}
            <ProgressRing value={transferProgress} size={17} color="#38bdf8" />
          </>
        )}
        {lead === 'notification' && <CountBadge count={notificationCount} />}
      </div>
    </motion.div>
  )
}
