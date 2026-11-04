import { useState } from 'react'
import { Music } from 'lucide-react'

interface ArtworkProps {
  url: string | null
  size: number
  radius: number
}

/** Cover art or video thumbnail, with a quiet placeholder when there is none or it fails to load. */
export function Artwork({ url, size, radius }: ArtworkProps): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = url !== null && failedUrl !== url

  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center overflow-hidden bg-white/10 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.18)]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Music size={Math.round(size * 0.45)} className="text-white/45" />
      )}
    </div>
  )
}
