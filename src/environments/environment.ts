/**
 * Production settings.
 *
 * Note there is no Audius configuration here by design: the browser never talks to
 * Audius directly, and the API token lives only in the Spring Boot backend.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
};
