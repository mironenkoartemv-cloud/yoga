import api from './client'

export const trainingsApi = {
  list:   (params) => api.get('/trainings', { params }),
  get:    (id)     => api.get(`/trainings/${id}`),
  create: (data)   => api.post('/trainings', data),
  update: (id, data) => api.patch(`/trainings/${id}`, data),
  cancel: (id)     => api.delete(`/trainings/${id}`),
  mine:   (params) => api.get('/trainings/trainer/mine', { params }),
}
