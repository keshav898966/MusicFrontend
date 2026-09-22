import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PlaylistService } from '../../core/services/playlist.service';

/** Primary navigation, plus a live list of local playlists. */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar" [class.open]="open()" aria-label="Main navigation">
      <div class="brand">
        <a class="brand-main" routerLink="/" (click)="navigate.emit()">
          <span class="logo" aria-hidden="true">
            <!-- A "K" whose upper arm becomes a music note: the initial and the subject
                 in one mark, so it reads at the small size the sidebar allows. -->
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M10 6v20"
                stroke="currentColor"
                stroke-width="3.2"
                stroke-linecap="round"
              />
              <path
                d="M10 17.5L19 26"
                stroke="currentColor"
                stroke-width="3.2"
                stroke-linecap="round"
              />
              <path
                d="M10 16L21 8.5v7.5"
                stroke="currentColor"
                stroke-width="3.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="18.4" cy="16" r="3.4" fill="currentColor" />
            </svg>
          </span>
          <span class="name">keshav_rajput28</span>
        </a>

        <a
          class="social"
          href="https://instagram.com/keshav_rajput28"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          <span>instagram</span>
        </a>
      </div>

      <ul class="nav">
        <li>
          <a
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="navigate.emit()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke-linejoin="round" />
            </svg>
            <span>Home</span>
          </a>
        </li>

        <li>
          <a routerLink="/browse" routerLinkActive="active" (click)="navigate.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Browse</span>
          </a>
        </li>
        <li>
          <a routerLink="/playlists" routerLinkActive="active" (click)="navigate.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 6h13M3 12h13M3 18h9M19 10v9M19 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" stroke-linecap="round" />
            </svg>
            <span>Playlists</span>
          </a>
        </li>
      </ul>

      <div class="playlists">
        <div class="section-label">
          <span>Your playlists</span>
          <a routerLink="/playlists" aria-label="Manage playlists" (click)="navigate.emit()">+</a>
        </div>

        @if (playlistService.playlists().length === 0) {
          <p class="hint">Create a playlist to see it here.</p>
        } @else {
          <ul class="playlist-list">
            @for (playlist of playlistService.playlists(); track playlist.id) {
              <li>
                <a [routerLink]="['/playlists', playlist.id]" routerLinkActive="active" (click)="navigate.emit()">
                  <span class="truncate">{{ playlist.name }}</span>
                  <span class="badge">{{ playlist.songCount }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </div>

      <footer>
        <p>Music by <a href="https://audius.co" target="_blank" rel="noopener">Audius</a></p>
      </footer>
    </nav>
  `,
  styles: [
    `
      .sidebar {
        display: flex;
        flex-direction: column;
        width: var(--sidebar-width);
        height: 100%;
        padding: 18px 12px;
        background: var(--bg-sunken);
        border-right: 1px solid var(--border);
        overflow-y: auto;
      }

      .brand {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 10px 20px;
      }

      .brand-main {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      /* Sits under the name, deliberately quieter than the brand itself. */
      .social {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        /* Aligned with the name rather than the logo: logo width plus its gap. */
        margin-left: 44px;
        font-size: 0.6875rem;
        color: var(--text-muted);
        transition: color var(--transition-fast);
      }

      .social:hover {
        color: var(--accent-bright);
      }

      .social svg {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
      }

      .logo {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-md);
        background: var(--gradient-aurora);
        color: var(--text-on-accent);
      }

      .logo svg {
        width: 19px;
        height: 19px;
      }

      .name {
        /* Smaller than a short brand word would be: the username is long, and this keeps
           it on one line inside the sidebar. */
        font-size: 0.9375rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .nav a,
      .playlist-list a {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 0.9375rem;
        transition: color var(--transition-fast), background var(--transition-fast);
      }

      .nav a:hover,
      .playlist-list a:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      .nav a.active,
      .playlist-list a.active {
        color: var(--text-primary);
        background: var(--bg-active);
      }

      .nav a svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .playlists {
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        flex: 1;
        min-height: 0;
      }

      .section-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px 8px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .section-label a {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: var(--radius-sm);
        font-size: 1.125rem;
        line-height: 1;
        color: var(--text-muted);
      }

      .section-label a:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      .hint {
        padding: 0 12px;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      .playlist-list a {
        justify-content: space-between;
        padding: 8px 12px;
        font-size: 0.875rem;
        font-weight: 400;
      }

      .badge {
        font-size: 0.6875rem;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      footer {
        padding: 16px 12px 4px;
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      footer a {
        color: var(--accent-bright);
      }

      footer a:hover {
        text-decoration: underline;
      }

      /* Off-canvas drawer below the desktop breakpoint. */
      @media (max-width: 900px) {
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 70;
          transform: translateX(-100%);
          transition: transform var(--transition-base);
          box-shadow: var(--shadow-lg);
        }

        .sidebar.open {
          transform: translateX(0);
        }
      }
    `,
  ],
})
export class SidebarComponent {
  readonly playlistService = inject(PlaylistService);

  /** Controls the drawer on small screens. */
  readonly open = input<boolean>(false);

  /** Emitted when a link is followed, so the shell can close the drawer. */
  readonly navigate = output<void>();
}
