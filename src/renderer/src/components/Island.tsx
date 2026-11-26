import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion'
import type { IslandGeometry } from '@shared/ipc'
import { useAppearance } from '../hooks/useAppearance'
import { useDeviceAlert } from '../hooks/useDeviceAlert'
import { islandActions, useIslandActivity } from '../hooks/useIslandActivity'
import { useIslandInteraction } from '../hooks/useIslandInteraction'
import { useLockTransition } from '../hooks/useLockTransition'
import { useMacUnlockAnimation } from '../hooks/useMacUnlockAnimation'
import {
  expandedBodyHeight,
  expandedHeaderHeight,
  IN_USE_DOT_OFFSET,
  islandFrame,
  type IslandShape,
  type PanelContent
} from '../services/island-layout'
import { instant, islandSpring } from '../services/motion'
import { compactPresentation } from '../services/presentation'
import { DeviceAlertView } from './DeviceAlert'
import { ExpandedPanel } from './ExpandedPanel'
import { FaceIdCard, FaceIdView, LockedCompact } from './FaceLock'
import { CompactActivity } from './island/CompactActivity'
import { InUseDot, inUseColor, inUseLabel } from './island/InUseDot'
import { PersonalCharacters } from './island/characters'
import { CrawlingHero } from './island/CrawlingHero'
import { NotchSpider, type SpiderMood } from './island/NotchSpider'
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
  // Just after the Mac itself was unlocked. Main only sends this when MacIsland
  // is unlocked or opening with the Mac, so it may cover the lock as it opens.
  const macUnlockStage = useMacUnlockAnimation()
  const macUnlocking = macUnlockStage !== null
  // A charger or headphones just connected. It never interrupts an open panel or the
  // Face ID card; main only sends headphone alerts while MacIsland is unlocked.
  const deviceAlert = useDeviceAlert()
  const showAlert = deviceAlert !== null && !macUnlocking && !faceIdOpen && !(mode === 'expanded' && !showLock)

  // While locked the island never opens, whatever the interaction state says.
  const shownMode: IslandShape = macUnlocking
    ? 'face-id'
    : showAlert
      ? 'alert'
      : showLock
        ? faceIdOpen
          ? 'face-id'
          : 'compact'
        : mode
  const expanded = shownMode === 'expanded'
  const activity: PanelContent = {
    hasTrack: snapshot.nowPlaying !== null,
    badges: snapshot.badges.length,
    transfers: snapshot.transfers.length
  }
  const isNotch = geometry.variant === 'notch'
  // Camera or microphone in use: a dot beside the notch on the small island (the
  // expanded header shows its own), even while locked.
  const dotColor = inUseColor(snapshot.inUse)
  const showDot = dotColor !== null && (shownMode === 'idle' || shownMode === 'compact')
  const frame = islandFrame(geometry, shownMode, hovering, expandedBodyHeight(activity), showDot)

  const onClick = macUnlocking
    ? undefined
    : showLock
      ? canRequestUnlock
        ? islandActions.requestUnlock
        : undefined
      : expanded
        ? undefined
        : expand
  const label = showLock ? 'MacIsland is locked. Click to unlock.' : expanded ? 'MacIsland' : 'Open MacIsland'

  // The character below the island (Skyline, the spider, or a personal one): it holds
  // on while the island is open, livens up with music, and drops whenever a
  // charger, headphones or a Mac unlock arrives.
  const { character } = useAppearance()
  const Crawler = character === 'none' ? null : (PersonalCharacters ?? (character === 'hero' ? CrawlingHero : null))
  const [excitement, setExcitement] = useState(0)
  const macUnlockStarted = macUnlockStage === 'face'
  useEffect(() => {
    if (deviceAlert || macUnlockStarted) setExcitement((count) => count + 1)
  }, [deviceAlert, macUnlockStarted])
  const spiderMood: SpiderMood =
    shownMode === 'expanded' || shownMode === 'face-id' ? 'clinging' : snapshot.nowPlaying?.isPlaying ? 'dancing' : 'idle'
  // Hangs from the flat part of the bottom edge, right of centre (34 is the spider's width).
  const spiderX = frame.width / 2 - frame.bottomRadius - 6 - 17
  // Personal characters walk along the whole flat part of that edge instead.
  const edgeWidth = Math.max(0, frame.width - frame.bottomRadius * 2 - 8)

  return (
    <div className="relative flex justify-center">
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
            {showLock && !faceIdOpen && !macUnlocking && !showAlert && (
              <LockedCompact key="lock" notchWidth={geometry.notchWidth} />
            )}
            {showAlert && (
              <DeviceAlertView
                // A new alert fades in fresh instead of swapping text in place.
                key={deviceAlert.kind === 'charging' ? 'alert-charging' : `alert-${deviceAlert.name}`}
                alert={deviceAlert}
                notchWidth={geometry.notchWidth}
              />
            )}
            {faceIdOpen && !macUnlocking && (
              <FaceIdCard
                key="face-id"
                lock={snapshot.lock}
                justUnlocked={justUnlocked}
                topInset={isNotch ? expandedHeaderHeight(geometry) : 0}
              />
            )}
            {macUnlocking && (
              <FaceIdView
                key="mac-unlock"
                stage={macUnlockStage}
                text={macUnlockStage === 'success' ? 'Unlocked' : ''}
                topInset={isNotch ? expandedHeaderHeight(geometry) : 0}
              />
            )}
            {!showLock && !macUnlocking && shownMode === 'compact' && (
              <CompactActivity key="compact" snapshot={snapshot} notchWidth={geometry.notchWidth} />
            )}
            {showDot && (
              <div
                key="in-use"
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: isNotch ? `calc(50% + ${geometry.notchWidth / 2 + IN_USE_DOT_OFFSET}px)` : '50%' }}
              >
                <InUseDot color={dotColor} label={inUseLabel(snapshot.inUse)} />
              </div>
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

      {Crawler && (
        <motion.div
          className="pointer-events-none absolute left-1/2"
          initial={false}
          animate={{ top: frame.top + frame.height, x: -edgeWidth / 2, width: edgeWidth }}
          transition={reduceMotion ? instant : islandSpring}
        >
          <Crawler mood={spiderMood} excitement={excitement} edgeWidth={edgeWidth} />
        </motion.div>
      )}
      {character === 'spider' && !Crawler && (
        <motion.div
          className="pointer-events-none absolute left-1/2"
          initial={false}
          animate={{ top: frame.top + frame.height, x: spiderX }}
          transition={reduceMotion ? instant : islandSpring}
        >
          <NotchSpider mood={spiderMood} excitement={excitement} />
        </motion.div>
      )}
    </div>
  )
}
