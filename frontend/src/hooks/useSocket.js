import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

let socketInstance = null

export const useSocket = () => {
  const { token } = useAuthStore()
  const socketRef = useRef(null)

  const getSocket = useCallback(() => {
    if (socketInstance?.connected) return socketInstance

    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id)
    })
    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] Error:', err.message)
    })
    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    socketRef.current = socketInstance
    return socketInstance
  }, [token])

  useEffect(() => {
    return () => {
      // Не закрываем глобальный инстанс при размонтировании хука
    }
  }, [])

  return { getSocket }
}

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
