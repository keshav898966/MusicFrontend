import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageFallbackDirective } from '../directives/image-fallback.directive';
import { Track } from '../../core/models/music.models';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { formatCount, formatDuration } from '../../core/utils/format';

/**
 * A track presented as an artwork card, used in grids.
 *
 * <p>The card never creates an audio element: it asks {@link PlayerService} to play,
 * which is what keeps a single playback instance for the whole application.
 */
@Component({
  selector: 'app-music-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFallbackDirective, RouterLink],
  template: `
    <article class="card" [class.playing]="isCurrent()" (pointerenter)="onHover()" (focusin)="onHover()">
      <div class="art">
        @if (track().artworkUrl) {
          <img [src]="track().artworkUrl" [alt]="" loading="lazy" decoding="async" appImageFallback />
        } @else {
          <div class="placeholder" aria-hidden="true">♪</div>
        }

        <button
          type="button"
          class="play"
          [class.visible]="isCurrent()"
          [attr.aria-label]="isCurrentlyPlaying() ? 'Pause ' + track().title : 'Play ' + track().title"
          (click)="onPlay($event)"
        >
          @if (isCurrentlyPlaying()) {
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
          class="queue"
          [attr.aria-label]="'Add ' + track().title + ' to queue'"
          title="Add to queue"
          (click)="onAddToQueue($event)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h13M3 12h9M3 18h9M17 12v8M13 16h8" stroke-linecap="round" />
          </svg>
        </button>

        <!-- One click saves to the playlist, creating "My List" the first time. -->
        <button
          type="button"
          class="save"
          [class.saved]="isSaved()"
          [disabled]="isSaving()"
          [attr.aria-label]="isSaved() ? track().title + ' saved to playlist' : 'Save ' + track().title + ' to playlist'"
          [title]="isSaved() ? 'Saved to playlist' : 'Save to playlist'"
          (click)="onSave($event)"
        >
          @if (isSaving()) {
            <span class="dots" aria-hidden="true"></span>
          } @else if (isSaved()) {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          }
        </button>

        @if (track().previewOnly) {
          <span class="preview-badge" title="Apple Music preview — about 30 seconds">PREVIEW</span>
        }

        @if (track().duration) {
          <span class="duration">{{ duration() }}</span>
        }
      </div>

      <div class="meta">
        <a class="title truncate" [routerLink]="['/track', track().id]" [title]="track().title">
          {{ track().title }}
        </a>

        @if (track().artistId) {
          <a class="artist truncate" [routerLink]="['/artist', track().artistId]">
            {{ track().artistName }}
            @if (track().artistVerified) {
              <span class="verified" title="Verified artist" aria-label="Verified">✓</span>
            }
          </a>
        } @else {
          <span class="artist truncate">{{ track().artistName }}</span>
        }

        @if (track().playCount) {
          <span class="plays">{{ plays() }} plays</span>
        }
      </div>
    </article>
  `,
  styles: [
    `
      .card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        background: var(--bg-surface);
        border: 1px solid transparent;
        border-radius: var(--radius-lg);
        transition: background var(--transition-base), border-color var(--transition-base),
          transform var(--transition-base);
      }

      .card:hover {
        background: var(--bg-elevated);
        transform: translateY(-3px);
      }

      .card.playing {
        border-color: var(--accent);
        background: var(--gradient-subtle);
      }

      .art {
        position: relative;
        aspect-ratio: 1;
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--bg-sunken);
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
        font-size: 2.5rem;
        color: var(--text-muted);
        background: var(--gradient-subtle);
      }

      .play {
        position: absolute;
        right: 10px;
        bottom: 10px;
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: var(--gradient-aurora);
        color: var(--text-on-accent);
        box-shadow: var(--shadow-md);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity var(--transition-base), transform var(--transition-base);
      }

      .play svg {
        width: 22px;
        height: 22px;
      }

      /* Reveal on hover, and keep it visible for the track that is playing. */
      .card:hover .play,
      .play.visible,
      .play:focus-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .play:hover {
        transform: scale(1.08);
      }

      .queue {
        position: absolute;
        top: 10px;
        right: 10px;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(8, 8, 15, 0.75);
        color: var(--text-primary);
        backdrop-filter: blur(6px);
        opacity: 0;
        transition: opacity var(--transition-base), background var(--transition-fast);
      }

      .queue svg {
        width: 17px;
        height: 17px;
      }

      .card:hover .queue,
      .queue:focus-visible {
        opacity: 1;
      }

      .queue:hover {
        background: var(--accent);
      }

      /* Sits beside the queue button, top-left of the artwork. */
      .save {
        position: absolute;
        top: 10px;
        left: 10px;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(8, 8, 15, 0.75);
        color: var(--text-primary);
        backdrop-filter: blur(6px);
        opacity: 0;
        transition: opacity var(--transition-base), background var(--transition-fast);
      }

      .save svg {
        width: 17px;
        height: 17px;
      }

      .card:hover .save,
      .save:focus-visible,
      .save.saved {
        opacity: 1;
      }

      .save:hover {
        background: var(--accent);
      }

      .save.saved {
        background: var(--success);
        color: #05231a;
      }

      .dots {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 700ms linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .duration {
        position: absolute;
        left: 10px;
        bottom: 10px;
        padding: 3px 8px;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
        background: rgba(8, 8, 15, 0.75);
        border-radius: var(--radius-sm);
        backdrop-filter: blur(6px);
      }

      .preview-badge {
        position: absolute;
        left: 10px;
        top: 10px;
        padding: 3px 7px;
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #06251c;
        background: var(--success);
        border-radius: var(--radius-sm);
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .title {
        font-weight: 600;
        font-size: 0.9375rem;
        color: var(--text-primary);
      }

      .title:hover {
        color: var(--accent-bright);
      }

      .artist {
        font-size: 0.8125rem;
        color: var(--text-secondary);
      }

      a.artist:hover {
        color: var(--accent-bright);
        text-decoration: underline;
      }

      .verified {
        color: var(--accent-bright);
        font-size: 0.75rem;
      }

      .plays {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      @media (max-width: 480px) {
        .card {
          padding: 8px;
          gap: 8px;
        }

        /* Touch devices have no hover, so the controls stay visible. */
        .play,
        .queue {
          opacity: 1;
          transform: none;
        }

        .play {
          width: 40px;
          height: 40px;
        }
      }
    `,
  ],
})
export class MusicCardComponent {
  private readonly player = inject(PlayerService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly musicService = inject(MusicService);

  readonly track = input.required<Track>();

  /** Optional context: playing the card adopts this list as the queue. */
  readonly queue = input<Track[] | undefined>(undefined);

  /** True when this card's track is the one loaded in the player. */
  readonly isCurrent = computed(() => this.player.currentTrack()?.id === this.track().id);

  /** True when this card's track is loaded and actively playing. */
  readonly isCurrentlyPlaying = computed(() => this.isCurrent() && this.player.isPlaying());

  readonly duration = computed(() => formatDuration(this.track().duration));
  readonly plays = computed(() => formatCount(this.track().playCount));

  /** True once the track has been saved to the playlist this session. */
  readonly isSaved = computed(() => this.quickAdd.isAdded(this.track().id));

  /** True while the save request is in flight. */
  readonly isSaving = computed(() => this.quickAdd.isPending(this.track().id));

  onPlay(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Toggle when this card is already the active track; otherwise start it.
    if (this.isCurrent()) {
      this.player.togglePlayPause();
      return;
    }
    this.player.play(this.track(), this.queue());
  }

  /**
   * Warms the stream URL when the pointer enters the card.
   *
   * <p>Resolving costs a redirect round-trip to Audius, and hovering reliably precedes
   * clicking by a few hundred milliseconds, so this usually removes the wait entirely.
   */
  onHover(): void {
    if (!this.isCurrent() && !this.track().previewUrl) {
      this.musicService.prefetchStreamUrl(this.track().id);
    }
  }

  onAddToQueue(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.player.addToQueue(this.track());
  }

  /** Saves to the playlist in a single click; the service handles creating one. */
  onSave(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickAdd.add(this.track());
  }
}
