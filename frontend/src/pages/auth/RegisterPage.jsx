import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Spinner } from '../../components/ui'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { registerByEmail, sendOtp, verifyOtp, loading, error, clearError } = useAuthStore()

  const [step, setStep] = useState(1) // 1 = ввод данных, 2 = ввод кода
  const [method, setMethod] = useState('email') // 'email' | 'phone'
  const [roleType, setRoleType] = useState('student')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    trainerBio: '',
    personalDataConsent: false,
  })
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [trainerPending, setTrainerPending] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [key]: null }))
    clearError()
  }

  const setChecked = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.checked }))
    setFieldErrors((fe) => ({ ...fe, [key]: null }))
    clearError()
  }

  const switchMethod = (nextMethod) => {
    setMethod(nextMethod)
    setStep(1)
    setCode('')
    setFieldErrors({})
    clearError()
  }

  const validateEmail = () => {
    if (!form.email.trim()) return 'Введите email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Неверный email'
    return null
  }

  const validateStep1 = () => {
    const errs = {}
    if (!form.name.trim())  errs.name  = 'Введите имя'
    if (method === 'email') {
      const emailErr = validateEmail()
      if (emailErr) errs.email = emailErr
    } else {
      if (!form.phone.trim()) errs.phone = 'Введите номер телефона'
      else if (!/^\+7\d{10}$/.test(form.phone.replace(/\s/g, '')))
        errs.phone = 'Формат: +79001234567'
    }
    if (form.password.length < 6) errs.password = 'Минимум 6 символов'
    if (form.password !== form.confirm) errs.confirm = 'Пароли не совпадают'
    if (!form.personalDataConsent) errs.personalDataConsent = 'Нужно согласие на обработку данных'
    return errs
  }

  const handleRegisterByEmail = async (e) => {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length) return setFieldErrors(errs)
    try {
      const result = await registerByEmail(
        form.email,
        form.password,
        form.name,
        roleType === 'trainer' ? 'TRAINER' : 'STUDENT',
        roleType === 'trainer' ? form.trainerBio : undefined
      )
      if (result?.trainerRequestPending) {
        setTrainerPending(true)
      } else {
        navigate('/catalog')
      }
    } catch {}
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length) return setFieldErrors(errs)
    try {
      await sendOtp(form.phone, 'register')
      setStep(2)
    } catch {}
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setFieldErrors({ code: 'Введите код' })
    try {
      const result = await verifyOtp(
        form.phone,
        code,
        form.name,
        form.password,
        roleType === 'trainer' ? 'TRAINER' : 'STUDENT',
        roleType === 'trainer' ? form.trainerBio : undefined
      )
      if (result?.trainerRequestPending) {
        setTrainerPending(true)
      } else {
        navigate('/catalog')
      }
    } catch {}
  }

  // Заявка тренера на модерации
  if (trainerPending) {
    return (
      <AuthLayout title="Заявка отправлена" subtitle="Ожидайте проверки">
        <div className="text-center py-6">
          <div className="text-5xl mb-4">🎉</div>
          <p className="font-body text-stone-600 mb-2">
            Ваша заявка на роль тренера отправлена на модерацию.
          </p>
          <p className="font-body text-sm text-stone-400 mb-6">
            Мы рассмотрим её в течение 24 часов и пришлём уведомление в личный кабинет.
          </p>
          <Link to="/catalog" className="btn-primary inline-flex">
            Перейти в каталог
          </Link>
        </div>
      </AuthLayout>
    )
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
            ← Изменить данные
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

      {/* Способ регистрации */}
      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-4">
        <button type="button"
          onClick={() => switchMethod('email')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            method === 'email' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Email
        </button>
        <button type="button"
          onClick={() => switchMethod('phone')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            method === 'phone' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Телефон
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-sand-100 rounded-2xl mb-5">
        <button type="button"
          onClick={() => setRoleType('student')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            roleType === 'student' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          🧘 Я ученик
        </button>
        <button type="button"
          onClick={() => setRoleType('trainer')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-150 ${
            roleType === 'trainer' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
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

      <form onSubmit={method === 'email' ? handleRegisterByEmail : handleSendOtp} className="flex flex-col gap-4">
        <Input
          label="Имя"
          type="text"
          placeholder={roleType === 'trainer' ? 'Имя и фамилия' : 'Как вас зовут?'}
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
          autoFocus
        />
        {method === 'email' ? (
          <Input
            label="Email"
            type="email"
            placeholder="student@yoga.app"
            value={form.email}
            onChange={set('email')}
            error={fieldErrors.email}
          />
        ) : (
          <Input
            label="Телефон"
            type="tel"
            placeholder="+79001234567"
            value={form.phone}
            onChange={set('phone')}
            error={fieldErrors.phone}
          />
        )}
        <Input
          label="Пароль"
          type="password"
          placeholder="Минимум 6 символов"
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
        />
        <Input
          label="Повторите пароль"
          type="password"
          placeholder="•••••••"
          value={form.confirm}
          onChange={set('confirm')}
          error={fieldErrors.confirm}
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

        <label className="flex items-start gap-3 rounded-2xl bg-sand-50 border border-sand-200 px-4 py-3">
          <input
            type="checkbox"
            checked={form.personalDataConsent}
            onChange={setChecked('personalDataConsent')}
            className="mt-1 h-4 w-4 rounded border-sand-300 text-sage-600 focus:ring-sage-300"
          />
          <span className="font-body text-xs leading-relaxed text-stone-500">
            Я соглашаюсь на обработку персональных данных и принимаю{' '}
            <Link to="/legal/privacy" className="text-sage-600 hover:underline">согласие</Link>
            {' '}и{' '}
            <Link to="/legal/offer" className="text-sage-600 hover:underline">оферту</Link>.
            {fieldErrors.personalDataConsent && (
              <span className="block text-red-500 mt-1">{fieldErrors.personalDataConsent}</span>
            )}
          </span>
        </label>

        <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
          {loading ? <Spinner size="sm" className="text-white" /> : method === 'email' ? 'Зарегистрироваться' : 'Получить код'}
        </button>
      </form>
    </AuthLayout>
  )
}
