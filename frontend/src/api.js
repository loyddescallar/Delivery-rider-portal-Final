const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3600/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('ys_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  me: () => request('/rider/me'),
  deliveries: () => request('/deliveries'),
  history: () => request('/deliveries/history'),
  deliveryDetails: (id) => request(`/deliveries/${id}`),
  updateStatus: (id, status, remarks) => request(`/deliveries/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, remarks })
  }),
  confirmDelivery: (id) => request(`/deliveries/${id}/confirm`, {
    method: 'POST'
  })
};
