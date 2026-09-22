/**
 * Types mirroring the DTOs served by the Spring Boot backend.
 *
 * These deliberately match the backend contract rather than the Audius payload: the
 * browser never sees an Audius response directly.
 */

/** A playable track. */
export interface Track {
  id: string;
  title: string;
  artistId: string | null;
  artistName: string;
  artistHandle: string | null;
  artistVerified: boolean;
  artworkUrl: string | null;
  artworkThumbUrl: string | null;
  duration: number | null;
  genre: string | null;
  mood: string | null;
  releaseDate: string | null;
  playCount: number;
  favoriteCount: number;
  repostCount: number;
  streamable: boolean;
  permalink: string | null;
  /** Which catalogue the track came from. */
  source: 'AUDIUS' | 'ITUNES' | 'YOUTUBE';
  /** True when only a short preview clip is available. */
  previewOnly: boolean;
  /** Directly playable clip URL for preview-only sources. */
  previewUrl: string | null;
}

/** An artist profile. */
export interface Artist {
  id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
  profilePictureUrl: string | null;
  profilePictureThumbUrl: string | null;
  coverPhotoUrl: string | null;
  followerCount: number;
  followeeCount: number;
  trackCount: number;
}

/** A playlist published on Audius. */
export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  artworkUrl: string | null;
  artworkThumbUrl: string | null;
  ownerName: string | null;
  ownerId: string | null;
  trackCount: number;
  favoriteCount: number;
  album: boolean;
}

/** One page of results. */
export interface PageResponse<T> {
  items: T[];
  offset: number;
  limit: number;
  count: number;
  hasMore: boolean;
  /**
   * Opaque cursor for the next page, or null when the collection is exhausted.
   *
   * <p>Preferred over `offset` for paging: it survives the underlying list shifting
   * between requests, which offsets do not.
   */
  nextCursor: string | null;
}

/** A resolved, signed CDN URL for the audio element. */
export interface StreamUrl {
  trackId: string;
  streamUrl: string;
  expiresInSeconds: number;
}

/** A playlist stored by this application. Global — this build has no user accounts. */
export interface LocalPlaylist {
  id: number;
  name: string;
  description: string | null;
  songCount: number;
  createdAt: string;
  updatedAt: string;
  songs: PlaylistSong[] | null;
}

/** One song inside a local playlist. */
export interface PlaylistSong {
  id: number;
  trackId: string;
  title: string;
  artistName: string | null;
  artistId: string | null;
  artworkUrl: string | null;
  duration: number | null;
  position: number;
  addedAt: string;
}

/** The standard backend error envelope. */
export interface ApiError {
  success: false;
  message: string;
  timestamp: string;
  path: string;
  errors?: Record<string, string>;
}

/** How the player behaves when a track ends. */
export type RepeatMode = 'off' | 'all' | 'one';

/** Everything the UI needs to render the player. */
export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  loading: boolean;
  error: string | null;
}

/** Converts a song stored in a local playlist back into a playable track. */
export function playlistSongToTrack(song: PlaylistSong): Track {
  return {
    id: song.trackId,
    title: song.title,
    artistId: song.artistId,
    artistName: song.artistName ?? 'Unknown artist',
    artistHandle: null,
    artistVerified: false,
    artworkUrl: song.artworkUrl,
    artworkThumbUrl: song.artworkUrl,
    duration: song.duration,
    genre: null,
    mood: null,
    releaseDate: null,
    playCount: 0,
    favoriteCount: 0,
    repostCount: 0,
    streamable: true,
    permalink: null,
    // Saved songs resolve through the normal Audius path; a preview clip is never stored.
    source: 'AUDIUS',
    previewOnly: false,
    previewUrl: null,
  };
}
