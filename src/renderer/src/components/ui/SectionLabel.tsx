interface SectionLabelProps {
  children: React.ReactNode
  trailing?: React.ReactNode
}

export function SectionLabel({ children, trailing }: SectionLabelProps): React.JSX.Element {
  return (
    <div className="mb-2 flex items-baseline justify-between text-[10px] font-semibold tracking-[0.06em] text-white/40 uppercase">
      <span>{children}</span>
      {trailing !== undefined && <span className="tabular-nums">{trailing}</span>}
    </div>
  )
}
