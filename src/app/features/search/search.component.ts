import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { Artist, Track } from '../../core/models/music.models';
import { SearchHint, interpretQuery, popularMovies } from '../../core/models/search-hints';
import { errorMessageOf } from '../../core/services/error.interceptor';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { ArtistCardComponent } from '../../shared/components/artist-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { SearchBarComponent } from '../../shared/components/search-bar.component';
import { TrackRowComponent } from '../../shared/components/track-row.component';

/** Page size for the search results, also used as the paging increment. */
const PAGE_SIZE = 20;

/** Search page with debounced live results and load-more paging. */
@Component({
  selector: 'app-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchBarComponent,
    TrackRowComponent,
    ArtistCardComponent,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="search-page">
      <!-- No search field here: the navbar owns the single search box for the whole
           application, so duplicating it would be confusing. -->
      <header>
        @if (query()) {
          <h1 class="truncate">Results for “{{ query() }}”</h1>
        } @else {
          <h1>Search</h1>
        }
      </header>

      @if (!query()) {
        <app-empty-state
          icon="🔍"
          title="Search for music"
          message="Search a song, an artist, or a film title."
        />

        <section>
          <div class="section-title">
            <h2>Try a movie</h2>
            <span class="section-subtitle">Search a film to hear its songs</span>
          </div>
          <div class="suggest-chips">
            @for (movie of movieExamples; track movie) {
              <button type="button" class="suggest" (click)="applySuggestion(movie)">🎬 {{ movie }}</button>
            }
          </div>
        </section>
      } @else if (loading()) {
        <app-loading-spinner [message]="'Searching for “' + query() + '”…'" />
      } @else if (error(); as message) {
        <app-error-message [message]="message" (retry)="runSearch(query())" />
      } @else {
        <!-- Spelling help and film recognition, shown above the results. -->
        @if (hint().correction; as fixed) {
          <p class="did-you-mean">
            Showing results for
            <button type="button" class="link" (click)="applySuggestion(fixed)">{{ fixed }}</button>
          </p>
        }

        @if (movieTracks().length > 0) {
          <section>
            <div class="section-title">
              <h2>Songs from {{ hint().movie }}</h2>
              <button type="button" class="btn-ghost" (click)="playMovie()">Play all</button>
            </div>
            <div class="rows">
              @for (track of movieTracks(); track track.id; let i = $index) {
                <app-track-row [track]="track" [index]="i" [queue]="movieTracks()" />
              }
            </div>
          </section>
        }

        @if (hint().suggestions.length > 0) {
          <div class="suggest-chips">
            @for (term of hint().suggestions; track term) {
              <button type="button" class="suggest" (click)="applySuggestion(term)">{{ term }}</button>
            }
          </div>
        }

        @if (tracks().length === 0 && artists().length === 0 && movieTracks().length === 0) {
          <app-empty-state
            icon="🤷"
            title="No results"
            [message]="'Nothing matched “' + query() + '”. Check the spelling, or try a film or artist name.'"
          />

          <div class="suggest-chips">
            @for (movie of movieExamples; track movie) {
              <button type="button" class="suggest" (click)="applySuggestion(movie)">🎬 {{ movie }}</button>
            }
          </div>
        }

        @if (artists().length > 0) {
          <section>
            <div class="section-title">
              <h2>Artists</h2>
            </div>
            <div class="artist-grid">
              @for (artist of artists(); track artist.id) {
                <app-artist-card [artist]="artist" />
              }
            </div>
          </section>
        }

        @if (tracks().length > 0) {
          <section>
            <div class="section-title">
              <h2>Tracks</h2>
              <button type="button" class="btn-ghost" (click)="playAll()">Play all</button>
            </div>

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
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .search-page {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 720px;
      }

      .artist-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .did-you-mean {
        color: var(--text-secondary);
        font-size: 0.9375rem;
      }

      .link {
        color: var(--accent-bright);
        font-weight: 600;
        text-decoration: underline;
      }

      .suggest-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .suggest {
        padding: 8px 14px;
        font-size: 0.875rem;
        color: var(--text-secondary);
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        transition: all var(--transition-fast);
      }

      .suggest:hover {
        color: var(--text-primary);
        border-color: var(--accent);
        background: var(--bg-hover);
      }

      .more {
        display: flex;
        justify-content: center;
        margin-top: 22px;
      }

      @media (max-width: 640px) {
        .artist-grid {
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }
      }
    `,
  ],
})
export class SearchComponent implements OnInit {
  private readonly musicService = inject(MusicService);
  private readonly player = inject(PlayerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = signal('');
  readonly tracks = signal<Track[]>([]);
  readonly artists = signal<Artist[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  readonly error = signal<string | null>(null);

  /** Songs from a recognised film, shown above the raw matches. */
  readonly movieTracks = signal<Track[]>([]);

  /** How the current query was interpreted: film match, spelling correction, hints. */
  readonly hint = signal<SearchHint>({ expandedQueries: [], suggestions: [] });

  /** Example film titles, offered when there is nothing to show. */
  readonly movieExamples = popularMovies(8);

  /**
   * The query most recently searched.
   *
   * <p>Guards the query-param subscription against re-running on the URL update this
   * component performs after every search.
   */
  private lastSearched = '';

  /** Cursor for the next page, from the previous response. */
  private nextCursor: string | null = null;

  /** Keystrokes, debounced so typing does not fire a request per character. */
  private readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        // switchMap cancels the previous search, so out-of-order responses cannot
        // overwrite results for the query the user is actually looking at.
        switchMap((query) => {
          const trimmed = query.trim();
          if (!trimmed) {
            this.resetResults();
            return of(null);
          }

          this.query.set(trimmed);
          this.lastSearched = trimmed;
          this.loading.set(true);
          this.error.set(null);
          this.nextCursor = null;

          return forkJoin({
            tracks: this.musicService.searchTracks(trimmed, PAGE_SIZE, 0),
            artists: this.musicService.searchArtists(trimmed, 6),
          }).pipe(
            catchError((err) => {
              this.error.set(errorMessageOf(err, 'Search failed.'));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.tracks.set(result.tracks.items);
        this.artists.set(result.artists);
        this.hasMore.set(result.tracks.hasMore);
        this.nextCursor = result.tracks.nextCursor;
      });
  }

  ngOnInit(): void {
    // Subscribed rather than read from the snapshot: Angular reuses this component when
    // only the query string changes, so a snapshot read would run once and every later
    // search — from the navbar or a category chip — would be silently ignored.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const incoming = (params.get('q') ?? '').trim();

      if (!incoming) {
        this.resetResults();
        return;
      }
      // The component updates the URL itself after searching; without this guard that
      // would bounce straight back and search a second time.
      if (incoming === this.lastSearched) {
        return;
      }

      this.query.set(incoming);
      this.runSearch(incoming);
    });
  }

  /** Runs a search immediately, bypassing the debounce (Enter or the button). */
  runSearch(query: string): void {
    // Guard against a non-string arriving from a stray DOM event binding.
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!trimmed) {
      return;
    }

    this.query.set(trimmed);
    this.lastSearched = trimmed;
    this.loading.set(true);
    this.error.set(null);
    this.nextCursor = null;

    // Reflect the query in the URL so results can be shared and restored.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: trimmed },
      replaceUrl: true,
    });

    // Audius holds no film metadata, so a movie title on its own matches almost nothing
    // useful. When the title is recognised — even misspelled — search for its songs too.
    const hint = interpretQuery(trimmed);
    this.hint.set(hint);

    const movieSongs = hint.expandedQueries.length > 0
      ? this.musicService.searchTracksBatch([...hint.expandedQueries], 6)
      : of({} as Record<string, Track[]>);

    forkJoin({
      tracks: this.musicService.searchTracks(trimmed, PAGE_SIZE, 0),
      artists: this.musicService.searchArtists(trimmed, 6),
      movie: movieSongs.pipe(catchError(() => of({} as Record<string, Track[]>))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ tracks, artists, movie }) => {
          // Songs from a recognised film lead the results: they are what was actually
          // asked for, whereas the raw title match is mostly incidental.
          const movieTracks = Object.values(movie).flat();
          const seen = new Set(movieTracks.map((track) => track.id));
          const rest = tracks.items.filter((track) => !seen.has(track.id));

          this.movieTracks.set(movieTracks);
          this.tracks.set(rest);
          this.artists.set(artists);
          this.hasMore.set(tracks.hasMore);
          this.nextCursor = tracks.nextCursor;
        },
        error: (err) => this.error.set(errorMessageOf(err, 'Search failed.')),
      });
  }

  /** Plays the film's songs as a queue. */
  playMovie(): void {
    const tracks = this.movieTracks();
    if (tracks.length > 0) {
      this.player.playQueue(tracks, 0);
    }
  }

  /** Runs one of the offered suggestions. */
  applySuggestion(term: string): void {
    this.runSearch(term);
  }

  onQueryChange(value: string): void {
    if (!value.trim()) {
      this.query.set('');
      this.resetResults();
      return;
    }
    this.typed.next(value);
  }

  /** Appends the next page of track results. */
  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.musicService
      .searchTracks(this.query(), PAGE_SIZE, 0, this.nextCursor)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (page) => {
          this.tracks.set([...this.tracks(), ...page.items]);
          this.hasMore.set(page.hasMore);
          this.nextCursor = page.nextCursor;
        },
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load more results.')),
      });
  }

  playAll(): void {
    const tracks = this.tracks();
    if (tracks.length > 0) {
      this.player.playQueue(tracks, 0);
    }
  }

  private resetResults(): void {
    this.tracks.set([]);
    this.artists.set([]);
    this.hasMore.set(false);
    this.nextCursor = null;
  }
}
