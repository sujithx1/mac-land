import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { IslandActions, NowPlaying } from '../types/activity'
import { instant } from '../services/motion'
import { sourceAccent } from '../services/presentation'
import { Equalizer } from './island/Equalizer'
import { Artwork } from './ui/Artwork'
import { IconButton } from './ui/IconButton'
import { Scrubber } from './ui/Scrubber'

interface MusicPlayerProps {
  nowPlaying: NowPlaying | null
  actions: Pick<IslandActions, 'togglePlayback' | 'nextTrack' | 'previousTrack' | 'seek'>
}

export function MusicPlayer({ nowPlaying, actions }: MusicPlayerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  if (!nowPlaying) {
    return (
      <div className="flex h-full items-center gap-3 text-white/45">
        <div className="grid size-16 place-items-center rounded-[14px] bg-white/[0.06]">
          <Music size={22} />
        </div>
        <span className="text-[13px]">Not Playing</span>
      </div>
    )
  }

  const { track, isPlaying, position, sourceApp } = nowPlaying
  const accent = sourceAccent(sourceApp)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-3">
        {/* Like iPhone: the cover settles back a little while paused and springs forward on play. */}
        <motion.div
          className="shrink-0 rounded-[14px] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]"
          initial={false}
          animate={{ scale: isPlaying ? 1 : 0.88 }}
          transition={reduceMotion ? instant : { type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Artwork url={track.artworkUrl} size={64} radius={14} />
        </motion.div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[14px] leading-tight font-semibold text-white">{track.title}</p>
            <span className="shrink-0">
              <Equalizer playing={isPlaying} color={accent} />
            </span>
          </div>
          <p className="truncate text-[12px] leading-snug text-white/55">
            {track.artist || sourceApp}
            {track.artist && <span className="text-white/30"> · {sourceApp}</span>}
          </p>
          <div className="mt-2.5">
            <Scrubber
              // A new track starts fresh instead of animating from the old one's position.
              key={track.id}
              position={position}
              duration={track.duration}
              color={accent}
              label={`${track.title} playback position`}
              onSeek={actions.seek}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5">
        <IconButton icon={SkipBack} label="Previous track" onClick={actions.previousTrack} />
        <PlayPauseButton playing={isPlaying} onClick={actions.togglePlayback} />
        <IconButton icon={SkipForward} label="Next track" onClick={actions.nextTrack} />
      </div>
    </div>
  )
}

/** Play and pause morph into each other instead of swapping. */
function PlayPauseButton({ playing, onClick }: { playing: boolean; onClick: () => void }): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const Icon = playing ? Pause : Play
  const label = playing ? 'Pause' : 'Play'

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={reduceMotion ? {} : { scale: 0.86 }}
      className="relative grid size-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={label}
          className="grid place-items-center"
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0, rotate: -40 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0, rotate: 40 }}
          transition={reduceMotion ? instant : { type: 'spring', stiffness: 520, damping: 28 }}
        >
          <Icon size={22} strokeWidth={2} fill="currentColor" />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
