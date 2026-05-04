import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, differenceInHours, differenceInMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuthStore } from '../store/authStore'
import { trainingsApi } from '../api/trainings'
import { bookingsApi, paymentsApi } from '../api/bookings'
import api from '../api/client'
import { Spinner, Alert } from '../components/ui'

const TABS = ['upcoming', 'past', 'students', 'finance']
const TAB_LABELS = { upcoming: 'Предстоящие', past: 'Прошедшие', students: 'Ученики', finance: 'Финансы' }
const DIRECTION_LABEL = { YOGA: 'Йога', PILATES: 'Пилатес' }
const LEVEL_LABEL = { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' }
const STATUS_COLOR = {
  SCHEDULED: 'bg-sage-100 text-sage-700',
  LIVE:      'bg-red-100 text-red-600',
  FINISHED:  'bg-stone-100 text-stone-500',
  CANCELLED: 'bg-red-50 text-red-400',
}
const STATUS_LABEL = { SCHEDULED: 'Запланирована', LIVE: 'Идёт', FINISHED: 'Завершена', CANCELLED: 'Отменена' }

export default function TrainerPage() {
  const { user } = useAuthStore()
  const [tab,   setTab]   = useState('upcoming')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    trainingsApi.mine({ limit: 100 }).then(({ data }) => {
      const finished  = data.data.filter(t => t.status === 'FINISHED').length
      const scheduled = data.data.filter(t => t.status === 'SCHEDULED').length
      const totalStudents = data.data.reduce((sum, t) => sum + (t._count?.bookings || 0), 0)
      setStats({ total: data.total, finished, scheduled, totalStudents })
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-8 animate-fade-up">
        <div>
          <p className="font-body text-xs text-sage-600 uppercase tracking-widest mb-1">Кабинет тренера</p>
          <h1 className="font-display text-3xl text-stone-800">{user?.name}</h1>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard value={stats.total}         label="Всего тренировок" />
          <StatCard value={stats.scheduled}     label="Запланировано" />
          <StatCard value={stats.totalStudents} label="Всего записей" />
        </div>
      )}

      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all duration-150 whitespace-nowrap px-3 ${
              tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'upcoming'  && <TrainingsTab status="upcoming" />}
      {tab === 'past'      && <TrainingsTab status="past" />}
      {tab === 'students'  && <StudentsTab />}
      {tab === 'finance'   && <FinanceTab />}
    </div>
  )
}

// ── Тренировки ────────────────────────────────────────
function TrainingsTab({ status }) {
  const [trainings, setTrainings] = useState([])
  const [loading,   setLoading]   = useState(true)

  const load = () => {
    setLoading(true)
    trainingsApi.mine({ limit: 50 }).then(({ data }) => {
      let filtered = data.data
      if (status === 'upcoming') {
        filtered = data.data.filter(t => t.status === 'SCHEDULED' || t.status === 'LIVE')
      } else {
        filtered = data.data.filter(t => t.status === 'FINISHED' || t.status === 'CANCELLED')
      }
      setTrainings(filtered)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!trainings.length) return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">{status === 'upcoming' ? '📅' : '📋'}</p>
      <p className="font-display text-xl text-stone-500">
        {status === 'upcoming' ? 'Нет предстоящих тренировок' : 'История пуста'}
      </p>
      {status === 'upcoming' && (
        <p className="font-body text-sm text-stone-400 mt-1">Нажмите «+ Тренировка» в шапке</p>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {trainings.map((t) => (
        <TrainingRow key={t.id} training={t} onRefresh={load} />
      ))}
    </div>
  )
}

function TrainingRow({ training, onRefresh }) {
  const [participants, setParticipants] = useState(null)
  const [expanded,     setExpanded]     = useState(false)
  const [editing,      setEditing]      = useState(false)
  const [newTime,      setNewTime]      = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [descRequest,  setDescRequest]  = useState('')
  const [descSent,     setDescSent]     = useState(false)

  const startDate     = new Date(training.startAt)
  const hoursUntil    = differenceInHours(startDate, new Date())
  const minutesUntil  = differenceInMinutes(startDate, new Date())
  const canOpenRoom   = minutesUntil <= 10 && minutesUntil >= -training.durationMin
  const canEdit       = hoursUntil > 24
  const bookedSlots   = training._count?.bookings || 0
  const isUpcoming    = training.status === 'SCHEDULED' || training.status === 'LIVE'

  const loadParticipants = async () => {
    if (participants) return
    try {
      const { data } = await bookingsApi.participants(training.id)
      setParticipants(data)
    } catch {}
  }

  const handleExpand = () => {
    setExpanded(v => !v)
    if (!expanded) loadParticipants()
  }

  const handleReschedule = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Клиентская валидация — новое время минимум через 24 часа
    const newDate = new Date(newTime)
    const hoursUntilNew = (newDate - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilNew < 24) {
      setError('Новое время должно быть не менее чем через 24 часа от сейчас')
      setLoading(false)
      return
    }

    try {
      await trainingsApi.update(training.id, { startAt: newTime })
      setEditing(false)
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm(`Отменить тренировку "${training.title}"? Ученики получат уведомление.`)) return
    setLoading(true)
    try {
      await trainingsApi.cancel(training.id)
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleDescRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await trainingsApi.update(training.id, { description: descRequest })
      setDescSent(true)
    } catch (err) {
      if (err.response?.status === 202) {
        setDescSent(true)
      } else {
        setError(err.response?.data?.error || 'Ошибка')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        {/* Date */}
        <div className="shrink-0 w-12 text-center">
          <p className="font-display text-2xl text-stone-800 leading-none">{format(startDate, 'd')}</p>
          <p className="font-body text-xs text-stone-400 uppercase">{format(startDate, 'MMM', { locale: ru })}</p>
        </div>

        <div className="w-px h-10 bg-sand-200 shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-body font-medium text-stone-700 truncate">{training.title}</p>
            <span className={`badge text-xs ${STATUS_COLOR[training.status]}`}>
              {training.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1 animate-pulse" />}
              {STATUS_LABEL[training.status]}
            </span>
          </div>
          <p className="font-body text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{format(startDate, 'HH:mm')}</span>
            <span>·</span><span>{training.durationMin} мин</span>
            <span>·</span><span>{DIRECTION_LABEL[training.direction]}</span>
            <span>·</span><span>{LEVEL_LABEL[training.level]}</span>
          </p>
          <p className="font-body text-xs text-stone-400 mt-0.5">{bookedSlots} из {training.maxSlots} мест занято</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {isUpcoming && (
            canOpenRoom ? (
              <Link to={`/room/${training.id}`}
                className={`btn-primary py-1.5 text-xs ${training.status === 'LIVE' ? 'bg-red-500 hover:bg-red-600' : ''}`}>
                {training.status === 'LIVE' ? '🔴 Войти' : 'Открыть'}
              </Link>
            ) : (
              <div className="text-center">
                <div className="px-3 py-1.5 rounded-xl bg-sand-100 text-xs font-body text-stone-400">
                  ▶ {format(startDate, 'HH:mm')}
                </div>
                <p className="text-[10px] text-stone-300 mt-0.5">через {hoursUntil}ч</p>
              </div>
            )
          )}
          {isUpcoming && canEdit && (
            <>
              <button onClick={() => setEditing(v => !v)}
                className="btn-ghost py-1.5 text-xs text-stone-400">
                ✏️ Время
              </button>
              <button onClick={handleCancel} disabled={loading}
                className="btn-ghost py-1.5 text-xs text-red-400 hover:text-red-600">
                ✕ Отменить
              </button>
            </>
          )}
          {isUpcoming && !canEdit && training.status === 'SCHEDULED' && (
            <span className="text-[10px] font-body text-stone-300 text-right">
              Менее 24ч<br/>до старта
            </span>
          )}
          {bookedSlots > 0 && (
            <button onClick={handleExpand} className="btn-ghost py-1.5 text-xs text-stone-400">
              {expanded ? '▲' : '▼'} Ученики
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="px-4 pb-3"><Alert type="error">{error}</Alert></div>}

      {/* Edit time form */}
      {editing && (
        <div className="border-t border-sand-100 px-4 py-3 bg-sand-50">
          <p className="font-body text-xs text-stone-500 mb-2">Новое время тренировки:</p>
          <form onSubmit={handleReschedule} className="flex items-center gap-2">
            <input type="datetime-local" value={newTime}
              onChange={e => setNewTime(e.target.value)}
              min={(() => {
                const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
                const offset = d.getTimezoneOffset() * 60 * 1000
                return new Date(d.getTime() - offset).toISOString().slice(0, 16)
              })()}
              className="input-field text-sm py-2 flex-1" required />
            <button type="submit" className="btn-primary py-2 text-xs" disabled={loading}>
              {loading ? <Spinner size="sm" className="text-white" /> : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-2 text-xs">
              Отмена
            </button>
          </form>

          {/* Description moderation request */}
          {!descSent ? (
            <div className="mt-3 pt-3 border-t border-sand-200">
              <p className="font-body text-xs text-stone-400 mb-2">
                Хотите изменить описание? Отправьте заявку на модерацию:
              </p>
              <form onSubmit={handleDescRequest} className="flex gap-2">
                <textarea value={descRequest} onChange={e => setDescRequest(e.target.value)}
                  placeholder="Новое описание тренировки..."
                  className="input-field text-xs py-2 flex-1 resize-none" rows={2} required />
                <button type="submit" className="btn-secondary py-2 text-xs shrink-0" disabled={loading}>
                  Отправить
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-2 font-body text-xs text-sage-600">
              ✓ Заявка на изменение описания отправлена на модерацию
            </p>
          )}
        </div>
      )}

      {/* Participants */}
      {expanded && (
        <div className="border-t border-sand-100 px-4 py-3 bg-sand-50">
          {!participants ? (
            <div className="flex justify-center py-2"><Spinner size="sm" /></div>
          ) : participants.length === 0 ? (
            <p className="font-body text-xs text-stone-400">Нет участников</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map((b) => (
                <div key={b.id} className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 border border-sand-200">
                  {b.user.avatarUrl ? (
                    <img src={b.user.avatarUrl} alt={b.user.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-sage-200 flex items-center justify-center text-sage-700 text-[10px] font-medium">
                      {b.user.name[0]}
                    </div>
                  )}
                  <span className="font-body text-xs text-stone-600">{b.user.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ученики ───────────────────────────────────────────
function StudentsTab() {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    trainingsApi.mine({ limit: 100 }).then(async ({ data }) => {
      // Собираем всех уникальных учеников
      const trainingIds = data.data.map(t => t.id)
      const allBookings = await Promise.all(
        data.data
          .filter(t => t._count?.bookings > 0)
          .slice(0, 20) // лимит запросов
          .map(t => bookingsApi.participants(t.id).then(r => r.data).catch(() => []))
      )

      const studentMap = {}
      allBookings.flat().forEach(b => {
        if (!studentMap[b.userId]) {
          studentMap[b.userId] = {
            ...b.user,
            sessions: 0,
            totalPaid: 0,
            lastSession: null,
          }
        }
        studentMap[b.userId].sessions++
        if (b.payment?.status === 'PAID') {
          studentMap[b.userId].totalPaid += b.payment.amount || 0
        }
        const trainingDate = b.training?.startAt
        if (trainingDate && (!studentMap[b.userId].lastSession || trainingDate > studentMap[b.userId].lastSession)) {
          studentMap[b.userId].lastSession = trainingDate
        }
      })

      setStudents(Object.values(studentMap).sort((a, b) => b.sessions - a.sessions))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!students.length) return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">👥</p>
      <p className="font-display text-xl text-stone-500">Нет учеников</p>
      <p className="font-body text-sm text-stone-400 mt-1">Ученики появятся после записи на тренировки</p>
    </div>
  )

  return (
    <div>
      <p className="font-body text-xs text-stone-400 mb-4">{students.length} учеников</p>
      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.id} className="card p-4 flex items-center gap-4">
            {s.avatarUrl ? (
              <img src={s.avatarUrl} alt={s.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center
                              font-display text-lg text-sage-600 shrink-0">
                {s.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-body font-medium text-stone-700">{s.name}</p>
              <p className="font-body text-xs text-stone-400">
                {s.email || s.phone || '—'}
              </p>
            </div>
            <div className="text-center shrink-0">
              <p className="font-display text-xl text-stone-800">{s.sessions}</p>
              <p className="font-body text-[10px] text-stone-400">занятий</p>
            </div>
            {s.totalPaid > 0 && (
              <div className="text-center shrink-0">
                <p className="font-body font-medium text-sage-700 text-sm">
                  {(s.totalPaid / 100).toLocaleString('ru-RU')} ₽
                </p>
                <p className="font-body text-[10px] text-stone-400">оплачено</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Финансы ───────────────────────────────────────────
function FinanceTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState('month')
  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')

  const PERIODS = [
    { key: 'week',   label: 'Неделя',   days: 7  },
    { key: 'month',  label: 'Месяц',    days: 30 },
    { key: 'three',  label: '3 месяца', days: 90 },
    { key: 'custom', label: 'Период',   days: null },
  ]

  const getDateRange = () => {
    if (period === 'custom') return { from, to }
    const p = PERIODS.find(p => p.key === period)
    const fromDate = new Date(Date.now() - p.days * 24 * 60 * 60 * 1000)
    return {
      from: fromDate.toISOString(),
      to:   new Date().toISOString(),
    }
  }

  const load = () => {
    setLoading(true)
    const { from: f, to: t } = getDateRange()
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)

    api.get('/trainer/finance', { params: Object.fromEntries(params) })
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [period])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data)   return <div className="text-center py-8 text-stone-400">Ошибка загрузки</div>

  const fmt = (n) => (n / 100).toLocaleString('ru-RU')

  return (
    <div>
      {/* Period filter */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl">
          {PERIODS.filter(p => p.key !== 'custom').map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-all ${
                period === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPeriod('custom') }}
            className="input-field text-xs py-1.5 w-36" />
          <span className="text-stone-400 text-xs">—</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPeriod('custom') }}
            className="input-field text-xs py-1.5 w-36" />
          {period === 'custom' && (
            <button onClick={load} className="btn-primary text-xs py-1.5">Применить</button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Выручка" value={`${fmt(data.totalAmount)} ₽`} sub={`${data.totalCount} оплат`} accent />
        <KpiCard label="Средний чек" value={`${fmt(data.avgCheck)} ₽`} />
        <KpiCard label="Доход/день" value={`${fmt(data.avgPerDay)} ₽`} />
        <KpiCard label="Доход/тренировку" value={`${fmt(data.avgPerTraining)} ₽`} />
      </div>

      {data.dailyData.length === 0 ? (
        <div className="text-center py-12 bg-sand-50 rounded-2xl">
          <p className="text-2xl mb-2">📊</p>
          <p className="font-body text-stone-400 text-sm">Нет платежей за выбранный период</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="card p-4 mb-6">
            <p className="font-body text-xs text-stone-400 uppercase tracking-wider mb-4">Доход по дням</p>
            <IncomeChart data={data.dailyData} />
          </div>

          {/* Payments list */}
          <p className="font-body text-xs text-stone-400 uppercase tracking-wider mb-3">Платежи</p>
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="card p-3 flex items-center gap-3">
                <div className="shrink-0 w-10 text-center">
                  <p className="font-display text-lg text-stone-700 leading-none">
                    {format(new Date(p.date), 'd')}
                  </p>
                  <p className="font-body text-[10px] text-stone-400 uppercase">
                    {format(new Date(p.date), 'MMM', { locale: ru })}
                  </p>
                </div>
                <div className="w-px h-8 bg-sand-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-stone-700 truncate">{p.trainingTitle}</p>
                  <p className="font-body text-xs text-stone-400">{p.studentName}</p>
                </div>
                <p className="font-body font-medium text-sage-700 shrink-0">
                  +{fmt(p.amount)} ₽
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`card p-4 ${accent ? 'bg-sage-50 border-sage-200' : ''}`}>
      <p className="font-body text-xs text-stone-400 mb-1">{label}</p>
      <p className="font-display text-2xl text-stone-800">{value}</p>
      {sub && <p className="font-body text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function IncomeChart({ data }) {
  // Простой SVG bar chart без внешних библиотек
  const max = Math.max(...data.map(d => d.amount), 1)
  const W = 600
  const H = 160
  const barW = Math.min(32, Math.floor((W - 40) / data.length) - 4)
  const gap  = Math.floor((W - 40) / data.length)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ minWidth: Math.max(300, data.length * 40) }}>
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.amount / max) * H))
          const x = 20 + i * gap + (gap - barW) / 2
          const y = H - barH
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barW} height={barH}
                rx="4" fill="#5c8560" opacity="0.8" />
              {/* Label */}
              {data.length <= 14 && (
                <text x={x + barW / 2} y={H + 14} textAnchor="middle"
                  fontSize="9" fill="#78716c" fontFamily="DM Sans, sans-serif">
                  {format(new Date(d.date), 'd.MM')}
                </text>
              )}
              {/* Amount on hover — просто показываем если маленький набор */}
              {data.length <= 7 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fill="#5c8560" fontFamily="DM Sans, sans-serif">
                  {(d.amount / 100).toLocaleString('ru-RU')}
                </text>
              )}
            </g>
          )
        })}
        {/* Baseline */}
        <line x1="10" y1={H} x2={W - 10} y2={H} stroke="#e7e0d8" strokeWidth="1" />
      </svg>
    </div>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-display text-3xl text-stone-800">{value}</p>
      <p className="font-body text-xs text-stone-400 mt-1">{label}</p>
    </div>
  )
}
