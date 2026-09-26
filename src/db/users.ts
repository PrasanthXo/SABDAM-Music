import { db } from './index.ts';
import {
  users,
  userFavorites,
  userPlaylists,
  playlistTracks,
  userCustomSongs,
  userRecentlyPlayed,
  userSettings,
} from './schema.ts';
import { eq, and, desc, inArray, notInArray } from 'drizzle-orm';

export interface DbTrack {
  id: string;
  title?: string;
  artist?: string;
  artwork?: string;
  url?: string;
  youtubeId?: string;
  duration?: number;
  [key: string]: any;
}

export interface DbPlaylist {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  isCustom?: boolean;
  trackIds?: string[];
  tracks?: DbTrack[];
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export interface DbUserLibrary {
  likedTrackIds: string[];
  recentlyPlayed: DbTrack[];
  customPlaylists: DbPlaylist[];
  customSongs: DbTrack[];
  settings?: Record<string, any>;
}

export async function getUserByEmail(email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('[Cloud SQL] getUserByEmail error:', error);
    return null;
  }
}
export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: [users.uid],
        set: {
          email,
          displayName: displayName || null,
          photoUrl: photoUrl || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('[Cloud SQL] getOrCreateUser error:', error);
    return null;
  }
}

/**
 * Loads a user's full library (playlists, favorites, custom songs, recents, settings) from Cloud SQL PostgreSQL.
 */
export async function getUserLibraryFromDb(uid: string): Promise<DbUserLibrary | null> {
  try {
    // 1. Fetch user favorites
    const favRecords = await db
      .select()
      .from(userFavorites)
      .where(eq(userFavorites.userUid, uid));
    const likedTrackIds = favRecords.map((r) => r.trackId);

    // 2. Fetch user playlists
    const playlistRecords = await db
      .select()
      .from(userPlaylists)
      .where(eq(userPlaylists.userUid, uid));

    let customPlaylists: DbPlaylist[] = [];
    if (playlistRecords.length > 0) {
      const playlistIds = playlistRecords.map((p) => p.id);
      const trackRecords = await db
        .select()
        .from(playlistTracks)
        .where(inArray(playlistTracks.playlistId, playlistIds));

      // Group tracks by playlist
      const tracksByPlaylist = new Map<string, { trackIds: string[]; tracks: DbTrack[] }>();
      for (const pl of playlistRecords) {
        tracksByPlaylist.set(pl.id, { trackIds: [], tracks: [] });
      }

      for (const tr of trackRecords) {
        const group = tracksByPlaylist.get(tr.playlistId);
        if (group) {
          group.trackIds.push(tr.trackId);
          if (tr.trackData) {
            try {
              group.tracks.push(JSON.parse(tr.trackData));
            } catch {
              group.tracks.push({ id: tr.trackId });
            }
          } else {
            group.tracks.push({ id: tr.trackId });
          }
        }
      }

      customPlaylists = playlistRecords.map((pl) => {
        const group = tracksByPlaylist.get(pl.id) || { trackIds: [], tracks: [] };
        return {
          id: pl.id,
          title: pl.title,
          description: pl.description || '',
          coverUrl: pl.coverUrl || '',
          isCustom: pl.isCustom ?? true,
          trackIds: group.trackIds,
          tracks: group.tracks,
          createdAt: pl.createdAt ? pl.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: pl.updatedAt ? pl.updatedAt.toISOString() : new Date().toISOString(),
          userId: pl.userUid,
        };
      });
    }

    // 3. Fetch custom songs
    const songRecords = await db
      .select()
      .from(userCustomSongs)
      .where(eq(userCustomSongs.userUid, uid));

    const customSongs: DbTrack[] = songRecords.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      audioUrl: s.audioUrl,
      artwork: s.artwork || '',
      duration: s.duration || 0,
      youtubeId: s.youtubeId || undefined,
      lyrics: s.lyrics || undefined,
      createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
    }));

    // 4. Fetch recently played (last 50)
    const recentsRecords = await db
      .select()
      .from(userRecentlyPlayed)
      .where(eq(userRecentlyPlayed.userUid, uid))
      .orderBy(desc(userRecentlyPlayed.playedAt))
      .limit(50);

    const recentlyPlayed: DbTrack[] = recentsRecords.map((r) => {
      if (r.trackData) {
        try {
          return JSON.parse(r.trackData);
        } catch {
          return { id: r.trackId };
        }
      }
      return { id: r.trackId };
    });

    // 5. Fetch user settings
    const settingsRecord = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userUid, uid))
      .limit(1);

    const settings = settingsRecord[0]
      ? {
          audioQuality: settingsRecord[0].audioQuality,
          crossfade: settingsRecord[0].crossfade,
          equalizerPreset: settingsRecord[0].equalizerPreset,
          offlineMode: settingsRecord[0].offlineMode,
        }
      : undefined;

    return {
      likedTrackIds,
      recentlyPlayed,
      customPlaylists,
      customSongs,
      settings,
    };
  } catch (error) {
    console.error('[Cloud SQL] getUserLibraryFromDb failed:', error);
    return null;
  }
}

/**
 * Saves/Synchronizes the full user library to Cloud SQL PostgreSQL.
 * Uses upserts with conflict handling to prevent duplicate key constraint issues.
 */
export async function saveUserLibraryToDb(
  uid: string,
  data: Partial<DbUserLibrary>
): Promise<boolean> {
  try {
    // 1. Sync Favorites
    if (Array.isArray(data.likedTrackIds)) {
      await db.delete(userFavorites).where(eq(userFavorites.userUid, uid));
      const uniqueIds = Array.from(new Set(data.likedTrackIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
      if (uniqueIds.length > 0) {
        await db.insert(userFavorites).values(
          uniqueIds.map((trackId) => ({
            userUid: uid,
            trackId,
          }))
        );
      }
    }

    // 2. Sync Custom Playlists (Upsert by ID + Clean up removed)
    if (Array.isArray(data.customPlaylists)) {
      // De-duplicate incoming playlists by ID
      const playlistMap = new Map<string, DbPlaylist>();
      for (const pl of data.customPlaylists) {
        if (pl && pl.id && pl.title) {
          playlistMap.set(pl.id, pl);
        }
      }
      const uniquePlaylists = Array.from(playlistMap.values());
      const currentPlaylistIds = uniquePlaylists.map((p) => p.id);

      // Remove playlists that are no longer in user's library
      if (currentPlaylistIds.length > 0) {
        await db
          .delete(userPlaylists)
          .where(and(eq(userPlaylists.userUid, uid), notInArray(userPlaylists.id, currentPlaylistIds)));
      } else {
        await db.delete(userPlaylists).where(eq(userPlaylists.userUid, uid));
      }

      // Upsert each unique playlist and its tracks
      for (const pl of uniquePlaylists) {
        await db
          .insert(userPlaylists)
          .values({
            id: pl.id,
            userUid: uid,
            title: pl.title,
            description: pl.description || '',
            coverUrl: pl.coverUrl || '',
            isCustom: pl.isCustom ?? true,
            createdAt: pl.createdAt ? new Date(pl.createdAt) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userPlaylists.id,
            set: {
              userUid: uid,
              title: pl.title,
              description: pl.description || '',
              coverUrl: pl.coverUrl || '',
              isCustom: pl.isCustom ?? true,
              updatedAt: new Date(),
            },
          });

        // Refresh tracks for this playlist
        await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, pl.id));
        const tracksList = pl.tracks || (pl.trackIds ? pl.trackIds.map((id) => ({ id })) : []);
        if (tracksList.length > 0) {
          await db.insert(playlistTracks).values(
            tracksList.map((tr, index) => ({
              playlistId: pl.id,
              trackId: typeof tr === 'string' ? tr : tr.id,
              trackData: typeof tr === 'object' ? JSON.stringify(tr) : null,
              position: index,
            }))
          );
        }
      }
    }

    // 3. Sync Custom Songs (Upsert by ID + Clean up removed)
    if (Array.isArray(data.customSongs)) {
      const songMap = new Map<string, DbTrack>();
      for (const s of data.customSongs) {
        if (s && s.id && s.title && s.audioUrl) {
          songMap.set(s.id, s);
        }
      }
      const uniqueSongs = Array.from(songMap.values());
      const currentSongIds = uniqueSongs.map((s) => s.id);

      if (currentSongIds.length > 0) {
        await db
          .delete(userCustomSongs)
          .where(and(eq(userCustomSongs.userUid, uid), notInArray(userCustomSongs.id, currentSongIds)));
      } else {
        await db.delete(userCustomSongs).where(eq(userCustomSongs.userUid, uid));
      }

      for (const s of uniqueSongs) {
        await db
          .insert(userCustomSongs)
          .values({
            id: s.id,
            userUid: uid,
            title: s.title,
            artist: s.artist || 'Unknown Artist',
            audioUrl: s.audioUrl,
            artwork: s.artwork || '',
            duration: s.duration || 0,
            youtubeId: s.youtubeId || null,
            lyrics: s.lyrics || null,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          })
          .onConflictDoUpdate({
            target: userCustomSongs.id,
            set: {
              userUid: uid,
              title: s.title,
              artist: s.artist || 'Unknown Artist',
              audioUrl: s.audioUrl,
              artwork: s.artwork || '',
              duration: s.duration || 0,
              youtubeId: s.youtubeId || null,
              lyrics: s.lyrics || null,
            },
          });
      }
    }

    // 4. Sync Recently Played
    if (Array.isArray(data.recentlyPlayed)) {
      await db.delete(userRecentlyPlayed).where(eq(userRecentlyPlayed.userUid, uid));
      const recentSlice = data.recentlyPlayed.slice(0, 50);
      if (recentSlice.length > 0) {
        await db.insert(userRecentlyPlayed).values(
          recentSlice.map((r) => ({
            userUid: uid,
            trackId: r.id,
            trackData: JSON.stringify(r),
            playedAt: new Date(),
          }))
        );
      }
    }

    // 5. Sync Settings
    if (data.settings && typeof data.settings === 'object') {
      await db
        .insert(userSettings)
        .values({
          userUid: uid,
          audioQuality: data.settings.audioQuality || 'high',
          crossfade: data.settings.crossfade ?? true,
          equalizerPreset: data.settings.equalizerPreset || 'Dynamic Clarity',
          offlineMode: data.settings.offlineMode ?? false,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userSettings.userUid,
          set: {
            audioQuality: data.settings.audioQuality || 'high',
            crossfade: data.settings.crossfade ?? true,
            equalizerPreset: data.settings.equalizerPreset || 'Dynamic Clarity',
            offlineMode: data.settings.offlineMode ?? false,
            updatedAt: new Date(),
          },
        });
    }

    return true;
  } catch (error) {
    console.error('[Cloud SQL] saveUserLibraryToDb failed:', error);
    return false;
  }
}

export async function getUserFavorites(uid: string) {
  try {
    const records = await db.select().from(userFavorites).where(eq(userFavorites.userUid, uid));
    return records.map((r) => r.trackId);
  } catch (error) {
    console.error('[Cloud SQL] getUserFavorites failed:', error);
    return [];
  }
}

export async function addUserFavorite(uid: string, trackId: string, trackData?: any) {
  try {
    await db.insert(userFavorites).values({
      userUid: uid,
      trackId,
      trackData: trackData ? JSON.stringify(trackData) : null,
    });
    return { success: true };
  } catch (error) {
    console.error('[Cloud SQL] addUserFavorite failed:', error);
    return { success: false };
  }
}

export async function removeUserFavorite(uid: string, trackId: string) {
  try {
    await db
      .delete(userFavorites)
      .where(and(eq(userFavorites.userUid, uid), eq(userFavorites.trackId, trackId)));
    return { success: true };
  } catch (error) {
    console.error('[Cloud SQL] removeUserFavorite failed:', error);
    return { success: false };
  }
}

export async function deleteUserPlaylist(uid: string, playlistId: string): Promise<boolean> {
  try {
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    await db.delete(userPlaylists).where(and(eq(userPlaylists.userUid, uid), eq(userPlaylists.id, playlistId)));
    return true;
  } catch (error) {
    console.error('[Cloud SQL] deleteUserPlaylist failed:', error);
    return false;
  }
}
