import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PlayerService } from './core/services/player.service';
import { PlaylistService } from './core/services/playlist.service';
import { QuickAddService } from './core/services/quick-add.service';
import { MusicPlayerComponent } from './shared/components/music-player.component';
import { NavbarComponent } from './shared/components/navbar.component';
import { SidebarComponent } from './shared/components/sidebar.component';

/**
 * Application shell.
 *
 * <p>The sidebar, navbar and player live here — outside {@code router-outlet} — so
 * navigation swaps only the page content and never interrupts playback.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, MusicPlayerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly playlistService = inject(PlaylistService);
  private readonly player = inject(PlayerService);

  /** Drives the save-confirmation toast. */
  readonly quickAdd = inject(QuickAddService);

  private readonly _menuOpen = signal(false);
  readonly menuOpen = this._menuOpen.asReadonly();

  /** Reserves space at the bottom of the scroll area only while the player is visible. */
  readonly playerVisible = computed(() => this.player.hasTrack());

  ngOnInit(): void {
    // Load playlists once for the sidebar; failures are non-fatal for browsing.
    this.playlistService.loadPlaylists().subscribe({
      // Reflect what is already saved, so the heart icons survive a reload.
      next: () => this.quickAdd.syncFromServer(),
      error: () => undefined,
    });
  }

  toggleMenu(): void {
    this._menuOpen.set(!this._menuOpen());
  }

  closeMenu(): void {
    this._menuOpen.set(false);
  }
}
