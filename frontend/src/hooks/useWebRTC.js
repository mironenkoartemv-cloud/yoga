import { useRef, useState, useCallback, useEffect } from 'react'

export const useWebRTC = ({ socketRef, iceServers }) => {
  const localStreamRef  = useRef(null)
  const peersRef        = useRef({})
  const iceServersRef   = useRef(iceServers)

  const [localStream,   setLocalStream]  = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [audioEnabled,  setAudioEnabled] = useState(true)
  const [videoEnabled,  setVideoEnabled] = useState(true)
  const [mediaError,    setMediaError]   = useState(null)

  useEffect(() => {
    if (iceServers) iceServersRef.current = iceServers
  }, [iceServers])

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch (err) {
      const msg = err.name === 'NotAllowedError' ? 'Нет доступа к камере/микрофону. Разрешите доступ в браузере.'
        : err.name === 'NotFoundError' ? 'Камера или микрофон не найдены.'
        : `Ошибка медиа: ${err.message}`
      setMediaError(msg)
      return null
    }
  }, [])

  const createPeer = useCallback((targetUserId) => {
    if (peersRef.current[targetUserId]) {
      peersRef.current[targetUserId].close()
      delete peersRef.current[targetUserId]
    }
    const config = { iceServers: iceServersRef.current || [{ urls: 'stun:stun.l.google.com:19302' }] }
    const pc = new RTCPeerConnection(config)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      console.log('[WebRTC] ontrack from', targetUserId, remoteStream.getTracks().map(t=>t.kind))
      setRemoteStreams((prev) => ({ ...prev, [targetUserId]: remoteStream }))
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef?.current) {
        socketRef.current.emit('rtc:ice-candidate', { targetUserId, candidate: event.candidate })
      }
    }

    pc.onconnectionstatechange = () => console.log(`[WebRTC] ${targetUserId}: ${pc.connectionState}`)
    pc.oniceconnectionstatechange = () => console.log(`[WebRTC] ICE ${targetUserId}: ${pc.iceConnectionState}`)

    peersRef.current[targetUserId] = pc
    return pc
  }, [socketRef])

  const callUser = useCallback(async (targetUserId) => {
    console.log('[WebRTC] callUser ->', targetUserId)
    const pc = createPeer(targetUserId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socketRef?.current?.emit('rtc:offer', { targetUserId, offer })
  }, [createPeer, socketRef])

  const answerCall = useCallback(async (fromUserId, offer) => {
    console.log('[WebRTC] answerCall from', fromUserId)
    const pc = createPeer(fromUserId)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socketRef?.current?.emit('rtc:answer', { targetUserId: fromUserId, answer })
  }, [createPeer, socketRef])

  const handleAnswer = useCallback(async (fromUserId, answer) => {
    console.log('[WebRTC] handleAnswer from', fromUserId)
    const pc = peersRef.current[fromUserId]
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }, [])

  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    const pc = peersRef.current[fromUserId]
    if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {} }
  }, [])

  const removePeer = useCallback((userId) => {
    const pc = peersRef.current[userId]
    if (pc) { pc.close(); delete peersRef.current[userId] }
    setRemoteStreams((prev) => { const n = { ...prev }; delete n[userId]; return n })
  }, [])

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
    const enabled = stream.getAudioTracks()[0]?.enabled ?? false
    setAudioEnabled(enabled)
    socketRef?.current?.emit('media:toggle', { kind: 'audio', enabled })
  }, [socketRef])

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
    const enabled = stream.getVideoTracks()[0]?.enabled ?? false
    setVideoEnabled(enabled)
    socketRef?.current?.emit('media:toggle', { kind: 'video', enabled })
  }, [socketRef])

  const forceMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => { t.enabled = false })
    setAudioEnabled(false)
  }, [])

  const stopAll = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    Object.values(peersRef.current).forEach((pc) => pc.close())
    peersRef.current = {}
    setLocalStream(null)
    setRemoteStreams({})
  }, [])

  return {
    localStream, remoteStreams, audioEnabled, videoEnabled, mediaError,
    startLocalStream, callUser, answerCall, handleAnswer, handleIceCandidate,
    removePeer, toggleAudio, toggleVideo, forceMute, stopAll,
  }
}
