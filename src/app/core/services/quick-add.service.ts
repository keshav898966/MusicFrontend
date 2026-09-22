import { Injectable, computed, inject, signal } from '@angular/core';

import { Track } from '../models/music.models';
import { PlaylistService } from './playlist.service';

/** Name used when a playlist has to be created on the fly. */
const DEFAULT_PLAYLIST_NAME = 'My List';

/** Remembers the chosen target playlist between visits. */
const TARGET_KEY = 'music-quick-add-target';

/**
 * One-click "add this song to my playlist".
 *
 * <p>Picking a playlist from a menu on every add is tedious when a listener is really just
 * saving tracks to one list. This service keeps a target playlist — chosen once, then
 * remembered — so adding a song is a single click anywhere in the application. If no
 * playlist exists yet, the first click creates one.
 */
@Injectable({ providedIn: 'root' })
export class QuickAddService {
  private readonly playlistService = inject(PlaylistService);

  /** Id of the playlist that one-click adds go into. */
  private readonly _targetId = signal<number | null>(this.restoreTarget());

  /** Track ids added during this session, so the UI can show a saved state. */
  private readonly _added = signal<ReadonlySet<string>>(new Set());

  /** Transient message shown after an add, e.g. in a toast. */
  private readonly _notice = signal<string | null>(null);

  /** Track ids currently being saved, so a button can show progress. */
  private readonly _pending = signal<ReadonlySet<string>>(new Set());

  readonly notice = this._notice.asReadonly();

  /** The playlist one-click adds go into, when it still exists. */
  readonly target = computed(() => {
    const id = this._targetId();
    return this.playlistService.playlists().find((playlist) => playlist.id === id) ?? null;
  });

  /** True when the target playlist holds the track. */
  isAdded(trackId: string): boolean {
    return this._added().has(trackId);
  }

  /**
   * Loads the target playlist's contents so the saved state is correct after a reload.
   *
   * <p>Without this the buttons would reset to "not saved" on every refresh, even though
   * the songs are still in the playlist on the server.
   */
  syncFromServer(): void {
    const playlist = this.target() ?? this.playlistService.playlists()[0] ?? null;
    if (!playlist) {
      return;
    }

    this.setTarget(playlist.id);
    this.playlistService.getPlaylist(playlist.id).subscribe({
      next: (full) => this._added.set(new Set((full.songs ?? []).map((song) => song.trackId))),
      error: () => undefined,
    });
  }

  /** True while the track is being saved. */
  isPending(trackId: string): boolean {
    return this._pending().has(trackId);
  }

  /** Chooses which playlist one-click adds go into. */
  setTarget(playlistId: number): void {
    this._targetId.set(playlistId);
    try {
      localStorage.setItem(TARGET_KEY, String(playlistId));
    } catch {
      // Storage may be unavailable; the choice simply will not persist.
    }
  }

  /**
   * Adds a track to the target playlist in one step.
   *
   * <p>Resolves the target first: the remembered playlist if it still exists, otherwise
   * the most recent one, otherwise a newly created default. That is what allows the very
   * first click to succeed without any setup.
   */
  add(track: Track): void {
    if (this.isPending(track.id)) {
      return;
    }

    const existing = this.target() ?? this.playlistService.playlists()[0] ?? null;

    if (existing) {
      this.setTarget(existing.id);
      this.save(existing.id, existing.name, track);
      return;
    }

    // No playlists yet — create one, then add into it.
    this.markPending(track.id, true);
    this.playlistService.create(DEFAULT_PLAYLIST_NAME).subscribe({
      next: (created) => {
        this.setTarget(created.id);
        this.markPending(track.id, false);
        this.save(created.id, created.name, track);
      },
      error: () => {
        this.markPending(track.id, false);
        this.flash('Could not create a playlist.');
      },
    });
  }

  /**
   * Adds the track, or removes it when the playlist already holds it.
   *
   * <p>A single control that reflects and flips the current state is less confusing than
   * separate add and remove buttons, especially in the player bar where space is tight.
   */
  toggle(track: Track): void {
    if (this.isPending(track.id)) {
      return;
    }

    const playlist = this.target();
    if (playlist && this.isAdded(track.id)) {
      this.remove(playlist.id, playlist.name, track);
      return;
    }

    this.add(track);
  }

  /** Removes a track from the target playlist. */
  private remove(playlistId: number, playlistName: string, track: Track): void {
    this.markPending(track.id, true);

    this.playlistService.removeSong(playlistId, track.id).subscribe({
      next: () => {
        this.markPending(track.id, false);
        const next = new Set(this._added());
        next.delete(track.id);
        this._added.set(next);
        this.flash(`Removed from ${playlistName}`);
      },
      error: () => {
        this.markPending(track.id, false);
        this.flash('Could not remove the song.');
      },
    });
  }

  private save(playlistId: number, playlistName: string, track: Track): void {
    this.markPending(track.id, true);

    this.playlistService.addSong(playlistId, track).subscribe({
      next: () => {
        this.markPending(track.id, false);
        this._added.set(new Set([...this._added(), track.id]));
        this.flash(`Saved to ${playlistName}`);
      },
      error: (error: { status?: number }) => {
        this.markPending(track.id, false);
        // 409 means the playlist already holds it, which is a success from here.
        if (error?.status === 409) {
          this._added.set(new Set([...this._added(), track.id]));
          this.flash(`Already in ${playlistName}`);
          return;
        }
        this.flash('Could not save the song.');
      },
    });
  }

  private markPending(trackId: string, pending: boolean): void {
    const next = new Set(this._pending());
    if (pending) {
      next.add(trackId);
    } else {
      next.delete(trackId);
    }
    this._pending.set(next);
  }

  private flash(message: string): void {
    this._notice.set(message);
    setTimeout(() => {
      if (this._notice() === message) {
        this._notice.set(null);
      }
    }, 2600);
  }

  private restoreTarget(): number | null {
    try {
      const raw = localStorage.getItem(TARGET_KEY);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
