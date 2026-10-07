import axios from 'axios';
import { getHostKey } from '../lib/hostKey';

/** True for /admin and anything below it, but not for look-alikes such as /administrators. */
const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

// Since we setup the Vite proxy, we can just hit /api and /admin
const client = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Every request carries the admin token (if signed in). Requests from public
// pages also carry this browser's host key: that is what lets a visitor create
// and host quizzes without an account, and the server uses the bearer token
// first and falls back to the key.
//
// Inside /admin the key is deliberately left off. With it, an expired admin
// token would not produce a 401 — the server would quietly treat the admin as a
// visitor, the sign-in redirect below would never fire, and "New quiz" would
// create a game owned by the browser instead of the admin.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!isAdminPath(window.location.pathname)) {
    config.headers['X-Host-Key'] = getHostKey();
  }
  return config;
});

// Access tokens expire. Without this the SPA keeps rendering as "logged in"
// while every request fails, because isAuthenticated only checks that some
// string is present in localStorage. Only the admin area reacts: on public
// pages (hosting a game as a visitor) a 401 is just a failed request, and
// bouncing to /login would break hosting.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isAdminPath(window.location.pathname)) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      // Full reload so every store and in-flight view is reset.
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default client;
