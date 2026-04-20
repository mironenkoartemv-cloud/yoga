import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Spinner } from '../../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sendOtp, verifyOtp, loading, error, clearError } = useAuthStore()

  const [step, setStep] = useState(1) // 1 = ввод телефона, 2 = ввод кода
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!/^\+7\d{10}$/.test(phone.replace(/\s/g, ''))) {
      return setFieldErrors({ phone: 'Формат: +79001234567' })
    }
    try {
      await sendOtp(phone)
      setStep(2)
    } catch {}
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setFieldErrors({ code: 'Введите код' })
    try {
      await verifyOtp(phone, code)
      navigate('/catalog')
    } catch {}
  }

  // Шаг 2 — ввод кода
  if (step === 2) {
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

  // Шаг 1 — ввод телефона
  return (
    <AuthLayout
      title="Войти"
      subtitle="Введите номер телефона — отправим код"
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
    </AuthLayout>
  )
}