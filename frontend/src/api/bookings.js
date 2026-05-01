import api from './client'

export const bookingsApi = {
  create:       (trainingId) => api.post('/bookings', { trainingId }),
  cancel:       (id)         => api.delete(`/bookings/${id}`),
  my:           ()           => api.get('/bookings/my'),
  participants: (trainingId) => api.get(`/bookings/training/${trainingId}`),
}

export const paymentsApi = {
  my:           ()          => api.get('/payments/my'),
  get:          (paymentId) => api.get(`/payments/${paymentId}`),
  createLink:   (paymentId) => api.post(`/payments/${paymentId}/link`),
  stubConfirm:  (paymentId) => api.post('/payments/stub-confirm', { paymentId }),
  refund:       (id)        => api.post(`/payments/${id}/refund`),
}
