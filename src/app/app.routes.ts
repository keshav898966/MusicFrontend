import { Routes } from '@angular/router';

/**
 * Application routes.
 *
 * Every page is lazily loaded, so the initial bundle carries only the shell and the
 * player; a route's code arrives when it is first visited.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'Home',
  },
  {
    path: 'browse',
    loadComponent: () => import('./features/browse/browse.component').then((m) => m.BrowseComponent),
    title: 'Browse',
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.component').then((m) => m.SearchComponent),
    title: 'Search',
  },
  {
    path: 'track/:id',
    loadComponent: () => import('./features/track/track.component').then((m) => m.TrackComponent),
    title: 'Track',
  },
  {
    path: 'artist/:id',
    loadComponent: () => import('./features/artist/artist.component').then((m) => m.ArtistComponent),
    title: 'Artist',
  },
  {
    path: 'playlists',
    loadComponent: () =>
      import('./features/playlists/playlists.component').then((m) => m.PlaylistsComponent),
    title: 'Playlists',
  },
  {
    path: 'playlists/:id',
    loadComponent: () =>
      import('./features/playlists/playlist-detail.component').then((m) => m.PlaylistDetailComponent),
    title: 'Playlist',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Not found',
  },
];
