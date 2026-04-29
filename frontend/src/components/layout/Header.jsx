import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../store/authStore'
import CreateTrainingModal from '../training/CreateTrainingModal'
import NotificationsDropdown from './NotificationsDropdown'
import clsx from 'clsx'

const NAV_LINKS = [
  { to: '/catalog', label: 'Расписание' },
  { to: '/contacts', label: 'Контакты' },
]

const TRAINER_LINKS = [
  { to: '/trainer', label: 'Мои тренировки' },
]
const ADMIN_LINKS = [
  { to: '/admin', label: 'Админ' },
]

export default function Header() {
  const { user, logout, isAuthenticated, isTrainer, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const extraLinks = isAdmin()
    ? ADMIN_LINKS
    : isTrainer()
    ? TRAINER_LINKS
    : []

  return (
    <>
      <header className="sticky top-0 z-40 bg-sand-50/80 backdrop-blur-md border-b border-sand-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/catalog" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-sage-600 flex items-center justify-center">
            <LeafIcon />
          </div>
          <span className="font-display text-xl font-semibold text-stone-800 leading-none">
            Asana
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {[...NAV_LINKS, ...extraLinks].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'px-3.5 py-1.5 rounded-xl text-sm font-body font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-sage-100 text-sage-700'
                    : 'text-stone-600 hover:bg-sand-100 hover:text-stone-800'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-2">
          {isAuthenticated() && <NotificationsDropdown />}
          {isAuthenticated() && (isTrainer() || isAdmin()) && (
            <button onClick={() => setShowCreate(true)} className="btn-primary py-2 text-xs">
              + Тренировка
            </button>
          )}
          {isAuthenticated() ? (
            <>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors duration-150',
                    isActive ? 'bg-sage-100' : 'hover:bg-sand-100'
                  )
                }
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-sage-200 flex items-center justify-center text-sage-700 text-xs font-medium">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-body text-stone-700 max-w-[100px] truncate">
                  {user?.name}
                </span>
              </NavLink>
              <button onClick={handleLogout} className="btn-ghost text-stone-400 hover:text-stone-600 px-2">
                <LogoutIcon />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Войти</Link>
              <Link to="/register" className="btn-primary py-2 text-xs">Начать</Link>
            </>
          )}
        </div>
      </div>
    </header>
    {showCreate && createPortal(
      <CreateTrainingModal onClose={() => setShowCreate(false)} />,
      document.body
    )}
    </>
  )
}

const LeafIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
