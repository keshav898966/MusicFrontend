import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { ImageFallbackDirective } from '../directives/image-fallback.directive';
import { PlayerService } from '../../core/services/player.service';
import { formatDuration } from '../../core/utils/format';
import { EmptyStateComponent } from './empty-state.component';

/** Slide-over panel listing the play queue. */
@Component({
  selector: 'app-queue-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFallbackDirective, EmptyStateComponent],
  template: `
    <aside class="panel" role="dialog" aria-label="Play queue">
      <header>
        <div>
          <h3>Play queue</h3>
          <span class="count">{{ player.queue().length }} tracks</span>
        </div>
        <div class="header-actions">
          @if (player.queue().length > 0) {
            <button type="button" class="btn-ghost small" (click)="player.clearQueue()">Clear</button>
          }
          <button type="button" class="btn-icon" aria-label="Close queue" (click)="close.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div class="list">
        @if (player.queue().length === 0) {
          <app-empty-state
            icon="🎧"
            title="Your queue is empty"
            message="Play a track or use the add-to-queue button to build one."
          />
        } @else {
          @for (track of player.queue(); track track.id; let i = $index) {
            <div class="item" [class.current]="i === player.currentIndex()">
              <button
                type="button"
                class="main"
                [attr.aria-label]="'Play ' + track.title"
                (click)="player.playAt(i)"
              >
                <span class="pos">
                  @if (i === player.currentIndex()) {
                    <span class="dot" aria-hidden="true"></span>
                  } @else {
                    {{ i + 1 }}
                  }
                </span>

                <span class="art">
                  @if (track.artworkThumbUrl) {
                    <img [src]="track.artworkThumbUrl" alt="" loading="lazy" appImageFallback />
                  }
                </span>

                <span class="info">
                  <span class="title truncate">{{ track.title }}</span>
                  <span class="artist truncate">{{ track.artistName }}</span>
                </span>

                <span class="dur">{{ format(track.duration) }}</span>
              </button>

              <button
                type="button"
                class="btn-icon remove"
                [attr.aria-label]="'Remove ' + track.title + ' from queue'"
                (click)="player.removeFromQueue(i)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          }
        }
      </div>
    </aside>
  `,
  styles: [
    `
      .panel {
        display: flex;
        flex-direction: column;
        width: 360px;
        max-width: 100vw;
        height: 100%;
        background: var(--bg-surface);
        border-left: 1px solid var(--border);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 14px;
        border-bottom: 1px solid var(--border);
      }

      h3 {
        font-size: 1.0625rem;
      }

      .count {
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .btn-ghost.small {
        padding: 5px 12px;
        font-size: 0.8125rem;
      }

      .btn-icon svg {
        width: 18px;
        height: 18px;
      }

      .list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      .item {
        display: flex;
        align-items: center;
        border-radius: var(--radius-md);
        transition: background var(--transition-fast);
      }

      .item:hover {
        background: var(--bg-hover);
      }

      .item.current {
        background: var(--gradient-subtle);
      }

      .main {
        display: grid;
        grid-template-columns: 24px 40px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        padding: 8px;
        text-align: left;
      }

      .pos {
        font-size: 0.8125rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      .dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent-bright);
        animation: pulse 1.4s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      .art {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--bg-sunken);
      }

      .art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .title {
        font-size: 0.875rem;
        font-weight: 500;
      }

      .item.current .title {
        color: var(--accent-bright);
      }

      .artist {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .dur {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      .remove {
        width: 30px;
        height: 30px;
        margin-right: 6px;
        opacity: 0;
      }

      .remove svg {
        width: 15px;
        height: 15px;
      }

      .item:hover .remove,
      .remove:focus-visible {
        opacity: 1;
      }

      @media (max-width: 560px) {
        .panel {
          width: 100vw;
        }

        .remove {
          opacity: 1;
        }
      }
    `,
  ],
})
export class QueuePanelComponent {
  readonly player = inject(PlayerService);
  readonly close = output<void>();

  format(seconds: number | null): string {
    return formatDuration(seconds);
  }
}
