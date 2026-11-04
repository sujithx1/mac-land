import { ArrowDownToLine, Check, Files } from 'lucide-react'
import type { Transfer } from '../types/activity'
import { formatBytes } from '../services/format'
import { transferFraction } from '../services/presentation'
import { ProgressBar } from './ui/ProgressBar'
import { SectionLabel } from './ui/SectionLabel'

interface TransferProgressProps {
  transfers: readonly Transfer[]
}

const VISIBLE = 2

export function TransferProgress({ transfers }: TransferProgressProps): React.JSX.Element {
  return (
    <section aria-label="Transfers" className="min-w-0">
      <SectionLabel trailing={transfers.length > 0 ? transfers.length : undefined}>Transfers</SectionLabel>
      {transfers.length === 0 ? (
        <p className="pt-3 text-[12px] text-white/35">No active transfers</p>
      ) : (
        <ul className="flex flex-col gap-3 pt-1">
          {transfers.slice(0, VISIBLE).map((transfer) => (
            <li key={transfer.id}>
              <TransferRow transfer={transfer} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function transferDetail(transfer: Transfer): string {
  if (transfer.done) return `${formatBytes(transfer.transferredBytes)} · Done`
  const size = transfer.totalBytes > 0
    ? `${formatBytes(transfer.transferredBytes)} of ${formatBytes(transfer.totalBytes)}`
    : formatBytes(transfer.transferredBytes)
  return transfer.bytesPerSecond > 0 ? `${size} · ${formatBytes(transfer.bytesPerSecond)}/s` : size
}

function TransferRow({ transfer }: { transfer: Transfer }): React.JSX.Element {
  const fraction = transferFraction(transfer)
  const { done } = transfer
  const Icon = done ? Check : transfer.kind === 'download' ? ArrowDownToLine : Files
  const color = done ? '#30d158' : '#64d2ff'

  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-white/[0.08]">
        <Icon size={14} style={{ color }} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[11px]">
          <p className="truncate font-medium text-white">{transfer.name}</p>
          {fraction !== null && (
            <span className="ml-auto shrink-0 text-white/45 tabular-nums">{Math.floor(fraction * 100)}%</span>
          )}
        </div>
        <ProgressBar className="mt-1.5 h-[3px]" value={fraction ?? 0} color={color} label={`${transfer.name} progress`} />
        <p className="mt-1 truncate text-[10px] text-white/40 tabular-nums">{transferDetail(transfer)}</p>
      </div>
    </div>
  )
}
