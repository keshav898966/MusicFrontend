import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';

import { PlaylistService } from '../../core/services/playlist.service';
import { QuickAddService } from '../../core/services/quick-add.service';

/**
 * Asks which playlist a song should be saved to, when there is more than one.
 *
 * <p>Opened by {@link QuickAddService} and rendered once in the application shell. It is
 * a bottom sheet on phones, where it sits under the thumb, and a centred dialog on
 * larger screens.
 */
@Component({
  selector: 'app-playlist-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (quickAdd.pickerTrack(); as track) {
      <div class="backdrop" (click)="cancel()" aria-hidden="true"></div>

      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <header>
          <h3 id="picker-title">Save to playlist</h3>
          <p class="track truncate">{{ track.title }}</p>
        </header>

        <ul class="list">
          @for (playlist of playlists(); track playlist.id) {
            <li>
              <button type="button" class="option" (click)="choose(playlist.id)">
                <span class="name truncate">{{ playlist.name }}</span>
                <span class="count">{{ playlist.songCount }} {{ playlist.songCount === 1 ? 'song' : 'songs' }}</span>
                @if (playlist.id === targetId()) {
                  <span class="last" title="Last used">✓</span>
                }
              </button>
            </li>
          }
        </ul>

        <form class="create" (submit)="create($event)">
          <input
            type="text"
            placeholder="New playlist name"
            maxlength="120"
            aria-label="New playlist name"
            [value]="newName()"
            (input)="newName.set($any($event.target).value)"
          />
          <button type="submit" class="btn-accent" [disabled]="!newName().trim()">Create</button>
        </form>

        <button type="button" class="btn-ghost cancel" (click)="cancel()">Cancel</button>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 90;
        background: rgba(0, 0, 0, 0.55);
        animation: fade 160ms ease;
      }

      .sheet {
        position: fixed;
        z-index: 91;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: min(420px, calc(100vw - 32px));
        max-height: min(560px, calc(100vh - 64px));
        padding: 20px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        animation: pop 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      header {
        min-width: 0;
      }

      .track {
        margin-top: 4px;
        color: var(--text-muted);
        font-size: 0.875rem;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        min-height: 0;
      }

      .option {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        text-align: left;
        transition: background var(--transition-fast);
      }

      .option:hover {
        background: var(--bg-hover);
      }

      .name {
        flex: 1;
        min-width: 0;
        font-weight: 600;
      }

      .count {
        flex-shrink: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      .last {
        flex-shrink: 0;
        color: var(--success);
        font-weight: 700;
      }

      .create {
        display: flex;
        gap: 8px;
      }

      .create input {
        flex: 1;
        min-width: 0;
        padding: 10px 14px;
        color: var(--text-primary);
        background: var(--bg-surface);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-full);
        outline: none;
      }

      .create input:focus {
        border-color: var(--accent);
      }

      .create .btn-accent {
        padding: 10px 18px;
      }

      .cancel {
        align-self: stretch;
      }

      @keyframes fade {
        from { opacity: 0; }
      }

      @keyframes pop {
        from { opacity: 0; transform: translate(-50%, -48%); }
      }

      @keyframes rise {
        from { transform: translateY(100%); }
      }

      /* On phones it becomes a bottom sheet, clear of the gesture bar. */
      @media (max-width: 560px) {
        .sheet {
          left: 0;
          right: 0;
          top: auto;
          bottom: 0;
          transform: none;
          width: 100%;
          max-height: 75vh;
          padding: 20px 16px calc(16px + var(--player-safe-bottom, 0px));
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          border-bottom: none;
          animation: rise 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      }
    `,
  ],
})
export class PlaylistPickerComponent {
  readonly quickAdd = inject(QuickAddService);
  private readonly playlistService = inject(PlaylistService);

  readonly playlists = this.playlistService.playlists;
  readonly targetId = computed(() => this.quickAdd.target()?.id ?? null);
  readonly newName = signal('');

  choose(playlistId: number): void {
    this.newName.set('');
    this.quickAdd.chooseForPicker(playlistId);
  }

  create(event: Event): void {
    event.preventDefault();
    const name = this.newName();
    this.newName.set('');
    this.quickAdd.createForPicker(name);
  }

  cancel(): void {
    this.newName.set('');
    this.quickAdd.cancelPicker();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.quickAdd.pickerTrack()) {
      this.cancel();
    }
  }
}
