const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const isAdminPage = window.location.pathname.startsWith('/admin');
    const isAdminApi = endpoint.startsWith('/admin') || endpoint.startsWith('/dashboard');
    
    let token = null;
    if (isAdminPage || isAdminApi) {
      token = localStorage.getItem('admin_token') || localStorage.getItem('customer_token');
    } else {
      token = localStorage.getItem('customer_token') || localStorage.getItem('admin_token');
    }
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 && endpoint.startsWith('/admin')) {
          localStorage.removeItem('admin_token');
          window.location.href = '/admin/login.html';
        }
        throw result.error || { message: 'Something went wrong' };
      }

      return result;
    } catch (err) {
      console.error(`API Error (${endpoint}):`, err);
      throw err;
    }
  },

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};
