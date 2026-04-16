import { create } from 'zustand'
import { trainingsApi } from '../api/trainings'

export const useTrainingsStore = create((set, get) => ({
  trainings:  [],
  total:      0,
  loading:    false,
  error:      null,
  filters: {
    direction: '',
    level:     '',
    trainerId: '',
    from:      '',
    to:        '',
    page:      1,
    limit:     12,
  },

  setFilter: (key, value) => {
    set((s) => ({ filters: { ...s.filters, [key]: value, page: 1 } }))
    get().fetch()
  },

  setPage: (page) => {
    set((s) => ({ filters: { ...s.filters, page } }))
    get().fetch()
  },

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      // убираем пустые параметры
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== null)
      )
      const { data } = await trainingsApi.list(params)
      set({ trainings: data.data, total: data.total, loading: false })
    } catch (err) {
      set({ error: 'Не удалось загрузить тренировки', loading: false })
    }
  },

  reset: () => set({ trainings: [], total: 0, filters: {
    direction: '', level: '', trainerId: '', from: '', to: '', page: 1, limit: 12,
  }}),
}))
