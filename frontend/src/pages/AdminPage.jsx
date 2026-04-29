import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { adminApi } from '../api/admin'
import { Spinner, Alert } from '../components/ui'

const TABS = ['dashboard', 'users', 'trainers', 'trainings', 'payments', 'moderation', 'legal']
const TAB_LABELS = {
  dashboard:  '📊 Дашборд',
  users:      '👥 Пользователи',
  trainers:   '🏋️ Тренеры',
  trainings:  '📅 Тренировки',
  payments:   '💳 Платежи',
  moderation: '✏️ Модерация',
  legal:      '⚖️ Юридическое',
}

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <p className="font-body text-xs text-red-500 uppercase tracking-widest mb-1">Администратор</p>
        <h1 className="font-display text-3xl text-stone-800">Панель управления</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-sand-100 rounded-2xl mb-8">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-xl text-xs font-body font-medium transition-all whitespace-nowrap ${
              tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'users'      && <UsersTab />}
      {tab === 'trainers'   && <TrainersTab />}
      {tab === 'trainings'  && <TrainingsTab />}
      {tab === 'payments'   && <PaymentsTab />}
      {tab === 'moderation' && <ModerationTab />}
      {tab === 'legal'      && <LegalTab />}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────
function DashboardTab() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.stats().then(({ data }) => setStats(data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!stats)  return null

  const fmt = (n) => (n / 100).toLocaleString('ru-RU')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Учеников"       value={stats.totalUsers}        color="sage" />
        <StatCard label="Тренеров"       value={stats.totalTrainers}     color="sand" />
        <StatCard label="Тренировок"     value={stats.totalTrainings}    color="stone" />
        <StatCard label="Выручка"        value={`${fmt(stats.totalRevenue)} ₽`} color="sage" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Активных записей"   value={stats.totalBookings}     color="stone" />
        <StatCard label="Активных тренировок" value={stats.activeTrainings}   color="stone" />
        <StatCard label="Новых за месяц"     value={stats.newUsersThisMonth} color="sand" />
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────
function UsersTab() {
  const [users,   setUsers]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [error,   setError]   = useState(null)

  const load = (p = page, s = search) => {
    setLoading(true)
    adminApi.users({ search: s, role: 'STUDENT', page: p, limit: 20 })
      .then(({ data }) => { setUsers(data.data); setTotal(data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load(1, search)
  }

  const handleBlock = async (id, isBlocked) => {
    try {
      await adminApi.blockUser(id, !isBlocked)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  const handleRole = async (id, role) => {
    try {
      await adminApi.changeRole(id, role === 'STUDENT' ? 'TRAINER' : 'STUDENT')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  return (
    <div>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, email, телефону..."
          className="input-field text-sm py-2 flex-1" />
        <button type="submit" className="btn-primary py-2 text-sm">Найти</button>
      </form>

      <p className="font-body text-xs text-stone-400 mb-3">{total} пользователей</p>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center
                              font-display text-sm text-sage-600 shrink-0">
                {u.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-stone-700 truncate">{u.name}</p>
                <p className="font-body text-xs text-stone-400">{u.email || u.phone}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {u.isBlocked && <span className="badge bg-red-100 text-red-500">Заблокирован</span>}
                <button onClick={() => handleBlock(u.id, u.isBlocked)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-body transition-colors ${
                    u.isBlocked
                      ? 'bg-sage-100 text-sage-700 hover:bg-sage-200'
                      : 'bg-red-50 text-red-500 hover:bg-red-100'
                  }`}>
                  {u.isBlocked ? 'Разблокировать' : 'Блокировать'}
                </button>
                <button onClick={() => handleRole(u.id, u.role)}
                  className="px-2.5 py-1 rounded-xl text-xs font-body bg-sand-100 text-stone-600 hover:bg-sand-200 transition-colors">
                  → Тренер
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {Math.ceil(total / 20) > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">←</button>
          <span className="font-body text-sm text-stone-500 py-1.5">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  )
}

// ── Trainers ──────────────────────────────────────────
function TrainersTab() {
  const [trainers, setTrainers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(null)

  const load = () => {
    setLoading(true)
    adminApi.trainers().then(({ data }) => setTrainers(data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await adminApi.createTrainer(form)
      setSuccess(`Тренер ${form.name} создан`)
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setCreating(false)
    }
  }

  const handleBlock = async (id, isBlocked) => {
    try {
      await adminApi.blockUser(id, !isBlocked)
      load()
    } catch {}
  }

  return (
    <div>
      {error   && <Alert type="error"   className="mb-4">{error}</Alert>}
      {success  && <Alert type="success" className="mb-4">{success}</Alert>}

      <div className="flex justify-between items-center mb-4">
        <p className="font-body text-xs text-stone-400">{trainers.length} тренеров</p>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary py-2 text-xs">
          + Добавить тренера
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4">
          <h3 className="font-display text-lg text-stone-700 mb-4">Новый тренер</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Имя" className="input-field text-sm py-2" required />
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email" className="input-field text-sm py-2" required />
            <div className="flex gap-2">
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Пароль" className="input-field text-sm py-2 flex-1" required minLength={6} />
              <button type="submit" className="btn-primary py-2 text-xs shrink-0" disabled={creating}>
                {creating ? <Spinner size="sm" className="text-white" /> : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-2">
          {trainers.map(t => (
            <div key={t.id} className="card p-3 flex items-center gap-3">
              {t.avatarUrl ? (
                <img src={t.avatarUrl} alt={t.name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-sand-100 flex items-center justify-center
                                font-display text-sm text-sand-600 shrink-0">
                  {t.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-stone-700">{t.name}</p>
                <p className="font-body text-xs text-stone-400">{t.email}</p>
              </div>
              <div className="text-center shrink-0">
                <p className="font-body text-sm font-medium text-stone-700">{t._count?.trainingsAsTrainer || 0}</p>
                <p className="font-body text-[10px] text-stone-400">тренировок</p>
              </div>
              {t.isBlocked && <span className="badge bg-red-100 text-red-500 shrink-0">Блок</span>}
              <button onClick={() => handleBlock(t.id, t.isBlocked)}
                className={`px-2.5 py-1 rounded-xl text-xs font-body transition-colors shrink-0 ${
                  t.isBlocked ? 'bg-sage-100 text-sage-700 hover:bg-sage-200' : 'bg-red-50 text-red-500 hover:bg-red-100'
                }`}>
                {t.isBlocked ? 'Разблокировать' : 'Блокировать'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Trainings ─────────────────────────────────────────
function TrainingsTab() {
  const [trainings, setTrainings] = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [status,    setStatus]    = useState('')
  const [direction, setDirection] = useState('')
  const [page,      setPage]      = useState(1)
  const [error,     setError]     = useState(null)

  const load = () => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (status)    params.status    = status
    if (direction) params.direction = direction
    adminApi.trainings(params)
      .then(({ data }) => { setTrainings(data.data); setTotal(data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, status, direction])

  const handleCancel = async (id, title) => {
    if (!confirm(`Отменить тренировку "${title}"?`)) return
    try {
      await adminApi.cancelTraining(id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  const STATUS_COLOR = {
    SCHEDULED: 'bg-sage-100 text-sage-700',
    LIVE:      'bg-red-100 text-red-600',
    FINISHED:  'bg-stone-100 text-stone-500',
    CANCELLED: 'bg-red-50 text-red-400',
  }
  const STATUS_LABEL = { SCHEDULED: 'Запланирована', LIVE: 'Идёт', FINISHED: 'Завершена', CANCELLED: 'Отменена' }

  return (
    <div>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="input-field text-sm py-2 w-40">
          <option value="">Все статусы</option>
          <option value="SCHEDULED">Запланированные</option>
          <option value="LIVE">Идут сейчас</option>
          <option value="FINISHED">Завершённые</option>
          <option value="CANCELLED">Отменённые</option>
        </select>
        <select value={direction} onChange={e => { setDirection(e.target.value); setPage(1) }}
          className="input-field text-sm py-2 w-40">
          <option value="">Все направления</option>
          <option value="YOGA">Йога</option>
          <option value="PILATES">Пилатес</option>
        </select>
      </div>

      <p className="font-body text-xs text-stone-400 mb-3">{total} тренировок</p>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-2">
          {trainings.map(t => (
            <div key={t.id} className="card p-3 flex items-center gap-3">
              <div className="shrink-0 w-10 text-center">
                <p className="font-display text-lg text-stone-700 leading-none">
                  {format(new Date(t.startAt), 'd')}
                </p>
                <p className="font-body text-[10px] text-stone-400 uppercase">
                  {format(new Date(t.startAt), 'MMM', { locale: ru })}
                </p>
              </div>
              <div className="w-px h-8 bg-sand-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-body text-sm font-medium text-stone-700 truncate">{t.title}</p>
                  <span className={`badge text-xs ${STATUS_COLOR[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                </div>
                <p className="font-body text-xs text-stone-400">
                  {t.trainer?.name} · {format(new Date(t.startAt), 'HH:mm')} · {t._count?.bookings || 0} записей
                </p>
              </div>
              {t.status === 'SCHEDULED' && (
                <button onClick={() => handleCancel(t.id, t.title)}
                  className="px-2.5 py-1 rounded-xl text-xs font-body bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0">
                  Отменить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {Math.ceil(total / 20) > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">←</button>
          <span className="font-body text-sm text-stone-500 py-1.5">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  )
}

// ── Payments ──────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [status,   setStatus]   = useState('')
  const [page,     setPage]     = useState(1)
  const [error,    setError]    = useState(null)

  const load = () => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (status) params.status = status
    adminApi.payments(params)
      .then(({ data }) => { setPayments(data.data); setTotal(data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, status])

  const handleRefund = async (id) => {
    if (!confirm('Оформить возврат?')) return
    try {
      await adminApi.refund(id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  const totalRevenue = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)

  const STATUS_COLOR = { PENDING: 'bg-sand-100 text-sand-700', PAID: 'bg-sage-100 text-sage-700', REFUNDED: 'bg-stone-100 text-stone-500', FAILED: 'bg-red-100 text-red-500' }
  const STATUS_LABEL = { PENDING: 'Ожидает', PAID: 'Оплачен', REFUNDED: 'Возврат', FAILED: 'Ошибка' }

  return (
    <div>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="input-field text-sm py-2 w-40">
          <option value="">Все статусы</option>
          <option value="PAID">Оплаченные</option>
          <option value="PENDING">Ожидают</option>
          <option value="REFUNDED">Возвраты</option>
        </select>
        <div className="ml-auto card px-4 py-2 bg-sage-50 border-sage-200">
          <span className="font-body text-xs text-stone-400">Выручка на странице: </span>
          <span className="font-body font-medium text-sage-700">
            {(totalRevenue / 100).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      <p className="font-body text-xs text-stone-400 mb-3">{total} платежей</p>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-body text-sm font-medium text-stone-700 truncate">
                    {p.booking?.training?.title || '—'}
                  </p>
                  <span className={`badge text-xs ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="font-body text-xs text-stone-400">
                  {p.user?.name} · {format(new Date(p.createdAt), 'd MMM HH:mm', { locale: ru })}
                </p>
              </div>
              <p className={`font-body font-medium shrink-0 ${p.status === 'REFUNDED' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                {(p.amount / 100).toLocaleString('ru-RU')} ₽
              </p>
              {p.status === 'PAID' && (
                <button onClick={() => handleRefund(p.id)}
                  className="px-2.5 py-1 rounded-xl text-xs font-body bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0">
                  Возврат
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {Math.ceil(total / 20) > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">←</button>
          <span className="font-body text-sm text-stone-500 py-1.5">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  )
}

// ── Moderation ────────────────────────────────────────
function ModerationTab() {
  const [subTab, setSubTab] = useState('trainers')

  return (
    <div>
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-6 w-fit">
        <button onClick={() => setSubTab('trainers')}
          className={`px-4 py-2 rounded-xl text-xs font-body font-medium transition-all ${
            subTab === 'trainers' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          🏋️ Заявки тренеров
        </button>
        <button onClick={() => setSubTab('descriptions')}
          className={`px-4 py-2 rounded-xl text-xs font-body font-medium transition-all ${
            subTab === 'descriptions' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          ✏️ Описания тренировок
        </button>
      </div>
      {subTab === 'trainers'     && <TrainerRequestsTab />}
      {subTab === 'descriptions' && <DescriptionModerationTab />}
    </div>
  )
}

function TrainerRequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('pending')
  const [error,    setError]    = useState(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/trainer-requests?status=${filter}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
    }).then(r => r.json()).then(data => {
      setRequests(Array.isArray(data) ? data : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id) => {
    try {
      await fetch(`/api/admin/trainer-requests/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
      })
      load()
    } catch { setError('Ошибка') }
  }

  const handleReject = async (id) => {
    const reason = prompt('Причина отклонения (необязательно):')
    try {
      await fetch(`/api/admin/trainer-requests/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        body: JSON.stringify({ reason })
      })
      load()
    } catch { setError('Ошибка') }
  }

  return (
    <div>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-4 w-fit">
        {[{ key: 'pending', label: 'Новые' }, { key: 'approved', label: 'Одобренные' }].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-all ${
              filter === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>{label}</button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
       requests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-body text-stone-400 text-sm">Нет заявок</p>
        </div>
       ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="card p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center font-display text-lg text-sage-600 shrink-0">
                {r.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-medium text-stone-700">{r.name}</p>
                <p className="font-body text-xs text-stone-400">{r.email || r.phone}</p>
                {r.trainerBio && (
                  <p className="font-body text-sm text-stone-600 mt-2 p-3 bg-sand-50 rounded-xl">{r.trainerBio}</p>
                )}
                <p className="font-body text-xs text-stone-300 mt-1">
                  {format(new Date(r.createdAt), 'd MMM yyyy', { locale: ru })}
                </p>
              </div>
              {filter === 'pending' ? (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleApprove(r.id)}
                    className="px-3 py-1.5 rounded-xl text-xs bg-sage-100 text-sage-700 hover:bg-sage-200 font-body transition-colors">
                    ✓ Одобрить
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="px-3 py-1.5 rounded-xl text-xs bg-red-50 text-red-500 hover:bg-red-100 font-body transition-colors">
                    ✕ Отклонить
                  </button>
                </div>
              ) : (
                <span className="badge bg-sage-100 text-sage-700 shrink-0">Тренер</span>
              )}
            </div>
          ))}
        </div>
       )}
    </div>
  )
}

function DescriptionModerationTab() {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('PENDING')
  const [error,    setError]    = useState(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/moderation?status=${filter}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
    }).then(r => r.json()).then(data => {
      setRequests(Array.isArray(data) ? data : [])
    }).catch(() => setRequests([]))
    .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handle = async (id, status) => {
    const note = status === 'REJECTED' ? prompt('Причина отклонения (необязательно):') : undefined
    try {
      await fetch(`/api/admin/moderation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        body: JSON.stringify({ status, reviewNote: note })
      })
      load()
    } catch { setError('Ошибка') }
  }

  return (
    <div>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-4 w-fit">
        {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-all ${
              filter === s ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {s === 'PENDING' ? 'На рассмотрении' : s === 'APPROVED' ? 'Одобренные' : 'Отклонённые'}
          </button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
       requests.length === 0 ? (
        <div className="text-center py-12"><p className="text-2xl mb-2">✓</p><p className="font-body text-stone-400 text-sm">Нет заявок</p></div>
       ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-body font-medium text-stone-700">{r.training.title}</p>
                  <p className="font-body text-xs text-stone-400 mt-0.5">
                    {r.field} · {format(new Date(r.createdAt), 'd MMM HH:mm', { locale: ru })}
                  </p>
                </div>
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handle(r.id, 'APPROVED')} className="px-3 py-1.5 rounded-xl text-xs bg-sage-100 text-sage-700 hover:bg-sage-200 font-body transition-colors">✓ Одобрить</button>
                    <button onClick={() => handle(r.id, 'REJECTED')} className="px-3 py-1.5 rounded-xl text-xs bg-red-50 text-red-500 hover:bg-red-100 font-body transition-colors">✕ Отклонить</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-sand-50 rounded-xl p-3">
                  <p className="font-body text-[10px] text-stone-400 uppercase mb-1">Текущее</p>
                  <p className="font-body text-xs text-stone-600">{r.training.description || '—'}</p>
                </div>
                <div className="bg-sage-50 rounded-xl p-3">
                  <p className="font-body text-[10px] text-stone-400 uppercase mb-1">Предлагаемое</p>
                  <p className="font-body text-xs text-stone-700">{r.newValue}</p>
                </div>
              </div>
              {r.reviewNote && <p className="font-body text-xs text-stone-400 mt-2 italic">Примечание: {r.reviewNote}</p>}
            </div>
          ))}
        </div>
       )}
    </div>
  )
}

// ── Legal ─────────────────────────────────────────────
const PROFILE_FIELDS = [
  ['brand', 'Бренд сервиса'],
  ['legalName', 'Полное наименование'],
  ['shortName', 'Сокращенное наименование'],
  ['director', 'Генеральный директор'],
  ['inn', 'ИНН'],
  ['kpp', 'КПП'],
  ['ogrn', 'ОГРН'],
  ['address', 'Юридический адрес'],
  ['registrationDate', 'Дата регистрации'],
  ['workHours', 'Режим работы'],
  ['supportPhone', 'Телефон поддержки'],
  ['supportEmail', 'Email поддержки'],
  ['serviceTitle', 'Название услуги'],
  ['serviceDescription', 'Описание услуги'],
  ['serviceCountry', 'Страна оказания услуги'],
  ['serviceCurrency', 'Валюта'],
  ['serviceWarranty', 'Гарантийный срок / порядок оказания'],
  ['serviceLifetime', 'Срок доступа'],
  ['serviceSafety', 'Правила безопасного использования'],
]

const DOCUMENT_TYPES = [
  { type: 'offer', label: 'Оферта' },
  { type: 'privacy', label: 'Согласие на обработку ПД' },
  { type: 'returns', label: 'Возврат и обмен' },
]

function LegalTab() {
  const [profile, setProfile] = useState(null)
  const [documents, setDocuments] = useState([])
  const [selectedType, setSelectedType] = useState('offer')
  const [docForm, setDocForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const load = () => {
    setLoading(true)
    adminApi.legal()
      .then(({ data }) => {
        setProfile(data.profile)
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
      })
      .catch((err) => setError(err.response?.data?.error || 'Не удалось загрузить юридические данные'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const currentDoc = documents.find((doc) => doc.type === selectedType && !doc.effectiveTo)
  const archiveDocs = documents.filter((doc) => doc.type === selectedType && doc.effectiveTo)

  useEffect(() => {
    setDocForm({
      title: currentDoc?.title || DOCUMENT_TYPES.find((item) => item.type === selectedType)?.label || '',
      content: currentDoc?.content || '',
    })
  }, [selectedType, currentDoc?.id])

  const updateProfileField = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setError(null)
    setSuccess(null)
    try {
      const { data } = await adminApi.updateLegalProfile(profile)
      setProfile(data)
      setSuccess('Контакты и реквизиты обновлены')
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить профиль')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePublishDocument = async (e) => {
    e.preventDefault()
    if (!confirm('Опубликовать новую версию документа? Текущая версия уйдет в архив.')) return
    setPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      await adminApi.createLegalDocument({
        type: selectedType,
        title: docForm.title,
        content: docForm.content,
      })
      setSuccess('Новая версия документа опубликована')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось опубликовать документ')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!profile) return null

  return (
    <div className="space-y-8">
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-2xl text-stone-800">Контакты и реквизиты</h2>
            <p className="font-body text-sm text-stone-400">Эти данные обновляются на страницах контактов и реквизитов без архива.</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="card p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 gap-3">
            {PROFILE_FIELDS.map(([key, label]) => {
              const isLong = ['address', 'serviceDescription', 'serviceWarranty', 'serviceLifetime', 'serviceSafety'].includes(key)
              return (
                <label key={key} className={isLong ? 'sm:col-span-2' : ''}>
                  <span className="block font-body text-xs text-stone-400 uppercase tracking-wider mb-1.5">
                    {label}
                  </span>
                  {isLong ? (
                    <textarea
                      value={profile[key] || ''}
                      onChange={(e) => updateProfileField(key, e.target.value)}
                      className="input-field min-h-24 resize-y"
                    />
                  ) : (
                    <input
                      value={profile[key] || ''}
                      onChange={(e) => updateProfileField(key, e.target.value)}
                      className="input-field"
                    />
                  )}
                </label>
              )
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="btn-primary py-2 text-xs" disabled={savingProfile}>
              {savingProfile ? <Spinner size="sm" className="text-white" /> : 'Сохранить'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-2xl text-stone-800">Версии документов</h2>
            <p className="font-body text-sm text-stone-400">Новая публикация сохраняет предыдущую версию в архиве сайта.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-sand-100 rounded-2xl mb-4 w-fit">
          {DOCUMENT_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => setSelectedType(item.type)}
              className={`px-4 py-2 rounded-xl text-xs font-body font-medium transition-all ${
                selectedType === item.type ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePublishDocument} className="card p-4 sm:p-5">
          <div className="grid gap-3">
            <label>
              <span className="block font-body text-xs text-stone-400 uppercase tracking-wider mb-1.5">
                Заголовок
              </span>
              <input
                value={docForm.title}
                onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                className="input-field"
                required
              />
            </label>
            <label>
              <span className="block font-body text-xs text-stone-400 uppercase tracking-wider mb-1.5">
                Текст документа
              </span>
              <textarea
                value={docForm.content}
                onChange={(e) => setDocForm((f) => ({ ...f, content: e.target.value }))}
                className="input-field min-h-[360px] resize-y font-mono text-xs leading-relaxed"
                required
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <p className="font-body text-xs text-stone-400">
              Текущая версия: {currentDoc ? formatVersionRange(currentDoc) : 'не опубликована'}
            </p>
            <button type="submit" className="btn-primary py-2 text-xs" disabled={publishing}>
              {publishing ? <Spinner size="sm" className="text-white" /> : 'Опубликовать новую версию'}
            </button>
          </div>
        </form>

        {archiveDocs.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="font-body text-xs text-stone-400 uppercase tracking-wider">Архив</p>
            {archiveDocs.map((doc) => (
              <details key={doc.id} className="card p-4">
                <summary className="cursor-pointer font-body text-sm text-stone-700">
                  {archiveLabel(doc)}
                </summary>
                <pre className="font-body text-xs text-stone-500 whitespace-pre-wrap mt-3 bg-sand-50 rounded-xl p-3">
                  {doc.content}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function archiveLabel(doc) {
  const label = DOCUMENT_TYPES.find((item) => item.type === doc.type)?.label || doc.title
  return `${label} с ${formatCompactDate(doc.effectiveFrom)} по ${formatCompactDate(doc.effectiveTo)}`
}

function formatVersionRange(doc) {
  if (!doc.effectiveFrom) return 'черновик'
  return `с ${format(new Date(doc.effectiveFrom), 'd MMM yyyy HH:mm', { locale: ru })}`
}

function formatCompactDate(value) {
  if (!value) return ''
  return new Date(value)
    .toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    .replace(/\./g, '')
}

function StatCard({ label, value, color }) {
  const colors = {
    sage:  'bg-sage-50  border-sage-200',
    sand:  'bg-sand-50  border-sand-200',
    stone: 'bg-stone-50 border-stone-200',
  }
  return (
    <div className={`card p-4 ${colors[color] || ''}`}>
      <p className="font-body text-xs text-stone-400 mb-1">{label}</p>
      <p className="font-display text-2xl text-stone-800">{value}</p>
    </div>
  )
}
