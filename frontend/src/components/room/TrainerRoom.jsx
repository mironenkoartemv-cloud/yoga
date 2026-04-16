import { useState } from 'react'
import VideoTile from './VideoTile'
import RoomControls from './RoomControls'
import clsx from 'clsx'

export default function TrainerRoom({
  localStream,
  remoteStreams,
  participants,
  localUser,
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onMuteUser,
  trainingTitle,
  mediaError,
}) {
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [pipExpanded,  setPipExpanded]  = useState(false)

  const studentIds     = Object.keys(remoteStreams)
  const participantCount = participants.length

  // Сетка учеников
  const gridCols = studentIds.length === 1 ? 'grid-cols-1'
    : studentIds.length === 2 ? 'grid-cols-2'
    : studentIds.length <= 4  ? 'grid-cols-2'
    : 'grid-cols-3'

  return (
    <div className="flex flex-col h-full bg-stone-950">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-body text-sm text-white/80 truncate max-w-[200px]">{trainingTitle}</span>
          <span className="badge bg-red-500/20 text-red-400 text-xs ml-1">Тренер</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-stone-500">{participantCount} участников</span>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white transition-colors"
          >
            <PeopleIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Main area */}
        <div className="flex-1 relative p-3 overflow-hidden">

          {/* Ученики — главный экран */}
          {studentIds.length > 0 ? (
            <div className={clsx('grid gap-2 w-full h-full', gridCols)}>
              {studentIds.map((uid) => {
                const p = participants.find((x) => x.id === uid)
                return (
                  <VideoTile
                    key={uid}
                    stream={remoteStreams[uid]}
                    label={p?.name || 'Ученик'}
                    avatarUrl={p?.avatarUrl}
                    className="rounded-2xl w-full h-full"
                  />
                )
              })}
            </div>
          ) : (
            <div className="w-full h-full rounded-3xl bg-stone-900/50 border border-stone-800
                            flex flex-col items-center justify-center gap-3">
              <p className="font-body text-stone-500 text-sm">Ожидание учеников...</p>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-700 animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Тренер — PiP в углу */}
          {localStream && (
            <div
              className={clsx(
                'absolute bottom-5 right-5 rounded-2xl overflow-hidden border-2 border-stone-700 shadow-2xl',
                'transition-all duration-300 cursor-pointer',
                pipExpanded ? 'w-72 sm:w-96' : 'w-32 sm:w-44'
              )}
              onClick={() => setPipExpanded(v => !v)}
              title={pipExpanded ? 'Свернуть' : 'Развернуть'}
            >
              <VideoTile
                stream={localStream}
                label={localUser?.name || 'Тренер'}
                isLocal
                muted
                audioEnabled={audioEnabled}
                videoEnabled={videoEnabled}
                className="rounded-none"
              />
              {/* Expand hint */}
              <div className="absolute top-2 right-2 w-5 h-5 rounded bg-black/40
                              flex items-center justify-center">
                {pipExpanded ? <CollapseIcon /> : <ExpandIcon />}
              </div>
            </div>
          )}

          {/* Media error */}
          {mediaError && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
              <div className="bg-red-900/90 text-red-200 rounded-2xl px-4 py-3 text-xs font-body text-center">
                {mediaError}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-52 bg-stone-900 border-l border-stone-800 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-800">
              <p className="font-body text-xs text-stone-400 uppercase tracking-wider">
                Участники ({participantCount})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <ParticipantRow
                name={`${localUser?.name || 'Вы'} (тренер)`}
                avatarUrl={localUser?.avatarUrl}
                isTrainer
              />
              {participants.filter((p) => p.id !== localUser?.id).map((p) => (
                <ParticipantRow
                  key={p.id}
                  name={p.name}
                  avatarUrl={p.avatarUrl}
                  onMute={() => onMuteUser(p.id)}
                />
              ))}
              {participants.length <= 1 && (
                <p className="px-4 py-3 font-body text-xs text-stone-600">Нет учеников</p>
              )}
            </div>
          </div>
        )}
      </div>

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
  )
}

function ParticipantRow({ name, avatarUrl, isTrainer, onMute }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-stone-800/50 group">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center
                        font-body text-xs text-stone-400 shrink-0">
          {name[0]?.toUpperCase()}
        </div>
      )}
      <span className="font-body text-xs text-stone-300 truncate flex-1">{name}</span>
      {isTrainer && <span className="text-[10px] font-body text-sage-500 shrink-0">тренер</span>}
      {onMute && (
        <button onClick={onMute} title="Выключить микрофон"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-stone-500 hover:text-red-400">
          <MuteIcon />
        </button>
      )}
    </div>
  )
}

const PeopleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const MuteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
  </svg>
)
const ExpandIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)
const CollapseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
  </svg>
)
