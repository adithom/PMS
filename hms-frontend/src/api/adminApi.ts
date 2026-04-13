import api from './fetchClient';

const adminApi = {
  restartServer: () => api.post<{ message: string }>('/admin/restart'),
};

export default adminApi;
