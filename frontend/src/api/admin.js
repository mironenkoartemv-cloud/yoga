import api from './client'

export const adminApi = {
  stats:          ()           => api.get('/admin/stats'),
  
  // Users
  users:          (params)     => api.get('/admin/users', { params }),
  blockUser:      (id, block)  => api.patch(`/admin/users/${id}/block`, { isBlocked: block }),
  changeRole:     (id, role)   => api.patch(`/admin/users/${id}/role`, { role }),

  // Trainers
  trainers:       (params)     => api.get('/admin/trainers', { params }),
  createTrainer:  (data)       => api.post('/admin/trainers', data),

  // Trainings
  trainings:      (params)     => api.get('/admin/trainings', { params }),
  updateTraining: (id, data)   => api.patch(`/trainings/${id}`, data),
  cancelTraining: (id)         => api.delete(`/trainings/${id}`),

  // Payments
  payments:       (params)     => api.get('/admin/payments', { params }),
  refund:         (id)         => api.post(`/payments/${id}/refund`),

  // Legal
  legal:          ()           => api.get('/admin/legal'),
  updateLegalProfile: (data)   => api.put('/admin/legal/profile', data),
  createLegalDocument: (data)  => api.post('/admin/legal/documents', data),
}
