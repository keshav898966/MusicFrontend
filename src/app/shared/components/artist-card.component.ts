import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageFallbackDirective } from '../directives/image-fallback.directive';
import { Artist } from '../../core/models/music.models';
import { formatCount } from '../../core/utils/format';

/** An artist presented as a circular-avatar card. */
@Component({
  selector: 'app-artist-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFallbackDirective, RouterLink],
  template: `
    <a class="card" [routerLink]="['/artist', artist().id]">
      <div class="avatar">
        @if (artist().profilePictureUrl) {
          <img [src]="artist().profilePictureUrl" alt="" loading="lazy" decoding="async" appImageFallback />
        } @else {
          <div class="placeholder" aria-hidden="true">{{ initial() }}</div>
        }
      </div>

      <div class="meta">
        <span class="name truncate">
          {{ artist().name }}
          @if (artist().verified) {
            <span class="verified" title="Verified artist" aria-label="Verified">✓</span>
          }
        </span>
        <span class="stat">{{ followers() }} followers</span>
      </div>
    </a>
  `,
  styles: [
    `
      .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 18px 12px;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        text-align: center;
        transition: background var(--transition-base), transform var(--transition-base);
      }

      .card:hover {
        background: var(--bg-elevated);
        transform: translateY(-3px);
      }

      .avatar {
        width: 100%;
        max-width: 132px;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: hidden;
        background: var(--bg-sunken);
        box-shadow: var(--shadow-sm);
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .placeholder {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-on-accent);
        background: var(--gradient-aurora);
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        min-width: 0;
      }

      .name {
        font-weight: 600;
        font-size: 0.9375rem;
      }

      .verified {
        color: var(--accent-bright);
        font-size: 0.75rem;
      }

      .stat {
        font-size: 0.8125rem;
        color: var(--text-muted);
      }
    `,
  ],
})
export class ArtistCardComponent {
  readonly artist = input.required<Artist>();

  readonly followers = computed(() => formatCount(this.artist().followerCount));

  /** First letter of the name, used when there is no profile picture. */
  readonly initial = computed(() => (this.artist().name?.charAt(0) ?? '?').toUpperCase());
}
