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

export default client;
