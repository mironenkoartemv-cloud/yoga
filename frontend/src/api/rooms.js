import api from './client'

export const roomsApi = {
  state: (trainingId) => api.get(`/rooms/${trainingId}`),
  livekitToken: (trainingId) => api.post(`/rooms/${trainingId}/livekit-token`),
}
