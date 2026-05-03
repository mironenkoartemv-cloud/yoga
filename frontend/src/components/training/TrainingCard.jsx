import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const DIRECTION_LABEL = { YOGA: 'Йога', PILATES: 'Пилатес' }
const LEVEL_LABEL     = { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' }
const DIRECTION_COLOR = {
  YOGA:    'bg-sage-100 text-sage-700',
  PILATES: 'bg-sand-100 text-sand-700',
}

export default function TrainingCard({ training, discount }) {
  const {
    id, title, trainer, direction, level,
    startAt, durationMin, maxSlots, bookedSlots, availableSlots, price, status,
  } = training

  const isFull    = availableSlots <= 0
  const isFree    = price === 0
  const discountedPrice = discount && !isFree ? Math.round(price * (100 - discount.percent) / 100) : null
  const startDate = new Date(startAt)
  const isToday   = new Date().toDateString() === startDate.toDateString()
  const isSoon    = startDate - Date.now() < 60 * 60 * 1000 // < 1 час

  return (
    <Link
      to={`/training/${id}`}
      className="card p-5 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5
                 transition-all duration-200 cursor-pointer group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={`badge ${DIRECTION_COLOR[direction]}`}>
            {DIRECTION_LABEL[direction]}
          </span>
          <span className="badge bg-stone-100 text-stone-500">
            {LEVEL_LABEL[level]}
          </span>
          {isSoon && status === 'SCHEDULED' && (
            <span className="badge bg-amber-100 text-amber-700 animate-pulse">
              Скоро
            </span>
          )}
          {status === 'LIVE' && (
            <span className="badge bg-red-100 text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1 animate-pulse" />
              Идёт сейчас
            </span>
          )}
        </div>
        <span className="font-body font-semibold text-stone-800 text-sm shrink-0 text-right">
          {isFree ? 'Бесплатно' : discountedPrice ? (
            <>
              <span className="block text-sage-700">{(discountedPrice / 100).toLocaleString('ru-RU')} ₽</span>
              <span className="block text-[10px] text-stone-400 line-through">{(price / 100).toLocaleString('ru-RU')} ₽</span>
            </>
          ) : `${(price / 100).toLocaleString('ru-RU')} ₽`}
        </span>
      </div>

      {/* Title */}
      <div>
        {discount && (
          <span className="inline-flex mb-2 rounded-xl bg-sage-600 px-2.5 py-1 text-[11px] font-body font-semibold text-white">
            -{discount.percent}% по вашей скидке
          </span>
        )}
        <h3 className="font-display text-lg text-stone-800 leading-snug group-hover:text-sage-700 transition-colors">
          {title}
        </h3>
        <p className="font-body text-xs text-stone-400 mt-1 flex items-center gap-1">
          <AvatarMini url={trainer?.avatarUrl} name={trainer?.name} />
          {trainer?.name}
        </p>
      </div>

      {/* Date & duration */}
      <div className="flex items-center gap-3 text-xs font-body text-stone-500">
        <span className="flex items-center gap-1">
          <CalIcon />
          {isToday
            ? `Сегодня, ${format(startDate, 'HH:mm')}`
            : format(startDate, 'd MMM, HH:mm', { locale: ru })}
        </span>
        <span className="flex items-center gap-1">
          <ClockIcon />
          {durationMin} мин
        </span>
      </div>

      {/* Slots progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-body text-stone-400">
          <span>{isFull ? 'Мест нет' : `${availableSlots} из ${maxSlots} мест`}</span>
          <span>{bookedSlots} записались</span>
        </div>
        <div className="h-1.5 rounded-full bg-sand-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull ? 'bg-red-400' : bookedSlots / maxSlots > 0.7 ? 'bg-amber-400' : 'bg-sage-400'
            }`}
            style={{ width: `${Math.min((bookedSlots / maxSlots) * 100, 100)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function AvatarMini({ url, name }) {
  if (url) return <img src={url} alt={name} className="w-4 h-4 rounded-full object-cover" />
  return (
    <span className="w-4 h-4 rounded-full bg-sage-200 text-sage-700 text-[9px] font-medium flex items-center justify-center">
      {name?.[0]}
    </span>
  )
}

const CalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
