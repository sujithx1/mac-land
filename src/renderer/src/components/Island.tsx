import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { IslandGeometry } from '@shared/ipc'
import { islandActions, useIslandActivity } from '../hooks/useIslandActivity'
import { useIslandInteraction } from '../hooks/useIslandInteraction'
import { islandFrame } from '../services/island-layout'
import { instant, islandSpring } from '../services/motion'
import { compactPresentation } from '../services/presentation'
import { ExpandedPanel } from './ExpandedPanel'
import { CompactActivity } from './island/CompactActivity'
import { NotchShoulders } from './island/NotchShoulders'

interface IslandProps {
  geometry: IslandGeometry
}

/**
 * The island shell: owns the shape, its spring, and which content is shown.
 * Content components only render data; they never size the island.
 */
export function Island({ geometry }: IslandProps): React.JSX.Element {
  const snapshot = useIslandActivity()
  const hasActivity = compactPresentation(snapshot).lead !== 'none'
  const { mode, hovering, onPointerEnter, onPointerLeave, expand } = useIslandInteraction(hasActivity)
  const reduceMotion = useReducedMotion()
  const activityRow =
    snapshot.badges.length > 0 || snapshot.badgePermission === 'denied' || snapshot.transfers.length > 0
  const frame = islandFrame(geometry, mode, hovering, activityRow)
  const isNotch = geometry.variant === 'notch'
  const expanded = mode === 'expanded'

  return (
    <div className="flex justify-center">
      <motion.div
        role={expanded ? 'region' : 'button'}
        aria-label={expanded ? 'MacIsland' : 'Open MacIsland'}
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
          borderBottomRightRadius: frame.bottomRadius
        }}
        whileTap={reduceMotion || expanded ? {} : { scale: 0.97 }}
        transition={reduceMotion ? instant : islandSpring}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={expanded ? undefined : expand}
      >
        {isNotch && <NotchShoulders />}

        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
          <AnimatePresence initial={false}>
            {mode === 'compact' && (
              <CompactActivity key="compact" snapshot={snapshot} notchWidth={geometry.notchWidth} />
            )}
            {expanded && (
              <ExpandedPanel
                key="expanded"
                geometry={geometry}
                height={frame.height}
                activityRow={activityRow}
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
