import { create } from 'zustand'
import { authApi } from '../api/auth'

export const useAuthStore = create((set, get) => ({
  user:    null,
  token:   sessionStorage.getItem('token') || null,
  loading: false,
  error:   null,

  // Инициализация — проверить токен при старте приложения
  init: async () => {
    const token = sessionStorage.getItem('token')
    if (!token) return
    try {
      set({ loading: true })
      const { data } = await authApi.me()
      set({ user: data.user, token, loading: false })
    } catch {
      sessionStorage.removeItem('token')
      set({ user: null, token: null, loading: false })
    }
  },

  // Регистрация по email
  registerByEmail: async (email, password, name, role = 'STUDENT', trainerBio) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.register({ email, password, name, role, trainerBio })
      sessionStorage.setItem('token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка регистрации'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  // Вход по email
  loginByEmail: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.login({ email, password })
      sessionStorage.setItem('token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return data
    } catch (err) {
      const msg = err.response?.data?.error || 'Неверный email или пароль'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  // Отправить OTP
  sendOtp: async (phone) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.sendOtp(phone)
      set({ loading: false })
      return data
    } catch (err) {
      const msg = err.response?.data?.error || 'Не удалось отправить SMS'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  // Подтвердить OTP
  verifyOtp: async (phone, code, name) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.verifyOtp(phone, code, name)
      sessionStorage.setItem('token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return data
    } catch (err) {
      const msg = err.response?.data?.error || 'Неверный код'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  logout: () => {
    sessionStorage.removeItem('token')
    set({ user: null, token: null, error: null })
    window.location.href = '/login'
  },

  clearError: () => set({ error: null }),

  isAuthenticated: () => !!get().token,
  isTrainer: ()       => get().user?.role === 'TRAINER',
  isAdmin:   ()       => get().user?.role === 'ADMIN',
}))
