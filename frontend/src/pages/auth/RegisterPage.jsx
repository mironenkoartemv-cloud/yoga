import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Spinner } from '../../components/ui'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { sendOtp, verifyOtp, loading, error, clearError } = useAuthStore()

  const [step, setStep] = useState(1) // 1 = ввод данных, 2 = ввод кода
  const [roleType, setRoleType] = useState('student')
  const [form, setForm] = useState({ name: '', phone: '', trainerBio: '' })
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [key]: null }))
    clearError()
  }

  const validateStep1 = () => {
    const errs = {}
    if (!form.name.trim())  errs.name  = 'Введите имя'
    if (!form.phone.trim()) errs.phone = 'Введите номер телефона'
    else if (!/^\+7\d{10}$/.test(form.phone.replace(/\s/g, '')))
      errs.phone = 'Формат: +79001234567'
    return errs
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length) return setFieldErrors(errs)
    try {
      await sendOtp(form.phone)
      setStep(2)
    } catch {}
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setFieldErrors({ code: 'Введите код' })
    try {
      await verifyOtp(form.phone, code, form.name)
      navigate('/catalog')
    } catch {}
  }

  // Шаг 2 — ввод кода
  if (step === 2) {
    return (
      <AuthLayout
        title="Введите код"
        subtitle={`Мы отправили SMS на ${form.phone}`}
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
            {loading ? <Spinner size="sm" className="text-white" /> : 'Подтвердить'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  // Шаг 1 — ввод данных
  return (
    <AuthLayout
      title="Создать аккаунт"
      subtitle="Присоединяйтесь — первое занятие бесплатно"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-sage-600 hover:underline font-medium">
            Войти
          </Link>
        </>
      }
    >
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Переключатель роли */}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-5">
        <button type="button"
          onClick={() => setRoleType('student')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            roleType === 'student'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}>
          🧘 Я ученик
        </button>
        <button type="button"
          onClick={() => setRoleType('trainer')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            roleType === 'trainer'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}>
          🏋️‍♀️ Я тренер
        </button>
      </div>

      {roleType === 'trainer' && (
        <div className="bg-sage-50 border border-sage-200 rounded-2xl px-4 py-3 mb-4">
          <p className="font-body text-xs text-sage-700">
            Заявка тренера проходит модерацию в течение 24 часов.
          </p>
        </div>
      )}

      <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
        <Input
          label="Имя"
          type="text"
          placeholder={roleType === 'trainer' ? 'Имя и фамилия' : 'Как вас зовут?'}
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
          autoFocus
        />
        <Input
          label="Телефон"
          type="tel"
          placeholder="+79001234567"
          value={form.phone}
          onChange={set('phone')}
          error={fieldErrors.phone}
        />

        {roleType === 'trainer' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-body font-medium text-stone-600 uppercase tracking-wider">
              О себе (необязательно)
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Опыт, специализация, подход к тренировкам..."
              value={form.trainerBio}
              onChange={set('trainerBio')}
            />
          </div>
        )}

        <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
          {loading ? <Spinner size="sm" className="text-white" /> : 'Получить код'}
        </button>
      </form>
    </AuthLayout>
  )
}