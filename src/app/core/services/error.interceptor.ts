import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError } from '../models/music.models';

/**
 * Turns backend failures into a single readable message.
 *
 * <p>The backend answers with a consistent error envelope, so its message is preferred;
 * transport failures fall back to a generic explanation.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      let message: string;

      if (error.status === 0) {
        message = 'Cannot reach the server. Check that the backend is running.';
      } else if (isApiError(error.error)) {
        message = error.error.message;
      } else if (error.status === 404) {
        message = 'Not found.';
      } else if (error.status === 429) {
        message = 'Too many requests. Please slow down.';
      } else if (error.status >= 500) {
        message = 'The server had a problem. Please try again.';
      } else {
        message = 'Something went wrong.';
      }

      // Attach the friendly message without discarding the original response.
      return throwError(() => Object.assign(error, { userMessage: message }));
    }),
  );

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof (body as ApiError).message === 'string'
  );
}

/** Reads the friendly message attached by the interceptor. */
export function errorMessageOf(error: unknown, fallback = 'Something went wrong.'): string {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    return String((error as { userMessage: string }).userMessage);
  }
  return fallback;
}
