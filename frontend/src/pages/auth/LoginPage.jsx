import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Divider, Spinner } from '../../components/ui'

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/catalog'

  const { loginByEmail, sendOtp, verifyOtp, loading, error, clearError } = useAuthStore()

  const [tab,  setTab]  = useState('email') // 'email' | 'phone'
  const [step, setStep] = useState(1)        // phone: 1=enter, 2=otp

  // Email form
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  // Phone form
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [devCode, setDevCode] = useState(null)

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    clearError()
    sessionStorage.removeItem('token') // сбросить старый токен
    try {
      await loginByEmail(email, password)
      navigate(from, { replace: true })
    } catch {}
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    clearError()
    try {
      const data = await sendOtp(formatPhone(phone))
      if (data.dev_code) setDevCode(data.dev_code)
      setStep(2)
    } catch {}
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    clearError()
    try {
      await verifyOtp(formatPhone(phone), otp)
      navigate(from, { replace: true })
    } catch {}
  }

  const formatPhone = (p) => {
    const digits = p.replace(/\D/g, '')
    return digits.startsWith('8') ? '+7' + digits.slice(1) : '+' + digits
  }

  return (
    <AuthLayout
      title="Добро пожаловать"
      subtitle="Войдите, чтобы начать практику"
      footer={
        <>
          Ещё нет аккаунта?{' '}
          <Link to="/register" className="text-sage-600 hover:underline font-medium">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-6">
        {[
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Телефон' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); clearError(); setStep(1) }}
            className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all duration-200 ${
              tab === key
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Email form */}
      {tab === 'email' && (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Войти'}
          </button>
        </form>
      )}

      {/* Phone form */}
      {tab === 'phone' && step === 1 && (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <Input
            label="Номер телефона"
            type="tel"
            placeholder="+7 900 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Получить код'}
          </button>
        </form>
      )}

      {tab === 'phone' && step === 2 && (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
          <p className="font-body text-sm text-stone-500">
            Код отправлен на <span className="font-medium text-stone-700">{phone}</span>
          </p>

          {/* Dev hint */}
          {devCode && (
            <Alert type="info">
              <span className="font-mono font-bold">{devCode}</span>
              <span className="ml-2 text-stone-500">(dev: код из консоли)</span>
            </Alert>
          )}

          <OtpInput value={otp} onChange={setOtp} />

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading || otp.length < 6}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Подтвердить'}
          </button>

          <button
            type="button"
            className="btn-ghost w-full text-stone-400"
            onClick={() => { setStep(1); setOtp(''); setDevCode(null); clearError() }}
          >
            ← Изменить номер
          </button>
        </form>
      )}

      <Divider>или</Divider>

      {/* Telegram stub */}
      <button
        className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl
                   bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20
                   hover:bg-[#229ED9]/15 transition-colors text-sm font-body font-medium"
        disabled
        title="Скоро"
      >
        <TelegramIcon />
        Войти через Telegram
        <span className="ml-auto text-xs opacity-50 font-normal">скоро</span>
      </button>
    </AuthLayout>
  )
}

// 6-digit OTP input
function OtpInput({ value, onChange }) {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const handleChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(clean)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-body font-medium text-stone-600 uppercase tracking-wider">
        Код из SMS
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="000000"
        value={value}
        onChange={handleChange}
        className="input-field text-center tracking-[0.5em] text-xl font-mono"
        maxLength={6}
        autoFocus
      />
    </div>
  )
}

const TelegramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.613c-.148.67-.543.834-1.1.518l-3.037-2.237-1.466 1.41c-.162.162-.298.298-.611.298l.218-3.088 5.629-5.085c.245-.218-.054-.338-.38-.12L7.04 14.36l-2.983-.932c-.648-.203-.66-.648.135-.961l11.644-4.49c.54-.196 1.013.12.726.271z"/>
  </svg>
)
