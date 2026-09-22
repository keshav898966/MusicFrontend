import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageFallbackDirective } from '../directives/image-fallback.directive';
import { Track } from '../../core/models/music.models';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { formatDuration } from '../../core/utils/format';

/**
 * A track presented as a compact list row, used in search results, artist pages and
 * playlists.
 *
 * <p>Like {@link MusicCardComponent}, it delegates playback to the shared player.
 */
@Component({
  selector: 'app-track-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFallbackDirective, RouterLink],
  template: `
    <div class="row" [class.playing]="isCurrent()" (pointerenter)="onHover()" (focusin)="onHover()">
      <div class="index">
        @if (isCurrentlyPlaying()) {
          <span class="bars" aria-label="Now playing">
            <i></i><i></i><i></i>
          </span>
        } @else {
          <span class="number">{{ position() }}</span>
        }

        <button
          type="button"
          class="play"
          [attr.aria-label]="isCurrentlyPlaying() ? 'Pause ' + track().title : 'Play ' + track().title"
          (click)="onPlay()"
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
      </div>

      <div class="art">
        @if (track().artworkThumbUrl) {
          <img [src]="track().artworkThumbUrl" alt="" loading="lazy" decoding="async" appImageFallback />
        } @else {
          <div class="placeholder" aria-hidden="true">♪</div>
        }
      </div>

      <div class="info">
        <span class="title-line">
          <a class="title truncate" [routerLink]="['/track', track().id]">{{ track().title }}</a>
          @if (track().previewOnly) {
            <span class="preview-tag" title="Apple Music preview — about 30 seconds">preview</span>
          }
        </span>
        @if (track().artistId) {
          <a class="artist truncate" [routerLink]="['/artist', track().artistId]">{{ track().artistName }}</a>
        } @else {
          <span class="artist truncate">{{ track().artistName }}</span>
        }
      </div>

      @if (track().genre) {
        <span class="genre truncate">{{ track().genre }}</span>
      }

      <div class="actions">
        <button
          type="button"
          class="btn-icon save"
          [class.saved]="isSaved()"
          [disabled]="isSaving()"
          [attr.aria-label]="isSaved() ? track().title + ' saved to playlist' : 'Save ' + track().title + ' to playlist'"
          [title]="isSaved() ? 'Saved to playlist' : 'Save to playlist'"
          (click)="onSave()"
        >
          @if (isSaved()) {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          }
        </button>

        <button
          type="button"
          class="btn-icon"
          [attr.aria-label]="'Add ' + track().title + ' to queue'"
          title="Add to queue"
          (click)="onAddToQueue()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h13M3 12h9M3 18h9M17 12v8M13 16h8" stroke-linecap="round" />
          </svg>
        </button>

        @if (showRemove()) {
          <button
            type="button"
            class="btn-icon danger"
            [attr.aria-label]="'Remove ' + track().title"
            title="Remove"
            (click)="remove.emit(track())"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        }
      </div>

      <span class="duration">{{ duration() }}</span>
    </div>
  `,
  styles: [
    `
      .row {
        display: grid;
        grid-template-columns: 36px 44px minmax(0, 1fr) minmax(0, 130px) auto 56px;
        align-items: center;
        gap: 14px;
        padding: 8px 12px;
        border-radius: var(--radius-md);
        transition: background var(--transition-fast);
      }

      .row:hover {
        background: var(--bg-hover);
      }

      .row.playing .title {
        color: var(--accent-bright);
      }

      .index {
        position: relative;
        display: grid;
        place-items: center;
        width: 36px;
        color: var(--text-muted);
        font-size: 0.875rem;
        font-variant-numeric: tabular-nums;
      }

      .play {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--text-primary);
        opacity: 0;
      }

      .play svg {
        width: 18px;
        height: 18px;
      }

      /* Swap the track number for a play button on hover. */
      .row:hover .number,
      .row:hover .bars {
        opacity: 0;
      }

      .row:hover .play,
      .play:focus-visible {
        opacity: 1;
      }

      /* Animated equaliser marking the currently playing row. */
      .bars {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 14px;
      }

      .bars i {
        width: 3px;
        background: var(--accent-bright);
        border-radius: 1px;
        animation: bounce 900ms ease-in-out infinite;
      }

      .bars i:nth-child(1) { height: 60%; animation-delay: -200ms; }
      .bars i:nth-child(2) { height: 100%; animation-delay: -500ms; }
      .bars i:nth-child(3) { height: 40%; animation-delay: -800ms; }

      @keyframes bounce {
        0%, 100% { transform: scaleY(0.4); }
        50% { transform: scaleY(1); }
      }

      .art {
        width: 44px;
        height: 44px;
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

      .info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .title {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 0.9375rem;
      }

      .title:hover {
        text-decoration: underline;
      }

      .title-line {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }

      .preview-tag {
        flex-shrink: 0;
        padding: 1px 6px;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--success);
        border: 1px solid var(--success);
        border-radius: var(--radius-sm);
        opacity: 0.85;
      }

      .artist {
        font-size: 0.8125rem;
        color: var(--text-secondary);
      }

      a.artist:hover {
        color: var(--accent-bright);
        text-decoration: underline;
      }

      .genre {
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      .actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .row:hover .actions,
      .actions:focus-within {
        opacity: 1;
      }

      .btn-icon svg {
        width: 17px;
        height: 17px;
      }

      .btn-icon.save.saved {
        color: var(--success);
        opacity: 1;
      }

      .btn-icon.danger:hover {
        color: var(--danger);
      }

      .duration {
        text-align: right;
        font-size: 0.875rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      /* Drop the genre column first, then the artwork, as space runs out. */
      @media (max-width: 860px) {
        .row {
          grid-template-columns: 32px 44px minmax(0, 1fr) auto 52px;
        }

        .genre {
          display: none;
        }
      }

      @media (max-width: 560px) {
        .row {
          grid-template-columns: 44px minmax(0, 1fr) auto 48px;
          gap: 10px;
          padding: 8px;
        }

        .index {
          display: none;
        }

        /* No hover on touch: keep the actions reachable. */
        .actions {
          opacity: 1;
        }
      }
    `,
  ],
})
export class TrackRowComponent {
  private readonly player = inject(PlayerService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly musicService = inject(MusicService);

  readonly track = input.required<Track>();

  /** Zero-based index within the list, rendered as a 1-based position. */
  readonly index = input<number>(0);

  /** Optional list adopted as the queue when this row is played. */
  readonly queue = input<Track[] | undefined>(undefined);

  /** Shows a remove button, used inside playlists and the queue panel. */
  readonly showRemove = input<boolean>(false);

  readonly remove = output<Track>();

  readonly position = computed(() => this.index() + 1);
  readonly duration = computed(() => formatDuration(this.track().duration));
  readonly isCurrent = computed(() => this.player.currentTrack()?.id === this.track().id);
  readonly isCurrentlyPlaying = computed(() => this.isCurrent() && this.player.isPlaying());

  /** True once the track has been saved to the playlist this session. */
  readonly isSaved = computed(() => this.quickAdd.isAdded(this.track().id));

  /** True while the save request is in flight. */
  readonly isSaving = computed(() => this.quickAdd.isPending(this.track().id));

  onPlay(): void {
    if (this.isCurrent()) {
      this.player.togglePlayPause();
      return;
    }
    this.player.play(this.track(), this.queue());
  }

  onAddToQueue(): void {
    this.player.addToQueue(this.track());
  }

  /** Warms the stream URL on hover, so the click that follows starts immediately. */
  onHover(): void {
    if (!this.isCurrent() && !this.track().previewUrl) {
      this.musicService.prefetchStreamUrl(this.track().id);
    }
  }

  /** Saves to the playlist in a single click. */
  onSave(): void {
    this.quickAdd.add(this.track());
  }
}
