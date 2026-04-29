import { Outlet, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import Header from './Header'
import { legalNav } from '../../config/legal'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main key={pathname} className="flex-1 page-enter">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-sand-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="text-center lg:text-left">
            <span className="font-display text-stone-400 text-sm">© 2025 Asana</span>
            <span className="font-body text-stone-400 text-xs block mt-1">Йога и пилатес онлайн</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {legalNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="font-body text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
