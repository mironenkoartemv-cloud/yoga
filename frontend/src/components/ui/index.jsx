import clsx from 'clsx'

// ── Input ──────────────────────────────────────────────
export function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-body font-medium text-stone-600 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={clsx('input-field', error && 'error', className)}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 font-body mt-0.5">{error}</p>
      )}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────
export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <svg
      className={clsx('animate-spin text-sage-600', sizes[size], className)}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── Alert ──────────────────────────────────────────────
export function Alert({ type = 'error', children, className }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-sage-50 border-sage-200 text-sage-700',
    info:    'bg-sand-50 border-sand-200 text-sand-700',
  }
  return (
    <div className={clsx('px-4 py-3 rounded-2xl border text-sm font-body', styles[type], className)}>
      {children}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────
const DIRECTION_LABELS = { YOGA: 'Йога', PILATES: 'Пилатес' }
const LEVEL_LABELS = { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' }

export function DirectionBadge({ value }) {
  return (
    <span className={clsx('badge', value === 'YOGA' ? 'badge-yoga' : 'badge-pilates')}>
      {DIRECTION_LABELS[value] || value}
    </span>
  )
}

export function LevelBadge({ value }) {
  return <span className="badge-level">{LEVEL_LABELS[value] || value}</span>
}

// ── Divider ────────────────────────────────────────────
export function Divider({ children }) {
  return <div className="divider-text my-4">{children}</div>
}

// ── Empty state ────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 px-4">
      {icon && <div className="text-4xl opacity-40">{icon}</div>}
      <div>
        <h3 className="font-display text-xl text-stone-600">{title}</h3>
        {description && (
          <p className="font-body text-sm text-stone-400 mt-1 max-w-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
