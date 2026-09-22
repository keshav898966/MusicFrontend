import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, throwError, timer } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { Artist, PageResponse, PlaylistSummary, StreamUrl, Track } from '../models/music.models';

/**
 * How long a resolved stream URL may be reused.
 *
 * <p>Audius signatures last considerably longer, but a short window keeps a stale URL from
 * ever reaching the audio element while still covering prefetch and immediate replay.
 */
const STREAM_URL_CACHE_MS = 3 * 60 * 1000;

/**
 * Talks to the Spring Boot backend for all music data.
 *
 * <p>The browser never calls Audius directly — the backend holds the credentials and
 * performs every upstream request.
 */
@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/music`;

  /**
   * Caches in-flight and completed requests for data that does not change between
   * views, so revisiting the home page does not refetch the trending chart.
   */
  private readonly cache = new Map<string, Observable<unknown>>();

  /**
   * Recently resolved stream URLs, keyed by track id.
   *
   * <p>Held separately from {@link #cache} because these entries expire on a clock rather
   * than living for the session: the URLs carry a time-limited signature.
   */
  private readonly streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

  /** Trending tracks. */
  getTrending(limit = 20, offset = 0, genre?: string): Observable<PageResponse<Track>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (genre) {
      params = params.set('genre', genre);
    }

    return this.cached(
      `trending:${limit}:${offset}:${genre ?? ''}`,
      this.http.get<PageResponse<Track>>(`${this.baseUrl}/trending`, { params }),
    );
  }

  /** Trending tracks from lesser-known artists. */
  getUnderground(limit = 20, offset = 0): Observable<PageResponse<Track>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);

    return this.cached(
      `underground:${limit}:${offset}`,
      this.http.get<PageResponse<Track>>(`${this.baseUrl}/trending/underground`, { params }),
    );
  }

  /** Playlists trending on Audius. */
  getTrendingPlaylists(limit = 12, offset = 0): Observable<PageResponse<PlaylistSummary>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);

    return this.cached(
      `audiusPlaylists:${limit}:${offset}`,
      this.http.get<PageResponse<PlaylistSummary>>(`${this.baseUrl}/playlists/trending`, { params }),
    );
  }

  /**
   * Searches tracks.
   *
   * <p>Blank queries resolve to an empty page without a network call.
   */
  searchTracks(query: string, limit = 20, offset = 0, cursor?: string | null): Observable<PageResponse<Track>> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of({ items: [], offset: 0, limit, count: 0, hasMore: false, nextCursor: null });
    }

    let params = new HttpParams().set('q', trimmed).set('limit', limit);
    // A cursor supersedes the offset; the backend ignores offset when one is present.
    if (cursor) {
      params = params.set('cursor', cursor);
    } else {
      params = params.set('offset', offset);
    }

    return this.http.get<PageResponse<Track>>(`${this.baseUrl}/search`, { params });
  }

  /**
   * Runs several searches in one request.
   *
   * <p>The backend fans them out concurrently, so a page built from ten category searches
   * costs roughly one search instead of ten — and it is one HTTP request rather than ten
   * competing for the browser's connection budget.
   */
  searchTracksBatch(queries: string[], limit = 12): Observable<Record<string, Track[]>> {
    const cleaned = queries.map((query) => query.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return of({});
    }

    let params = new HttpParams().set('limit', limit);
    for (const query of cleaned) {
      params = params.append('q', query);
    }

    // Deliberately not run through the session cache: the home page uses this to show a
    // different selection on each visit, and a cached response would defeat that. The
    // backend still caches upstream, so a repeat is cheap without being identical here.
    return this.http.get<Record<string, Track[]>>(`${this.baseUrl}/search/batch`, { params });
  }

  /** Searches artists. */
  searchArtists(query: string, limit = 8): Observable<Artist[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of([]);
    }

    const params = new HttpParams().set('q', trimmed).set('limit', limit);
    return this.http
      .get<Artist[]>(`${this.baseUrl}/search/artists`, { params })
      // An artist-search failure must not blank out the track results beside it.
      .pipe(catchError(() => of([])));
  }

  /** A single track. */
  getTrack(trackId: string): Observable<Track> {
    return this.cached(`track:${trackId}`, this.http.get<Track>(`${this.baseUrl}/tracks/${trackId}`));
  }

  /**
   * Resolves the signed CDN URL to feed to the audio element.
   *
   * <p>Resolving costs a redirect round-trip to Audius (roughly 1.2s cold), which is the
   * single largest delay between pressing play and hearing sound. Results are therefore
   * held briefly in {@link #streamUrlCache} so a prefetched track starts instantly. The
   * window is kept well inside the lifetime of the signature Audius puts on the URL.
   *
   * <p>A transient failure is retried twice with a short backoff, since playback is the
   * one action where a retry is clearly worth the wait.
   */
  getStreamUrl(trackId: string, prefetch = false): Observable<string> {
    const cached = this.streamUrlCache.get(trackId);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.url);
    }

    // prefetch=true asks the backend to resolve the whole CDN chain. That costs an extra
    // round trip, which is free while warming but would delay interactive playback.
    const params = prefetch ? new HttpParams().set('prefetch', true) : undefined;

    return this.http.get<StreamUrl>(`${this.baseUrl}/tracks/${trackId}/stream-url`, { params }).pipe(
      retry({ count: 2, delay: (_error, retryCount) => timer(retryCount * 400) }),
      map((response) => {
        this.streamUrlCache.set(trackId, {
          url: response.streamUrl,
          expiresAt: Date.now() + STREAM_URL_CACHE_MS,
        });
        this.pruneStreamUrlCache();
        return response.streamUrl;
      }),
      catchError((error) => throwError(() => error)),
    );
  }

  /**
   * Resolves a stream URL ahead of time and discards the result.
   *
   * <p>Called for the next track in the queue while the current one plays, so skipping
   * forward starts without waiting on the Audius redirect. Failures are ignored: this is
   * an optimisation, and the real request will surface any genuine error.
   */
  prefetchStreamUrl(trackId: string): void {
    const cached = this.streamUrlCache.get(trackId);
    if (cached && cached.expiresAt > Date.now()) {
      return;
    }
    this.getStreamUrl(trackId, true).subscribe({ error: () => undefined });
  }

  /** Drops expired entries so the map cannot grow without bound. */
  private pruneStreamUrlCache(): void {
    if (this.streamUrlCache.size < 60) {
      return;
    }
    const now = Date.now();
    for (const [key, value] of this.streamUrlCache) {
      if (value.expiresAt <= now) {
        this.streamUrlCache.delete(key);
      }
    }
  }

  /** An artist profile. */
  getArtist(artistId: string): Observable<Artist> {
    return this.cached(`artist:${artistId}`, this.http.get<Artist>(`${this.baseUrl}/artists/${artistId}`));
  }

  /** Tracks uploaded by an artist. */
  getArtistTracks(
    artistId: string,
    limit = 20,
    offset = 0,
    cursor?: string | null,
  ): Observable<PageResponse<Track>> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    } else {
      params = params.set('offset', offset);
    }

    return this.cached(
      `artistTracks:${artistId}:${limit}:${cursor ?? offset}`,
      this.http.get<PageResponse<Track>>(`${this.baseUrl}/artists/${artistId}/tracks`, { params }),
    );
  }

  /** Empties the in-memory cache, e.g. on an explicit refresh. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Shares one request among all subscribers and replays its result to later ones.
   *
   * <p>{@code shareReplay({refCount: false})} keeps the value after the last subscriber
   * leaves, which is what makes navigating away and back free.
   */
  private cached<T>(key: string, request: Observable<T>): Observable<T> {
    const existing = this.cache.get(key) as Observable<T> | undefined;
    if (existing) {
      return existing;
    }

    const shared = request.pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      // A failed request must not be cached, or the error would be replayed forever.
      catchError((error) => {
        this.cache.delete(key);
        return throwError(() => error);
      }),
    );

    this.cache.set(key, shared);
    return shared;
  }
}
