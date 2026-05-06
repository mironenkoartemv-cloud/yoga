import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Spinner } from '../../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sendOtp, verifyOtp, loginByPhone, loginByEmail, loading, error, clearError } = useAuthStore()

  const [mode, setMode] = useState('email') // 'email' | 'password' | 'sms'
  const [step, setStep] = useState(1) // для SMS: 1 = телефон, 2 = код
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const validatePhone = () => {
    if (!phone.trim()) return 'Введите номер телефона'
    if (!/^\+7\d{10}$/.test(phone.replace(/\s/g, ''))) return 'Формат: +79001234567'
    return null
  }

  const validateEmail = () => {
    if (!email.trim()) return 'Введите email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Неверный email'
    return null
  }

  // Вход по телефону + паролю
  const handleLoginByPassword = async (e) => {
    e.preventDefault()
    const phoneErr = validatePhone()
    const errs = {}
    if (phoneErr) errs.phone = phoneErr
    if (!password) errs.password = 'Введите пароль'
    if (Object.keys(errs).length) return setFieldErrors(errs)
    try {
      await loginByPhone(phone, password)
      navigate('/catalog')
    } catch {}
  }

  const handleLoginByEmail = async (e) => {
    e.preventDefault()
    const emailErr = validateEmail()
    const errs = {}
    if (emailErr) errs.email = emailErr
    if (!password) errs.password = 'Введите пароль'
    if (Object.keys(errs).length) return setFieldErrors(errs)
    try {
      await loginByEmail(email, password)
      navigate('/catalog')
    } catch {}
  }

  // Отправить SMS для входа
  const handleSendOtp = async (e) => {
    e.preventDefault()
    const phoneErr = validatePhone()
    if (phoneErr) return setFieldErrors({ phone: phoneErr })
    try {
      await sendOtp(phone, 'login')
      setStep(2)
    } catch {}
  }

  // Подтвердить код
  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setFieldErrors({ code: 'Введите код' })
    try {
      await verifyOtp(phone, code)
      navigate('/catalog')
    } catch {}
  }

  // Переключение режима сбрасывает всё
  const switchMode = (newMode) => {
    setMode(newMode)
    setStep(1)
    setCode('')
    setPassword('')
    setFieldErrors({})
    clearError()
  }

  // SMS режим, шаг 2 — ввод кода
  if (mode === 'sms' && step === 2) {
    return (
      <AuthLayout
        title="Введите код"
        subtitle={`Мы отправили SMS на ${phone}`}
        footer={
          <button
            type="button"
            className="text-sage-600 hover:underline font-medium"
            onClick={() => { setStep(1); clearError() }}
          >
            ← Изменить номер
          </button>
        }
      >
        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <Input
            label="Код из SMS"
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => { setCode(e.target.value); clearError() }}
            error={fieldErrors.code}
            autoFocus
            maxLength={6}
          />
          <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Войти'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Войти"
      subtitle="Выберите способ входа"
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className="text-sage-600 hover:underline font-medium">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Переключатель режима */}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-5">
        <button type="button"
          onClick={() => switchMode('email')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            mode === 'email' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          @ Email
        </button>
        <button type="button"
          onClick={() => switchMode('password')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            mode === 'password' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Телефон
        </button>
        <button type="button"
          onClick={() => switchMode('sms')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            mode === 'sms' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          SMS
        </button>
      </div>

      {mode === 'email' ? (
        <form onSubmit={handleLoginByEmail} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="admin@yoga.app"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError(); setFieldErrors({}) }}
            error={fieldErrors.email}
            autoFocus
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="Ваш пароль"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError(); setFieldErrors({}) }}
            error={fieldErrors.password}
          />
          <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Войти'}
          </button>
        </form>
      ) : mode === 'password' ? (
        <form onSubmit={handleLoginByPassword} className="flex flex-col gap-4">
          <Input
            label="Телефон"
            type="tel"
            placeholder="+79001234567"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); clearError(); setFieldErrors({}) }}
            error={fieldErrors.phone}
            autoFocus
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="Ваш пароль"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError(); setFieldErrors({}) }}
            error={fieldErrors.password}
          />
          <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Войти'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <Input
            label="Телефон"
            type="tel"
            placeholder="+79001234567"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); clearError(); setFieldErrors({}) }}
            error={fieldErrors.phone}
            autoFocus
          />
          <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Получить код'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
