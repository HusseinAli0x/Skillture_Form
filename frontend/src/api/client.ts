import axios from 'axios';

// Since we setup the Vite proxy, we can just hit /api and /admin
const client = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach the token if we have it
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Access tokens expire. Without this the SPA keeps rendering as "logged in"
// while every request fails, because isAuthenticated only checks that some
// string is present in localStorage.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const onLoginPage = window.location.pathname === '/login';
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      if (!onLoginPage) {
        // Full reload so every store and in-flight view is reset.
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
