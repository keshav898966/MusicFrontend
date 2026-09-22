import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** Player states reported by the YouTube IFrame API. */
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/**
 * Minimal shape of the YouTube IFrame player this application uses.
 *
 * <p>Declared locally rather than pulling in the full typings package, which would add a
 * dependency for a handful of methods.
 */
interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: unknown) => YTPlayer;
      PlayerState: Record<string, number>;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Wraps the official YouTube IFrame player.
 *
 * <p>YouTube's terms require the player to remain visible and unobscured, so the host
 * element is a small video panel in the player bar rather than a hidden iframe. Audio is
 * never extracted or re-streamed — YouTube serves the content itself, which is what keeps
 * this compliant.
 *
 * <p>The API script is loaded lazily on first use, so visitors who never play a YouTube
 * track pay nothing for it.
 */
@Injectable({ providedIn: 'root' })
export class YoutubePlayerService {
  private readonly document = inject(DOCUMENT);

  private player: YTPlayer | null = null;
  private apiReady: Promise<void> | null = null;

  /** Element the iframe is mounted into, supplied by the player bar. */
  private host: HTMLElement | null = null;

  /** Video queued before the player finished initialising. */
  private pendingVideoId: string | null = null;

  /** Drives the progress bar while a YouTube track plays. */
  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly loading = signal(false);
  readonly hasVideo = signal(false);

  /** Invoked when the video reaches its end, so the queue can advance. */
  onEnded: (() => void) | null = null;

  /**
   * Registers the element the video renders into.
   *
   * <p>Called by the player bar once its video panel exists. Any video requested before
   * that point is started as soon as the host arrives.
   */
  attachHost(element: HTMLElement): void {
    this.host = element;
    if (this.pendingVideoId) {
      const videoId = this.pendingVideoId;
      this.pendingVideoId = null;
      void this.play(videoId);
    }
  }

  /** Loads and plays a video by id. */
  async play(videoId: string): Promise<void> {
    this.loading.set(true);
    this.hasVideo.set(true);

    if (!this.host) {
      // The player bar has not rendered its panel yet; start once it does.
      this.pendingVideoId = videoId;
      return;
    }

    await this.ensureApiLoaded();

    if (this.player) {
      this.player.loadVideoById(videoId);
      return;
    }

    this.player = new window.YT!.Player(this.host, {
      videoId,
      // Sized by CSS; width/height here only set the initial aspect.
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        // Keep the frame clean, but never hide it: the video must stay visible.
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          event.target.playVideo();
          this.startTicker();
        },
        onStateChange: (event: { data: number }) => this.handleStateChange(event.data),
        onError: () => {
          this.loading.set(false);
          this.isPlaying.set(false);
        },
      },
    });
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  resume(): void {
    this.player?.playVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
    this.currentTime.set(seconds);
  }

  /** Volume is 0-1 here, but the IFrame API expects 0-100. */
  setVolume(volume: number): void {
    this.player?.setVolume(Math.round(Math.min(Math.max(volume, 0), 1) * 100));
  }

  setMuted(muted: boolean): void {
    if (!this.player) {
      return;
    }
    if (muted) {
      this.player.mute();
    } else {
      this.player.unMute();
    }
  }

  /** Stops playback and hides the video panel. */
  stop(): void {
    this.player?.pauseVideo();
    this.stopTicker();
    this.isPlaying.set(false);
    this.hasVideo.set(false);
    this.currentTime.set(0);
  }

  private handleStateChange(state: number): void {
    switch (state) {
      case YT_STATE.PLAYING:
        this.loading.set(false);
        this.isPlaying.set(true);
        this.duration.set(this.player?.getDuration() ?? 0);
        this.startTicker();
        break;
      case YT_STATE.PAUSED:
        this.isPlaying.set(false);
        break;
      case YT_STATE.BUFFERING:
        this.loading.set(true);
        break;
      case YT_STATE.ENDED:
        this.isPlaying.set(false);
        this.stopTicker();
        this.onEnded?.();
        break;
      default:
        break;
    }
  }

  /**
   * Polls playback position.
   *
   * <p>The IFrame API emits no timeupdate event, so the progress bar has to be driven by
   * a timer. Four times a second is smooth enough without being wasteful.
   */
  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => {
      if (this.player) {
        this.currentTime.set(this.player.getCurrentTime());
        const duration = this.player.getDuration();
        if (duration > 0) {
          this.duration.set(duration);
        }
      }
    }, 250);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  /** Loads the IFrame API script once, resolving when it is ready to use. */
  private ensureApiLoaded(): Promise<void> {
    if (window.YT?.Player) {
      return Promise.resolve();
    }
    if (this.apiReady) {
      return this.apiReady;
    }

    this.apiReady = new Promise<void>((resolve, reject) => {
      // The API calls this global hook when it finishes loading.
      window.onYouTubeIframeAPIReady = () => resolve();

      const script = this.document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('Could not load the YouTube player'));
      this.document.body.appendChild(script);
    });

    return this.apiReady;
  }
}
