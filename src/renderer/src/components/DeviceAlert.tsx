import { motion, useReducedMotion } from 'framer-motion'
import { Earbuds, Headphones, Zap } from 'lucide-react'
import type { DeviceAlert, HeadphoneBattery } from '@shared/devices'
import { contentEnter, contentExit, instant } from '../services/motion'

const GREEN = '#30d158'
const RED = '#ff453a'
/** At or below this, a battery shows red, as in the menu bar. */
const LOW_BATTERY = 20

interface DeviceAlertViewProps {
  alert: DeviceAlert
  /** Width hidden behind the hardware notch; content stays clear of it. */
  notchWidth: number
}

/** Charger or headphones that just connected, either side of the notch, like on iPhone. */
export function DeviceAlertView({ alert, notchWidth }: DeviceAlertViewProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-4 text-[12px]"
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter }}
      exit={{ opacity: 0, filter: 'blur(4px)', transition: reduceMotion ? instant : contentExit }}
    >
      {alert.kind === 'charging' ? <ChargingAlert alert={alert} notchWidth={notchWidth} /> : null}
      {alert.kind === 'headphones' ? <HeadphonesAlert alert={alert} notchWidth={notchWidth} /> : null}
    </motion.div>
  )
}

type Charging = Extract<DeviceAlert, { kind: 'charging' }>
type HeadphonesConnected = Extract<DeviceAlert, { kind: 'headphones' }>

const CHARGING_LABEL: Record<Charging['state'], string> = {
  charging: 'Charging',
  full: 'Charged',
  plugged: 'On Power',
  discharging: 'On Battery'
}

function ChargingAlert({ alert, notchWidth }: { alert: Charging; notchWidth: number }): React.JSX.Element {
  return (
    <>
      <Side notchWidth={notchWidth}>
        <Zap size={14} fill={GREEN} stroke={GREEN} className="shrink-0" aria-hidden />
        <span className="truncate font-medium text-white/90">{CHARGING_LABEL[alert.state]}</span>
      </Side>
      <div className="shrink-0" style={{ width: notchWidth }} />
      <Side notchWidth={notchWidth} end>
        <BatteryReadout percent={alert.percent} color={GREEN} />
      </Side>
    </>
  )
}

/** Earbuds report each bud; headphones and headsets report one battery. */
function isEarbuds(name: string, battery: HeadphoneBattery | null): boolean {
  if (battery && (battery.left !== null || battery.right !== null)) return true
  return /\bbuds\b|earbuds|airpods(?!\s*max)/i.test(name)
}

/** The lower bud matters most, as on iPhone; the case is left out. */
function headphoneLevel(battery: HeadphoneBattery | null): number | null {
  if (!battery) return null
  const buds = [battery.left, battery.right].filter((level): level is number => level !== null)
  return buds.length > 0 ? Math.min(...buds) : battery.main
}

function HeadphonesAlert({ alert, notchWidth }: { alert: HeadphonesConnected; notchWidth: number }): React.JSX.Element {
  const Icon = isEarbuds(alert.name, alert.battery) ? Earbuds : Headphones
  const level = headphoneLevel(alert.battery)

  return (
    <>
      <Side notchWidth={notchWidth}>
        <Icon size={15} className="shrink-0 text-white/90" aria-hidden />
        <span className="truncate font-medium text-white/90" title={alert.name}>
          {alert.name}
        </span>
      </Side>
      <div className="shrink-0" style={{ width: notchWidth }} />
      <Side notchWidth={notchWidth} end>
        {level !== null ? (
          <BatteryReadout percent={level} color={level <= LOW_BATTERY ? RED : 'rgba(255,255,255,0.9)'} />
        ) : (
          <span className="shrink-0 text-white/55">Connected</span>
        )}
      </Side>
    </>
  )
}

/**
 * One side of the alert. Beside a notch both sides take equal width, so the gap
 * between them sits exactly under the camera housing and a long name is cut short
 * instead of sliding beneath it. A floating pill has no notch and lets the name use the room.
 */
function Side({ notchWidth, end = false, children }: { notchWidth: number; end?: boolean; children: React.ReactNode }): React.JSX.Element {
  const width = notchWidth > 0 ? 'min-w-0 flex-1 basis-0' : end ? 'shrink-0' : 'min-w-0'
  return <div className={`flex items-center gap-1.5 ${width} ${end ? 'justify-end' : ''}`}>{children}</div>
}

function BatteryReadout({ percent, color }: { percent: number; color: string }): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
      <span className="font-semibold" style={{ color }}>
        {percent}%
      </span>
      <BatteryGlyph percent={percent} color={color} />
    </div>
  )
}

/** A battery outline that fills to the level as the alert opens. */
function BatteryGlyph({ percent, color }: { percent: number; color: string }): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const inner = 19
  // A sliver stays visible at 0% so the glyph never reads as broken.
  const fill = Math.max(1.5, (inner * Math.min(100, Math.max(0, percent))) / 100)

  return (
    <svg width={27} height={13} viewBox="0 0 27 13" aria-hidden>
      <rect x={0.75} y={0.75} width={23} height={11.5} rx={3.5} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      <path d="M25.5 4.5v4a2 2 0 0 0 0-4Z" fill="rgba(255,255,255,0.4)" />
      <motion.rect
        x={2.75}
        y={2.75}
        height={7.5}
        rx={2}
        fill={color}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: fill }}
        transition={reduceMotion ? instant : { type: 'spring', stiffness: 160, damping: 22, delay: 0.15 }}
      />
    </svg>
  )
}
