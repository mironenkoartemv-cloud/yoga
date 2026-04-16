import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main key={pathname} className="flex-1 page-enter">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-sand-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-display text-stone-400 text-sm">© 2025 Asana</span>
          <span className="font-body text-stone-400 text-xs">Йога и пилатес онлайн</span>
        </div>
      </footer>
    </div>
  )
}
