import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainingsApi } from '../../api/trainings'
import { Spinner } from '../ui'

export default function CreateTrainingModal({ onClose }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [form, setForm] = useState({
    title:      '',
    direction:  'YOGA',
    level:      'BEGINNER',
    startAt:    defaultDateTime(),
    durationMin: 60,
    maxSlots:   10,
    price:      0,
    description: '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await trainingsApi.create({
        ...form,
        durationMin: Number(form.durationMin),
        maxSlots:    Number(form.maxSlots),
        price:       Math.round(Number(form.price) * 100), // рубли → копейки
      })
      onClose()
      navigate(`/training/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh]
                      overflow-y-auto animate-fade-up">
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-sand-100 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-stone-800">Новая тренировка</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-sand-100 flex items-center justify-center
                         text-stone-400 hover:text-stone-600 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <Field label="Название">
            <input className="input-field" placeholder="Утренняя йога" value={form.title}
              onChange={set('title')} required />
          </Field>

          <Field label="Описание">
            <textarea className="input-field resize-none" rows={2}
              placeholder="Краткое описание тренировки"
              value={form.description} onChange={set('description')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Направление">
              <select className="input-field" value={form.direction} onChange={set('direction')}>
                <option value="YOGA">Йога</option>
                <option value="PILATES">Пилатес</option>
              </select>
            </Field>
            <Field label="Уровень">
              <select className="input-field" value={form.level} onChange={set('level')}>
                <option value="BEGINNER">Начинающий</option>
                <option value="INTERMEDIATE">Средний</option>
                <option value="ADVANCED">Продвинутый</option>
              </select>
            </Field>
          </div>

          <Field label="Дата и время">
            <input className="input-field" type="datetime-local"
              value={form.startAt} onChange={set('startAt')} required />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Длит. (мин)">
              <input className="input-field" type="number" min="15" max="180"
                value={form.durationMin} onChange={set('durationMin')} required />
            </Field>
            <Field label="Мест">
              <input className="input-field" type="number" min="1" max="50"
                value={form.maxSlots} onChange={set('maxSlots')} required />
            </Field>
            <Field label="Цена (₽)">
              <input className="input-field" type="number" min="0"
                placeholder="0 = бесплатно"
                value={form.price} onChange={set('price')} required />
            </Field>
          </div>

          <button type="submit" className="btn-primary w-full justify-center mt-2" disabled={loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Создать тренировку'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-body font-medium text-stone-600 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

function defaultDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000) // +1 час
  d.setMinutes(0, 0, 0)
  return d.toISOString().slice(0, 16)
}
