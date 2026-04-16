import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import AuthLayout from '../../components/auth/AuthLayout'
import { Input, Alert, Spinner } from '../../components/ui'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { registerByEmail, loading, error, clearError } = useAuthStore()

  const [roleType, setRoleType] = useState('student') // 'student' | 'trainer'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', trainerBio: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [trainerPending, setTrainerPending] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [key]: null }))
    clearError()
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim())          errs.name     = 'Введите имя'
    if (!form.email.includes('@'))  errs.email    = 'Неверный email'
    if (form.password.length < 6)   errs.password = 'Минимум 6 символов'
    if (form.password !== form.confirm) errs.confirm = 'Пароли не совпадают'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) return setFieldErrors(errs)

    try {
      const result = await registerByEmail(
        form.email,
        form.password,
        form.name,
        roleType === 'trainer' ? 'TRAINER' : 'STUDENT',
        roleType === 'trainer' ? form.trainerBio : undefined,
      )
      if (result?.trainerRequestPending) {
        setTrainerPending(true)
      } else {
        navigate('/catalog')
      }
    } catch {}
  }

  // Показываем экран ожидания если заявка тренера отправлена
  if (trainerPending) {
    return (
      <AuthLayout title="Заявка отправлена" subtitle="Ожидайте проверки">
        <div className="text-center py-6">
          <div className="text-5xl mb-4">🎉</div>
          <p className="font-body text-stone-600 mb-2">
            Ваша заявка на роль тренера отправлена на модерацию.
          </p>
          <p className="font-body text-sm text-stone-400 mb-6">
            Мы рассмотрим её в течение 24 часов и уведомим вас по email.
          </p>
          <p className="font-body text-sm text-stone-500 mb-4">
            Пока можете войти как ученик и изучить расписание.
          </p>
          <Link to="/catalog" className="btn-primary inline-flex">
            Перейти в каталог
          </Link>
        </div>
      </AuthLayout>
    )
  }

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

      {/* Role switcher */}
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
          🏋️ Я тренер
        </button>
      </div>

      {/* Trainer notice */}
      {roleType === 'trainer' && (
        <div className="bg-sage-50 border border-sage-200 rounded-2xl px-4 py-3 mb-4">
          <p className="font-body text-xs text-sage-700">
            Заявка тренера проходит модерацию в течение 24 часов. После одобрения вы сможете создавать тренировки.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          error={fieldErrors.email}
        />
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
          placeholder="••••••••"
          value={form.confirm}
          onChange={set('confirm')}
          error={fieldErrors.confirm}
        />

        {/* Trainer bio */}
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

        <p className="font-body text-xs text-stone-400 leading-relaxed">
          Регистрируясь, вы соглашаетесь с{' '}
          <span className="text-sage-600 cursor-pointer hover:underline">условиями использования</span>
          {' '}и{' '}
          <span className="text-sage-600 cursor-pointer hover:underline">политикой конфиденциальности</span>.
        </p>

        <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
          {loading ? <Spinner size="sm" className="text-white" /> :
            roleType === 'trainer' ? 'Подать заявку' : 'Зарегистрироваться'
          }
        </button>
      </form>
    </AuthLayout>
  )
}
