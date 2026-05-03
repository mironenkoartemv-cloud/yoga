import api from './client'

export const usersApi = {
  me:             ()      => api.get('/users/me'),
  discount:       ()      => api.get('/users/me/discount'),
  pendingBooking: ()      => api.get('/users/me/pending-booking'),
  updateMe:       (data)  => api.patch('/users/me', data),
  changePassword: (data)  => api.patch('/users/me/password', data),
  trainers:       ()      => api.get('/users/trainers'),
  trainer:        (id)    => api.get(`/users/trainers/${id}`),
}

export const historyApi = {
  list: (params) => api.get('/history', { params }),
}

export const notificationsApi = {
  list:    (params) => api.get('/notifications', { params }),
  read:    (id)     => api.patch(`/notifications/${id}/read`),
  readAll: ()       => api.patch('/notifications/read-all'),
}
