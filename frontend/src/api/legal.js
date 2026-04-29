import api from './client'

export const legalApi = {
  profile: () => api.get('/legal/profile'),
  currentDocument: (type) => api.get(`/legal/documents/${type}/current`),
  archive: (type) => api.get(`/legal/documents/${type}/archive`),
}
