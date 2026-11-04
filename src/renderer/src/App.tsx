import { Island } from './components/Island'
import { useIslandGeometry } from './hooks/useIslandGeometry'

export function App(): React.JSX.Element | null {
  const geometry = useIslandGeometry()
  if (!geometry) return null
  return <Island geometry={geometry} />
}
