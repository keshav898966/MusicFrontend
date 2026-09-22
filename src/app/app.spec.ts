import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the navigation and brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-sidebar')).toBeTruthy();
    expect(element.querySelector('app-navbar')).toBeTruthy();
    expect(element.textContent).toContain('Nocturne');
  });

  it('keeps the player mounted outside the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    // The player must be a sibling of the outlet so navigation never destroys it.
    const element = fixture.nativeElement as HTMLElement;
    const player = element.querySelector('app-music-player');
    expect(player).toBeTruthy();
    expect(player?.closest('router-outlet')).toBeNull();
  });

  it('opens and closes the mobile navigation drawer', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.menuOpen()).toBe(false);
    app.toggleMenu();
    expect(app.menuOpen()).toBe(true);
    app.closeMenu();
    expect(app.menuOpen()).toBe(false);
  });
});
