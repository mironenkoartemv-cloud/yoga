import { useTrainingsStore } from '../../store/trainingsStore'
import clsx from 'clsx'

const DIRECTIONS = [
  { value: '',        label: 'Все' },
  { value: 'YOGA',    label: 'Йога' },
  { value: 'PILATES', label: 'Пилатес' },
]

const LEVELS = [
  { value: '',             label: 'Любой уровень' },
  { value: 'BEGINNER',     label: 'Начинающий' },
  { value: 'INTERMEDIATE', label: 'Средний' },
  { value: 'ADVANCED',     label: 'Продвинутый' },
]

export default function TrainingFilters() {
  const { filters, setFilter } = useTrainingsStore()

  return (
    <div className="flex flex-wrap gap-2 items-center">

      {/* Direction pills */}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl">
        {DIRECTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('direction', value)}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl text-sm font-body font-medium transition-all duration-150',
              filters.direction === value
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Level select */}
      <select
        value={filters.level}
        onChange={(e) => setFilter('level', e.target.value)}
        className="px-3.5 py-2 rounded-2xl text-sm font-body bg-sand-100 border-none
                   text-stone-600 cursor-pointer hover:bg-sand-200 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-sage-300"
      >
        {LEVELS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {/* Date from */}
      <input
        type="date"
        value={filters.from}
        onChange={(e) => setFilter('from', e.target.value)}
        className="px-3.5 py-2 rounded-2xl text-sm font-body bg-sand-100 border-none
                   text-stone-600 cursor-pointer hover:bg-sand-200 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-sage-300"
      />

      {/* Clear */}
      {(filters.direction || filters.level || filters.from) && (
        <button
          onClick={() => {
            setFilter('direction', '')
            setFilter('level', '')
            setFilter('from', '')
          }}
          className="px-3 py-2 rounded-2xl text-xs font-body text-stone-400
                     hover:text-stone-600 hover:bg-sand-100 transition-colors"
        >
          Сбросить ✕
        </button>
      )}
    </div>
  )
}
