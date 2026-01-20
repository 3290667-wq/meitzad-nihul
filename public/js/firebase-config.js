// API Configuration for Meitzad Management System
// Backend API is used instead of Firebase

// API Helper for making authenticated requests
const API = {
  baseUrl: '',  // Same origin

  // Make API request
  async request(endpoint, options = {}) {
    const token = Auth?.getToken?.() || localStorage.getItem('meitzad_token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.baseUrl + endpoint, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'שגיאה בשרת');
    }

    return data;
  },

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  // POST request
  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // PUT request
  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// Expose API globally
window.API = API;

// Placeholder compatibility objects (for any code that might reference Firebase)
window.firebaseAuth = null;
window.firebaseDB = null;
window.firebaseStorage = null;

console.log('API configuration loaded');
