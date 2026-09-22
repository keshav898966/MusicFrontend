import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Track } from '../models/music.models';
import { MusicService } from './music.service';
import { PlayerService } from './player.service';

function makeTrack(id: string, title = `Track ${id}`): Track {
  return {
    id,
    title,
    artistId: 'a1',
    artistName: 'Test Artist',
    artistHandle: null,
    artistVerified: false,
    artworkUrl: null,
    artworkThumbUrl: null,
    duration: 180,
    genre: null,
    mood: null,
    releaseDate: null,
    playCount: 0,
    favoriteCount: 0,
    repostCount: 0,
    streamable: true,
    permalink: null,
    source: 'AUDIUS',
    previewOnly: false,
    previewUrl: null,
  };
}

/** Minimal MusicService stub: playback tests care only about the resolved URL. */
class MusicServiceStub {
  getStreamUrl = vi.fn((trackId: string) => of(`https://cdn.example.com/${trackId}`));
}

describe('PlayerService', () => {
  let player: PlayerService;
  let musicService: MusicServiceStub;

  beforeEach(() => {
    musicService = new MusicServiceStub();

    // jsdom does not implement media playback; stub it so play() resolves.
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [PlayerService, { provide: MusicService, useValue: musicService }],
    });
    player = TestBed.inject(PlayerService);
  });

  describe('initial state', () => {
    it('starts empty and paused', () => {
      expect(player.currentTrack()).toBeNull();
      expect(player.queue()).toEqual([]);
      expect(player.currentIndex()).toBe(-1);
      expect(player.isPlaying()).toBe(false);
      expect(player.hasTrack()).toBe(false);
    });

    it('starts with shuffle and repeat off', () => {
      expect(player.shuffle()).toBe(false);
      expect(player.repeatMode()).toBe('off');
    });
  });

  describe('play', () => {
    it('plays a single track and resolves its stream URL', () => {
      const track = makeTrack('t1');
      player.play(track);

      expect(player.currentTrack()?.id).toBe('t1');
      expect(player.queue().length).toBe(1);
      expect(musicService.getStreamUrl).toHaveBeenCalledWith('t1');
    });

    it('adopts a supplied queue and starts at the chosen track', () => {
      const queue = [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')];
      player.play(queue[1], queue);

      expect(player.queue().length).toBe(3);
      expect(player.currentIndex()).toBe(1);
      expect(player.currentTrack()?.id).toBe('t2');
    });

    it('reuses the existing entry when replaying a queued track', () => {
      const track = makeTrack('t1');
      player.play(track);
      player.play(track);

      // The track must not be appended twice.
      expect(player.queue().length).toBe(1);
    });

    it('playQueue starts from the requested index', () => {
      const tracks = [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')];
      player.playQueue(tracks, 2);

      expect(player.currentIndex()).toBe(2);
      expect(player.currentTrack()?.id).toBe('t3');
    });

    it('playQueue ignores an empty list', () => {
      player.playQueue([], 0);
      expect(player.currentTrack()).toBeNull();
    });

    it('clamps an out-of-range start index', () => {
      const tracks = [makeTrack('t1'), makeTrack('t2')];
      player.playQueue(tracks, 99);
      expect(player.currentIndex()).toBe(1);
    });
  });

  describe('next and previous', () => {
    beforeEach(() => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')], 0);
    });

    it('advances through the queue', () => {
      player.next();
      expect(player.currentTrack()?.id).toBe('t2');

      player.next();
      expect(player.currentTrack()?.id).toBe('t3');
    });

    it('stops at the end when repeat is off', () => {
      player.playAt(2);
      player.next();

      // The index must stay put rather than wrapping around.
      expect(player.currentIndex()).toBe(2);
      expect(player.isPlaying()).toBe(false);
    });

    it('wraps to the start when repeat is all', () => {
      player.cycleRepeatMode(); // off -> all
      expect(player.repeatMode()).toBe('all');

      player.playAt(2);
      player.next();
      expect(player.currentIndex()).toBe(0);
    });

    it('goes back to the previous track', () => {
      player.playAt(2);
      player.previous();
      expect(player.currentTrack()?.id).toBe('t2');
    });

    it('reports whether next is available', () => {
      player.playAt(2);
      expect(player.canGoNext()).toBe(false);

      player.cycleRepeatMode(); // all
      expect(player.canGoNext()).toBe(true);
    });
  });

  describe('repeat', () => {
    it('cycles off, all, one and back', () => {
      expect(player.repeatMode()).toBe('off');
      player.cycleRepeatMode();
      expect(player.repeatMode()).toBe('all');
      player.cycleRepeatMode();
      expect(player.repeatMode()).toBe('one');
      player.cycleRepeatMode();
      expect(player.repeatMode()).toBe('off');
    });

    it('an explicit skip still advances while repeat-one is set', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2')], 0);
      player.cycleRepeatMode();
      player.cycleRepeatMode(); // one

      // automatic=false means the user pressed next.
      player.next(false);
      expect(player.currentTrack()?.id).toBe('t2');
    });
  });

  describe('shuffle', () => {
    it('toggles on and off', () => {
      expect(player.shuffle()).toBe(false);
      player.toggleShuffle();
      expect(player.shuffle()).toBe(true);
      player.toggleShuffle();
      expect(player.shuffle()).toBe(false);
    });

    it('keeps the current track playing when shuffle is switched on', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')], 1);
      const before = player.currentTrack()?.id;

      player.toggleShuffle();

      expect(player.currentTrack()?.id).toBe(before);
    });

    it('does not reorder the visible queue', () => {
      const tracks = [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')];
      player.playQueue(tracks, 0);
      player.toggleShuffle();

      expect(player.queue().map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('visits every track exactly once per shuffled pass', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3'), makeTrack('t4')], 0);
      player.toggleShuffle();

      const visited = new Set<string>([player.currentTrack()!.id]);
      for (let i = 0; i < 3; i++) {
        player.next();
        visited.add(player.currentTrack()!.id);
      }

      expect(visited.size).toBe(4);
    });
  });

  describe('volume and mute', () => {
    it('sets the volume', () => {
      player.setVolume(0.35);
      expect(player.volume()).toBeCloseTo(0.35);
    });

    it('clamps out-of-range values', () => {
      player.setVolume(5);
      expect(player.volume()).toBe(1);

      player.setVolume(-2);
      expect(player.volume()).toBe(0);
    });

    it('toggles mute', () => {
      expect(player.muted()).toBe(false);
      player.toggleMute();
      expect(player.muted()).toBe(true);
      player.toggleMute();
      expect(player.muted()).toBe(false);
    });

    it('raising the volume unmutes', () => {
      player.setMuted(true);
      player.setVolume(0.5);
      expect(player.muted()).toBe(false);
    });
  });

  describe('queue management', () => {
    it('appends a track', () => {
      player.addToQueue(makeTrack('t1'));
      expect(player.queue().length).toBe(1);
    });

    it('ignores a duplicate', () => {
      const track = makeTrack('t1');
      player.addToQueue(track);
      player.addToQueue(track);
      expect(player.queue().length).toBe(1);
    });

    it('starts playing when the first track is queued into an empty player', () => {
      player.addToQueue(makeTrack('t1'));
      expect(player.currentTrack()?.id).toBe('t1');
    });

    it('adds several tracks at once', () => {
      player.addAllToQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')]);
      expect(player.queue().length).toBe(3);
    });

    it('removes a track and keeps the current one selected', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')], 2);

      // Removing an earlier entry must not change which track is playing.
      player.removeFromQueue(0);

      expect(player.queue().length).toBe(2);
      expect(player.currentTrack()?.id).toBe('t3');
    });

    it('plays the next track when the current one is removed', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')], 1);
      player.removeFromQueue(1);

      expect(player.queue().map((t) => t.id)).toEqual(['t1', 't3']);
      expect(player.currentTrack()?.id).toBe('t3');
    });

    it('stops when the last track is removed', () => {
      player.playQueue([makeTrack('t1')], 0);
      player.removeFromQueue(0);

      expect(player.queue()).toEqual([]);
      expect(player.currentTrack()).toBeNull();
    });

    it('ignores an out-of-range removal', () => {
      player.playQueue([makeTrack('t1')], 0);
      player.removeFromQueue(99);
      expect(player.queue().length).toBe(1);
    });

    it('clears the queue', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2')], 0);
      player.clearQueue();

      expect(player.queue()).toEqual([]);
      expect(player.currentIndex()).toBe(-1);
      expect(player.currentTrack()).toBeNull();
    });

    it('jumps to a queue position', () => {
      player.playQueue([makeTrack('t1'), makeTrack('t2'), makeTrack('t3')], 0);
      player.playAt(2);
      expect(player.currentTrack()?.id).toBe('t3');
    });
  });

  describe('errors', () => {
    it('surfaces an error when the stream URL cannot be resolved', () => {
      musicService.getStreamUrl = vi.fn(() => throwError(() => new Error('boom')));

      player.play(makeTrack('t1'));

      expect(player.error()).toContain('Could not play');
      expect(player.isPlaying()).toBe(false);
      expect(player.loading()).toBe(false);
    });

    it('clears the error when a later track plays successfully', () => {
      musicService.getStreamUrl = vi.fn(() => throwError(() => new Error('boom')));
      player.play(makeTrack('t1'));
      expect(player.error()).not.toBeNull();

      musicService.getStreamUrl = vi.fn((id: string) => of(`https://cdn.example.com/${id}`));
      player.play(makeTrack('t2'));

      expect(player.error()).toBeNull();
    });
  });

  describe('preferences', () => {
    it('remembers volume and repeat mode between sessions', () => {
      player.setVolume(0.42);
      player.cycleRepeatMode(); // all
      TestBed.flushEffects?.();

      // A fresh service instance must pick the stored values back up.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [PlayerService, { provide: MusicService, useValue: musicService }],
      });
      const restored = TestBed.inject(PlayerService);

      expect(restored.volume()).toBeCloseTo(0.42);
      expect(restored.repeatMode()).toBe('all');
    });
  });
});
