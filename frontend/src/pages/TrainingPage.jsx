import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { trainingsApi } from '../api/trainings'
import { bookingsApi, paymentsApi } from '../api/bookings'
import { useAuthStore } from '../store/authStore'
import { Spinner, Alert } from '../components/ui'

const DIRECTION_LABEL = { YOGA: 'Йога', PILATES: 'Пилатес' }
const LEVEL_LABEL = { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' }
const DIRECTION_COLOR = { YOGA: 'bg-sage-100 text-sage-700', PILATES: 'bg-sand-100 text-sand-700' }

export default function TrainingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [training,     setTraining]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [bookingState, setBookingState] = useState('idle') // idle | booking | paying | done | error
  const [myBooking,    setMyBooking]    = useState(null)
  const [myPayment,    setMyPayment]    = useState(null)
  const [error,        setError]        = useState(null)
  const [payMsg,       setPayMsg]       = useState(null)

  useEffect(() => {
    loadTraining()
    if (isAuthenticated()) loadMyBooking()
  }, [id])

  const loadTraining = async () => {
    try {
      setLoading(true)
      const { data } = await trainingsApi.get(id)
      setTraining(data)
    } catch {
      setError('Тренировка не найдена')
    } finally {
      setLoading(false)
    }
  }

  const loadMyBooking = async () => {
    try {
      const { data } = await bookingsApi.my()
      const booking = data.find((b) => b.trainingId === id)
      if (booking) {
        setMyBooking(booking)
        setMyPayment(booking.payment)
        if (booking.status === 'CONFIRMED') setBookingState('done')
        else if (booking.status === 'PENDING') setBookingState('paying')
      }
    } catch {}
  }

  // Шаг 1: записаться → получить booking + payment
  const handleBook = async () => {
    if (!isAuthenticated()) return navigate('/login', { state: { from: { pathname: `/training/${id}` } } })
    setError(null)
    setBookingState('booking')
    try {
      const { data } = await bookingsApi.create(id)
      setMyBooking(data.booking)
      if (data.payment) {
        setMyPayment(data.payment)
        setBookingState('paying')
      } else {
        // Бесплатная тренировка
        setBookingState('done')
        loadTraining()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось записаться')
      setBookingState('idle')
    }
  }

  // Шаг 2: "оплатить" через stub
  const handleStubPay = async () => {
    if (!myPayment) return
    setBookingState('booking')
    setError(null)
    try {
      await paymentsApi.stubConfirm(myPayment.paymentId || myPayment.id)
      setBookingState('done')
      setPayMsg('Оплата прошла успешно!')
      loadTraining()
      loadMyBooking()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка оплаты')
      setBookingState('paying')
    }
  }

  const handleCancel = async () => {
    if (!myBooking) return
    if (!confirm('Отменить запись?')) return
    try {
      await bookingsApi.cancel(myBooking.id)
      setMyBooking(null)
      setMyPayment(null)
      setBookingState('idle')
      setPayMsg(null)
      loadTraining()
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось отменить')
    }
  }

  // ── Loading ──
  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-20 flex justify-center">
      <Spinner size="lg" />
    </div>
  )

  if (error && !training) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="font-display text-2xl text-stone-400">{error}</p>
      <Link to="/catalog" className="btn-secondary mt-6 inline-flex">← Назад</Link>
    </div>
  )

  const startDate   = new Date(training.startAt)
  const isFull      = training.availableSlots <= 0
  const isFree      = training.price === 0
  const isPast      = startDate < new Date()
  const isOwner     = user?.id === training.trainerId || user?.id === training.trainer?.id
  const minutesUntil = Math.floor((startDate - Date.now()) / (1000 * 60))
  const canStart    = minutesUntil <= 15
  const canJoin     = bookingState === 'done' && (training.status === 'LIVE' || training.status === 'SCHEDULED')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

      {/* Back */}
      <Link to="/catalog" className="inline-flex items-center gap-1.5 text-sm font-body
                                     text-stone-400 hover:text-stone-600 transition-colors mb-6">
        <span>←</span> Расписание
      </Link>

      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`badge ${DIRECTION_COLOR[training.direction]}`}>
            {DIRECTION_LABEL[training.direction]}
          </span>
          <span className="badge bg-stone-100 text-stone-500">
            {LEVEL_LABEL[training.level]}
          </span>
          {training.status === 'LIVE' && (
            <span className="badge bg-red-100 text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1 animate-pulse" />
              Идёт сейчас
            </span>
          )}
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-medium text-stone-800 mb-2">
          {training.title}
        </h1>

        {training.description && (
          <p className="font-body text-stone-500 leading-relaxed mb-6">{training.description}</p>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <InfoCard icon="📅" label="Дата"
          value={format(startDate, 'd MMMM', { locale: ru })} />
        <InfoCard icon="🕐" label="Время"
          value={format(startDate, 'HH:mm')} />
        <InfoCard icon="⏱" label="Длительность"
          value={`${training.durationMin} мин`} />
        <InfoCard icon="👥" label="Места"
          value={isFull ? 'Мест нет' : `${training.availableSlots} из ${training.maxSlots}`}
          highlight={isFull} />
      </div>

      {/* Trainer */}
      <div className="card p-4 flex items-center gap-3 mb-6">
        {training.trainer.avatarUrl ? (
          <img src={training.trainer.avatarUrl} alt={training.trainer.name}
            className="w-12 h-12 rounded-2xl object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-sage-200 flex items-center justify-center
                          font-display text-xl text-sage-700">
            {training.trainer.name[0]}
          </div>
        )}
        <div>
          <p className="font-body text-xs text-stone-400 uppercase tracking-wider">Тренер</p>
          <p className="font-body font-medium text-stone-700">{training.trainer.name}</p>
        </div>
      </div>

      {/* Slots progress */}
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs font-body text-stone-400">
          <span>{training.bookedSlots} из {training.maxSlots} мест занято</span>
          <span>{Math.round((training.bookedSlots / training.maxSlots) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-sand-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isFull ? 'bg-red-400' : training.bookedSlots / training.maxSlots > 0.7 ? 'bg-amber-400' : 'bg-sage-400'
            }`}
            style={{ width: `${Math.min((training.bookedSlots / training.maxSlots) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Error / success */}
      {error  && <Alert type="error"   className="mb-4">{error}</Alert>}
      {payMsg && <Alert type="success" className="mb-4">{payMsg}</Alert>}

      {/* CTA block */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-body text-xs text-stone-400 uppercase tracking-wider">Стоимость</p>
            <p className="font-display text-3xl font-medium text-stone-800">
              {isFree ? 'Бесплатно' : `${(training.price / 100).toLocaleString('ru-RU')} ₽`}
            </p>
          </div>

          {/* Status badge */}
          {bookingState === 'done' && (
            <span className="badge bg-sage-100 text-sage-700 text-sm px-3 py-1.5">
              ✓ Вы записаны
            </span>
          )}
        </div>

        {/* Action buttons */}
        {isOwner ? (
          <div className="space-y-2">
            <p className="font-body text-sm text-stone-400 mb-3">Это ваша тренировка</p>
            {(training.status === 'SCHEDULED' || training.status === 'LIVE') && (
              canStart ? (
                <Link to={`/room/${id}`} className={`btn-primary w-full justify-center ${
                  training.status === 'LIVE' ? 'bg-red-500 hover:bg-red-600' : ''
                }`}>
                  {training.status === 'LIVE' ? '🔴 Войти в комнату' : '▶ Начать тренировку'}
                </Link>
              ) : (
                <div className="bg-sand-50 rounded-2xl p-4 text-center">
                  <p className="font-body text-sm text-stone-500">
                    Тренировка начнётся {format(startDate, 'd MMMM в HH:mm', { locale: ru })}
                  </p>
                  <p className="font-body text-xs text-stone-400 mt-1">
                    Кнопка «Начать» появится за 15 минут до старта
                  </p>
                </div>
              )
            )}
            {training.status === 'FINISHED' && (
              <p className="font-body text-sm text-stone-400 text-center py-2">
                Тренировка завершена
              </p>
            )}
          </div>

        ) : isPast && bookingState !== 'done' ? (
          <p className="font-body text-sm text-stone-400 text-center py-2">
            Тренировка уже завершена
          </p>

        ) : training.status === 'CANCELLED' ? (
          <p className="font-body text-sm text-red-400 text-center py-2">
            Тренировка отменена
          </p>

        ) : bookingState === 'idle' ? (
          <button
            onClick={handleBook}
            disabled={isFull}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {isFull ? 'Мест нет' : isFree ? 'Записаться бесплатно' : 'Записаться'}
          </button>

        ) : bookingState === 'booking' ? (
          <button disabled className="btn-primary w-full justify-center">
            <Spinner size="sm" className="text-white" />
          </button>

        ) : bookingState === 'paying' ? (
          <div className="space-y-3">
            <div className="bg-sand-50 rounded-2xl p-4 text-center">
              <p className="font-body text-sm text-stone-600 mb-1">Оплата банковской картой</p>
              <p className="font-body text-xs text-stone-400">
                В реальном приложении откроется платежная форма Т-Банка
              </p>
            </div>
            <button onClick={handleStubPay} className="btn-primary w-full justify-center">
              💳 Оплатить {(training.price / 100).toLocaleString('ru-RU')} ₽ (stub)
            </button>
            <button onClick={handleCancel} className="btn-ghost w-full text-stone-400">
              Отменить запись
            </button>
          </div>

        ) : bookingState === 'done' ? (
          <div className="space-y-3">
            {canJoin ? (
              <Link to={`/room/${id}`} className="btn-primary w-full justify-center">
                {training.status === 'LIVE' ? '🔴 Войти — идёт сейчас' : '▶ Войти в тренировку'}
              </Link>
            ) : (
              <div className="bg-sage-50 rounded-2xl p-4 text-center">
                <p className="font-body text-sm text-sage-700">
                  {training.status === 'FINISHED'
                    ? 'Тренировка завершена'
                    : `Начнётся ${format(startDate, 'd MMMM в HH:mm', { locale: ru })}`}
                </p>
              </div>
            )}
            <button onClick={handleCancel} className="btn-ghost w-full text-stone-400 text-xs">
              Отменить запись
            </button>
          </div>
        ) : null}

        {/* Login prompt */}
        {!isAuthenticated() && bookingState === 'idle' && (
          <p className="text-center font-body text-xs text-stone-400 mt-3">
            <Link to="/login" className="text-sage-600 hover:underline">Войдите</Link>
            {' '}чтобы записаться
          </p>
        )}
        <p className="text-center font-body text-xs text-stone-400 mt-4">
          Оплачивая тренировку, вы принимаете{' '}
          <Link to="/legal/offer" className="text-sage-600 hover:underline">оферту</Link>
          {' '}и{' '}
          <Link to="/legal/returns" className="text-sage-600 hover:underline">условия возврата</Link>.
        </p>
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${highlight ? 'bg-red-50' : 'bg-sand-50'}`}>
      <p className="text-xl mb-1">{icon}</p>
      <p className="font-body text-xs text-stone-400">{label}</p>
      <p className={`font-body font-medium text-sm mt-0.5 ${highlight ? 'text-red-500' : 'text-stone-700'}`}>
        {value}
      </p>
    </div>
  )
}
