import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LocalPlaylist, Track } from '../models/music.models';

/**
 * CRUD for the application's own playlists, stored in PostgreSQL.
 *
 * <p>This build has no authentication, so playlists are global: every visitor shares
 * one collection.
 *
 * <p>The service keeps a signal-backed cache of the playlist list so the sidebar stays
 * current after a change without refetching.
 */
@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/playlists`;

  private readonly _playlists = signal<LocalPlaylist[]>([]);
  private readonly _loaded = signal(false);

  readonly playlists = this._playlists.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly count = computed(() => this._playlists().length);

  /** Fetches all playlists and refreshes the cache. */
  loadPlaylists(): Observable<LocalPlaylist[]> {
    return this.http.get<LocalPlaylist[]>(this.baseUrl).pipe(
      tap((playlists) => {
        this._playlists.set(playlists);
        this._loaded.set(true);
      }),
    );
  }

  /** Fetches one playlist including its songs. Not cached: songs change often. */
  getPlaylist(id: number): Observable<LocalPlaylist> {
    return this.http.get<LocalPlaylist>(`${this.baseUrl}/${id}`);
  }

  create(name: string, description?: string): Observable<LocalPlaylist> {
    return this.http
      .post<LocalPlaylist>(this.baseUrl, { name, description: description ?? null })
      .pipe(tap((created) => this._playlists.set([created, ...this._playlists()])));
  }

  update(id: number, name: string, description?: string): Observable<LocalPlaylist> {
    return this.http
      .put<LocalPlaylist>(`${this.baseUrl}/${id}`, { name, description: description ?? null })
      .pipe(tap((updated) => this.replaceInCache(updated)));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this._playlists.set(this._playlists().filter((playlist) => playlist.id !== id))));
  }

  /**
   * Adds a track to a playlist.
   *
   * <p>The known metadata is sent along so the backend does not have to look the track
   * up on Audius again.
   */
  addSong(playlistId: number, track: Track): Observable<LocalPlaylist> {
    return this.http
      .post<LocalPlaylist>(`${this.baseUrl}/${playlistId}/songs/${track.id}`, {
        title: track.title,
        artistName: track.artistName,
        artistId: track.artistId,
        artworkUrl: track.artworkUrl,
        duration: track.duration,
      })
      .pipe(tap((updated) => this.replaceInCache(updated)));
  }

  removeSong(playlistId: number, trackId: string): Observable<LocalPlaylist> {
    return this.http
      .delete<LocalPlaylist>(`${this.baseUrl}/${playlistId}/songs/${trackId}`)
      .pipe(tap((updated) => this.replaceInCache(updated)));
  }

  /** Updates one playlist in the cached list, preserving order. */
  private replaceInCache(updated: LocalPlaylist): void {
    const current = this._playlists();
    const index = current.findIndex((playlist) => playlist.id === updated.id);
    if (index < 0) {
      this._playlists.set([updated, ...current]);
      return;
    }
    const next = [...current];
    // Songs are omitted from list responses; keep the row light and consistent.
    next[index] = { ...updated, songs: null };
    this._playlists.set(next);
  }
}
