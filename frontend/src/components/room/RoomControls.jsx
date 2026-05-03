import clsx from 'clsx'

export default function RoomControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onEnd,
  participantCount,
  trainingTitle,
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3
                    bg-stone-900/95 backdrop-blur border-t border-stone-800">

      {/* Left — info */}
      <div className="hidden sm:block min-w-0">
        <p className="font-body text-xs text-stone-400 truncate max-w-[200px]">
          {trainingTitle}
        </p>
        <p className="font-body text-xs text-stone-600">
          {participantCount} участник{participantCount === 1 ? '' : participantCount < 5 ? 'а' : 'ов'}
        </p>
      </div>

      {/* Center — controls */}
      <div className="flex items-center gap-3 mx-auto sm:mx-0">
        <ControlBtn
          onClick={onToggleAudio}
          active={audioEnabled}
          label={audioEnabled ? 'Выкл. микрофон' : 'Вкл. микрофон'}
          activeIcon={<MicIcon />}
          inactiveIcon={<MicOffIcon />}
        />
        <ControlBtn
          onClick={onToggleVideo}
          active={videoEnabled}
          label={videoEnabled ? 'Выкл. камеру' : 'Вкл. камеру'}
          activeIcon={<CamIcon />}
          inactiveIcon={<CamOffIcon />}
        />
        <button
          onClick={onLeave}
          title="Выйти"
          className="w-12 h-12 rounded-2xl bg-red-500 hover:bg-red-600
                     flex items-center justify-center transition-colors duration-150
                     active:scale-95"
        >
          <PhoneIcon />
        </button>
        {onEnd && (
          <button
            onClick={onEnd}
            className="h-12 px-4 rounded-2xl bg-sage-600 hover:bg-sage-700 text-white
                       font-body text-sm transition-colors active:scale-95"
          >
            Завершить
          </button>
        )}
      </div>

      {/* Right — spacer */}
      <div className="hidden sm:block w-[120px]" />
    </div>
  )
}

function ControlBtn({ onClick, active, label, activeIcon, inactiveIcon }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-95',
        active
          ? 'bg-stone-700 hover:bg-stone-600 text-white'
          : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
      )}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  )
}

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const MicOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const CamIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
)

const CamOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h2a2 2 0 0 1 2 2v9.34"/>
    <line x1="16" y1="11" x2="23" y2="7"/><line x1="23" y1="17" x2="16" y2="13"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.32 9.9a16 16 0 0 0 3.36 3.41z"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
)
