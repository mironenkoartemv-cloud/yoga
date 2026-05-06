import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import { roomsApi } from '../api/rooms'
import { useAuthStore } from '../store/authStore'
import RoomControls from '../components/room/RoomControls'
import { Spinner } from '../components/ui'

const STATUS = {
  LOADING: 'loading',
  CONNECTING: 'connecting',
  LIVE: 'live',
  ERROR: 'error',
}

export default function LiveKitRoomPage() {
  const { id: trainingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [status, setStatus] = useState(STATUS.LOADING)
  const [room, setRoom] = useState(null)
  const [tiles, setTiles] = useState([])
  const [training, setTraining] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)

  const roomRef = useRef(null)

  const syncRoomState = useCallback((currentRoom) => {
    if (!currentRoom) return

    const localParticipant = currentRoom.localParticipant
    const localCamera = localParticipant.getTrackPublication(Track.Source.Camera)
    const localMic = localParticipant.getTrackPublication(Track.Source.Microphone)

    setAudioEnabled(Boolean(localMic) && !localMic.isMuted)
    setVideoEnabled(Boolean(localCamera) && !localCamera.isMuted)

    const nextTiles = [{
      id: localParticipant.identity,
      name: user?.name || localParticipant.name || 'Вы',
      role: user?.role || 'LOCAL',
      isLocal: true,
      cameraTrack: localCamera?.track || null,
      audioTrack: null,
      audioEnabled: Boolean(localMic) && !localMic.isMuted,
      videoEnabled: Boolean(localCamera) && !localCamera.isMuted,
    }]

    currentRoom.remoteParticipants.forEach((participant) => {
      const camera = participant.getTrackPublication(Track.Source.Camera)
      const microphone = participant.getTrackPublication(Track.Source.Microphone)
      const metadata = safeJson(participant.metadata)

      nextTiles.push({
        id: participant.identity,
        name: participant.name || 'Участник',
        role: metadata?.role || 'STUDENT',
        isLocal: false,
        cameraTrack: camera?.track || null,
        audioTrack: microphone?.track || null,
        audioEnabled: Boolean(microphone) && !microphone.isMuted,
        videoEnabled: Boolean(camera) && !camera.isMuted,
      })
    })

    setTiles(nextTiles)
  }, [user])

  useEffect(() => {
    let disposed = false

    const connect = async () => {
      try {
        setStatus(STATUS.CONNECTING)

        const { data } = await roomsApi.livekitToken(trainingId)
        if (disposed) return
        setTraining(data.training)

        const nextRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        })

        const refresh = () => syncRoomState(nextRoom)
        nextRoom
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.TrackSubscribed, refresh)
          .on(RoomEvent.TrackUnsubscribed, refresh)
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)
          .on(RoomEvent.MediaDevicesError, (err) => {
            setErrorMsg(`Ошибка камеры или микрофона: ${err.message}`)
          })

        await nextRoom.connect(data.livekitUrl, data.token)
        await nextRoom.localParticipant.enableCameraAndMicrophone()

        if (disposed) {
          nextRoom.disconnect()
          return
        }

        roomRef.current = nextRoom
        setRoom(nextRoom)
        syncRoomState(nextRoom)
        setStatus(STATUS.LIVE)
      } catch (err) {
        console.error('[LiveKit room]', err)
        if (!disposed) {
          setErrorMsg(err.response?.data?.error || err.message || 'Не удалось подключиться к LiveKit-комнате')
          setStatus(STATUS.ERROR)
        }
      }
    }

    connect()

    return () => {
      disposed = true
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [syncRoomState, trainingId])

  const toggleAudio = useCallback(async () => {
    const currentRoom = roomRef.current
    if (!currentRoom) return
    await currentRoom.localParticipant.setMicrophoneEnabled(!audioEnabled)
    syncRoomState(currentRoom)
  }, [audioEnabled, syncRoomState])

  const toggleVideo = useCallback(async () => {
    const currentRoom = roomRef.current
    if (!currentRoom) return
    await currentRoom.localParticipant.setCameraEnabled(!videoEnabled)
    syncRoomState(currentRoom)
  }, [syncRoomState, videoEnabled])

  const leaveRoom = useCallback(() => {
    roomRef.current?.disconnect()
    navigate(`/training/${trainingId}`)
  }, [navigate, trainingId])

  if (status === STATUS.LOADING || status === STATUS.CONNECTING) {
    return (
      <DarkCenter>
        <Spinner size="lg" className="text-sage-500" />
        <p className="text-stone-400 text-sm">Подключение к LiveKit...</p>
      </DarkCenter>
    )
  }

  if (status === STATUS.ERROR) {
    return (
      <DarkCenter>
        <p className="font-display text-2xl text-white/75">LiveKit-комната недоступна</p>
        <p className="font-body text-stone-400 text-sm text-center max-w-md">{errorMsg}</p>
        <button onClick={() => navigate(`/training/${trainingId}`)} className="btn-secondary mt-2">Назад</button>
      </DarkCenter>
    )
  }

  const gridCols = tiles.length <= 1 ? 'grid-cols-1'
    : tiles.length <= 4 ? 'grid-cols-2'
    : 'grid-cols-3'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-stone-950">
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900/80 border-b border-stone-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-body text-sm text-white/80 truncate max-w-[260px]">{training?.title || 'LiveKit-комната'}</span>
          <span className="badge bg-sage-500/20 text-sage-300 text-xs">LiveKit</span>
        </div>
        <span className="font-body text-xs text-stone-500">{room?.state || 'connected'}</span>
      </div>

      <div className="flex-1 min-h-0 p-3">
        <div className={`grid ${gridCols} gap-3 w-full h-full`}>
          {tiles.map((tile) => (
            <LiveKitTile key={tile.id} tile={tile} />
          ))}
        </div>
      </div>

      <RoomControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={leaveRoom}
        participantCount={tiles.length}
        trainingTitle={training?.title}
      />
    </div>
  )
}

function LiveKitTile({ tile }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center min-h-[180px]">
      {tile.cameraTrack && tile.videoEnabled ? (
        <TrackElement track={tile.cameraTrack} muted={tile.isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-800">
          <div className="w-16 h-16 rounded-full bg-stone-700 flex items-center justify-center font-display text-2xl text-stone-400">
            {tile.name?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {!tile.isLocal && tile.audioTrack && <TrackElement track={tile.audioTrack} audioOnly />}

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/65 to-transparent flex items-center justify-between">
        <span className="font-body text-xs text-white/90 truncate max-w-[75%]">
          {tile.name}{tile.isLocal ? ' (вы)' : ''}
        </span>
        <div className="flex items-center gap-1">
          {!tile.audioEnabled && <StatusDot label="mic" />}
          {!tile.videoEnabled && <StatusDot label="cam" />}
        </div>
      </div>
    </div>
  )
}

function TrackElement({ track, muted = false, audioOnly = false, className = '' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!track || !containerRef.current) return undefined

    const el = track.attach()
    el.autoplay = true
    el.playsInline = true
    el.muted = muted

    if (!audioOnly) {
      el.className = className
    } else {
      el.style.position = 'absolute'
      el.style.width = '1px'
      el.style.height = '1px'
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
    }

    containerRef.current.replaceChildren(el)

    return () => {
      track.detach(el)
      el.remove()
    }
  }, [audioOnly, className, muted, track])

  return <div ref={containerRef} className={audioOnly ? 'absolute w-px h-px overflow-hidden' : 'w-full h-full'} />
}

function StatusDot({ label }) {
  return (
    <span className="w-5 h-5 rounded-full bg-red-500/80 text-white text-[9px] flex items-center justify-center uppercase">
      {label === 'mic' ? 'M' : 'C'}
    </span>
  )
}

function DarkCenter({ children }) {
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-5 px-4">
      {children}
    </div>
  )
}

function safeJson(value) {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
