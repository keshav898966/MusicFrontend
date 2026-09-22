import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';

import { SearchContextService } from '../../core/services/search-context.service';
import { SearchBarComponent } from './search-bar.component';

/** Top bar: menu toggle on mobile, history controls, and global search. */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchBarComponent],
  template: `
    <header class="navbar">
      <button type="button" class="btn-icon menu" aria-label="Open navigation" (click)="toggleMenu.emit()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round" />
        </svg>
      </button>

      <div class="history">
        <button type="button" class="btn-icon" aria-label="Go back" (click)="goBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button type="button" class="btn-icon" aria-label="Go forward" (click)="goForward()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <!-- The application's only search box. It filters the current page when that page
           supports it (a playlist), and searches Audius otherwise. -->
      <div class="search-slot">
        <app-search-bar
          [placeholder]="searchContext.placeholder()"
          (searchSubmit)="onSearch($event)"
          (queryChange)="onQueryChange($event)"
        />
        @if (searchContext.mode() === 'local') {
          <span class="scope-badge" title="Searching within this playlist">
            in {{ searchContext.scopeLabel() }}
          </span>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .navbar {
        display: flex;
        align-items: center;
        gap: 12px;
        height: var(--navbar-height);
        padding: 0 20px;
        background: rgba(8, 8, 15, 0.75);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .menu {
        display: none;
      }

      .history {
        display: flex;
        gap: 4px;
      }

      .btn-icon svg {
        width: 19px;
        height: 19px;
      }

      .search-slot {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        max-width: 520px;
      }

      .scope-badge {
        flex-shrink: 0;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--accent-bright);
        background: rgba(139, 92, 246, 0.14);
        border-radius: var(--radius-full);
        white-space: nowrap;
      }

      @media (max-width: 900px) {
        .navbar {
          padding: 0 12px;
        }

        .menu {
          display: grid;
        }

        /* History controls duplicate the browser chrome on mobile. */
        .history {
          display: none;
        }

        .search-slot {
          max-width: none;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  private readonly router = inject(Router);
  readonly searchContext = inject(SearchContextService);

  readonly toggleMenu = output<void>();

  /**
   * Handles a submitted search.
   *
   * <p>Within a playlist the query filters that playlist in place; elsewhere it goes to
   * the search page. Navigating away from a filtered playlist would lose the listener's
   * place for no benefit.
   */
  onSearch(query: string): void {
    if (this.searchContext.mode() === 'local') {
      this.searchContext.setLocalQuery(query);
      return;
    }
    void this.router.navigate(['/search'], { queryParams: { q: query } });
  }

  /** Live filtering only applies to the local scope; global search waits for submit. */
  onQueryChange(query: string): void {
    if (this.searchContext.mode() === 'local') {
      this.searchContext.setLocalQuery(query);
    }
  }

  goBack(): void {
    history.back();
  }

  goForward(): void {
    history.forward();
  }
}
