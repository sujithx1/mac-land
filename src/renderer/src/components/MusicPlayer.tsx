import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { IslandActions, NowPlaying } from '../types/activity'
import { formatDuration } from '../services/format'
import { sourceAccent } from '../services/presentation'
import { Artwork } from './ui/Artwork'
import { IconButton } from './ui/IconButton'
import { ProgressBar } from './ui/ProgressBar'

interface MusicPlayerProps {
  nowPlaying: NowPlaying | null
  actions: Pick<IslandActions, 'togglePlayback' | 'nextTrack' | 'previousTrack'>
}

export function MusicPlayer({ nowPlaying, actions }: MusicPlayerProps): React.JSX.Element {
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
  const hasDuration = track.duration > 0

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-3">
        <Artwork url={track.artworkUrl} size={64} radius={14} />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-[14px] leading-tight font-semibold text-white">{track.title}</p>
          <p className="truncate text-[12px] leading-snug text-white/55">
            {track.artist || sourceApp}
            {track.artist && <span className="text-white/30"> · {sourceApp}</span>}
          </p>
          <ProgressBar
            className="mt-2.5"
            value={hasDuration ? position / track.duration : 0}
            color={accent}
            label={`${track.title} playback position`}
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/40 tabular-nums">
            <span>{formatDuration(position)}</span>
            <span>{hasDuration ? `-${formatDuration(track.duration - position)}` : 'Live'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5">
        <IconButton icon={SkipBack} label="Previous track" onClick={actions.previousTrack} />
        <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'Pause' : 'Play'} size="lg" onClick={actions.togglePlayback} />
        <IconButton icon={SkipForward} label="Next track" onClick={actions.nextTrack} />
      </div>
    </div>
  )
}
