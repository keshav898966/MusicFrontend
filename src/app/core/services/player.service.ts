import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { RepeatMode, Track } from '../models/music.models';
import { MusicService } from './music.service';
import { YoutubePlayerService } from './youtube-player.service';

/** Key under which volume and repeat preferences are remembered between visits. */
const PREFERENCES_KEY = 'music-player-preferences';

interface StoredPreferences {
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
}

/**
 * Owns playback for the whole application.
 *
 * <p>There is exactly one {@link HTMLAudioElement} in the application, created here and
 * never exposed. Components ask the service to play; they must not create audio elements
 * of their own. Because the service is root-provided and the player component lives
 * outside the router outlet, audio continues uninterrupted across navigation.
 *
 * <p>State is published through signals so templates re-render without zone.js — this
 * application runs zoneless.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly musicService = inject(MusicService);
  private readonly document = inject(DOCUMENT);
  private readonly youtube = inject(YoutubePlayerService);

  /** The single audio element. Created lazily so the service is safe to construct in tests. */
  private audio: HTMLAudioElement | null = null;

  /** Tracks the in-flight stream-URL request so a rapid track change can cancel it. */
  private streamSubscription: Subscription | null = null;

  /**
   * Monotonic id for the most recent play request. A late-arriving stream URL whose id
   * no longer matches is discarded, which prevents a slow request from hijacking
   * playback after the user has already skipped on.
   */
  private playToken = 0;

  // ----------------------------------------------------------- state signals

  private readonly _queue = signal<Track[]>([]);
  private readonly _currentIndex = signal(-1);
  private readonly _isPlaying = signal(false);
  private readonly _currentTime = signal(0);
  private readonly _duration = signal(0);
  private readonly _volume = signal(0.8);
  private readonly _muted = signal(false);
  private readonly _shuffle = signal(false);
  private readonly _repeatMode = signal<RepeatMode>('off');
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  /**
   * Playback order when shuffle is on: a permutation of queue indices.
   *
   * <p>Shuffling an index order rather than the queue itself means the visible queue
   * never reorders under the user, and turning shuffle off restores the original order
   * exactly.
   */
  private readonly _shuffleOrder = signal<number[]>([]);

  // ------------------------------------------------------- public read model

  readonly queue = this._queue.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly duration = this._duration.asReadonly();
  readonly volume = this._volume.asReadonly();
  readonly muted = this._muted.asReadonly();
  readonly shuffle = this._shuffle.asReadonly();
  readonly repeatMode = this._repeatMode.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** The track currently loaded, or null when the queue is empty. */
  readonly currentTrack = computed<Track | null>(() => {
    const queue = this._queue();
    const index = this._currentIndex();
    return index >= 0 && index < queue.length ? queue[index] : null;
  });

  /** True when the player bar should be visible at all. */
  readonly hasTrack = computed(() => this.currentTrack() !== null);

  /** Playback position as a percentage, for the progress bar. */
  readonly progress = computed(() => {
    const duration = this._duration();
    return duration > 0 ? (this._currentTime() / duration) * 100 : 0;
  });

  /** Whether a previous track exists, accounting for repeat and shuffle. */
  readonly canGoPrevious = computed(() => this._queue().length > 0);

  /** Whether a next track exists, accounting for repeat and shuffle. */
  readonly canGoNext = computed(() => {
    const queue = this._queue();
    if (queue.length === 0) {
      return false;
    }
    if (this._repeatMode() !== 'off' || this._shuffle()) {
      return true;
    }
    return this._currentIndex() < queue.length - 1;
  });

  constructor() {
    this.restorePreferences();

    // A YouTube track ending must advance the queue exactly like an audio track ending.
    this.youtube.onEnded = () => this.next(true);

    // Mirror the IFrame player's state into the shared signals, so the transport bar and
    // progress bar work identically whichever player is actually running.
    effect(() => {
      if (this.currentTrack()?.source !== 'YOUTUBE') {
        return;
      }
      this._isPlaying.set(this.youtube.isPlaying());
      this._currentTime.set(this.youtube.currentTime());
      this._loading.set(this.youtube.loading());

      const duration = this.youtube.duration();
      if (duration > 0) {
        this._duration.set(duration);
      }
    });

    // Persist preferences whenever they change, so the next visit starts as the user left it.
    effect(() => {
      const preferences: StoredPreferences = {
        volume: this._volume(),
        muted: this._muted(),
        repeatMode: this._repeatMode(),
        shuffle: this._shuffle(),
      };
      this.savePreferences(preferences);
    });
  }

  // ------------------------------------------------------------- public API

  /**
   * Plays a track.
   *
   * <p>When {@code queue} is supplied the player adopts it and starts at the given
   * track, which is what makes "play this album from here" work. Otherwise the track is
   * appended and played on its own.
   */
  play(track: Track, queue?: Track[]): void {
    if (queue && queue.length > 0) {
      const index = Math.max(queue.findIndex((item) => item.id === track.id), 0);
      this._queue.set([...queue]);
      this.regenerateShuffleOrder(index);
      this._currentIndex.set(index);
    } else {
      const current = this._queue();
      const existing = current.findIndex((item) => item.id === track.id);
      if (existing >= 0) {
        this._currentIndex.set(existing);
      } else {
        this._queue.set([...current, track]);
        this._currentIndex.set(current.length);
        this.regenerateShuffleOrder(current.length);
      }
    }

    this.loadAndPlayCurrent();
  }

  /** Replaces the queue and starts from a given position. */
  playQueue(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) {
      return;
    }
    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    this._queue.set([...tracks]);
    this.regenerateShuffleOrder(index);
    this._currentIndex.set(index);
    this.loadAndPlayCurrent();
  }

  /** True when the current track plays through the YouTube IFrame player. */
  private get onYoutube(): boolean {
    return this.currentTrack()?.source === 'YOUTUBE';
  }

  /** Resumes if paused, pauses if playing, and starts the queue if nothing is loaded. */
  togglePlayPause(): void {
    if (!this.currentTrack()) {
      if (this._queue().length > 0) {
        this.loadAndPlayCurrent();
      }
      return;
    }

    // Transport controls drive whichever player owns the current track.
    if (this.onYoutube) {
      if (this.youtube.isPlaying()) {
        this.youtube.pause();
      } else {
        this.youtube.resume();
      }
      return;
    }

    const audio = this.audio;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void this.safePlay(audio);
    } else {
      audio.pause();
    }
  }

  pause(): void {
    if (this.onYoutube) {
      this.youtube.pause();
      return;
    }
    this.audio?.pause();
  }

  resume(): void {
    if (this.onYoutube) {
      this.youtube.resume();
      return;
    }
    const audio = this.audio;
    if (audio && audio.paused && this.currentTrack()) {
      void this.safePlay(audio);
    }
  }

  /**
   * Advances to the next track.
   *
   * @param automatic true when triggered by a track ending rather than by the user.
   *   With repeat off, reaching the end stops playback instead of wrapping around.
   */
  next(automatic = false): void {
    const queue = this._queue();
    if (queue.length === 0) {
      return;
    }

    // Repeat-one replays the same track, but only when it ended on its own: an explicit
    // skip should still move on.
    if (automatic && this._repeatMode() === 'one') {
      this.seek(0);
      void this.safePlay(this.audio!);
      return;
    }

    const nextIndex = this.resolveNextIndex();
    if (nextIndex === null) {
      // End of queue with repeat off.
      this._isPlaying.set(false);
      this.audio?.pause();
      return;
    }

    this._currentIndex.set(nextIndex);
    this.loadAndPlayCurrent();
  }

  /**
   * Goes to the previous track, or restarts the current one.
   *
   * <p>Restarting when more than three seconds in matches what listeners expect from
   * a physical transport control.
   */
  previous(): void {
    const audio = this.audio;
    if (audio && audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    const queue = this._queue();
    if (queue.length === 0) {
      return;
    }

    const previousIndex = this.resolvePreviousIndex();
    if (previousIndex === null) {
      this.seek(0);
      return;
    }

    this._currentIndex.set(previousIndex);
    this.loadAndPlayCurrent();
  }

  /** Seeks to an absolute position in seconds. */
  seek(seconds: number): void {
    if (this.onYoutube) {
      this.youtube.seek(Math.max(seconds, 0));
      return;
    }
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration)) {
      return;
    }
    const clamped = Math.min(Math.max(seconds, 0), audio.duration);
    audio.currentTime = clamped;
    this._currentTime.set(clamped);
  }

  /** Seeks to a percentage of the track, for progress-bar drags. */
  seekToPercent(percent: number): void {
    const duration = this._duration();
    if (duration > 0) {
      this.seek((Math.min(Math.max(percent, 0), 100) / 100) * duration);
    }
  }

  /** Sets the volume, 0 to 1. Any change above zero also unmutes. */
  setVolume(volume: number): void {
    const clamped = Math.min(Math.max(volume, 0), 1);
    this._volume.set(clamped);
    if (this.audio) {
      this.audio.volume = clamped;
    }
    // Keep both players at the same level so switching source is not a jump in loudness.
    this.youtube.setVolume(clamped);
    if (clamped > 0 && this._muted()) {
      this.setMuted(false);
    }
  }

  toggleMute(): void {
    this.setMuted(!this._muted());
  }

  setMuted(muted: boolean): void {
    this._muted.set(muted);
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  /** Turns shuffle on or off, regenerating the shuffled order around the current track. */
  toggleShuffle(): void {
    const enabled = !this._shuffle();
    this._shuffle.set(enabled);
    if (enabled) {
      this.regenerateShuffleOrder(this._currentIndex());
    }
  }

  /** Cycles off → all → one → off. */
  cycleRepeatMode(): void {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(this._repeatMode()) + 1) % order.length];
    this._repeatMode.set(next);
  }

  /** Appends a track to the queue without interrupting playback. */
  addToQueue(track: Track): void {
    const queue = this._queue();
    if (queue.some((item) => item.id === track.id)) {
      return;
    }

    this._queue.set([...queue, track]);
    this._shuffleOrder.set([...this._shuffleOrder(), queue.length]);

    // An empty player should start playing the first thing queued.
    if (this._currentIndex() < 0) {
      this._currentIndex.set(0);
      this.loadAndPlayCurrent();
    }
  }

  /** Queues several tracks at once. */
  addAllToQueue(tracks: Track[]): void {
    tracks.forEach((track) => this.addToQueue(track));
  }

  /**
   * Removes a track from the queue, keeping the current track playing where possible.
   */
  removeFromQueue(index: number): void {
    const queue = this._queue();
    if (index < 0 || index >= queue.length) {
      return;
    }

    const currentIndex = this._currentIndex();
    const updated = queue.filter((_, position) => position !== index);
    this._queue.set(updated);

    if (updated.length === 0) {
      this.stop();
      return;
    }

    if (index === currentIndex) {
      // The playing track was removed: play whatever slid into its place.
      const nextIndex = Math.min(currentIndex, updated.length - 1);
      this._currentIndex.set(nextIndex);
      this.regenerateShuffleOrder(nextIndex);
      this.loadAndPlayCurrent();
    } else {
      // Keep pointing at the same track after the list shifts underneath it.
      if (index < currentIndex) {
        this._currentIndex.set(currentIndex - 1);
      }
      this.regenerateShuffleOrder(this._currentIndex());
    }
  }

  /** Jumps to a queue position. */
  playAt(index: number): void {
    if (index < 0 || index >= this._queue().length) {
      return;
    }
    this._currentIndex.set(index);
    this.loadAndPlayCurrent();
  }

  /** Clears the queue and stops playback. */
  clearQueue(): void {
    this.stop();
    this._queue.set([]);
    this._shuffleOrder.set([]);
    this._currentIndex.set(-1);
  }

  /** Stops playback and releases the audio source. */
  stop(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = null;
    this.playToken++;

    const audio = this.audio;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    this._isPlaying.set(false);
    this._currentTime.set(0);
    this._duration.set(0);
    this._loading.set(false);
  }

  /** Retries the current track after a playback error. */
  retry(): void {
    if (this.currentTrack()) {
      this.loadAndPlayCurrent();
    }
  }

  // -------------------------------------------------------------- internals

  /** Resolves the stream URL for the current track and starts playback. */
  private loadAndPlayCurrent(): void {
    const track = this.currentTrack();
    if (!track) {
      return;
    }

    const audio = this.ensureAudio();

    // Abandon any earlier request so its response cannot overwrite this one.
    this.streamSubscription?.unsubscribe();
    const token = ++this.playToken;

    this._loading.set(true);
    this._error.set(null);
    this._currentTime.set(0);
    this._duration.set(track.duration ?? 0);

    // YouTube plays through its own IFrame player, which YouTube's terms require to stay
    // visible. The audio element is paused so the two can never sound at once.
    if (track.source === 'YOUTUBE' && track.previewUrl) {
      audio.pause();
      audio.removeAttribute('src');
      void this.youtube.play(track.previewUrl);
      this.youtube.setVolume(this._volume());
      this.youtube.setMuted(this._muted());
      this._loading.set(false);
      this.prefetchNext();
      return;
    }

    // Leaving a YouTube track: tear its player down before the audio element takes over.
    this.youtube.stop();

    // A preview-only track already carries a playable URL, so it starts immediately
    // instead of paying for a redirect round trip.
    if (track.previewUrl) {
      audio.src = track.previewUrl;
      audio.load();
      void this.safePlay(audio);
      this.prefetchNext();
      return;
    }

    this.streamSubscription = this.musicService.getStreamUrl(track.id).subscribe({
      next: (streamUrl) => {
        if (token !== this.playToken) {
          return; // Superseded by a newer request.
        }
        audio.src = streamUrl;
        audio.load();
        void this.safePlay(audio);
        // Resolve the following track now, so pressing next starts without
        // waiting on another Audius redirect.
        this.prefetchNext();
      },
      error: () => {
        if (token !== this.playToken) {
          return;
        }
        this._loading.set(false);
        this._isPlaying.set(false);
        this._error.set(`Could not play "${track.title}". Please try again.`);
      },
    });
  }

  /**
   * Calls {@code play()} and absorbs the rejection browsers raise when autoplay is
   * blocked or the source is swapped mid-play.
   */
  private async safePlay(audio: HTMLAudioElement): Promise<void> {
    try {
      await audio.play();
    } catch (error) {
      // AbortError simply means a newer load replaced this one; that is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      this._isPlaying.set(false);
      this._loading.set(false);
      this._error.set('Playback was blocked. Press play to start.');
    }
  }

  /** Creates the audio element on first use and wires up its events. */
  private ensureAudio(): HTMLAudioElement {
    if (this.audio) {
      return this.audio;
    }

    const audio = this.document.createElement('audio');
    // "auto" lets the browser buffer ahead as soon as the source is set, rather
    // than fetching only headers and then re-requesting audio on play — which
    // added roughly a second and a half before sound started.
    audio.preload = 'auto';
    // Deliberately no crossOrigin: the signed Audius CDN URLs are plain media
    // requests, and opting into CORS would trigger a preflight those hosts do
    // not answer, blocking playback.
    audio.volume = this._volume();
    audio.muted = this._muted();
    // Audius serves 320 kbps MP3; keep playback at native rate and pitch so
    // nothing resamples the signal.
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    // Hidden, but attached: browsers throttle or refuse playback on a media
    // element that is not part of the document.
    audio.setAttribute('aria-hidden', 'true');
    audio.style.display = 'none';
    this.document.body.appendChild(audio);

    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) {
        this._duration.set(audio.duration);
      }
    });

    audio.addEventListener('timeupdate', () => this._currentTime.set(audio.currentTime));
    audio.addEventListener('play', () => {
      this._isPlaying.set(true);
      this._error.set(null);
    });
    audio.addEventListener('pause', () => this._isPlaying.set(false));
    audio.addEventListener('playing', () => {
      this._loading.set(false);
      this._isPlaying.set(true);
    });
    audio.addEventListener('waiting', () => this._loading.set(true));
    audio.addEventListener('canplay', () => this._loading.set(false));
    audio.addEventListener('ended', () => this.next(true));

    audio.addEventListener('error', () => {
      // Ignore the error fired while clearing the source during stop().
      if (!audio.getAttribute('src')) {
        return;
      }
      this._loading.set(false);
      this._isPlaying.set(false);
      this._error.set('Playback failed. The track may be unavailable.');
    });

    this.audio = audio;
    return audio;
  }

  /**
   * Warms the stream URL for whichever track would play next.
   *
   * <p>Resolving costs an Audius redirect round-trip, so doing it during playback is what
   * makes skipping feel immediate rather than taking a second or more.
   */
  private prefetchNext(): void {
    const nextIndex = this.resolveNextIndex();
    if (nextIndex === null) {
      return;
    }
    const nextTrack = this._queue()[nextIndex];
    // Preview tracks need no resolution, so there is nothing to warm.
    if (nextTrack && !nextTrack.previewUrl) {
      this.musicService.prefetchStreamUrl(nextTrack.id);
    }
  }

  /** The next queue index, or null at the end of the queue with repeat off. */
  private resolveNextIndex(): number | null {
    const queue = this._queue();
    const currentIndex = this._currentIndex();

    if (this._shuffle()) {
      const order = this._shuffleOrder();
      const position = order.indexOf(currentIndex);
      if (position < order.length - 1) {
        return order[position + 1];
      }
      if (this._repeatMode() === 'all' || this._repeatMode() === 'one') {
        // Reshuffle so a repeated pass is not identical to the last one.
        this.regenerateShuffleOrder(-1);
        return this._shuffleOrder()[0] ?? null;
      }
      return null;
    }

    if (currentIndex < queue.length - 1) {
      return currentIndex + 1;
    }
    return this._repeatMode() === 'all' || this._repeatMode() === 'one' ? 0 : null;
  }

  /** The previous queue index, or null at the start with repeat off. */
  private resolvePreviousIndex(): number | null {
    const queue = this._queue();
    const currentIndex = this._currentIndex();

    if (this._shuffle()) {
      const order = this._shuffleOrder();
      const position = order.indexOf(currentIndex);
      if (position > 0) {
        return order[position - 1];
      }
      return this._repeatMode() === 'all' ? order[order.length - 1] : null;
    }

    if (currentIndex > 0) {
      return currentIndex - 1;
    }
    return this._repeatMode() === 'all' ? queue.length - 1 : null;
  }

  /**
   * Rebuilds the shuffled play order.
   *
   * @param keepFirst index to place first, so toggling shuffle does not interrupt the
   *   track already playing. Pass -1 to shuffle everything.
   */
  private regenerateShuffleOrder(keepFirst: number): void {
    const length = this._queue().length;
    const indices = Array.from({ length }, (_, index) => index).filter((index) => index !== keepFirst);

    // Fisher-Yates: an unbiased shuffle in a single pass.
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    this._shuffleOrder.set(keepFirst >= 0 && keepFirst < length ? [keepFirst, ...indices] : indices);
  }

  private restorePreferences(): void {
    try {
      const raw = this.document.defaultView?.localStorage?.getItem(PREFERENCES_KEY);
      if (!raw) {
        return;
      }
      const stored = JSON.parse(raw) as Partial<StoredPreferences>;
      if (typeof stored.volume === 'number') {
        this._volume.set(Math.min(Math.max(stored.volume, 0), 1));
      }
      if (typeof stored.muted === 'boolean') {
        this._muted.set(stored.muted);
      }
      if (stored.repeatMode === 'off' || stored.repeatMode === 'all' || stored.repeatMode === 'one') {
        this._repeatMode.set(stored.repeatMode);
      }
      if (typeof stored.shuffle === 'boolean') {
        this._shuffle.set(stored.shuffle);
      }
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); defaults are fine.
    }
  }

  private savePreferences(preferences: StoredPreferences): void {
    try {
      this.document.defaultView?.localStorage?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore: preferences are a convenience, never required for playback.
    }
  }
}
