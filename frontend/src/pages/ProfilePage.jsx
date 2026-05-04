import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuthStore } from '../store/authStore'
import { bookingsApi, paymentsApi } from '../api/bookings'
import { historyApi, usersApi } from '../api/users'
import { Input, Alert, Spinner } from '../components/ui'
import { BOOKING_STATUS, getBookingFlowStatus } from '../utils/bookingStatus'

const TABS = ['upcoming', 'history', 'settings']
const TAB_LABELS = { upcoming: 'Предстоящие', history: 'История', settings: 'Настройки' }

const DIRECTION_LABEL = { YOGA: 'Йога', PILATES: 'Пилатес' }
const LEVEL_LABEL = { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' }

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState('upcoming')
  const [pendingBooking, setPendingBooking] = useState(null)

  useEffect(() => {
    usersApi.pendingBooking()
      .then(({ data }) => setPendingBooking(data.booking))
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name}
              className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <span className="font-display text-2xl text-sage-600">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl text-stone-800">{user?.name}</h1>
          <p className="font-body text-sm text-stone-400">{user?.email || user?.phone}</p>
        </div>
      </div>

      {user?.trainerRequest && user?.role === 'STUDENT' && (
        <div className="card p-4 mb-6 bg-sage-50 border-sage-200">
          <p className="font-body text-xs text-sage-700 uppercase tracking-wider mb-1">Заявка тренера</p>
          <p className="font-body text-sm text-stone-600">
            Кабинет уже создан. После модерации здесь появится уведомление, а в шапке откроется создание тренировок.
          </p>
        </div>
      )}

      {/* Tabs */}
      {pendingBooking && <PendingPaymentBlock booking={pendingBooking} />}

      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
              tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'upcoming'  && <UpcomingTab />}
      {tab === 'history'   && <HistoryTab />}
      {tab === 'settings'  && <SettingsTab />}
    </div>
  )
}

function PendingPaymentBlock({ booking }) {
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt) : null
  const seconds = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000)) : null

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const pay = async () => {
    const paymentId = booking.payment?.id || booking.payment?.paymentId
    if (!paymentId) return
    setLoading(true)
    try {
      const { data } = await paymentsApi.createLink(paymentId)
      window.location.href = data.confirmationUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 mb-6 bg-sage-50 border-sage-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs text-sage-700 uppercase tracking-wider mb-1">Ожидает оплаты</p>
          <p className="font-body font-medium text-stone-800">{booking.training.title}</p>
          <p className="font-body text-xs text-stone-500 mt-1">
            {expiresAt ? `Место держим ещё ${formatCountdown(seconds)} · оплатить до ${format(expiresAt, 'HH:mm')}` : 'Место временно забронировано'}
          </p>
        </div>
        <button onClick={pay} className="btn-primary justify-center" disabled={loading}>
          {loading ? <Spinner size="sm" className="text-white" /> : 'Оплатить'}
        </button>
      </div>
    </div>
  )
}

// ── Предстоящие тренировки ────────────────────────────
function UpcomingTab() {
  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    bookingsApi.my().then(({ data }) => {
      const upcoming = data.filter((b) => {
        const status = getBookingFlowStatus(b)
        return [BOOKING_STATUS.BOOKED, BOOKING_STATUS.CAN_JOIN, BOOKING_STATUS.LIVE].includes(status)
      })
      setBookings(upcoming)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!bookings.length) return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">🧘</p>
      <p className="font-display text-xl text-stone-500">Нет предстоящих тренировок</p>
      <Link to="/catalog" className="btn-primary mt-4 inline-flex">Найти тренировку</Link>
    </div>
  )

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} showJoin />
      ))}
    </div>
  )
}

// ── История ───────────────────────────────────────────
function HistoryTab() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    historyApi.list({ page, limit: 10 }).then(({ data }) => {
      setItems(data.data)
      setTotal(data.total)
    }).finally(() => setLoading(false))
  }, [page])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!items.length) return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">📋</p>
      <p className="font-display text-xl text-stone-500">История пуста</p>
      <p className="font-body text-sm text-stone-400 mt-1">Завершённые тренировки появятся здесь</p>
    </div>
  )

  const totalPages = Math.ceil(total / 10)

  return (
    <div>
      <p className="font-body text-xs text-stone-400 mb-4">{total} тренировок</p>
      <div className="space-y-3">
        {items.map((b) => <BookingCard key={b.id} booking={b} />)}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">←</button>
          <span className="font-body text-sm text-stone-500 py-1.5">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  )
}

// ── Настройки ─────────────────────────────────────────
function SettingsTab() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [form,    setForm]    = useState({ name: user?.name || '', email: user?.email || '' })
  const [pwForm,  setPwForm]  = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error,   setError]   = useState(null)
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(null)

  const handleProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await usersApi.updateMe({ name: form.name, email: form.email })
      setSuccess('Профиль обновлён')
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('Пароли не совпадают')
      return
    }
    setPwLoading(true)
    setPwError(null)
    setPwSuccess(null)
    try {
      await usersApi.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      })
      setPwSuccess('Пароль изменён')
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      setPwError(err.response?.data?.error || 'Ошибка смены пароля')
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      {/* Profile form */}
      <div className="card p-6">
        <h3 className="font-display text-lg text-stone-700 mb-4">Личные данные</h3>
        {success && <Alert type="success" className="mb-4">{success}</Alert>}
        {error   && <Alert type="error"   className="mb-4">{error}</Alert>}
        <form onSubmit={handleProfile} className="space-y-4">
          <Input label="Имя" value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Сохранить'}
          </button>
        </form>
      </div>

      {/* Password form */}
      {user?.email && (
        <div className="card p-6">
          <h3 className="font-display text-lg text-stone-700 mb-4">Сменить пароль</h3>
          {pwSuccess && <Alert type="success" className="mb-4">{pwSuccess}</Alert>}
          {pwError   && <Alert type="error"   className="mb-4">{pwError}</Alert>}
          <form onSubmit={handlePassword} className="space-y-4">
            <Input label="Текущий пароль" type="password"
              value={pwForm.oldPassword}
              onChange={(e) => setPwForm(f => ({ ...f, oldPassword: e.target.value }))} />
            <Input label="Новый пароль" type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
            <Input label="Повторите пароль" type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            <button type="submit" className="btn-primary" disabled={pwLoading}>
              {pwLoading ? <Spinner size="sm" className="text-white" /> : 'Изменить пароль'}
            </button>
          </form>
        </div>
      )}

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full py-3 rounded-2xl border border-red-200 text-red-500
                   font-body text-sm hover:bg-red-50 transition-colors">
        Выйти из аккаунта
      </button>
    </div>
  )
}

// ── Booking card ──────────────────────────────────────
function BookingCard({ booking, showJoin }) {
  const { training } = booking
  const startDate = new Date(training.startAt)
  const isLive = training.status === 'LIVE'
  const isScheduled = training.status === 'SCHEDULED'
  const flowStatus = getBookingFlowStatus(booking)
  const canEnterRoom = flowStatus === BOOKING_STATUS.LIVE || flowStatus === BOOKING_STATUS.CAN_JOIN
  const statusText = {
    [BOOKING_STATUS.BOOKED]: 'Записан',
    [BOOKING_STATUS.CAN_JOIN]: 'Можно войти',
    [BOOKING_STATUS.LIVE]: 'Идёт сейчас',
    [BOOKING_STATUS.FINISHED]: 'Завершено',
    [BOOKING_STATUS.CANCELLED]: 'Отменено',
  }[flowStatus]

  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Date block */}
      <div className="shrink-0 w-12 text-center">
        <p className="font-display text-2xl text-stone-800 leading-none">
          {format(startDate, 'd')}
        </p>
        <p className="font-body text-xs text-stone-400 uppercase">
          {format(startDate, 'MMM', { locale: ru })}
        </p>
      </div>

      <div className="w-px h-10 bg-sand-200 shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-body font-medium text-stone-700 truncate">{training.title}</p>
          {statusText && (
            <span className={`badge shrink-0 ${
              flowStatus === BOOKING_STATUS.LIVE || flowStatus === BOOKING_STATUS.CAN_JOIN
                ? 'bg-sage-100 text-sage-700'
                : 'bg-stone-100 text-stone-500'
            }`}>
              {statusText}
            </span>
          )}
        </div>
        <p className="font-body text-xs text-stone-400 mt-0.5 flex items-center gap-2">
          <span>{format(startDate, 'HH:mm')}</span>
          <span>·</span>
          <span>{training.durationMin} мин</span>
          <span>·</span>
          <span>{DIRECTION_LABEL[training.direction]}</span>
        </p>
        <p className="font-body text-xs text-stone-400 mt-0.5">
          {training.trainer?.name}
        </p>
      </div>

      {/* Action */}
      {showJoin && (isLive || isScheduled) && canEnterRoom && (
        <Link to={`/room/${training.id}`}
          className={`btn-primary py-2 text-xs shrink-0 ${isLive ? 'bg-red-500 hover:bg-red-600' : ''}`}>
          {isLive ? '🔴 Войти' : '▶ Войти'}
        </Link>
      )}

      {showJoin && flowStatus === BOOKING_STATUS.BOOKED && (
        <button disabled className="btn-secondary py-2 text-xs shrink-0 opacity-50">
          Вход за 5 мин
        </button>
      )}

      {!showJoin && (
        <span className="badge bg-stone-100 text-stone-500 shrink-0">
          {LEVEL_LABEL[training.level]}
        </span>
      )}
    </div>
  )
}

function formatCountdown(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
