/**
 * Vercel settings: the frontend is served by Vercel and the backend runs separately on
 * Render, so there is no nginx proxy and the browser calls the backend's URL directly.
 * The backend must list the Vercel URL in CORS_ALLOWED_ORIGINS.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://musicbackend-ljkd.onrender.com/api',
};
