import { SHOULDER_RADIUS } from '../../services/island-layout'

/** Concave fillets that blend the island into the top edge, like the hardware notch. */
export function NotchShoulders(): React.JSX.Element {
  const size = `${SHOULDER_RADIUS}px`
  const fillet = (side: 'left' | 'right'): string =>
    `radial-gradient(circle at bottom ${side}, transparent ${SHOULDER_RADIUS - 0.5}px, var(--color-island) ${SHOULDER_RADIUS}px)`

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0"
        style={{ left: `-${size}`, width: size, height: size, background: fillet('left') }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0"
        style={{ right: `-${size}`, width: size, height: size, background: fillet('right') }}
      />
    </>
  )
}
