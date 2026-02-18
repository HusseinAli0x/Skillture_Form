import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1', // Proxied by Vite to localhost:8080
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth (placeholder for now)
api.interceptors.request.use((config) => {
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle global errors like 401
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default api;
