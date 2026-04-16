import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand-50 px-4">
      <p className="font-display text-8xl font-light text-sand-300 mb-4">404</p>
      <h1 className="font-display text-2xl text-stone-700 mb-2">Страница не найдена</h1>
      <p className="font-body text-sm text-stone-400 mb-8 text-center max-w-xs">
        Возможно, она была удалена или вы перешли по неверной ссылке
      </p>
      <Link to="/catalog" className="btn-primary">На главную</Link>
    </div>
  )
}
