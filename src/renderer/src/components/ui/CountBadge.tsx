import { formatCount } from '../../services/presentation'

interface CountBadgeProps {
  count: number
  className?: string
}

/** The red unread pill, as on iOS and Dock icons. */
export function CountBadge({ count, className = '' }: CountBadgeProps): React.JSX.Element {
  return (
    <span
      aria-label={`${count} unread`}
      className={`inline-grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[10px] leading-none font-semibold text-white tabular-nums ${className}`}
    >
      {formatCount(count)}
    </span>
  )
}
