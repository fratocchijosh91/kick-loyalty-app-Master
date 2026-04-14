/**
 * Single source for API base URL.
 * - Production: set VITE_API_URL on the host (e.g. https://your-api.onrender.com/api).
 * - Dev: defaults to http://localhost:5000/api (Vite still proxies /api if you prefer .env empty).
 */
export function apiBase() {
  const v = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (v) return v;
  if (import.meta.env.DEV) return 'http://localhost:5000/api';
  return '/api';
}

/**
 * @param {string} path - Route after /api/, e.g. "auth/login" or "organizations"
 */
export function apiUrl(path) {
  const s = String(path).replace(/^\/+/, '').replace(/^api\/?/, '');
  return `${apiBase()}/${s}`;
}
