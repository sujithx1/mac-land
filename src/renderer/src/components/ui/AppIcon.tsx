import { Bell } from 'lucide-react'

interface AppIconProps {
  icon: string | null
  size: number
}

/** An app's real icon from the helper, or a bell when it has none. */
export function AppIcon({ icon, size }: AppIconProps): React.JSX.Element {
  if (icon) return <img src={icon} alt="" draggable={false} style={{ width: size, height: size }} className="shrink-0" />
  return (
    <span className="grid shrink-0 place-items-center rounded-[22%] bg-white/10" style={{ width: size, height: size }}>
      <Bell size={Math.round(size * 0.5)} className="text-white/70" />
    </span>
  )
}
