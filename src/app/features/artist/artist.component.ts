import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { Artist, Track } from '../../core/models/music.models';
import { errorMessageOf } from '../../core/services/error.interceptor';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { formatCount } from '../../core/utils/format';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { TrackRowComponent } from '../../shared/components/track-row.component';

const PAGE_SIZE = 20;

/** Artist profile with their tracks. */
@Component({
  selector: 'app-artist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrackRowComponent, LoadingSpinnerComponent, ErrorMessageComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-loading-spinner message="Loading artist…" />
    } @else if (error(); as message) {
      <app-error-message title="Artist unavailable" [message]="message" (retry)="load()" />
    } @else if (artist(); as profile) {
      <div class="artist-page">
        <header class="hero">
          @if (profile.coverPhotoUrl) {
            <img class="cover" [src]="profile.coverPhotoUrl" alt="" aria-hidden="true" />
          }

          <div class="hero-inner">
            <div class="avatar">
              @if (profile.profilePictureUrl) {
                <img [src]="profile.profilePictureUrl" [alt]="profile.name" />
              } @else {
                <div class="placeholder" aria-hidden="true">{{ initial() }}</div>
              }
            </div>

            <div class="info">
              <span class="eyebrow">Artist</span>
              <h1>
                {{ profile.name }}
                @if (profile.verified) {
                  <span class="verified" title="Verified artist" aria-label="Verified">✓</span>
                }
              </h1>

              @if (profile.handle) {
                <p class="handle">&#64;{{ profile.handle }}</p>
              }

              <div class="stats">
                <span><strong>{{ followers() }}</strong> followers</span>
                <span><strong>{{ profile.trackCount }}</strong> tracks</span>
                @if (profile.location) {
                  <span>{{ profile.location }}</span>
                }
              </div>

              @if (profile.bio) {
                <p class="bio">{{ profile.bio }}</p>
              }

              @if (tracks().length > 0) {
                <div class="actions">
                  <button type="button" class="btn-accent" (click)="playAll()">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
                    </svg>
                    Play all
                  </button>
                  <button type="button" class="btn-ghost" (click)="shufflePlay()">Shuffle</button>
                  <button type="button" class="btn-ghost" (click)="queueAll()">Add all to queue</button>
                </div>
              }
            </div>
          </div>
        </header>

        <section>
          <div class="section-title">
            <h2>Tracks</h2>
          </div>

          @if (tracks().length === 0) {
            <app-empty-state title="No tracks" message="This artist has not published any tracks yet." />
          } @else {
            <div class="rows">
              @for (track of tracks(); track track.id; let i = $index) {
                <app-track-row [track]="track" [index]="i" [queue]="tracks()" />
              }
            </div>

            @if (hasMore()) {
              <div class="more">
                <button type="button" class="btn-ghost" [disabled]="loadingMore()" (click)="loadMore()">
                  {{ loadingMore() ? 'Loading…' : 'Load more' }}
                </button>
              </div>
            }
          }
        </section>
      </div>
    }
  `,
  styles: [
    `
      .artist-page {
        display: flex;
        flex-direction: column;
        gap: 30px;
      }

      .hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--radius-lg);
        isolation: isolate;
        background: var(--gradient-subtle);
      }

      .cover {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.45;
        z-index: -1;
      }

      .hero-inner {
        display: flex;
        align-items: flex-end;
        gap: 28px;
        padding: 40px 34px 30px;
        background: linear-gradient(180deg, rgba(8, 8, 15, 0.55), rgba(8, 8, 15, 0.95));
      }

      .avatar {
        width: 176px;
        height: 176px;
        flex-shrink: 0;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: var(--shadow-lg);
        background: var(--bg-sunken);
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
        font-size: 3.5rem;
        font-weight: 700;
        color: var(--text-on-accent);
        background: var(--gradient-aurora);
      }

      .info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .eyebrow {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-bright);
      }

      h1 {
        font-size: clamp(1.75rem, 4vw, 3rem);
        overflow-wrap: anywhere;
      }

      .verified {
        color: var(--accent-bright);
        font-size: 1.25rem;
        vertical-align: middle;
      }

      .handle {
        color: var(--text-secondary);
        font-size: 0.9375rem;
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .stats strong {
        color: var(--text-primary);
      }

      .bio {
        max-width: 62ch;
        font-size: 0.875rem;
        color: var(--text-secondary);
        white-space: pre-line;
        /* Long biographies are clamped so they cannot dominate the header. */
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 8px;
      }

      .actions svg {
        width: 18px;
        height: 18px;
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .more {
        display: flex;
        justify-content: center;
        margin-top: 22px;
      }

      @media (max-width: 760px) {
        .hero-inner {
          flex-direction: column;
          align-items: center;
          padding: 26px 18px 22px;
          text-align: center;
        }

        .avatar {
          width: min(150px, 44vw);
          height: auto;
          aspect-ratio: 1;
        }

        .info {
          align-items: center;
        }

        .stats,
        .actions {
          justify-content: center;
        }
      }
    `,
  ],
})
export class ArtistComponent {
  private readonly musicService = inject(MusicService);
  private readonly player = inject(PlayerService);

  readonly id = input.required<string>();

  readonly artist = signal<Artist | null>(null);
  readonly tracks = signal<Track[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  readonly error = signal<string | null>(null);

  /** Cursor for the next page of artist tracks. */
  private nextCursor: string | null = null;

  readonly followers = computed(() => formatCount(this.artist()?.followerCount));
  readonly initial = computed(() => (this.artist()?.name?.charAt(0) ?? '?').toUpperCase());

  constructor() {
    effect(() => {
      const artistId = this.id();
      if (artistId) {
        this.fetch(artistId);
      }
    });
  }

  load(): void {
    this.fetch(this.id());
  }

  /**
   * Loads the profile and the first page of tracks together.
   *
   * <p>A track-list failure leaves the profile visible rather than failing the page.
   */
  private fetch(artistId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.nextCursor = null;

    forkJoin({
      artist: this.musicService.getArtist(artistId),
      tracks: this.musicService
        .getArtistTracks(artistId, PAGE_SIZE, 0)
        .pipe(catchError(() => of({ items: [], offset: 0, limit: PAGE_SIZE, count: 0, hasMore: false, nextCursor: null }))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ artist, tracks }) => {
          this.artist.set(artist);
          this.tracks.set(tracks.items);
          this.hasMore.set(tracks.hasMore);
          this.nextCursor = tracks.nextCursor;
        },
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load this artist.')),
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.musicService
      .getArtistTracks(this.id(), PAGE_SIZE, 0, this.nextCursor)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (page) => {
          this.tracks.set([...this.tracks(), ...page.items]);
          this.hasMore.set(page.hasMore);
          this.nextCursor = page.nextCursor;
        },
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load more tracks.')),
      });
  }

  playAll(): void {
    const tracks = this.tracks();
    if (tracks.length > 0) {
      this.player.playQueue(tracks, 0);
    }
  }

  shufflePlay(): void {
    const tracks = this.tracks();
    if (tracks.length === 0) {
      return;
    }
    if (!this.player.shuffle()) {
      this.player.toggleShuffle();
    }
    this.player.playQueue(tracks, Math.floor(Math.random() * tracks.length));
  }

  queueAll(): void {
    this.player.addAllToQueue(this.tracks());
  }
}
