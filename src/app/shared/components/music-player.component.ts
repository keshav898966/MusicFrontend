import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Track } from '../../core/models/music.models';

import { ImageFallbackDirective } from '../directives/image-fallback.directive';
import { PlayerService } from '../../core/services/player.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { YoutubePlayerService } from '../../core/services/youtube-player.service';
import { ProgressBarComponent } from './progress-bar.component';
import { QueuePanelComponent } from './queue-panel.component';
import { VolumeControlComponent } from './volume-control.component';

/**
 * The fixed player bar.
 *
 * <p>Rendered once by the app shell, outside the router outlet, so navigating between
 * pages never tears it down and playback continues uninterrupted.
 */
@Component({
  selector: 'app-music-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFallbackDirective, RouterLink, ProgressBarComponent, VolumeControlComponent, QueuePanelComponent],
  template: `
    @if (player.hasTrack()) {
      <div class="player" role="region" aria-label="Music player">
        @if (player.error(); as message) {
          <div class="banner" role="alert">
            <span>{{ message }}</span>
            <button type="button" (click)="player.retry()">Retry</button>
          </div>
        }

        <div class="bar">
          <!-- Now playing -->
          <div class="now-playing">
            <!-- Outside the @if on purpose: the IFrame API replaces the element it mounts
                 into, so Angular must never destroy and recreate it. Keeping it here means
                 the same player instance survives every track change.

                 The artwork sits over the video and lifts on hover, so the bar reads as a
                 normal music player at rest while the video stays one gesture away. -->
            <div class="video-panel" [class.active]="youtube.hasVideo()">
              <div #videoHost></div>

              @if (player.currentTrack(); as track) {
                @if (track.artworkThumbUrl || track.artworkUrl) {
                  <img
                    class="video-cover"
                    [src]="track.artworkThumbUrl || track.artworkUrl"
                    alt=""
                    aria-hidden="true"
                    appImageFallback
                  />
                }
              }
            </div>

            @if (player.currentTrack(); as track) {
              @if (!youtube.hasVideo()) {
                            <a class="art" [routerLink]="['/track', track.id]" [attr.aria-label]="track.title">
                @if (track.artworkThumbUrl || track.artworkUrl) {
                  <img [src]="track.artworkThumbUrl || track.artworkUrl" alt="" appImageFallback />
                } @else {
                  <span class="placeholder" aria-hidden="true">♪</span>
                }
                @if (player.loading()) {
                  <span class="art-spinner" aria-hidden="true"></span>
                }
              </a>
              }

              <div class="details">
                <a class="title truncate" [routerLink]="['/track', track.id]">{{ track.title }}</a>
                @if (track.artistId) {
                  <a class="artist truncate" [routerLink]="['/artist', track.artistId]">
                    {{ track.artistName }}
                  </a>
                } @else {
                  <span class="artist truncate">{{ track.artistName }}</span>
                }
              </div>

              <!-- Adds the playing track to the playlist, or removes it if already saved. -->
              <button
                type="button"
                class="btn-icon save"
                [class.saved]="isSaved()"
                [disabled]="isSaving()"
                [attr.aria-pressed]="isSaved()"
                [attr.aria-label]="isSaved() ? 'Remove from playlist' : 'Add to playlist'"
                [title]="isSaved() ? 'Remove from playlist' : 'Add to playlist'"
                (click)="toggleSave(track)"
              >
                @if (isSaved()) {
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 21s-7.5-4.7-9.4-9A5.3 5.3 0 0 1 12 6.1 5.3 5.3 0 0 1 21.4 12c-1.9 4.3-9.4 9-9.4 9z" />
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M12 21s-7.5-4.7-9.4-9A5.3 5.3 0 0 1 12 6.1 5.3 5.3 0 0 1 21.4 12c-1.9 4.3-9.4 9-9.4 9z"
                          stroke-linejoin="round" />
                  </svg>
                }
              </button>
            }
          </div>

          <!-- Transport and progress -->
          <div class="center">
            <div class="controls">
              <button
                type="button"
                class="btn-icon"
                [class.active]="player.shuffle()"
                [attr.aria-pressed]="player.shuffle()"
                aria-label="Shuffle"
                title="Shuffle"
                (click)="player.toggleShuffle()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                class="btn-icon"
                aria-label="Previous track"
                title="Previous"
                [disabled]="!player.canGoPrevious()"
                (click)="player.previous()"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 5h2v14H6zM19 5.5v13a1 1 0 0 1-1.55.83l-9-6.5a1 1 0 0 1 0-1.66l9-6.5A1 1 0 0 1 19 5.5z" />
                </svg>
              </button>

              <button
                type="button"
                class="play-pause"
                [attr.aria-label]="player.isPlaying() ? 'Pause' : 'Play'"
                [title]="player.isPlaying() ? 'Pause' : 'Play'"
                (click)="player.togglePlayPause()"
              >
                @if (player.loading()) {
                  <span class="spinner" aria-hidden="true"></span>
                } @else if (player.isPlaying()) {
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
                  </svg>
                }
              </button>

              <button
                type="button"
                class="btn-icon"
                aria-label="Next track"
                title="Next"
                [disabled]="!player.canGoNext()"
                (click)="player.next()"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16 5h2v14h-2zM5 5.5v13a1 1 0 0 0 1.55.83l9-6.5a1 1 0 0 0 0-1.66l-9-6.5A1 1 0 0 0 5 5.5z" />
                </svg>
              </button>

              <button
                type="button"
                class="btn-icon"
                [class.active]="player.repeatMode() !== 'off'"
                [attr.aria-label]="'Repeat: ' + player.repeatMode()"
                [title]="repeatTitle()"
                (click)="player.cycleRepeatMode()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                @if (player.repeatMode() === 'one') {
                  <span class="badge" aria-hidden="true">1</span>
                }
              </button>
            </div>

            <app-progress-bar
              [currentTime]="player.currentTime()"
              [duration]="player.duration()"
              (seek)="player.seek($event)"
            />
          </div>

          <!-- Volume and queue -->
          <div class="right">
            <app-volume-control
              [volume]="player.volume()"
              [muted]="player.muted()"
              (volumeChange)="player.setVolume($event)"
              (toggleMute)="player.toggleMute()"
            />

            <button
              type="button"
              class="btn-icon"
              [class.active]="queueOpen()"
              [attr.aria-expanded]="queueOpen()"
              aria-label="Toggle play queue"
              title="Queue"
              (click)="toggleQueue()"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 6h13M3 12h13M3 18h9M19 10v9M19 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" stroke-linecap="round" />
              </svg>
              @if (player.queue().length > 0) {
                <span class="queue-count">{{ player.queue().length }}</span>
              }
            </button>
          </div>
        </div>
      </div>

      @if (queueOpen()) {
        <div class="queue-backdrop" (click)="closeQueue()" aria-hidden="true"></div>
        <div class="queue-host">
          <app-queue-panel (close)="closeQueue()" />
        </div>
      }
    }
  `,
  styles: [
    `
      .player {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 50;
        background: rgba(16, 16, 25, 0.94);
        backdrop-filter: blur(18px);
        border-top: 1px solid var(--border);
      }

      .banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 7px 16px;
        background: rgba(248, 113, 113, 0.14);
        color: var(--danger);
        font-size: 0.8125rem;
      }

      .banner button {
        color: var(--text-primary);
        text-decoration: underline;
        font-weight: 500;
      }

      .bar {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr) minmax(180px, 1fr);
        align-items: center;
        gap: 18px;
        height: var(--player-height);
        padding: 0 18px;
      }

      /* ------------------------------------------------------ now playing */

      .now-playing {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .art {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--bg-sunken);
        flex-shrink: 0;
      }

      .art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .placeholder {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        color: var(--text-muted);
      }

      .art-spinner {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 22px;
        height: 22px;
        border: 2px solid rgba(255, 255, 255, 0.25);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 700ms linear infinite;
        background: rgba(0, 0, 0, 0.25);
      }

      .details {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .title {
        font-weight: 600;
        font-size: 0.875rem;
      }

      .title:hover {
        color: var(--accent-bright);
      }

      .artist {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      a.artist:hover {
        color: var(--accent-bright);
        text-decoration: underline;
      }

      /*
       * The YouTube player.
       *
       * Sized as a small strip beside the artwork rather than replacing it. YouTube's
       * terms require the player to stay visible and unobscured while it plays, so it is
       * never hidden or covered — but it does not need to be the largest thing in the bar,
       * and at this size its own centre overlay is not what the eye lands on.
       */
      .video-panel {
        position: relative;
        display: none;
        width: 56px;
        height: 56px;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: var(--radius-sm);
        background: #000;
      }

      /*
       * Album art laid over the player.
       *
       * The YouTube player draws its own controls in the centre of the frame, which cannot
       * be styled away from outside the iframe. Rather than fight that, the artwork covers
       * it at rest and lifts on hover, so the video is always one gesture away without the
       * bar looking like an embedded video the rest of the time.
       */
      .video-cover {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* Clicks land on the player underneath, not on the image. */
        pointer-events: none;
        transition: opacity var(--transition-base);
      }

      .video-panel:hover .video-cover,
      .video-panel:focus-within .video-cover {
        opacity: 0;
      }

      /*
       * Fills the square frame by scaling the 16:9 video and letting the panel crop the
       * sides, so no letterbox bars show through.
       *
       * ::ng-deep is required here: the YouTube API creates the iframe itself, so it
       * carries none of Angular's scoping attributes and a plain selector never matches.
       */
      .video-panel > div,
      :host ::ng-deep .video-panel iframe {
        width: 178%;
        height: 100%;
        margin-left: -39%;
        border: 0;
      }

      /* Shown only while a YouTube track plays; never hidden during playback, which is
         what YouTube's terms require. */
      .video-panel.active {
        display: block;
      }

      .now-playing .save {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
      }

      .now-playing .save svg {
        width: 17px;
        height: 17px;
      }

      .now-playing .save.saved {
        color: var(--accent-secondary);
      }

      /* --------------------------------------------------------- controls */

      .center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 0;
        width: 100%;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .btn-icon.active {
        color: var(--accent-bright);
      }

      .btn-icon {
        position: relative;
      }

      .btn-icon svg {
        width: 18px;
        height: 18px;
      }

      .badge {
        position: absolute;
        right: 3px;
        bottom: 3px;
        font-size: 0.5625rem;
        font-weight: 700;
        line-height: 1;
        color: var(--accent-bright);
      }

      .queue-count {
        position: absolute;
        top: 1px;
        right: 0;
        min-width: 15px;
        padding: 1px 3px;
        font-size: 0.5625rem;
        font-weight: 700;
        color: var(--text-on-accent);
        background: var(--accent);
        border-radius: var(--radius-full);
      }

      .play-pause {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        margin: 0 4px;
        border-radius: 50%;
        background: var(--text-primary);
        color: var(--bg-base);
        transition: transform var(--transition-fast);
      }

      .play-pause:hover {
        transform: scale(1.07);
      }

      .play-pause svg {
        width: 20px;
        height: 20px;
      }

      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(0, 0, 0, 0.2);
        border-top-color: var(--bg-base);
        border-radius: 50%;
        animation: spin 700ms linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      app-progress-bar {
        width: 100%;
        max-width: 560px;
      }

      /* ------------------------------------------------------------ right */

      .right {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
      }

      /* ------------------------------------------------------ queue panel */

      .queue-backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: rgba(0, 0, 0, 0.5);
        animation: fade 160ms ease;
      }

      .queue-host {
        position: fixed;
        top: 0;
        right: 0;
        bottom: var(--player-height);
        z-index: 61;
        animation: slide 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes fade {
        from { opacity: 0; }
      }

      @keyframes slide {
        from { transform: translateX(100%); }
      }

      /* ------------------------------------------------------ responsive */

      @media (max-width: 900px) {
        .bar {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          padding: 0 12px;
        }

        /* On narrow screens the transport moves beside the artwork and the
           progress bar spans the full width beneath it. */
        .center {
          grid-column: 1 / -1;
          grid-row: 2;
          padding-bottom: 6px;
        }

        .right {
          grid-column: 2;
          grid-row: 1;
        }

        .player .bar {
          height: auto;
          padding-top: 10px;
        }
      }

      @media (max-width: 560px) {
        .art {
          width: 46px;
          height: 46px;
        }

        app-volume-control {
          display: none; /* volume is handled by the device on mobile */
        }
      }
    `,
  ],
})
export class MusicPlayerComponent {
  readonly player = inject(PlayerService);
  private readonly quickAdd = inject(QuickAddService);

  /** Drives the visible video panel that YouTube playback requires. */
  readonly youtube = inject(YoutubePlayerService);

  /** Host element the YouTube iframe mounts into. */
  private readonly videoHost = viewChild<ElementRef<HTMLElement>>('videoHost');

  constructor() {
    // The panel only exists once a track is loaded, so the host is handed over when it
    // appears rather than at construction.
    effect(() => {
      const host = this.videoHost();
      if (host) {
        this.youtube.attachHost(host.nativeElement);
      }
    });
  }

  /** True when the playing track is in the target playlist. */
  readonly isSaved = computed(() => {
    const track = this.player.currentTrack();
    return track ? this.quickAdd.isAdded(track.id) : false;
  });

  /** True while the add or remove request is in flight. */
  readonly isSaving = computed(() => {
    const track = this.player.currentTrack();
    return track ? this.quickAdd.isPending(track.id) : false;
  });

  /** Adds the track, or removes it when it is already saved. */
  toggleSave(track: Track): void {
    this.quickAdd.toggle(track);
  }

  private readonly _queueOpen = signal(false);
  readonly queueOpen = this._queueOpen.asReadonly();

  toggleQueue(): void {
    this._queueOpen.set(!this._queueOpen());
  }

  closeQueue(): void {
    this._queueOpen.set(false);
  }

  repeatTitle(): string {
    switch (this.player.repeatMode()) {
      case 'all':
        return 'Repeat queue';
      case 'one':
        return 'Repeat track';
      default:
        return 'Repeat off';
    }
  }

  /**
   * Global keyboard shortcuts.
   *
   * <p>Ignored while typing, so the search box keeps working normally.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    switch (event.key) {
      case ' ':
        if (this.player.hasTrack()) {
          event.preventDefault();
          this.player.togglePlayPause();
        }
        break;
      case 'ArrowRight':
        if (event.shiftKey) {
          event.preventDefault();
          this.player.next();
        }
        break;
      case 'ArrowLeft':
        if (event.shiftKey) {
          event.preventDefault();
          this.player.previous();
        }
        break;
      case 'm':
      case 'M':
        this.player.toggleMute();
        break;
      case 'Escape':
        this.closeQueue();
        break;
      default:
        break;
    }
  }
}
