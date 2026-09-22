import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { BROWSE_CATEGORIES, BrowseCategory } from '../../core/models/categories';
import { Track } from '../../core/models/music.models';
import { MusicService } from '../../core/services/music.service';
import { PlayerService } from '../../core/services/player.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { MusicGridComponent } from '../../shared/components/music-grid.component';

/** One search-backed row on the home page. */
interface HomeRow {
  readonly id: string;
  readonly label: string;
  readonly query: string;
}

/**
 * Rows that always appear, in this order.
 *
 * <p>These are the staples: whatever else changes, the page opens on Bollywood, Punjabi
 * and new releases.
 */
const PINNED_ROWS: readonly HomeRow[] = [
  { id: 'new-releases', label: 'New releases', query: 'new hindi song 2024' },
  { id: 'trending-india', label: 'Trending in India', query: 'bollywood hits' },
  { id: 'punjabi', label: 'Punjabi', query: 'punjabi' },
];

/**
 * The pool the remaining rows are drawn from.
 *
 * <p>A different selection is shown on each visit, so the page does not look identical
 * every time. Every entry was checked against the live API and returns playable results.
 */
const ROTATING_ROWS: readonly HomeRow[] = [
  { id: 'bhojpuri', label: 'Bhojpuri', query: 'bhojpuri' },
  { id: 'hindi', label: 'Hindi hits', query: 'hindi song' },
  { id: 'retro-bollywood', label: 'Retro Bollywood — 90s', query: '90s bollywood' },
  { id: 'old-hindi', label: 'Old is gold — classic Hindi', query: 'old hindi classic' },
  { id: 'romantic', label: 'Romantic Hindi', query: 'hindi romantic song' },
  { id: 'sad', label: 'Sad songs', query: 'hindi sad song' },
  { id: 'party', label: 'Party & dance', query: 'bollywood dance party' },
  { id: 'desi-hiphop', label: 'Desi hip-hop', query: 'desi hip hop' },
  { id: 'haryanvi', label: 'Haryanvi', query: 'haryanvi' },
  { id: 'rajputana', label: 'Rajputana', query: 'rajputana' },
  { id: 'maharana', label: 'Veer Ras — Maharana Pratap', query: 'maharana pratap' },
  { id: 'rajasthani', label: 'Rajasthani folk', query: 'rajasthani folk' },
  { id: 'marathi', label: 'Marathi', query: 'marathi song' },
  { id: 'bengali', label: 'Bengali', query: 'bengali song' },
  { id: 'kannada', label: 'Kannada', query: 'kannada song' },
  { id: 'malayalam', label: 'Malayalam', query: 'malayalam song' },
  { id: 'sufi', label: 'Sufi', query: 'sufi' },
  { id: 'qawwali', label: 'Qawwali', query: 'qawwali' },
  { id: 'ghazal', label: 'Ghazal', query: 'ghazal' },
  { id: 'bhajan', label: 'Bhajan & devotional', query: 'bhajan' },
  { id: 'classical', label: 'Indian classical', query: 'sitar tabla classical' },
  { id: 'remix', label: 'Remixes & mashups', query: 'bollywood remix mashup' },
  { id: 'lofi-india', label: 'Hindi lo-fi', query: 'hindi lofi' },
  { id: 'ninety', label: '90s throwbacks', query: '90s bollywood hits' },
  { id: 'eighty', label: '80s classics', query: '80s bollywood' },
  { id: 'indie', label: 'Indian indie', query: 'indian indie' },
];

/**
 * Rotates a list by a random offset.
 *
 * <p>Audius returns the same ordering for a given query, so without this a repeated
 * category would show the identical tracks in the identical order every visit.
 */
function rotate<T>(items: T[]): T[] {
  if (items.length < 3) {
    return items;
  }
  const start = Math.floor(Math.random() * items.length);
  return [...items.slice(start), ...items.slice(0, start)];
}

/** How many rotating rows to show alongside the pinned ones. */
const ROTATING_ROW_COUNT = 7;

/**
 * Picks the rows for this visit.
 *
 * <p>Pinned rows always lead; the rest are a random sample of the pool, so refreshing
 * genuinely changes what is on screen instead of showing the same list again.
 */
function pickRows(): HomeRow[] {
  const pool = [...ROTATING_ROWS];
  // Fisher-Yates, so every row has an equal chance of appearing.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [...PINNED_ROWS, ...pool.slice(0, ROTATING_ROW_COUNT)];
}

/** Landing page: a hero, Indian and retro rows, trending, and Audius playlists. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MusicGridComponent,

    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="home">
      @if (loading()) {
        <app-loading-spinner message="Loading music…" />
      } @else if (error(); as message) {
        <app-error-message [message]="message" (retry)="load()" />
      } @else {
        <!-- Hero -->
        @if (heroTrack(); as hero) {
          <section class="hero">
            @if (hero.artworkUrl) {
              <img class="hero-bg" [src]="hero.artworkUrl" alt="" aria-hidden="true" />
            }
            <div class="hero-inner">
              <span class="eyebrow">{{ heroEyebrow() }}</span>
              <h1 class="truncate">{{ hero.title }}</h1>
              <p class="truncate">{{ hero.artistName }}</p>
              <div class="hero-actions">
                <button type="button" class="btn-accent" (click)="playAll()">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
                  </svg>
                  Play
                </button>
                <button type="button" class="btn-ghost" (click)="shufflePlay()">Shuffle</button>
                <button
                  type="button"
                  class="btn-ghost"
                  title="Show a different selection"
                  (click)="shuffleRows()"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </section>
        }

        <!-- Quick category access -->
        <section>
          <div class="section-title">
            <h2>Browse by category</h2>
            <a class="see-all" routerLink="/browse">See all</a>
          </div>

          <div class="chips">
            @for (category of quickCategories; track category.id) {
              <button
                type="button"
                class="chip"
                [style.background]="category.gradient"
                (click)="openCategory(category)"
              >
                <span aria-hidden="true">{{ category.icon }}</span>
                {{ category.label }}
              </button>
            }
          </div>
        </section>

        <!-- Indian music leads the page. Audius has no genre tag for these styles, so
             each row is assembled from searches rather than from the trending chart. -->
        @if (indianLoading()) {
          <app-loading-spinner message="Loading Indian music…" />
        } @else {
          @for (row of indianRows(); track row.id) {
            @if (row.tracks.length > 0) {
              <section>
                <div class="section-title">
                  <h2>{{ row.label }}</h2>
                  <button type="button" class="see-all" (click)="openQuery(row.query)">See all</button>
                </div>
                <app-music-grid [tracks]="row.tracks" />
              </section>
            }
          }
        }

        @if (!indianLoading() && indianRows().length === 0) {
          <app-empty-state
            title="Nothing loaded"
            message="Could not reach the music service. Please try again."
            actionLabel="Retry"
            (action)="load()"
          />
        }
      }
    </div>
  `,
  styles: [
    `
      .home {
        display: flex;
        flex-direction: column;
        gap: 40px;
      }

      /* ------------------------------------------------------------- hero */

      .hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--radius-lg);
        background: var(--gradient-subtle);
        isolation: isolate;
      }

      .hero-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* Blurred artwork as an ambient backdrop rather than a literal image. */
        filter: blur(42px) saturate(1.5);
        transform: scale(1.25);
        opacity: 0.4;
        z-index: -1;
      }

      .hero-inner {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 44px 36px;
        background: linear-gradient(90deg, rgba(8, 8, 15, 0.9) 20%, rgba(8, 8, 15, 0.5) 100%);
      }

      .eyebrow {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-bright);
      }

      .hero h1 {
        font-size: clamp(1.75rem, 4vw, 2.75rem);
      }

      .hero p {
        color: var(--text-secondary);
        font-size: 1rem;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .hero-actions svg {
        width: 18px;
        height: 18px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 16px;
        border-radius: var(--radius-full);
        color: #fff;
        font-weight: 600;
        font-size: 0.875rem;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      }

      .chip:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      .see-all {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--accent-bright);
      }

      .see-all:hover {
        text-decoration: underline;
      }

      /* ------------------------------------------------------------- rows */

      .rows {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      /* -------------------------------------------------------- playlists */

      .playlist-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 18px;
      }

      .playlist-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        transition: background var(--transition-base), transform var(--transition-base);
      }

      .playlist-card:hover {
        background: var(--bg-elevated);
        transform: translateY(-3px);
      }

      .art {
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
        font-size: 2rem;
        color: var(--text-muted);
        background: var(--gradient-subtle);
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .name {
        font-weight: 600;
        font-size: 0.9375rem;
      }

      .owner {
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      @media (max-width: 640px) {
        .home {
          gap: 30px;
        }

        .hero-inner {
          padding: 28px 20px;
        }

        .playlist-grid {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly musicService = inject(MusicService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);

  /** Row selection for this visit; reshuffled by the refresh control. */
  private rows: HomeRow[] = pickRows();

  readonly indianRows = signal<(HomeRow & { tracks: Track[] })[]>([]);
  readonly indianLoading = signal(true);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** The first trending track, featured in the hero. */
  readonly heroTrack = signal<Track | null>(null);

  /** A short selection of the browse catalogue, shown as chips. */
  readonly quickCategories = BROWSE_CATEGORIES.filter((category) =>
    ['bollywood', 'punjabi', 'bhojpuri', 'haryanvi', 'sufi', 'ghazal', 'lofi', 'hiphop'].includes(
      category.id,
    ),
  );

  /** Labels the hero. */
  readonly heroEyebrow = computed(() => 'Featured');

  openCategory(category: BrowseCategory): void {
    void this.router.navigate(['/search'], { queryParams: { q: category.query } });
  }

  ngOnInit(): void {
    this.load();
  }

  /**
   * Loads all three sections in parallel.
   *
   * <p>Only trending is essential: the secondary sections fall back to empty rather than
   * failing the whole page, so one flaky upstream call cannot blank the home screen.
   */
  load(): void {
    // The page is entirely Indian music, so there is no separate global fetch: the row
    // batch below is the whole page.
    this.loading.set(false);
    this.error.set(null);
    this.loadIndianTracks();
  }

  /** Reshuffles the row selection and reloads, for the refresh control. */
  shuffleRows(): void {
    this.rows = pickRows();
    this.musicService.clearCache();
    this.loadIndianTracks();
  }

  /**
   * Builds the Indian music rows that lead the page.
   *
   * <p>Audius offers no genre filter for these styles — a Punjabi upload is typically
   * tagged Pop or Soundtrack — so each row comes from a search instead. The rows load in
   * one parallel batch, and the hero is taken from the first row that returns anything so
   * the page opens on Indian music rather than the global chart.
   */
  private loadIndianTracks(): void {
    this.indianLoading.set(true);

    // One request instead of ten: the backend runs the searches concurrently, so this
    // costs about as long as the slowest single search rather than the sum of them.
    this.musicService
      .searchTracksBatch(this.rows.map((row) => row.query), 14)
      .pipe(
        catchError(() => of({} as Record<string, Track[]>)),
        finalize(() => this.indianLoading.set(false)),
      )
      .subscribe((byQuery) => {
        // A single upload can match several searches; show it only in the first row.
        const seen = new Set<string>();
        const rows = this.rows
          .map((row) => {
            const tracks = (byQuery[row.query] ?? []).filter((track) => {
              if (seen.has(track.id)) {
                return false;
              }
              seen.add(track.id);
              return true;
            });
            // Rotate within the row too, so even a repeated category looks different.
            return { ...row, tracks: rotate(tracks) };
          })
          // Drop rows that came back empty rather than showing a bare heading.
          .filter((row) => row.tracks.length > 0);

        this.indianRows.set(rows);

        // Draw the hero from everything on the page, not just the first row: picking from
        // one short row made the same track lead every visit.
        const candidates = rows
          .flatMap((row) => row.tracks)
          // Artwork carries the hero visually, so prefer a track that has some.
          .filter((track) => track.artworkUrl);
        const pool = candidates.length > 0 ? candidates : rows.flatMap((row) => row.tracks);

        if (pool.length > 0) {
          this.heroTrack.set(pool[Math.floor(Math.random() * pool.length)]);
        }

        this.warmLikelyFirstPlays(rows);
      });
  }

  /**
   * Warms stream URLs for the tracks most likely to be played first.
   *
   * <p>Resolving a URL costs a redirect round trip to Audius, which is the bulk of the
   * delay between clicking play and hearing sound. Doing it for the hero and the first
   * few visible cards — after the page has rendered, so it competes with nothing — turns
   * the common first click from a wait into an instant start.
   *
   * <p>Kept deliberately small: warming everything would hammer the upstream API for
   * tracks nobody plays.
   */
  private warmLikelyFirstPlays(rows: (HomeRow & { tracks: Track[] })[]): void {
    const hero = this.heroTrack();
    const candidates = [
      ...(hero ? [hero] : []),
      // The first card of each of the first few rows: what a visitor actually sees.
      ...rows.slice(0, 3).flatMap((row) => row.tracks.slice(0, 2)),
    ];

    // Only two, and staggered. Warming five at once measurably slowed the very click it
    // was meant to help: Audius throttles concurrent callers, so the prefetches ended up
    // queued ahead of the real request.
    const unique = [...new Map(candidates.map((track) => [track.id, track])).values()].slice(0, 2);

    unique.forEach((track, index) => {
      // Defer past first paint, then space them out so they never overlap a user action.
      setTimeout(() => this.musicService.prefetchStreamUrl(track.id), 1200 + index * 1500);
    });
  }

  /** Opens the search page for a row's query. */
  openQuery(query: string): void {
    void this.router.navigate(['/search'], { queryParams: { q: query } });
  }

  /**
   * The queue the hero buttons play.
   *
   * <p>Every row on the page feeds the queue, so pressing play works through the whole
   * selection rather than a single category.
   */
  private heroQueue(): Track[] {
    return this.indianRows().flatMap((row) => row.tracks);
  }

  /** Plays the featured queue from the top. */
  playAll(): void {
    const tracks = this.heroQueue();
    if (tracks.length > 0) {
      this.player.playQueue(tracks, 0);
    }
  }

  /** Turns shuffle on, then plays the featured queue. */
  shufflePlay(): void {
    const tracks = this.heroQueue();
    if (tracks.length === 0) {
      return;
    }
    if (!this.player.shuffle()) {
      this.player.toggleShuffle();
    }
    this.player.playQueue(tracks, Math.floor(Math.random() * tracks.length));
  }
}
