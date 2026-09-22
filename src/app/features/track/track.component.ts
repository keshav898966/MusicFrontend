import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { LocalPlaylist, Track } from '../../core/models/music.models';
import { errorMessageOf } from '../../core/services/error.interceptor';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { formatCount, formatDate, formatDuration } from '../../core/utils/format';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';

/** Track detail page. */
@Component({
  selector: 'app-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorMessageComponent],
  template: `
    @if (loading()) {
      <app-loading-spinner message="Loading track…" />
    } @else if (error(); as message) {
      <app-error-message title="Track unavailable" [message]="message" (retry)="load()" />
    } @else if (track(); as item) {
      <article class="track-page">
        <header class="hero">
          @if (item.artworkUrl) {
            <img class="hero-bg" [src]="item.artworkUrl" alt="" aria-hidden="true" />
          }

          <div class="hero-inner">
            <div class="art">
              @if (item.artworkUrl) {
                <img [src]="item.artworkUrl" [alt]="'Artwork for ' + item.title" />
              } @else {
                <div class="placeholder" aria-hidden="true">♪</div>
              }
            </div>

            <div class="info">
              <span class="eyebrow">Track</span>
              <h1>{{ item.title }}</h1>

              <div class="byline">
                @if (item.artistId) {
                  <a [routerLink]="['/artist', item.artistId]" class="artist">
                    {{ item.artistName }}
                    @if (item.artistVerified) {
                      <span class="verified" title="Verified artist">✓</span>
                    }
                  </a>
                } @else {
                  <span class="artist">{{ item.artistName }}</span>
                }

                @if (item.duration) {
                  <span class="dot">·</span>
                  <span>{{ duration() }}</span>
                }
                @if (item.genre) {
                  <span class="dot">·</span>
                  <span>{{ item.genre }}</span>
                }
                @if (releaseDate()) {
                  <span class="dot">·</span>
                  <span>{{ releaseDate() }}</span>
                }
              </div>

              <div class="stats">
                <span><strong>{{ plays() }}</strong> plays</span>
                <span><strong>{{ favorites() }}</strong> favorites</span>
                <span><strong>{{ reposts() }}</strong> reposts</span>
              </div>

              <div class="actions">
                <button type="button" class="btn-accent" (click)="onPlay()">
                  @if (isCurrentlyPlaying()) {
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                    Pause
                  } @else {
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
                    </svg>
                    Play
                  }
                </button>

                <button type="button" class="btn-ghost" (click)="addToQueue()">Add to queue</button>

                @if (playlistService.playlists().length > 0) {
                  <div class="add-to-playlist">
                    <button
                      type="button"
                      class="btn-ghost"
                      [attr.aria-expanded]="menuOpen()"
                      (click)="toggleMenu()"
                    >
                      Add to playlist ▾
                    </button>

                    @if (menuOpen()) {
                      <ul class="menu" role="menu">
                        @for (playlist of playlistService.playlists(); track playlist.id) {
                          <li>
                            <button type="button" role="menuitem" (click)="addToPlaylist(playlist)">
                              <span class="truncate">{{ playlist.name }}</span>
                              <span class="count">{{ playlist.songCount }}</span>
                            </button>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                }
              </div>

              @if (notice(); as text) {
                <p class="notice" role="status">{{ text }}</p>
              }
            </div>
          </div>
        </header>

        @if (item.mood) {
          <section class="details">
            <h2>About</h2>
            <dl>
              <div><dt>Mood</dt><dd>{{ item.mood }}</dd></div>
              @if (item.genre) {
                <div><dt>Genre</dt><dd>{{ item.genre }}</dd></div>
              }
              @if (releaseDate()) {
                <div><dt>Released</dt><dd>{{ releaseDate() }}</dd></div>
              }
            </dl>
          </section>
        }
      </article>
    }
  `,
  styles: [
    `
      .hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--radius-lg);
        isolation: isolate;
        margin-bottom: 28px;
      }

      .hero-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(48px) saturate(1.6);
        transform: scale(1.3);
        opacity: 0.4;
        z-index: -1;
      }

      .hero-inner {
        display: flex;
        gap: 30px;
        padding: 34px;
        background: linear-gradient(180deg, rgba(8, 8, 15, 0.68), rgba(8, 8, 15, 0.94));
      }

      .art {
        width: 236px;
        height: 236px;
        flex-shrink: 0;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: var(--shadow-lg);
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
        font-size: 4rem;
        color: var(--text-muted);
        background: var(--gradient-subtle);
      }

      .info {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 10px;
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
        font-size: clamp(1.5rem, 3.5vw, 2.75rem);
        overflow-wrap: anywhere;
      }

      .byline {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
        color: var(--text-secondary);
        font-size: 0.9375rem;
      }

      .artist {
        font-weight: 600;
        color: var(--text-primary);
      }

      a.artist:hover {
        color: var(--accent-bright);
        text-decoration: underline;
      }

      .verified {
        color: var(--accent-bright);
        font-size: 0.8125rem;
      }

      .dot {
        color: var(--text-muted);
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

      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
      }

      .actions svg {
        width: 18px;
        height: 18px;
      }

      /* ------------------------------------------------- add to playlist */

      .add-to-playlist {
        position: relative;
      }

      .menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 20;
        min-width: 220px;
        max-height: 280px;
        overflow-y: auto;
        padding: 6px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
      }

      .menu button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 9px 12px;
        border-radius: var(--radius-sm);
        text-align: left;
        font-size: 0.875rem;
        color: var(--text-secondary);
      }

      .menu button:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      .count {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .notice {
        font-size: 0.875rem;
        color: var(--success);
      }

      /* --------------------------------------------------------- details */

      .details {
        max-width: 620px;
      }

      .details h2 {
        font-size: 1.125rem;
        margin-bottom: 14px;
      }

      dl {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
      }

      dl > div {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
      }

      dt {
        color: var(--text-muted);
        font-size: 0.875rem;
      }

      dd {
        margin: 0;
        font-size: 0.875rem;
      }

      @media (max-width: 760px) {
        .hero-inner {
          flex-direction: column;
          align-items: center;
          padding: 22px 18px;
          text-align: center;
        }

        .art {
          width: min(220px, 62vw);
          height: auto;
          aspect-ratio: 1;
        }

        .info {
          align-items: center;
        }

        .byline,
        .stats,
        .actions {
          justify-content: center;
        }

        .menu {
          left: 50%;
          transform: translateX(-50%);
        }
      }
    `,
  ],
})
export class TrackComponent {
  private readonly musicService = inject(MusicService);
  private readonly player = inject(PlayerService);
  readonly playlistService = inject(PlaylistService);

  /** Route parameter, bound automatically by withComponentInputBinding. */
  readonly id = input.required<string>();

  readonly track = signal<Track | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly menuOpen = signal(false);

  readonly duration = computed(() => formatDuration(this.track()?.duration));
  readonly plays = computed(() => formatCount(this.track()?.playCount));
  readonly favorites = computed(() => formatCount(this.track()?.favoriteCount));
  readonly reposts = computed(() => formatCount(this.track()?.repostCount));
  readonly releaseDate = computed(() => formatDate(this.track()?.releaseDate));

  readonly isCurrentlyPlaying = computed(
    () => this.player.currentTrack()?.id === this.track()?.id && this.player.isPlaying(),
  );

  constructor() {
    // Reload whenever the route id changes, including navigation between two tracks.
    effect(() => {
      const trackId = this.id();
      if (trackId) {
        this.fetch(trackId);
      }
    });
  }

  load(): void {
    this.fetch(this.id());
  }

  private fetch(trackId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.musicService
      .getTrack(trackId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (track) => this.track.set(track),
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load this track.')),
      });
  }

  onPlay(): void {
    const track = this.track();
    if (!track) {
      return;
    }
    if (this.player.currentTrack()?.id === track.id) {
      this.player.togglePlayPause();
      return;
    }
    this.player.play(track);
  }

  addToQueue(): void {
    const track = this.track();
    if (track) {
      this.player.addToQueue(track);
      this.flash('Added to queue');
    }
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  addToPlaylist(playlist: LocalPlaylist): void {
    const track = this.track();
    if (!track) {
      return;
    }

    this.menuOpen.set(false);
    this.playlistService.addSong(playlist.id, track).subscribe({
      next: () => this.flash(`Added to ${playlist.name}`),
      error: (err) =>
        this.flash(errorMessageOf(err, 'Could not add to playlist.')),
    });
  }

  /** Shows a transient status message beneath the actions. */
  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(null), 2600);
  }
}
