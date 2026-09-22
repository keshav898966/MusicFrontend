import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { LocalPlaylist } from '../../core/models/music.models';
import { errorMessageOf } from '../../core/services/error.interceptor';
import { PlaylistService } from '../../core/services/playlist.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorMessageComponent } from '../../shared/components/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';

/**
 * Playlist library.
 *
 * <p>Playlists are global in this build: with no user accounts, everyone shares the same
 * collection. That limitation is surfaced in the UI rather than hidden.
 */
@Component({
  selector: 'app-playlists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="playlists-page">
      <header>
        <div>
          <h1>Playlists</h1>
          <p class="note">
            Saved on this server. This build has no accounts, so playlists are shared by everyone.
          </p>
        </div>
        <button type="button" class="btn-accent" (click)="toggleForm()">
          {{ formOpen() ? 'Cancel' : 'New playlist' }}
        </button>
      </header>

      @if (formOpen()) {
        <form class="create" [formGroup]="form" (ngSubmit)="create()">
          <div class="field">
            <label for="name">Name</label>
            <input id="name" type="text" formControlName="name" placeholder="Late night coding" />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <span class="field-error">
                @if (form.controls.name.hasError('required')) {
                  A name is required.
                } @else {
                  Keep the name under 120 characters.
                }
              </span>
            }
          </div>

          <div class="field">
            <label for="description">Description <span class="optional">(optional)</span></label>
            <input id="description" type="text" formControlName="description" placeholder="What is it for?" />
          </div>

          <button type="submit" class="btn-accent" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Creating…' : 'Create' }}
          </button>
        </form>
      }

      @if (createError(); as message) {
        <app-error-message title="Could not create playlist" [message]="message" [showRetry]="false" />
      }

      @if (loading()) {
        <app-loading-spinner message="Loading playlists…" />
      } @else if (error(); as message) {
        <app-error-message [message]="message" (retry)="load()" />
      } @else if (playlistService.playlists().length === 0) {
        <app-empty-state
          icon="📀"
          title="No playlists yet"
          message="Create one, then add tracks from any track or search page."
          actionLabel="Create a playlist"
          (action)="toggleForm()"
        />
      } @else {
        <ul class="grid">
          @for (playlist of playlistService.playlists(); track playlist.id) {
            <li>
              <a class="card" [routerLink]="['/playlists', playlist.id]">
                <span class="art" aria-hidden="true">♫</span>
                <span class="meta">
                  <span class="name truncate">{{ playlist.name }}</span>
                  @if (playlist.description) {
                    <span class="desc truncate">{{ playlist.description }}</span>
                  }
                  <span class="count">{{ playlist.songCount }} {{ playlist.songCount === 1 ? 'song' : 'songs' }}</span>
                </span>
              </a>

              <button
                type="button"
                class="btn-icon delete"
                [attr.aria-label]="'Delete ' + playlist.name"
                (click)="remove(playlist)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .playlists-page {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
      }

      .note {
        margin-top: 4px;
        font-size: 0.875rem;
        color: var(--text-muted);
        max-width: 56ch;
      }

      /* ------------------------------------------------------------- form */

      .create {
        display: flex;
        align-items: flex-end;
        gap: 14px;
        flex-wrap: wrap;
        padding: 20px;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-width: 220px;
      }

      label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .optional {
        font-weight: 400;
        color: var(--text-muted);
      }

      input {
        padding: 10px 14px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        outline: none;
        transition: border-color var(--transition-fast);
      }

      input:focus {
        border-color: var(--accent);
      }

      input::placeholder {
        color: var(--text-muted);
      }

      .field-error {
        font-size: 0.75rem;
        color: var(--danger);
      }

      /* ------------------------------------------------------------- grid */

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 14px;
      }

      .grid li {
        position: relative;
      }

      .card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        transition: background var(--transition-base), transform var(--transition-base);
      }

      .card:hover {
        background: var(--bg-elevated);
        transform: translateY(-2px);
      }

      .art {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        flex-shrink: 0;
        font-size: 1.5rem;
        color: var(--text-on-accent);
        background: var(--gradient-aurora);
        border-radius: var(--radius-md);
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        /* Leaves room for the delete button in the top-right corner. */
        padding-right: 28px;
      }

      .name {
        font-weight: 600;
        font-size: 0.9375rem;
      }

      .desc {
        font-size: 0.8125rem;
        color: var(--text-secondary);
      }

      .count {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .delete {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        opacity: 0;
      }

      .delete svg {
        width: 15px;
        height: 15px;
      }

      .grid li:hover .delete,
      .delete:focus-visible {
        opacity: 1;
      }

      .delete:hover {
        color: var(--danger);
      }

      @media (max-width: 560px) {
        .delete {
          opacity: 1;
        }
      }
    `,
  ],
})
export class PlaylistsComponent implements OnInit {
  readonly playlistService = inject(PlaylistService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly formOpen = signal(false);

  /** Mirrors the backend constraints so invalid input is caught before the request. */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.playlistService
      .loadPlaylists()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        error: (err) => this.error.set(errorMessageOf(err, 'Could not load playlists.')),
      });
  }

  toggleForm(): void {
    this.formOpen.set(!this.formOpen());
    if (!this.formOpen()) {
      this.form.reset();
      this.createError.set(null);
    }
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description } = this.form.getRawValue();
    this.saving.set(true);
    this.createError.set(null);

    this.playlistService
      .create(name.trim(), description.trim() || undefined)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.form.reset();
          this.formOpen.set(false);
        },
        error: (err) => this.createError.set(errorMessageOf(err, 'Could not create the playlist.')),
      });
  }

  remove(playlist: LocalPlaylist): void {
    // Deleting takes the songs with it, so confirm before acting.
    if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) {
      return;
    }

    this.playlistService.delete(playlist.id).subscribe({
      error: (err) => this.error.set(errorMessageOf(err, 'Could not delete the playlist.')),
    });
  }
}
