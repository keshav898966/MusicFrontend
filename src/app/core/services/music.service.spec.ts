import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { PageResponse, Track } from '../models/music.models';
import { MusicService } from './music.service';

function makeTrack(id: string, title = 'Test Track'): Track {
  return {
    id,
    title,
    artistId: 'a1',
    artistName: 'Test Artist',
    artistHandle: 'testartist',
    artistVerified: false,
    artworkUrl: 'large.jpg',
    artworkThumbUrl: 'small.jpg',
    duration: 180,
    genre: 'Electronic',
    mood: null,
    releaseDate: null,
    playCount: 100,
    favoriteCount: 10,
    repostCount: 2,
    streamable: true,
    permalink: null,
    source: 'AUDIUS',
    previewOnly: false,
    previewUrl: null,
  };
}

function makePage(items: Track[]): PageResponse<Track> {
  return { items, offset: 0, limit: 20, count: items.length, hasMore: false, nextCursor: null };
}

describe('MusicService', () => {
  let service: MusicService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MusicService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MusicService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('trending', () => {
    it('requests trending tracks with the given paging', () => {
      let received: PageResponse<Track> | undefined;
      service.getTrending(10, 5).subscribe((page) => (received = page));

      const request = http.expectOne(
        (req) => req.url.endsWith('/music/trending') && req.params.get('limit') === '10',
      );
      expect(request.request.params.get('offset')).toBe('5');
      request.flush(makePage([makeTrack('t1')]));

      expect(received?.items.length).toBe(1);
      expect(received?.items[0].id).toBe('t1');
    });

    it('passes a genre filter when one is given', () => {
      service.getTrending(20, 0, 'Electronic').subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/trending'));
      expect(request.request.params.get('genre')).toBe('Electronic');
      request.flush(makePage([]));
    });

    it('serves a repeated request from cache without a second call', () => {
      service.getTrending(20, 0).subscribe();
      http.expectOne((req) => req.url.endsWith('/music/trending')).flush(makePage([makeTrack('t1')]));

      // The identical request must be answered from the cache.
      let cached: PageResponse<Track> | undefined;
      service.getTrending(20, 0).subscribe((page) => (cached = page));
      http.expectNone((req) => req.url.endsWith('/music/trending'));

      expect(cached?.items[0].id).toBe('t1');
    });

    it('does not cache a failed request', () => {
      service.getTrending(20, 0).subscribe({ error: () => undefined });
      http
        .expectOne((req) => req.url.endsWith('/music/trending'))
        .flush('boom', { status: 502, statusText: 'Bad Gateway' });

      // After a failure the next call must reach the network again.
      service.getTrending(20, 0).subscribe({ error: () => undefined });
      http.expectOne((req) => req.url.endsWith('/music/trending')).flush(makePage([]));
    });
  });

  describe('search', () => {
    it('sends the trimmed query', () => {
      service.searchTracks('  lofi  ').subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/search'));
      expect(request.request.params.get('q')).toBe('lofi');
      request.flush(makePage([]));
    });

    it('returns an empty page for a blank query without calling the backend', () => {
      let received: PageResponse<Track> | undefined;
      service.searchTracks('   ').subscribe((page) => (received = page));

      http.expectNone(() => true);
      expect(received?.items).toEqual([]);
      expect(received?.count).toBe(0);
    });

    it('returns no artists for a blank query without calling the backend', () => {
      let received: unknown[] | undefined;
      service.searchArtists('').subscribe((artists) => (received = artists));

      http.expectNone(() => true);
      expect(received).toEqual([]);
    });

    it('recovers from an artist-search failure so track results still render', () => {
      let received: unknown[] | undefined;
      service.searchArtists('test').subscribe((artists) => (received = artists));

      http
        .expectOne((req) => req.url.endsWith('/music/search/artists'))
        .flush('error', { status: 500, statusText: 'Server Error' });

      expect(received).toEqual([]);
    });
  });

  describe('tracks and artists', () => {
    it('fetches a track by id', () => {
      let received: Track | undefined;
      service.getTrack('t1').subscribe((track) => (received = track));

      http.expectOne((req) => req.url.endsWith('/music/tracks/t1')).flush(makeTrack('t1', 'My Song'));
      expect(received?.title).toBe('My Song');
    });

    it('fetches artist tracks with paging', () => {
      service.getArtistTracks('a1', 10, 20).subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/artists/a1/tracks'));
      expect(request.request.params.get('limit')).toBe('10');
      expect(request.request.params.get('offset')).toBe('20');
      request.flush(makePage([]));
    });
  });

  describe('stream URLs', () => {
    it('unwraps the resolved stream URL', () => {
      let received: string | undefined;
      service.getStreamUrl('t1').subscribe((url) => (received = url));

      http.expectOne((req) => req.url.endsWith('/music/tracks/t1/stream-url')).flush({
        trackId: 't1',
        streamUrl: 'https://cdn.example.com/signed',
        expiresInSeconds: 1800,
      });

      expect(received).toBe('https://cdn.example.com/signed');
    });

    it('reuses a freshly resolved URL so a prefetched track starts instantly', () => {
      service.getStreamUrl('t1').subscribe();
      http.expectOne((req) => req.url.endsWith('/music/tracks/t1/stream-url')).flush({
        trackId: 't1',
        streamUrl: 'https://cdn.example.com/one',
        expiresInSeconds: 1800,
      });

      // Resolving costs an Audius redirect round-trip, so a repeat within the short
      // reuse window must be served from memory rather than hitting the backend again.
      let second: string | undefined;
      service.getStreamUrl('t1').subscribe((url) => (second = url));
      http.expectNone((req) => req.url.endsWith('/music/tracks/t1/stream-url'));

      expect(second).toBe('https://cdn.example.com/one');
    });

    it('prefetches a stream URL exactly once', () => {
      service.prefetchStreamUrl('t2');
      http.expectOne((req) => req.url.endsWith('/music/tracks/t2/stream-url')).flush({
        trackId: 't2',
        streamUrl: 'https://cdn.example.com/two',
        expiresInSeconds: 1800,
      });

      // A prefetched URL must satisfy the later real request without a second call.
      service.prefetchStreamUrl('t2');
      http.expectNone((req) => req.url.endsWith('/music/tracks/t2/stream-url'));

      let resolved: string | undefined;
      service.getStreamUrl('t2').subscribe((url) => (resolved = url));
      expect(resolved).toBe('https://cdn.example.com/two');
    });
  });

  describe('cursor pagination', () => {
    it('sends a cursor instead of an offset when one is given', () => {
      service.searchTracks('lofi', 20, 0, 'djE6MjA6OTk5').subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/search'));
      expect(request.request.params.get('cursor')).toBe('djE6MjA6OTk5');
      // Offset must be omitted so the backend has no ambiguity about which wins.
      expect(request.request.params.has('offset')).toBe(false);
      request.flush(makePage([]));
    });

    it('falls back to an offset when no cursor is given', () => {
      service.searchTracks('lofi', 20, 40).subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/search'));
      expect(request.request.params.get('offset')).toBe('40');
      expect(request.request.params.has('cursor')).toBe(false);
      request.flush(makePage([]));
    });

    it('surfaces the cursor returned for the next page', () => {
      let received: PageResponse<Track> | undefined;
      service.searchTracks('lofi').subscribe((page) => (received = page));

      http.expectOne((req) => req.url.endsWith('/music/search')).flush({
        items: [makeTrack('t1')],
        offset: 0,
        limit: 20,
        count: 1,
        hasMore: true,
        nextCursor: 'djE6MjA6MTIz',
      });

      expect(received?.nextCursor).toBe('djE6MjA6MTIz');
      expect(received?.hasMore).toBe(true);
    });

    it('sends a cursor for artist tracks too', () => {
      service.getArtistTracks('a1', 20, 0, 'djE6MjA6NTU1').subscribe();

      const request = http.expectOne((req) => req.url.endsWith('/music/artists/a1/tracks'));
      expect(request.request.params.get('cursor')).toBe('djE6MjA6NTU1');
      request.flush(makePage([]));
    });
  });

  it('clears cached responses on demand', () => {
    service.getTrending(20, 0).subscribe();
    http.expectOne((req) => req.url.endsWith('/music/trending')).flush(makePage([]));

    service.clearCache();

    service.getTrending(20, 0).subscribe();
    http.expectOne((req) => req.url.endsWith('/music/trending')).flush(makePage([]));
  });
});
