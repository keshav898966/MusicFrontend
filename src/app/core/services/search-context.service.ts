import { Injectable, computed, signal } from '@angular/core';

/**
 * What the single search box should do right now.
 *
 * <p>`global` sends the query to the search page; `local` filters whatever the current
 * page is showing, without navigating away.
 */
export type SearchMode = 'global' | 'local';

/**
 * Coordinates the one search box in the navbar with the page beneath it.
 *
 * <p>There is a single search field in the application. Inside a playlist it should filter
 * that playlist rather than throwing the listener out to a global result page; everywhere
 * else it searches Audius. A page registers itself as the local target while it is open,
 * and the navbar adapts its placeholder and behaviour accordingly.
 */
@Injectable({ providedIn: 'root' })
export class SearchContextService {
  /** Label of the local scope, e.g. a playlist name. Null when searching globally. */
  private readonly _scopeLabel = signal<string | null>(null);

  /** The live filter text for the local scope. */
  private readonly _localQuery = signal('');

  readonly scopeLabel = this._scopeLabel.asReadonly();
  readonly localQuery = this._localQuery.asReadonly();

  readonly mode = computed<SearchMode>(() => (this._scopeLabel() ? 'local' : 'global'));

  /** Placeholder text reflecting what the box will actually do. */
  readonly placeholder = computed(() => {
    const scope = this._scopeLabel();
    return scope ? `Search in ${scope}` : 'Search songs, artists or a movie';
  });

  /**
   * Claims the search box for the current page.
   *
   * <p>Called by a page that can filter its own contents, such as a playlist.
   */
  setLocalScope(label: string): void {
    this._scopeLabel.set(label);
    this._localQuery.set('');
  }

  /** Releases the local scope, returning the box to global search. */
  clearLocalScope(): void {
    this._scopeLabel.set(null);
    this._localQuery.set('');
  }

  /** Updates the local filter as the listener types. */
  setLocalQuery(query: string): void {
    this._localQuery.set(query);
  }
}
