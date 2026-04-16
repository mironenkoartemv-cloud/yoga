import api from './client'

export const authApi = {
  // Email
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),

  // Phone OTP
  sendOtp:   (phone)       => api.post('/auth/phone/send-otp', { phone }),
  verifyOtp: (phone, code, name) => api.post('/auth/phone/verify-otp', { phone, code, name }),

  // Telegram (заглушка)
  telegram: (data) => api.post('/auth/telegram', data),
}
