import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Track } from '../../core/models/music.models';
import { PlayerService } from '../../core/services/player.service';
import { MusicCardComponent } from './music-card.component';

function makeTrack(id = 't1'): Track {
  return {
    id,
    title: 'Test Track',
    artistId: 'a1',
    artistName: 'Test Artist',
    artistHandle: 'testartist',
    artistVerified: true,
    artworkUrl: 'large.jpg',
    artworkThumbUrl: 'small.jpg',
    duration: 195,
    genre: 'Electronic',
    mood: null,
    releaseDate: null,
    playCount: 12345,
    favoriteCount: 0,
    repostCount: 0,
    streamable: true,
    permalink: null,
    source: 'AUDIUS',
    previewOnly: false,
    previewUrl: null,
  };
}

/** Stubs only what the card touches, so the real audio pipeline stays out of the test. */
class PlayerServiceStub {
  currentTrack = signal<Track | null>(null);
  isPlaying = signal(false);
  play = vi.fn();
  togglePlayPause = vi.fn();
  addToQueue = vi.fn();
}

describe('MusicCardComponent', () => {
  let player: PlayerServiceStub;

  beforeEach(async () => {
    player = new PlayerServiceStub();

    await TestBed.configureTestingModule({
      imports: [MusicCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PlayerService, useValue: player },
      ],
    }).compileComponents();
  });

  function render(track = makeTrack(), queue?: Track[]) {
    const fixture = TestBed.createComponent(MusicCardComponent);
    fixture.componentRef.setInput('track', track);
    if (queue) {
      fixture.componentRef.setInput('queue', queue);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('renders the title, artist and duration', async () => {
    const fixture = render();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Test Track');
    expect(text).toContain('Test Artist');
    expect(text).toContain('3:15');
  });

  it('abbreviates the play count', async () => {
    const fixture = render();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('12.3K');
  });

  it('asks the player to play rather than creating its own audio', () => {
    const track = makeTrack();
    const queue = [track, makeTrack('t2')];
    const fixture = render(track, queue);

    fixture.componentInstance.onPlay(new MouseEvent('click'));

    expect(player.play).toHaveBeenCalledWith(track, queue);
    // A card must never instantiate audio itself.
    expect((fixture.nativeElement as HTMLElement).querySelector('audio')).toBeNull();
  });

  it('toggles instead of restarting when it is already the active track', () => {
    const track = makeTrack();
    player.currentTrack.set(track);

    const fixture = render(track);
    fixture.componentInstance.onPlay(new MouseEvent('click'));

    expect(player.togglePlayPause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('adds the track to the queue', () => {
    const track = makeTrack();
    const fixture = render(track);

    fixture.componentInstance.onAddToQueue(new MouseEvent('click'));

    expect(player.addToQueue).toHaveBeenCalledWith(track);
  });

  it('marks itself as current when the player is on this track', () => {
    const track = makeTrack();
    player.currentTrack.set(track);
    player.isPlaying.set(true);

    const fixture = render(track);

    expect(fixture.componentInstance.isCurrent()).toBe(true);
    expect(fixture.componentInstance.isCurrentlyPlaying()).toBe(true);
  });
});
