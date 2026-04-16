import { useEffect, useState, useRef } from 'react'
import { notificationsApi } from '../../api/users'
import { useAuthStore } from '../../store/authStore'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function NotificationsDropdown() {
  const { isAuthenticated } = useAuthStore()
  const [open,        setOpen]        = useState(false)
  const [items,       setItems]       = useState([])
  const [unread,      setUnread]      = useState(0)
  const [loading,     setLoading]     = useState(false)
  const dropdownRef = useRef(null)

  const load = async () => {
    if (!isAuthenticated()) return
    setLoading(true)
    try {
      const { data } = await notificationsApi.list({ limit: 20 })
      setItems(data.data || [])
      setUnread(data.unreadCount || 0)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    // Обновляем каждые 30 секунд
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Закрыть при клике вне
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = async () => {
    setOpen(v => !v)
    if (!open && unread > 0) {
      try {
        await notificationsApi.readAll()
        setUnread(0)
        setItems(prev => prev.map(n => ({ ...n, isRead: true })))
      } catch {}
    }
  }

  const ICONS = {
    REMINDER_1H:      '⏰',
    REMINDER_10M:     '🔔',
    TRAINING_START:   '🎯',
    SCHEDULE_CHANGE:  '📅',
    TRAINER_APPROVED: '🎉',
    TRAINER_REJECTED: '❌',
  }

  if (!isAuthenticated()) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-sand-100 transition-colors"
        title="Уведомления"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500
                           flex items-center justify-center text-[10px] font-body font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl
                        border border-sand-200 overflow-hidden z-50 animate-fade-up">
          <div className="px-4 py-3 border-b border-sand-100 flex items-center justify-between">
            <p className="font-body font-medium text-stone-700 text-sm">Уведомления</p>
            {items.some(n => !n.isRead) && (
              <button
                onClick={async () => {
                  await notificationsApi.readAll()
                  setUnread(0)
                  setItems(prev => prev.map(n => ({ ...n, isRead: true })))
                }}
                className="font-body text-xs text-sage-600 hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-1">🔔</p>
                <p className="font-body text-sm text-stone-400">Нет уведомлений</p>
              </div>
            ) : (
              items.map(n => (
                <div key={n.id}
                  className={`px-4 py-3 border-b border-sand-50 last:border-0 hover:bg-sand-50
                              transition-colors ${!n.isRead ? 'bg-sage-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">
                      {ICONS[n.type] || '📣'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-stone-700 leading-snug">
                        {n.title}
                      </p>
                      <p className="font-body text-xs text-stone-400 mt-0.5 leading-snug">
                        {n.body}
                      </p>
                      <p className="font-body text-[10px] text-stone-300 mt-1">
                        {format(new Date(n.sentAt), 'd MMM HH:mm', { locale: ru })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-sage-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-600">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
