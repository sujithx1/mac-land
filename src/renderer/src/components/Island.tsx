import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion'
import type { IslandGeometry } from '@shared/ipc'
import { islandActions, useIslandActivity } from '../hooks/useIslandActivity'
import { useIslandInteraction } from '../hooks/useIslandInteraction'
import { useLockTransition } from '../hooks/useLockTransition'
import {
  expandedBodyHeight,
  expandedHeaderHeight,
  islandFrame,
  type IslandShape,
  type PanelContent
} from '../services/island-layout'
import { instant, islandSpring } from '../services/motion'
import { compactPresentation } from '../services/presentation'
import { ExpandedPanel } from './ExpandedPanel'
import { FaceIdCard, LockedCompact } from './FaceLock'
import { CompactActivity } from './island/CompactActivity'
import { NotchShoulders } from './island/NotchShoulders'

interface IslandProps {
  geometry: IslandGeometry
}

/** A short horizontal shake, like a rejected passcode on iPhone. */
const SHAKE = [0, -9, 9, -6, 6, -3, 3, 0]
const islandTransition: Transition = { ...islandSpring, x: { duration: 0.45, ease: 'easeInOut' } }

/**
 * The island shell: owns the shape, its spring, and which content is shown.
 * Content components only render data; they never size the island.
 */
export function Island({ geometry }: IslandProps): React.JSX.Element {
  const snapshot = useIslandActivity()
  const hasActivity = compactPresentation(snapshot).lead !== 'none'
  const { mode, hovering, onPointerEnter, onPointerLeave, expand, collapseNow } = useIslandInteraction(hasActivity)
  const reduceMotion = useReducedMotion()

  const { phase } = snapshot.lock
  const { justUnlocked } = useLockTransition(phase, {
    onLocked: collapseNow,
    // Open straight away if the pointer is still on the island (it was unlocked by clicking).
    onUnlocked: () => {
      if (hovering) expand()
    }
  })
  const showLock = phase !== 'unlocked' || justUnlocked
  // The Face ID card stays open from the scan until the check mark or failure has played.
  const faceIdOpen = phase === 'authenticating' || phase === 'failed' || justUnlocked
  const canRequestUnlock = phase === 'locked' || phase === 'failed'

  // While locked the island never opens, whatever the interaction state says.
  const shownMode: IslandShape = showLock ? (faceIdOpen ? 'face-id' : 'compact') : mode
  const expanded = shownMode === 'expanded'
  const activity: PanelContent = {
    hasTrack: snapshot.nowPlaying !== null,
    badges: snapshot.badges.length,
    transfers: snapshot.transfers.length
  }
  const frame = islandFrame(geometry, shownMode, hovering, expandedBodyHeight(activity))
  const isNotch = geometry.variant === 'notch'

  const onClick = showLock ? (canRequestUnlock ? islandActions.requestUnlock : undefined) : expanded ? undefined : expand
  const label = showLock ? 'MacIsland is locked. Click to unlock.' : expanded ? 'MacIsland' : 'Open MacIsland'

  return (
    <div className="flex justify-center">
      <motion.div
        role={expanded ? 'region' : 'button'}
        aria-label={label}
        aria-expanded={expanded}
        tabIndex={expanded ? -1 : 0}
        className={[
          'relative bg-island',
          expanded ? 'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]' : 'shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]',
          // A hairline edge helps the floating pill hold its shape on dark wallpapers.
          isNotch ? '' : 'ring-1 ring-white/[0.06] ring-inset'
        ].join(' ')}
        initial={false}
        animate={{
          width: frame.width,
          height: frame.height,
          marginTop: frame.top,
          borderTopLeftRadius: frame.topRadius,
          borderTopRightRadius: frame.topRadius,
          borderBottomLeftRadius: frame.bottomRadius,
          borderBottomRightRadius: frame.bottomRadius,
          x: phase === 'failed' && !reduceMotion ? SHAKE : 0
        }}
        whileTap={reduceMotion || expanded ? {} : { scale: 0.97 }}
        transition={reduceMotion ? instant : islandTransition}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      >
        {isNotch && <NotchShoulders />}

        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
          <AnimatePresence initial={false}>
            {showLock && !faceIdOpen && <LockedCompact key="lock" notchWidth={geometry.notchWidth} />}
            {faceIdOpen && (
              <FaceIdCard
                key="face-id"
                lock={snapshot.lock}
                justUnlocked={justUnlocked}
                topInset={isNotch ? expandedHeaderHeight(geometry) : 0}
              />
            )}
            {!showLock && shownMode === 'compact' && (
              <CompactActivity key="compact" snapshot={snapshot} notchWidth={geometry.notchWidth} />
            )}
            {expanded && (
              <ExpandedPanel
                key="expanded"
                geometry={geometry}
                height={frame.height}
                activity={activity}
                snapshot={snapshot}
                actions={islandActions}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
