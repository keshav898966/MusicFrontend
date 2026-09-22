import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { LocalPlaylist, Track, playlistSongToTrack } from '../../core/models/music.models';
import { errorMessageOf } from '../../core/services/error.interceptor';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { SearchContextService } from '../../core/services/search-context.service';
import { formatDuration } from '../../core/utils/format';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { TrackRowComponent } from '../../shared/components/track-row.component';

/** One playlist with its songs, playable as a queue. */
@Component({
  selector: 'app-playlist-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TrackRowComponent,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading-spinner message="Loading playlist…" />
    } @else if (error(); as message) {
      <app-error-message title="Playlist unavailable" [message]="message" (retry)="load()" />
    } @else if (playlist(); as item) {
      <div class="detail">
        <header class="hero">
          <div class="art" aria-hidden="true">♫</div>

          <div class="info">
            <span class="eyebrow">Playlist</span>
            <h1>{{ item.name }}</h1>
            @if (item.description) {
              <p class="desc">{{ item.description }}</p>
            }
            <p class="stats">
              {{ item.songCount }} {{ item.songCount === 1 ? 'song' : 'songs' }}
              @if (totalDuration()) {
                · {{ totalDuration() }}
              }
            </p>

            @if (tracks().length > 0) {
              <div class="actions">
                <button type="button" class="btn-accent" (click)="playAll()">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
                  </svg>
                  Play
                </button>
                <button type="button" class="btn-ghost" (click)="shufflePlay()">Shuffle</button>
                <a class="btn-ghost" routerLink="/playlists">Back to playlists</a>
              </div>
            }
          </div>
        </header>

        @if (filteredEmpty()) {
          <app-empty-state
            icon="🔍"
            title="No matches in this playlist"
            message="Clear the search box to see every song again."
          />
        } @else if (tracks().length === 0) {
          <app-empty-state
            icon="🎼"
            title="This playlist is empty"
            message="Open any track and use “Add to playlist” to fill it."
            actionLabel="Find music"
            (action)="goHome()"
          />
        } @else {
          <div class="rows">
            @for (track of tracks(); track track.id; let i = $index) {
              <app-track-row
                [track]="track"
                [index]="i"
                [queue]="tracks()"
                [showRemove]="true"
                (remove)="removeSong($event)"
              />
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .detail {
        display: flex;
        flex-direction: column;
        gap: 26px;
      }

      .hero {
        display: flex;
        align-items: flex-end;
        gap: 26px;
        padding: 30px;
        background: var(--gradient-subtle);
        border-radius: var(--radius-lg);
      }

      .art {
        display: grid;
        place-items: center;
        width: 168px;
        height: 168px;
        flex-shrink: 0;
        font-size: 3.5rem;
        color: var(--text-on-accent);
        background: var(--gradient-aurora);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
      }

      .info {
        display: flex;
        flex-direction: column;
        gap: 7px;
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
        font-size: clamp(1.625rem, 3.5vw, 2.5rem);
        overflow-wrap: anywhere;
      }

      .desc {
        color: var(--text-secondary);
        font-size: 0.9375rem;
        max-width: 62ch;
      }

      .stats {
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
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

      @media (max-width: 700px) {
        .hero {
          flex-direction: column;
          align-items: center;
          padding: 22px 18px;
          text-align: center;
        }

        .art {
          width: min(140px, 42vw);
          height: auto;
          aspect-ratio: 1;
        }

        .info {
          align-items: center;
        }

        .actions {
          justify-content: center;
        }
      }
    `,
  ],
})
export class PlaylistDetailComponent implements OnDestroy {
  private readonly playlistService = inject(PlaylistService);
  private readonly player = inject(PlayerService);
  private readonly searchContext = inject(SearchContextService);

  readonly id = input.required<string>();

  readonly playlist = signal<LocalPlaylist | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Every song in the playlist, as playable tracks. */
  private readonly allTracks = computed<Track[]>(() =>
    (this.playlist()?.songs ?? []).map(playlistSongToTrack),
  );

  /**
   * The tracks actually shown.
   *
   * <p>While this page is open the single navbar search filters the playlist rather than
   * searching Audius, so a listener can find a song without being navigated away.
   */
  readonly tracks = computed<Track[]>(() => {
    const filter = this.searchContext.localQuery().trim().toLowerCase();
    if (!filter) {
      return this.allTracks();
    }
    return this.allTracks().filter(
      (track) =>
        track.title.toLowerCase().includes(filter) ||
        track.artistName.toLowerCase().includes(filter),
    );
  });

  /** True when a filter is active but matches nothing. */
  readonly filteredEmpty = computed(
    () => this.allTracks().length > 0 && this.tracks().length === 0,
  );

  /** Combined running time, when the songs carry durations. */
  readonly totalDuration = computed(() => {
    const seconds = (this.playlist()?.songs ?? []).reduce((sum, song) => sum + (song.duration ?? 0), 0);
    return seconds > 0 ? formatDuration(seconds) : '';
  });

  constructor() {
    effect(() => {
      const playlistId = Number(this.id());
      if (Number.isFinite(playlistId)) {
        this.fetch(playlistId);
      }
    });

    // Claim the navbar search for this playlist while the page is open, and label it
    // with the playlist name so the scope is obvious.
    effect(() => {
      const name = this.playlist()?.name;
      if (name) {
        this.searchContext.setLocalScope(name);
      }
    });
  }

  ngOnDestroy(): void {
    // Hand the search box back to global search when leaving the playlist.
    this.searchContext.clearLocalScope();
  }

  load(): void {
    this.fetch(Number(this.id()));
  }

  private fetch(playlistId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.playlistService
      .getPlaylist(playlistId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (playlist) => this.playlist.set(playlist),
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load this playlist.')),
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

  removeSong(track: Track): void {
    const playlist = this.playlist();
    if (!playlist) {
      return;
    }

    this.playlistService.removeSong(playlist.id, track.id).subscribe({
      next: (updated) => this.playlist.set(updated),
      error: (err) => this.error.set(errorMessageOf(err, 'Could not remove the song.')),
    });
  }

  goHome(): void {
    location.assign('/');
  }
}
