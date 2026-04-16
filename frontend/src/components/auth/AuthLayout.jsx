import { Link } from 'react-router-dom'

export default function AuthLayout({ children, title, subtitle, footer }) {
  return (
    <div className="min-h-screen flex">

      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-sage-800">
        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #7fa382 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #5c8560 0%, transparent 40%),
                              radial-gradient(circle at 60% 80%, #39543b 0%, transparent 45%)`,
          }}
        />

        {/* Decorative circles */}
        <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full border border-sage-600/30" />
        <div className="absolute top-[10%] right-[5%] w-48 h-48 rounded-full border border-sage-600/20" />
        <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 rounded-full border border-sage-600/20" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <span className="font-display text-2xl font-semibold">Asana</span>
          </Link>

          <div>
            <p className="font-display text-5xl font-light leading-tight mb-6">
              Практика,<br />
              <em>которая меняет</em>
            </p>
            <p className="font-body text-sage-300 text-sm leading-relaxed max-w-xs">
              Онлайн-тренировки по йоге и пилатесу с живым тренером. Занимайтесь из любой точки мира.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Stat value="500+" label="учеников" />
            <div className="w-px h-8 bg-sage-600" />
            <Stat value="20+" label="тренеров" />
            <div className="w-px h-8 bg-sage-600" />
            <Stat value="7" label="дней в неделю" />
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 bg-sand-50">
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-sage-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <span className="font-display text-xl font-semibold text-stone-800">Asana</span>
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-medium text-stone-800 mb-1">
              {title}
            </h1>
            {subtitle && (
              <p className="font-body text-sm text-stone-500">{subtitle}</p>
            )}
          </div>

          {/* Form content */}
          {children}

          {/* Footer link */}
          {footer && (
            <p className="mt-6 text-center font-body text-sm text-stone-500">
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold text-white">{value}</p>
      <p className="font-body text-xs text-sage-400">{label}</p>
    </div>
  )
}
