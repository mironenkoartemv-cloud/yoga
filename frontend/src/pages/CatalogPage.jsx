import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrainingsStore } from '../store/trainingsStore'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../api/users'
import TrainingCard from '../components/training/TrainingCard'
import TrainingCardSkeleton from '../components/training/TrainingCardSkeleton'
import TrainingFilters from '../components/training/TrainingFilters'
import { EmptyState } from '../components/ui'

export default function CatalogPage() {
  const { trainings, total, loading, error, filters, setPage, fetch, reset } = useTrainingsStore()
  const { user, isAuthenticated } = useAuthStore()
  const [discount, setDiscount] = useState(null)

  useEffect(() => { fetch() }, [])
  useEffect(() => {
    if (!isAuthenticated()) return
    usersApi.discount().then(({ data }) => setDiscount(data.discount)).catch(() => {})
  }, [isAuthenticated])

  const totalPages = Math.ceil(total / filters.limit)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

      {/* Hero */}
      <div className="mb-8 animate-fade-up">
        <p className="font-body text-xs text-sage-600 uppercase tracking-widest mb-2">
          Расписание тренировок
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="font-display text-4xl sm:text-5xl font-light text-stone-800 leading-tight">
            {isAuthenticated()
              ? <>Привет, <em>{user?.name?.split(' ')[0]}</em></>
              : <>Найдите свою<br /><em>практику</em></>
            }
          </h1>
          {!isAuthenticated() && (
            <div className="flex gap-2">
              <Link to="/login"    className="btn-secondary py-2 text-xs">Войти</Link>
              <Link to="/register" className="btn-primary  py-2 text-xs">Начать</Link>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {discount && <DiscountBanner discount={discount} />}

      <div className="mb-6">
        <TrainingFilters />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3
                        text-sm font-body mb-6 flex items-center justify-between">
          {error}
          <button onClick={fetch} className="underline text-xs">Повторить</button>
        </div>
      )}

      {/* Count */}
      {!loading && !error && total > 0 && (
        <p className="font-body text-xs text-stone-400 mb-4">{total} тренировок</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <TrainingCardSkeleton key={i} />)}
        </div>
      ) : trainings.length === 0 ? (
        <EmptyState
          icon="🧘"
          title="Тренировок не найдено"
          description="Попробуйте изменить фильтры или загляните позже"
          action={
            <button onClick={() => { reset(); fetch() }} className="btn-secondary text-xs">
              Сбросить фильтры
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainings.map((t, i) => (
              <div key={t.id} className="animate-fade-up"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                <TrainingCard training={t} discount={discount} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              <button onClick={() => setPage(filters.page - 1)}
                disabled={filters.page === 1} className="btn-secondary py-2 px-4 text-xs disabled:opacity-30">←</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 rounded-xl text-sm font-body transition-colors ${
                    filters.page === i + 1 ? 'bg-sage-600 text-white' : 'bg-sand-100 text-stone-600 hover:bg-sand-200'
                  }`}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(filters.page + 1)}
                disabled={filters.page === totalPages} className="btn-secondary py-2 px-4 text-xs disabled:opacity-30">→</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DiscountBanner({ discount }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const expiresAt = new Date(discount.expiresAt).getTime()
  const seconds = discount.expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  if (seconds !== null && seconds <= 0) return null

  return (
    <div className="mb-5 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <p className="font-body text-sm text-sage-800">
        {discount.expiresAt
          ? `Скидка ${discount.percent}% на любую новую запись`
          : `У вас скидка ${discount.percent}% на любую новую запись`}
      </p>
      {seconds === null ? (
        <p className="font-body text-sm font-semibold text-sage-700">Применится к следующей оплате</p>
      ) : (
        <p className="font-body text-sm font-semibold text-sage-700">
          Осталось {mm}:{ss}
        </p>
      )}
    </div>
  )
}
