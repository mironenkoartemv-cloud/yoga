import VideoTile from './VideoTile'
import RoomControls from './RoomControls'

export default function StudentRoom({
  localStream,
  trainerStream,
  trainer,
  localUser,
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  trainingTitle,
  participantCount,
  mediaError,
}) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0c0a09', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0 }} className="flex items-center justify-between px-4 py-3 bg-stone-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-body text-sm text-white/80 truncate max-w-[200px]">{trainingTitle}</span>
        </div>
        <span className="font-body text-xs text-stone-500">{participantCount} участников</span>
      </div>

      {/* Video area — занимает всё оставшееся пространство */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '12px' }}>

        {/* Trainer video */}
        {trainerStream ? (
          <video
            autoPlay playsInline
            ref={(el) => {
              if (el && el.srcObject !== trainerStream) {
                el.srcObject = trainerStream
                el.muted = false
                el.play().catch(() => {})
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px', background: '#1c1917', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: '20px', background: '#1c1917', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            {trainer?.avatarUrl ? (
              <img src={trainer.avatarUrl} alt={trainer.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', opacity: 0.5 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#292524', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#78716c', fontFamily: 'Cormorant Garamond, serif' }}>
                {trainer?.name?.[0] || 'Т'}
              </div>
            )}
            <p className="font-body text-stone-400 text-sm">Ожидание тренера...</p>
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-600 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Trainer label */}
        {trainerStream && (
          <div style={{ position: 'absolute', bottom: 24, left: 24, padding: '6px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <span className="font-body text-xs text-white/80">{trainer?.name || 'Тренер'}</span>
          </div>
        )}

        {/* Local PiP */}
        {localStream && (
          <div style={{ position: 'absolute', bottom: 24, right: 24, width: 140, borderRadius: 14, overflow: 'hidden', border: '2px solid #44403c', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', background: '#1c1917' }}>
            <video
              autoPlay playsInline muted
              ref={(el) => {
                if (el && el.srcObject !== localStream) {
                  el.srcObject = localStream
                  el.muted = true
                  el.play().catch(() => {})
                }
              }}
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: 'DM Sans, sans-serif' }}>
                {localUser?.name || 'Вы'} (вы)
              </span>
            </div>
            {(!audioEnabled || !videoEnabled) && (
              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3 }}>
                {!audioEnabled && <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔇</span>}
                {!videoEnabled && <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(87,83,78,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>📵</span>}
              </div>
            )}
          </div>
        )}

        {/* Media error */}
        {mediaError && (
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, maxWidth: 360, width: '100%', padding: '0 16px' }}>
            <div className="bg-red-900/90 text-red-200 rounded-2xl px-4 py-3 text-xs font-body text-center">
              {mediaError}
            </div>
          </div>
        )}
      </div>

      {/* Controls — всегда внизу, не скроллится */}
      <div style={{ flexShrink: 0 }}>
        <RoomControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onLeave={onLeave}
          participantCount={participantCount}
          trainingTitle={trainingTitle}
        />
      </div>
    </div>
  )
}
