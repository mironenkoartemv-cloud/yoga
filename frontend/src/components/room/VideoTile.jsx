import { useEffect, useRef } from 'react'
import clsx from 'clsx'

export default function VideoTile({
  stream,
  muted = false,
  label,
  avatarUrl,
  isLocal = false,
  audioEnabled = true,
  videoEnabled = true,
  className,
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.muted = muted || isLocal
      videoRef.current.play().catch((e) => {
        console.warn('[VideoTile] play() failed:', e.message)
      })
    }
  }, [stream, muted, isLocal])

  return (
    <div className={clsx(
      'relative rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center aspect-video',
      className
    )}>

      {/* Video element */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={clsx(
            'w-full h-full object-cover transition-opacity duration-300',
            !videoEnabled && 'opacity-0'
          )}
          style={{ display: stream ? undefined : 'none' }}
        />
      ) : null}

      {/* Avatar fallback (нет стрима или камера выключена) */}
      {(!stream || !videoEnabled) && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-800">
          {avatarUrl ? (
            <img src={avatarUrl} alt={label}
              className="w-16 h-16 rounded-full object-cover opacity-60" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-stone-700 flex items-center justify-center
                            font-display text-2xl text-stone-400">
              {label?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      {/* Label bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2
                      bg-gradient-to-t from-black/60 to-transparent
                      flex items-center justify-between">
        <span className="font-body text-xs text-white/90 truncate max-w-[80%]">
          {label}{isLocal ? ' (вы)' : ''}
        </span>
        <div className="flex items-center gap-1">
          {!audioEnabled && (
            <span className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
              <MicOffIcon />
            </span>
          )}
          {!videoEnabled && (
            <span className="w-5 h-5 rounded-full bg-stone-600/80 flex items-center justify-center">
              <CamOffIcon />
            </span>
          )}
        </div>
      </div>

      {/* Connecting indicator */}
      {!stream && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        </div>
      )}
    </div>
  )
}

const MicOffIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const CamOffIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h2a2 2 0 0 1 2 2v9.34"/>
    <circle cx="12" cy="13" r="3" opacity="0"/>
  </svg>
)
