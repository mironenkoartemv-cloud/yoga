import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuthStore } from '../store/authStore'
import { useSocket, disconnectSocket } from '../hooks/useSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { roomsApi } from '../api/rooms'
import StudentRoom from '../components/room/StudentRoom'
import TrainerRoom from '../components/room/TrainerRoom'
import VideoTile from '../components/room/VideoTile'
import { Spinner } from '../components/ui'

const STATUS = {
  LOADING: 'loading',
  LOCKED: 'locked',
  TRAINER_PREP: 'trainer_prep',
  STUDENT_WAITING: 'student_waiting',
  CONNECTING: 'connecting',
  LIVE: 'live',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  ERROR: 'error',
}

export default function RoomPage() {
  const { id: trainingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { getSocket } = useSocket()

  const [status, setStatus] = useState(STATUS.LOADING)
  const [training, setTraining] = useState(null)
  const [roomWindow, setRoomWindow] = useState(null)
  const [isTrainer, setIsTrainer] = useState(false)
  const [participants, setParticipants] = useState([])
  const [iceServers, setIceServers] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [trainerInfo, setTrainerInfo] = useState(null)
  const [roomMessage, setRoomMessage] = useState('')
  const [reconnectUntil, setReconnectUntil] = useState(null)

  const socketRef = useRef(null)
  const trainerUid = useRef(null)
  const isTrainerRef = useRef(false)
  const webrtcRef = useRef(null)
  const joinedRef = useRef(false)
  const statusRef = useRef(status)

  const webrtc = useWebRTC({ socketRef, iceServers })
  webrtcRef.current = webrtc
  statusRef.current = status

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await roomsApi.state(trainingId)
        setTraining(data.training)
        setTrainerInfo(data.training.trainer)
        setRoomWindow(data.window)
        setIsTrainer(data.isTrainer)
        isTrainerRef.current = data.isTrainer

        if (!data.canJoin) {
          setErrorMsg(data.reason)
          setStatus(STATUS.LOCKED)
          return
        }

        if (data.isTrainer) {
          setStatus(STATUS.CONNECTING)
          await webrtcRef.current.startLocalStream()
          connectSocket()
          setStatus(data.room?.status === 'LIVE' || data.training.status === 'LIVE' ? STATUS.LIVE : STATUS.TRAINER_PREP)
        } else {
          setStatus(data.room?.status === 'LIVE' || data.training.status === 'LIVE' ? STATUS.CONNECTING : STATUS.STUDENT_WAITING)
          connectSocket()
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.error || 'Тренировка не найдена или нет доступа')
        setStatus(STATUS.ERROR)
      }
    }

    load()
    return () => {
      socketRef.current?.emit('room:leave')
      webrtcRef.current?.stopAll()
    }
  }, [trainingId])

  const connectSocket = useCallback(() => {
    if (joinedRef.current) return
    joinedRef.current = true

    const socket = getSocket()
    socketRef.current = socket

    socket.on('room:joined', ({ participants: pts, iceServers: ice, isTrainer: trainer, window }) => {
      setIceServers(ice)
      setParticipants(pts)
      setIsTrainer(trainer)
      isTrainerRef.current = trainer
      setRoomWindow(window)

      const trainerP = pts.find((p) => p.role === 'TRAINER')
      if (trainerP) trainerUid.current = trainerP.id
    })

    socket.on('room:started', async () => {
      setRoomMessage('')
      setReconnectUntil(null)
      setStatus(STATUS.LIVE)

      if (!isTrainerRef.current && !webrtcRef.current.localStream) {
        await webrtcRef.current.startLocalStream()
      }

      if (!isTrainerRef.current && trainerUid.current) {
        setTimeout(() => webrtcRef.current.callUser(trainerUid.current), 900)
      }
    })

    socket.on('room:cancelled', ({ message }) => {
      setRoomMessage(message)
      setStatus(STATUS.CANCELLED)
      webrtcRef.current.stopAll()
    })

    socket.on('room:ended', ({ message }) => {
      setRoomMessage(message || 'Тренировка завершена')
      setStatus(STATUS.ENDED)
      webrtcRef.current.stopAll()
    })

    socket.on('room:user-joined', (p) => {
      setParticipants((prev) => {
        if (prev.find((x) => x.id === p.userId)) return prev
        return [...prev, { id: p.userId, name: p.name, avatarUrl: p.avatarUrl, role: p.isTrainer ? 'TRAINER' : 'STUDENT' }]
      })
      if (p.isTrainer) {
        trainerUid.current = p.userId
        setReconnectUntil(null)
        if (!isTrainerRef.current && statusRef.current === STATUS.LIVE) {
          setTimeout(() => webrtcRef.current.callUser(p.userId), 900)
        }
      }
    })

    socket.on('room:user-left', ({ userId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== userId))
      webrtcRef.current.removePeer(userId)
    })

    socket.on('trainer:reconnecting', ({ timeoutSec }) => {
      setReconnectUntil(Date.now() + timeoutSec * 1000)
    })

    socket.on('trainer:reconnected', () => {
      setReconnectUntil(null)
      if (!isTrainerRef.current && trainerUid.current && statusRef.current === STATUS.LIVE) {
        setTimeout(() => webrtcRef.current.callUser(trainerUid.current), 900)
      }
    })

    socket.on('rtc:offer', ({ fromUserId, offer }) => {
      webrtcRef.current.answerCall(fromUserId, offer)
    })

    socket.on('rtc:answer', ({ fromUserId, answer }) => {
      webrtcRef.current.handleAnswer(fromUserId, answer)
    })

    socket.on('rtc:ice-candidate', ({ fromUserId, candidate }) => {
      webrtcRef.current.handleIceCandidate(fromUserId, candidate)
    })

    socket.on('media:user-toggle', ({ userId, kind, enabled }) => {
      setParticipants((prev) => prev.map((p) =>
        p.id === userId ? { ...p, [`${kind}Enabled`]: enabled } : p
      ))
    })

    socket.on('trainer:force-mute', () => {
      webrtcRef.current.forceMute()
    })

    socket.on('error', ({ message }) => {
      setErrorMsg(message)
      setStatus(STATUS.ERROR)
    })

    socket.emit('room:join', { trainingId })
  }, [getSocket, status, trainingId])

  const handleLeave = useCallback(() => {
    socketRef.current?.emit('room:leave')
    webrtcRef.current.stopAll()
    disconnectSocket()
    navigate(`/training/${trainingId}`)
  }, [navigate, trainingId])

  const handleStart = useCallback(() => {
    socketRef.current?.emit('room:start')
  }, [])

  const handleEnd = useCallback(() => {
    if (!confirm('Завершить тренировку для всех участников?')) return
    socketRef.current?.emit('room:end')
  }, [])

  const handleMuteUser = useCallback((targetUserId) => {
    socketRef.current?.emit('trainer:mute-user', { targetUserId })
  }, [])

  const trainerStream = trainerUid.current
    ? webrtc.remoteStreams[trainerUid.current]
    : Object.values(webrtc.remoteStreams)[0]

  if (status === STATUS.LOADING || status === STATUS.CONNECTING) {
    return <DarkCenter><Spinner size="lg" className="text-sage-500" /><p className="text-stone-400 text-sm">Подключение...</p></DarkCenter>
  }

  if (status === STATUS.ERROR || status === STATUS.LOCKED) {
    return (
      <DarkCenter>
        <p className="font-display text-2xl text-white/70">{status === STATUS.LOCKED ? 'Комната пока закрыта' : 'Ошибка'}</p>
        <p className="font-body text-stone-400 text-sm text-center max-w-sm">{errorMsg}</p>
        <button onClick={() => navigate(`/training/${trainingId}`)} className="btn-secondary mt-2">Назад</button>
      </DarkCenter>
    )
  }

  if (status === STATUS.CANCELLED) {
    return (
      <OutcomeScreen
        title="Тренировка не началась"
        message={roomMessage}
        primary={<Link to="/catalog" className="btn-primary justify-center">Выбрать тренировку</Link>}
      />
    )
  }

  if (status === STATUS.ENDED) {
    return (
      <OutcomeScreen
        title="Тренировка завершена"
        message={roomMessage || 'Для поддержания формы запишитесь на следующее занятие.'}
        primary={<Link to="/catalog" className="btn-primary justify-center">Записаться на занятие</Link>}
      />
    )
  }

  if (status === STATUS.STUDENT_WAITING) {
    return (
      <WaitingRoom
        title={training?.title}
        window={roomWindow}
        message="Вы в зале ожидания. Видео начнётся, когда тренер запустит тренировку."
        onLeave={handleLeave}
      />
    )
  }

  if (status === STATUS.TRAINER_PREP) {
    return (
      <TrainerPrep
        training={training}
        roomWindow={roomWindow}
        localStream={webrtc.localStream}
        audioEnabled={webrtc.audioEnabled}
        videoEnabled={webrtc.videoEnabled}
        onToggleAudio={webrtc.toggleAudio}
        onToggleVideo={webrtc.toggleVideo}
        onStart={handleStart}
        onLeave={handleLeave}
        mediaError={webrtc.mediaError}
      />
    )
  }

  const reconnectBanner = reconnectUntil ? <ReconnectBanner until={reconnectUntil} /> : null

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {isTrainer ? (
        <TrainerRoom
          localStream={webrtc.localStream}
          remoteStreams={webrtc.remoteStreams}
          participants={participants}
          localUser={user}
          audioEnabled={webrtc.audioEnabled}
          videoEnabled={webrtc.videoEnabled}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onLeave={handleLeave}
          onEnd={handleEnd}
          onMuteUser={handleMuteUser}
          trainingTitle={training?.title}
          mediaError={webrtc.mediaError}
          banner={reconnectBanner}
        />
      ) : (
        <StudentRoom
          localStream={webrtc.localStream}
          trainerStream={trainerStream}
          trainer={trainerInfo}
          localUser={user}
          audioEnabled={webrtc.audioEnabled}
          videoEnabled={webrtc.videoEnabled}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onLeave={handleLeave}
          trainingTitle={training?.title}
          participantCount={participants.length}
          mediaError={webrtc.mediaError}
          banner={reconnectBanner}
        />
      )}
    </div>
  )
}

function TrainerPrep({ training, roomWindow, localStream, audioEnabled, videoEnabled, onToggleAudio, onToggleVideo, onStart, onLeave, mediaError }) {
  const now = useNow()
  const startAt = roomWindow?.startAt ? new Date(roomWindow.startAt) : new Date(training.startAt)
  const deadlineAt = roomWindow?.startDeadlineAt ? new Date(roomWindow.startDeadlineAt) : new Date(startAt.getTime() + 5 * 60 * 1000)
  const canStart = now >= startAt && now <= deadlineAt
  const tooEarly = now < startAt

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      <div className="px-4 py-3 bg-stone-900/80 border-b border-stone-800 flex items-center justify-between">
        <p className="font-body text-sm text-white/80 truncate">{training.title}</p>
        <button onClick={onLeave} className="btn-ghost text-stone-400">Выйти</button>
      </div>
      <div className="flex-1 grid lg:grid-cols-[1fr_360px] gap-4 p-4 min-h-0">
        <div className="min-h-[320px] rounded-3xl overflow-hidden bg-stone-900">
          {localStream ? (
            <VideoTile stream={localStream} label="Вы" isLocal muted audioEnabled={audioEnabled} videoEnabled={videoEnabled} className="w-full h-full rounded-none" />
          ) : (
            <div className="h-full flex items-center justify-center text-stone-500">Проверяем камеру...</div>
          )}
        </div>
        <div className="rounded-3xl bg-stone-900 border border-stone-800 p-5 flex flex-col justify-between gap-5">
          <div>
            <p className="font-display text-2xl text-white/80 mb-2">Подготовка</p>
            <p className="font-body text-sm text-stone-400">
              Проверьте звук, видео и камеру. Начать занятие можно после планового времени старта.
            </p>
            {mediaError && <p className="mt-4 text-sm text-red-300 bg-red-900/40 rounded-2xl p-3">{mediaError}</p>}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onToggleAudio} className="btn-secondary justify-center">{audioEnabled ? 'Микрофон вкл.' : 'Микрофон выкл.'}</button>
              <button onClick={onToggleVideo} className="btn-secondary justify-center">{videoEnabled ? 'Камера вкл.' : 'Камера выкл.'}</button>
            </div>
            <button onClick={onStart} disabled={!canStart} className="btn-primary w-full justify-center disabled:opacity-40">
              {tooEarly ? `Начать можно через ${formatDistanceToNowStrict(startAt, { locale: ru })}` : 'Начать тренировку'}
            </button>
            {!tooEarly && !canStart && (
              <p className="font-body text-xs text-red-300 text-center">Окно старта истекло. Тренировка будет отменена.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function WaitingRoom({ title, window, message, onLeave }) {
  const now = useNow()
  const startAt = window?.startAt ? new Date(window.startAt) : null
  const deadlineAt = window?.startDeadlineAt ? new Date(window.startDeadlineAt) : null
  const waitingForTrainer = startAt && now >= startAt
  const target = waitingForTrainer ? deadlineAt : startAt

  return (
    <DarkCenter>
      <p className="font-body text-xs text-sage-400 uppercase tracking-widest">Зал ожидания</p>
      <h1 className="font-display text-3xl text-white/85 text-center">{title}</h1>
      <p className="font-body text-stone-400 text-center max-w-md">
        {waitingForTrainer
          ? target
            ? `Тренировка вот-вот начнется. Тренер уже спешит и подключится в течение ${formatDistanceToNowStrict(target, { locale: ru })}.`
            : 'Тренировка вот-вот начнется. Тренер уже спешит подключиться.'
          : message}
      </p>
      {target && (
        <div className="rounded-3xl bg-stone-900 border border-stone-800 px-6 py-4 text-center">
          <p className="font-body text-xs text-stone-500 mb-1">{waitingForTrainer ? 'Тренер подключится в течение' : 'До начала'}</p>
          <p className="font-display text-3xl text-white/80">{formatDistanceToNowStrict(target, { locale: ru })}</p>
        </div>
      )}
      <button onClick={onLeave} className="btn-ghost text-stone-400">Выйти</button>
    </DarkCenter>
  )
}

function ReconnectBanner({ until }) {
  const now = useNow()
  const remaining = Math.max(0, Math.ceil((until - now.getTime()) / 1000))
  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-32px)]">
      <div className="bg-amber-500/95 text-stone-950 rounded-2xl px-4 py-3 text-sm font-body text-center shadow-xl">
        У тренера проблемы со связью. Ждём переподключения: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </div>
    </div>
  )
}

function OutcomeScreen({ title, message, primary }) {
  return (
    <DarkCenter>
      <p className="font-display text-3xl text-white/85 text-center">{title}</p>
      <p className="font-body text-stone-400 text-center max-w-md">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3">{primary}<Link to="/profile" className="btn-secondary justify-center">В профиль</Link></div>
    </DarkCenter>
  )
}

function DarkCenter({ children }) {
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-5 px-4">
      {children}
    </div>
  )
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}
