import api from './client'

export const authApi = {
  // Email (оставляем для совместимости)
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),

  // Phone OTP
  sendOtp:   (phone, purpose)                      => api.post('/auth/phone/send-otp', { phone, purpose }),
  verifyOtp: (phone, code, name, password, role, trainerBio) =>
    api.post('/auth/phone/verify-otp', { phone, code, name, password, role, trainerBio }),

  // Phone + password (вход без SMS)
  loginByPhone: (phone, password) => api.post('/auth/login-by-phone', { phone, password }),

  // Telegram
  telegram: (data) => api.post('/auth/telegram', data),
}