import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';

import { PlayerService } from './player.service';

/** How far the lock-screen seek buttons jump when the OS does not say. */
const DEFAULT_SEEK_SECONDS = 10;

/**
 * Publishes playback to the operating system through the Media Session API.
 *
 * <p>This is what puts the title, artist and artwork on the phone's lock screen and in
 * the notification shade, with working play, pause, next, previous and seek controls.
 * It also tells the browser the page is a media player, which is what Android relies on
 * to keep audio going while the screen is locked.
 *
 * <p>Tracks played through the YouTube embed are the exception: the YouTube player pauses
 * itself when the page is hidden, and its terms do not allow working around that.
 */
@Injectable({ providedIn: 'root' })
export class MediaSessionService {
  private readonly player = inject(PlayerService);
  private readonly session = inject(DOCUMENT).defaultView?.navigator?.mediaSession ?? null;

  constructor() {
    const session = this.session;
    if (!session) {
      return; // Unsupported browser: everything else keeps working without it.
    }

    this.registerActions(session);

    effect(() => {
      const track = this.player.currentTrack();
      if (!track) {
        session.metadata = null;
        return;
      }
      const artwork = track.artworkUrl ?? track.artworkThumbUrl;
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artistName,
        artwork: artwork ? [{ src: artwork, sizes: '480x480' }] : [],
      });
    });

    effect(() => {
      session.playbackState = !this.player.hasTrack() ? 'none' : this.player.isPlaying() ? 'playing' : 'paused';
    });

    // Keeps the lock-screen progress bar in step with the track.
    effect(() => {
      const duration = this.player.duration();
      const position = this.player.currentTime();
      if (!session.setPositionState || !Number.isFinite(duration) || duration <= 0) {
        return;
      }
      try {
        session.setPositionState({ duration, position: Math.min(Math.max(position, 0), duration), playbackRate: 1 });
      } catch {
        // Rejected while a new track's duration is still settling; the next tick corrects it.
      }
    });
  }

  private registerActions(session: MediaSession): void {
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.player.resume()],
      ['pause', () => this.player.pause()],
      ['stop', () => this.player.pause()],
      ['previoustrack', () => this.player.previous()],
      ['nexttrack', () => this.player.next()],
      ['seekto', (details) => {
        if (details.seekTime != null) {
          this.player.seek(details.seekTime);
        }
      }],
      ['seekbackward', (details) =>
        this.player.seek(Math.max(this.player.currentTime() - (details.seekOffset ?? DEFAULT_SEEK_SECONDS), 0))],
      ['seekforward', (details) =>
        this.player.seek(this.player.currentTime() + (details.seekOffset ?? DEFAULT_SEEK_SECONDS))],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Browsers throw for actions they do not support; the others still register.
      }
    }
  }
}
