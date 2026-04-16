import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocket, disconnectSocket } from '../hooks/useSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { trainingsApi } from '../api/trainings'
import StudentRoom from '../components/room/StudentRoom'
import TrainerRoom from '../components/room/TrainerRoom'
import { Spinner } from '../components/ui'

const STATUS = {
  LOADING:    'loading',
  WAITING:    'waiting',
  CONNECTING: 'connecting',
  LIVE:       'live',
  ENDED:      'ended',
  ERROR:      'error',
}

export default function RoomPage() {
  const { id: trainingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { getSocket } = useSocket()

  const [status,       setStatus]       = useState(STATUS.LOADING)
  const [training,     setTraining]     = useState(null)
  const [isTrainer,    setIsTrainer]    = useState(false)
  const [participants, setParticipants] = useState([])
  const [iceServers,   setIceServers]   = useState(null)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [trainerInfo,  setTrainerInfo]  = useState(null)

  const socketRef    = useRef(null)
  const trainerUid   = useRef(null)
  const isTrainerRef = useRef(false)
  const webrtcRef    = useRef(null) // ссылка на актуальные webrtc функции

  const webrtc = useWebRTC({ socketRef, iceServers })

  // Всегда держим актуальную ссылку на webrtc
  webrtcRef.current = webrtc

  // ── 1. Загрузить тренировку ──────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await trainingsApi.get(trainingId)
        setTraining(data)
        setTrainerInfo(data.trainer)
        const trainer = data.trainer.id === user?.id
        setIsTrainer(trainer)
        isTrainerRef.current = trainer
        setStatus(STATUS.WAITING)
      } catch {
        setErrorMsg('Тренировка не найдена или нет доступа')
        setStatus(STATUS.ERROR)
      }
    }
    load()
  }, [trainingId, user])

  // ── 2. Медиа + сокет ────────────────────────────────
  useEffect(() => {
    if (status !== STATUS.WAITING) return

    const connect = async () => {
      const stream = await webrtcRef.current.startLocalStream()
      if (!stream) return

      setStatus(STATUS.CONNECTING)

      const socket = getSocket()
      socketRef.current = socket

      socket.on('room:joined', ({ participants: pts, iceServers: ice, isTrainer: trainer }) => {
        setIceServers(ice)
        setParticipants(pts)
        setIsTrainer(trainer)
        isTrainerRef.current = trainer
        setStatus(STATUS.LIVE)

        if (!trainer) {
          const trainerP = pts.find((p) => p.role === 'TRAINER')
          if (trainerP) {
            trainerUid.current = trainerP.id
            setTimeout(() => webrtcRef.current.callUser(trainerP.id), 1200)
          }
        }
      })

      socket.on('room:user-joined', (p) => {
        setParticipants((prev) => {
          if (prev.find((x) => x.id === p.userId)) return prev
          return [...prev, { id: p.userId, name: p.name, avatarUrl: p.avatarUrl, role: p.isTrainer ? 'TRAINER' : 'STUDENT' }]
        })
        // Ученик видит что тренер зашёл — звоним тренеру
        if (!isTrainerRef.current && p.isTrainer) {
          trainerUid.current = p.userId
          setTimeout(() => webrtcRef.current.callUser(p.userId), 1200)
        }
        // Тренер ждёт offer от ученика — не звоним
      })

      socket.on('room:user-left', ({ userId }) => {
        setParticipants((prev) => prev.filter((p) => p.id !== userId))
        webrtcRef.current.removePeer(userId)
      })

      socket.on('room:ended', () => {
        setStatus(STATUS.ENDED)
        webrtcRef.current.stopAll()
      })

      // WebRTC signaling — используем webrtcRef для актуальных функций
      socket.on('rtc:offer', ({ fromUserId, offer }) => {
        console.log('[Socket] rtc:offer from', fromUserId)
        webrtcRef.current.answerCall(fromUserId, offer)
      })

      socket.on('rtc:answer', ({ fromUserId, answer }) => {
        console.log('[Socket] rtc:answer from', fromUserId)
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
    }

    connect()
  }, [status])

  const handleLeave = useCallback(() => {
    socketRef.current?.emit('room:leave')
    webrtcRef.current.stopAll()
    disconnectSocket()
    navigate(`/training/${trainingId}`)
  }, [navigate, trainingId])

  const handleMuteUser = useCallback((targetUserId) => {
    socketRef.current?.emit('trainer:mute-user', { targetUserId })
  }, [])

  useEffect(() => {
    return () => {
      socketRef.current?.emit('room:leave')
      webrtcRef.current?.stopAll()
    }
  }, [])

  const trainerStream = trainerUid.current
    ? webrtc.remoteStreams[trainerUid.current]
    : Object.values(webrtc.remoteStreams)[0]

  // ── Render ────────────────────────────────────────────
  if (status === STATUS.ERROR) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-display text-2xl text-white/60">Ошибка</p>
        <p className="font-body text-stone-400 text-sm text-center">{errorMsg}</p>
        <button onClick={() => navigate(`/training/${trainingId}`)} className="btn-secondary mt-2">← Назад</button>
      </div>
    )
  }

  if (status === STATUS.ENDED) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-4xl">🧘</div>
        <p className="font-display text-2xl text-white/80">Тренировка завершена</p>
        <p className="font-body text-stone-400 text-sm">Спасибо за занятие!</p>
        <button onClick={() => navigate('/catalog')} className="btn-primary mt-2">На главную</button>
      </div>
    )
  }

  if (status === STATUS.LOADING || status === STATUS.CONNECTING) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-sage-500" />
        <p className="font-body text-stone-400 text-sm animate-pulse">
          {status === STATUS.LOADING ? 'Загрузка...' : 'Подключение к комнате...'}
        </p>
      </div>
    )
  }

  if (status === STATUS.WAITING) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-5xl">📷</div>
        <div className="text-center">
          <p className="font-display text-2xl text-white/80 mb-2">Разрешите доступ</p>
          <p className="font-body text-stone-400 text-sm max-w-xs">
            Нажмите «Разрешить» в запросе браузера для доступа к камере и микрофону
          </p>
        </div>
        {webrtc.mediaError && (
          <div className="bg-red-900/50 border border-red-800 rounded-2xl px-4 py-3 max-w-sm text-center">
            <p className="font-body text-red-300 text-sm">{webrtc.mediaError}</p>
            <button onClick={() => webrtc.startLocalStream()}
              className="mt-3 text-xs text-red-400 hover:text-red-300 underline">
              Попробовать снова
            </button>
          </div>
        )}
        <button onClick={() => navigate(`/training/${trainingId}`)} className="btn-ghost text-stone-500">
          Отмена
        </button>
      </div>
    )
  }

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
          onMuteUser={handleMuteUser}
          trainingTitle={training?.title}
          mediaError={webrtc.mediaError}
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
        />
      )}
    </div>
  )
}
