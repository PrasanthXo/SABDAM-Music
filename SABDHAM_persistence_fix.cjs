const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.ts');
const usersPath = path.join(process.cwd(), 'src', 'db', 'users.ts');

if (!fs.existsSync(serverPath) || !fs.existsSync(usersPath)) {
  throw new Error('Run this from SABDHAM project root. server.ts or src/db/users.ts was not found.');
}

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backupDir = path.join(process.cwd(), 'data_persistence_backup_' + stamp);
fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(serverPath, path.join(backupDir, 'server.ts'));
fs.copyFileSync(usersPath, path.join(backupDir, 'users.ts'));

console.log('BACKUP OK:', backupDir);

let server = fs.readFileSync(serverPath, 'utf8');
let users = fs.readFileSync(usersPath, 'utf8');

// ============================================================
// FIX 1: New accounts must NOT auto-create My Morning Favorites.
// Favorites belong only in user_favorites.
// ============================================================
const initStart = server.indexOf('function initUserData(');
if (initStart < 0) {
  throw new Error('initUserData() not found.');
}

const playlistStart = server.indexOf('    customPlaylists: [', initStart);
const customSongsStart = server.indexOf('    customSongs:', playlistStart);

if (playlistStart < 0 || customSongsStart < 0) {
  throw new Error('initUserData customPlaylists block not found.');
}

server =
  server.slice(0, playlistStart) +
  '    customPlaylists: [],\n' +
  server.slice(customSongsStart);

console.log('PATCHED: automatic My Morning Favorites creation removed');

// ============================================================
// FIX 2:
// PostgreSQL is authoritative for GET /api/user/data.
// NO memory fallback.
// NO cached-data writeback.
// Full sync can NEVER modify favorites.
// DB must succeed before cache is updated.
// ============================================================
const routesStart = server.indexOf(
  "// 7. API: Get User's Isolated Private Data"
);
const routesEnd = server.indexOf(
  'function getSpotifyRedirectUri',
  routesStart
);

if (routesStart < 0 || routesEnd < 0) {
  throw new Error('/api/user/data route block not found.');
}

const newRoutes = `function isLegacyGeneratedFavoritesPlaylist(playlist: any): boolean {
  if (!playlist || typeof playlist !== 'object') {
    return false;
  }

  const id = String(playlist.id || '').trim().toLowerCase();
  const title = String(
    playlist.title || playlist.name || ''
  ).trim().toLowerCase();

  return (
    title === 'my morning favorites' &&
    id.startsWith('pl_') &&
    id.endsWith('_fav')
  );
}

// 7. API: Get User's Isolated Private Data
// PostgreSQL is the ONLY durable source of truth.
app.get('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required to access user data.'
    });
  }

  const dbUser = await getOrCreateUser(
    user.id,
    user.email,
    user.name,
    user.avatarUrl
  );

  if (!dbUser) {
    console.error(
      '[DB AUTHORITATIVE] Could not resolve PostgreSQL user for ' +
      user.email
    );

    return res.status(503).json({
      success: false,
      error: 'Your library is temporarily unavailable.',
      code: 'USER_DB_UNAVAILABLE'
    });
  }

  const dbLibrary = await getUserLibraryFromDb(dbUser.uid);

  if (!dbLibrary) {
    console.error(
      '[DB AUTHORITATIVE] Library read failed for ' +
      dbUser.uid
    );

    return res.status(503).json({
      success: false,
      error: 'Your library is temporarily unavailable.',
      code: 'USER_LIBRARY_DB_UNAVAILABLE'
    });
  }

  // Old generated Favorites playlists are retained in PostgreSQL for
  // recovery, but they must no longer appear as normal playlists.
  const cleanLibrary: UserDataRecord = {
    ...(dbLibrary as UserDataRecord),
    likedTrackIds: [...(dbLibrary.likedTrackIds || [])],
    likedTracks: [...(dbLibrary.likedTracks || [])],
    recentlyPlayed: [...(dbLibrary.recentlyPlayed || [])],
    customPlaylists: (dbLibrary.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(dbLibrary.customSongs || [])],
  };

  // Cache receives PostgreSQL state only AFTER a successful DB read.
  userDataStore.set(dbUser.uid, cleanLibrary);
  userDataStore.set(user.id, cleanLibrary);

  if (user.email) {
    userDataStore.set(
      user.email.toLowerCase(),
      cleanLibrary
    );
  }

  savePersistedData();

  return res.json({
    data: cleanLibrary,
    source: 'postgresql'
  });
});

// 8. API: Save/Sync User's Isolated Private Data
// PostgreSQL is read first, written first, then cache is refreshed.
// Favorite mutations are exclusively handled by /api/db/favorites.
app.post('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required to save user data.'
    });
  }

  const dbUser = await getOrCreateUser(
    user.id,
    user.email,
    user.name,
    user.avatarUrl
  );

  if (!dbUser) {
    return res.status(503).json({
      success: false,
      error: 'Unable to access your account database.',
      code: 'USER_DB_UNAVAILABLE'
    });
  }

  // IMPORTANT:
  // Never merge a write against RAM/cache. Always start from PostgreSQL.
  const dbCurrent = await getUserLibraryFromDb(dbUser.uid);

  if (!dbCurrent) {
    console.error(
      '[DB AUTHORITATIVE] Refusing user-data write because DB read failed for ' +
      dbUser.uid
    );

    return res.status(503).json({
      success: false,
      error: 'Your library could not be loaded safely. Nothing was changed.',
      code: 'USER_LIBRARY_DB_UNAVAILABLE'
    });
  }

  const {
    likedTrackIds,
    likedTracks,
    recentlyPlayed,
    customPlaylists,
    customSongs,
    settings,
    isExplicitClear
  } = req.body || {};

  const current: UserDataRecord = {
    ...(dbCurrent as UserDataRecord),
    likedTrackIds: [...(dbCurrent.likedTrackIds || [])],
    likedTracks: [...(dbCurrent.likedTracks || [])],
    recentlyPlayed: [...(dbCurrent.recentlyPlayed || [])],
    customPlaylists: (dbCurrent.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(dbCurrent.customSongs || [])],
  };

  const dbPatch: any = {};

  // ==========================================================
  // FAVORITES SAFETY
  // ==========================================================
  // Full-library snapshots are NOT allowed to add/remove favorites.
  // This prevents an old Android cache/settings sync from restoring
  // deleted likes or wiping newly-added likes.
  if (
    Array.isArray(likedTrackIds) ||
    Array.isArray(likedTracks)
  ) {
    console.log(
      '[DB AUTHORITATIVE] Ignored snapshot favorite fields for ' +
      dbUser.uid +
      '; use atomic /api/db/favorites endpoints.'
    );
  }

  // ==========================================================
  // RECENTLY PLAYED
  // ==========================================================
  if (Array.isArray(recentlyPlayed)) {
    if (
      recentlyPlayed.length > 0 ||
      isExplicitClear ||
      current.recentlyPlayed.length === 0
    ) {
      current.recentlyPlayed =
        recentlyPlayed
          .filter(
            (item: any) =>
              item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              item.id.trim().length > 0
          )
          .slice(0, 50);

      dbPatch.recentlyPlayed =
        current.recentlyPlayed;
    }
  }

  // ==========================================================
  // PLAYLISTS
  // ==========================================================
  if (Array.isArray(customPlaylists)) {
    const playlistsById =
      new Map<string, any>();

    for (const existing of current.customPlaylists) {
      if (
        existing &&
        typeof existing.id === 'string' &&
        existing.id.trim().length > 0
      ) {
        playlistsById.set(existing.id, existing);
      }
    }

    const incoming =
      customPlaylists.filter(
        (playlist: any) =>
          playlist &&
          typeof playlist.id === 'string' &&
          playlist.id.trim().length > 0 &&
          !isLegacyGeneratedFavoritesPlaylist(playlist)
      );

    for (const playlist of incoming) {
      const existing =
        playlistsById.get(playlist.id);

      const merged = {
        ...(existing || {}),
        ...playlist,
      };

      // A stale/partial client sending an empty track array must NEVER
      // erase tracks that PostgreSQL already has.
      if (existing) {
        const existingTracks =
          Array.isArray(existing.tracks)
            ? existing.tracks
            : [];

        const existingTrackIds =
          Array.isArray(existing.trackIds)
            ? existing.trackIds
            : [];

        if (
          Array.isArray(playlist.tracks) &&
          playlist.tracks.length === 0 &&
          existingTracks.length > 0
        ) {
          merged.tracks = existingTracks;
        }

        if (
          Array.isArray(playlist.trackIds) &&
          playlist.trackIds.length === 0 &&
          existingTrackIds.length > 0
        ) {
          merged.trackIds = existingTrackIds;
        }
      }

      playlistsById.set(
        playlist.id,
        merged
      );
    }

    current.customPlaylists =
      Array.from(playlistsById.values());

    dbPatch.customPlaylists =
      current.customPlaylists;
  }

  // ==========================================================
  // CUSTOM SONGS
  // ==========================================================
  if (Array.isArray(customSongs)) {
    if (customSongs.length > 0) {
      const songsById =
        new Map<string, any>();

      for (const existing of current.customSongs) {
        if (
          existing &&
          typeof existing.id === 'string'
        ) {
          songsById.set(
            existing.id,
            existing
          );
        }
      }

      for (const song of customSongs) {
        if (
          song &&
          typeof song.id === 'string' &&
          song.id.trim().length > 0
        ) {
          songsById.set(
            song.id,
            {
              ...(songsById.get(song.id) || {}),
              ...song,
            }
          );
        }
      }

      current.customSongs =
        Array.from(songsById.values());

      dbPatch.customSongs =
        current.customSongs;
    } else if (
      current.customSongs.length === 0
    ) {
      dbPatch.customSongs = [];
    } else {
      console.warn(
        '[DB AUTHORITATIVE] Ignored empty custom-song snapshot for ' +
        dbUser.uid
      );
    }
  }

  // ==========================================================
  // SETTINGS
  // ==========================================================
  if (
    settings &&
    typeof settings === 'object'
  ) {
    current.settings = {
      ...(current.settings || {}),
      ...settings,
    } as UserDataRecord['settings'];

    dbPatch.settings = current.settings;
  }

  // PostgreSQL must succeed BEFORE RAM/JSON cache can change.
  if (Object.keys(dbPatch).length > 0) {
    const saved = await saveUserLibraryToDb(
      dbUser.uid,
      dbPatch
    );

    if (!saved) {
      console.error(
        '[DB AUTHORITATIVE] Database save failed for ' +
        dbUser.uid
      );

      return res.status(503).json({
        success: false,
        error: 'Your changes could not be saved safely. Nothing was cached.',
        code: 'USER_LIBRARY_DB_SAVE_FAILED'
      });
    }
  }

  // Re-read PostgreSQL after the write.
  const confirmed =
    await getUserLibraryFromDb(dbUser.uid);

  if (!confirmed) {
    return res.status(503).json({
      success: false,
      error: 'Changes were written but could not be verified.',
      code: 'USER_LIBRARY_DB_VERIFY_FAILED'
    });
  }

  const confirmedClean: UserDataRecord = {
    ...(confirmed as UserDataRecord),
    likedTrackIds: [...(confirmed.likedTrackIds || [])],
    likedTracks: [...(confirmed.likedTracks || [])],
    recentlyPlayed: [...(confirmed.recentlyPlayed || [])],
    customPlaylists: (confirmed.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(confirmed.customSongs || [])],
  };

  userDataStore.set(
    dbUser.uid,
    confirmedClean
  );

  userDataStore.set(
    user.id,
    confirmedClean
  );

  if (user.email) {
    userDataStore.set(
      user.email.toLowerCase(),
      confirmedClean
    );
  }

  savePersistedData();

  return res.json({
    success: true,
    message: 'User data saved to PostgreSQL.',
    data: confirmedClean,
    source: 'postgresql'
  });
});

`;

server =
  server.slice(0, routesStart) +
  newRoutes +
  server.slice(routesEnd);

console.log('PATCHED: PostgreSQL-authoritative /api/user/data');

// ============================================================
// FIX 3:
// Harden DB helper itself.
// - full sync can never DELETE favorites
// - empty playlist snapshot cannot erase playlist tracks
// - full sync can never DELETE custom songs
// ============================================================
const saveStart =
  users.indexOf(
    'export async function saveUserLibraryToDb('
  );

const saveEnd =
  users.indexOf(
    'export async function getUserFavorites',
    saveStart
  );

if (saveStart < 0 || saveEnd < 0) {
  throw new Error(
    'saveUserLibraryToDb function boundary not found.'
  );
}

const safeSaveFunction = `export async function saveUserLibraryToDb(
  uid: string,
  data: Partial<DbUserLibrary>
): Promise<boolean> {
  try {
    // ========================================================
    // 1. Favorites
    // ========================================================
    // NON-DESTRUCTIVE ONLY.
    // Full-library synchronization must never interpret a
    // missing favorite as an unlike.
    // Real unlikes use removeUserFavorite().
    if (Array.isArray(data.likedTrackIds)) {
      const uniqueIds = Array.from(
        new Set(
          data.likedTrackIds.filter(
            (id) =>
              typeof id === 'string' &&
              id.trim().length > 0
          )
        )
      );

      const existingFavorites =
        await db
          .select()
          .from(userFavorites)
          .where(
            eq(userFavorites.userUid, uid)
          );

      const existingIds =
        new Set(
          existingFavorites.map(
            (favorite) =>
              favorite.trackId
          )
        );

      const incomingTracks =
        new Map<string, DbTrack>();

      if (Array.isArray(data.likedTracks)) {
        for (const track of data.likedTracks) {
          if (
            track &&
            typeof track === 'object' &&
            track.id
          ) {
            incomingTracks.set(
              String(track.id),
              track
            );
          }
        }
      }

      for (const trackId of uniqueIds) {
        const incoming =
          incomingTracks.get(trackId);

        if (existingIds.has(trackId)) {
          if (incoming) {
            await db
              .update(userFavorites)
              .set({
                trackData:
                  JSON.stringify(incoming),
              })
              .where(
                and(
                  eq(
                    userFavorites.userUid,
                    uid
                  ),
                  eq(
                    userFavorites.trackId,
                    trackId
                  )
                )
              );
          }

          continue;
        }

        await db
          .insert(userFavorites)
          .values({
            userUid: uid,
            trackId,
            trackData: incoming
              ? JSON.stringify(incoming)
              : null,
          });

        existingIds.add(trackId);
      }
    }

    // ========================================================
    // 2. Custom Playlists
    // ========================================================
    if (Array.isArray(data.customPlaylists)) {
      const playlistMap =
        new Map<string, DbPlaylist>();

      for (const playlist of data.customPlaylists) {
        if (
          playlist &&
          playlist.id &&
          playlist.title
        ) {
          playlistMap.set(
            playlist.id,
            playlist
          );
        }
      }

      const uniquePlaylists =
        Array.from(
          playlistMap.values()
        );

      for (const playlist of uniquePlaylists) {
        await db
          .insert(userPlaylists)
          .values({
            id: playlist.id,
            userUid: uid,
            title: playlist.title,
            description:
              playlist.description || '',
            coverUrl:
              playlist.coverUrl || '',
            isCustom:
              playlist.isCustom ?? true,
            createdAt:
              playlist.createdAt
                ? new Date(
                    playlist.createdAt
                  )
                : new Date(),
            updatedAt:
              new Date(),
          })
          .onConflictDoUpdate({
            target: userPlaylists.id,
            set: {
              userUid: uid,
              title: playlist.title,
              description:
                playlist.description || '',
              coverUrl:
                playlist.coverUrl || '',
              isCustom:
                playlist.isCustom ?? true,
              updatedAt:
                new Date(),
            },
          });

        const rawTracks =
          Array.isArray(playlist.tracks)
            ? playlist.tracks
            : Array.isArray(
                playlist.trackIds
              )
              ? playlist.trackIds.map(
                  (id) => ({ id })
                )
              : [];

        const validTracks =
          rawTracks.filter(
            (track: any) => {
              const id =
                typeof track === 'string'
                  ? track
                  : track?.id;

              return (
                typeof id === 'string' &&
                id.trim().length > 0
              );
            }
          );

        // IMPORTANT:
        // Empty/stale snapshots must not erase tracks already stored.
        // Explicit playlist deletion is handled by deleteUserPlaylist().
        if (validTracks.length > 0) {
          await db
            .delete(playlistTracks)
            .where(
              eq(
                playlistTracks.playlistId,
                playlist.id
              )
            );

          await db
            .insert(playlistTracks)
            .values(
              validTracks.map(
                (track: any, index) => ({
                  playlistId:
                    playlist.id,
                  trackId:
                    typeof track === 'string'
                      ? track
                      : String(track.id),
                  trackData:
                    typeof track === 'object'
                      ? JSON.stringify(track)
                      : null,
                  position: index,
                })
              )
            );
        }
      }
    }

    // ========================================================
    // 3. Custom Songs
    // ========================================================
    // Upsert-only from full snapshots.
    // A stale empty device must never delete durable songs.
    if (Array.isArray(data.customSongs)) {
      const songMap =
        new Map<string, DbTrack>();

      for (const song of data.customSongs) {
        if (
          song &&
          song.id &&
          song.title &&
          song.audioUrl
        ) {
          songMap.set(
            song.id,
            song
          );
        }
      }

      for (const song of songMap.values()) {
        await db
          .insert(userCustomSongs)
          .values({
            id: song.id,
            userUid: uid,
            title: song.title,
            artist:
              song.artist ||
              'Unknown Artist',
            audioUrl: song.audioUrl,
            artwork:
              song.artwork || '',
            duration:
              song.duration || 0,
            youtubeId:
              song.youtubeId || null,
            lyrics:
              song.lyrics || null,
            createdAt:
              song.createdAt
                ? new Date(
                    song.createdAt
                  )
                : new Date(),
          })
          .onConflictDoUpdate({
            target: userCustomSongs.id,
            set: {
              userUid: uid,
              title: song.title,
              artist:
                song.artist ||
                'Unknown Artist',
              audioUrl:
                song.audioUrl,
              artwork:
                song.artwork || '',
              duration:
                song.duration || 0,
              youtubeId:
                song.youtubeId ||
                null,
              lyrics:
                song.lyrics || null,
            },
          });
      }
    }

    // ========================================================
    // 4. Recently Played
    // ========================================================
    if (
      Array.isArray(
        data.recentlyPlayed
      )
    ) {
      await db
        .delete(userRecentlyPlayed)
        .where(
          eq(
            userRecentlyPlayed.userUid,
            uid
          )
        );

      const recentSlice =
        data.recentlyPlayed
          .filter(
            (track: any) =>
              track &&
              typeof track.id === 'string' &&
              track.id.trim().length > 0
          )
          .slice(0, 50);

      if (recentSlice.length > 0) {
        await db
          .insert(userRecentlyPlayed)
          .values(
            recentSlice.map(
              (track: any) => ({
                userUid: uid,
                trackId:
                  track.id,
                trackData:
                  JSON.stringify(track),
                playedAt:
                  new Date(),
              })
            )
          );
      }
    }

    // ========================================================
    // 5. Settings
    // ========================================================
    if (
      data.settings &&
      typeof data.settings === 'object'
    ) {
      const settings = data.settings;

      await db
        .insert(userSettings)
        .values({
          userUid: uid,

          audioQuality:
            settings.audioQuality ||
            'Normal',

          crossfade:
            settings.crossfade ??
            false,

          gapless:
            settings.gapless ??
            false,

          autoplay:
            settings.autoplay ??
            false,

          volumeNormalization:
            settings.volumeNormalization ??
            false,

          wifiOnlyDownloads:
            settings.wifiOnlyDownloads ??
            false,

          mobileStreaming:
            settings.mobileStreaming ??
            false,

          downloadQuality:
            settings.downloadQuality ||
            'Normal',

          themeMode:
            settings.themeMode ||
            'Dark',

          equalizerEnabled:
            settings.equalizerEnabled ??
            false,

          equalizerPreset:
            settings.equalizerPreset ||
            'Flat',

          eqBass:
            Number(
              settings.eqBass ?? 0
            ),

          eqLowMid:
            Number(
              settings.eqLowMid ?? 0
            ),

          eqMid:
            Number(
              settings.eqMid ?? 0
            ),

          eqHighMid:
            Number(
              settings.eqHighMid ?? 0
            ),

          eqTreble:
            Number(
              settings.eqTreble ?? 0
            ),

          offlineMode:
            settings.offlineMode ??
            false,

          updatedAt:
            new Date(),
        })
        .onConflictDoUpdate({
          target:
            userSettings.userUid,

          set: {
            audioQuality:
              settings.audioQuality ||
              'Normal',

            crossfade:
              settings.crossfade ??
              false,

            gapless:
              settings.gapless ??
              false,

            autoplay:
              settings.autoplay ??
              false,

            volumeNormalization:
              settings.volumeNormalization ??
              false,

            wifiOnlyDownloads:
              settings.wifiOnlyDownloads ??
              false,

            mobileStreaming:
              settings.mobileStreaming ??
              false,

            downloadQuality:
              settings.downloadQuality ||
              'Normal',

            themeMode:
              settings.themeMode ||
              'Dark',

            equalizerEnabled:
              settings.equalizerEnabled ??
              false,

            equalizerPreset:
              settings.equalizerPreset ||
              'Flat',

            eqBass:
              Number(
                settings.eqBass ?? 0
              ),

            eqLowMid:
              Number(
                settings.eqLowMid ?? 0
              ),

            eqMid:
              Number(
                settings.eqMid ?? 0
              ),

            eqHighMid:
              Number(
                settings.eqHighMid ?? 0
              ),

            eqTreble:
              Number(
                settings.eqTreble ?? 0
              ),

            offlineMode:
              settings.offlineMode ??
              false,

            updatedAt:
              new Date(),
          },
        });
    }

    return true;
  } catch (error) {
    console.error(
      '[Cloud SQL] saveUserLibraryToDb failed:',
      error
    );

    return false;
  }
}

`;

users =
  users.slice(0, saveStart) +
  safeSaveFunction +
  users.slice(saveEnd);

fs.writeFileSync(
  serverPath,
  server,
  'utf8'
);

fs.writeFileSync(
  usersPath,
  users,
  'utf8'
);

console.log('');
console.log('========================================');
console.log('SABDHAM PERSISTENCE FIX WRITTEN');
console.log('========================================');
console.log('server.ts: patched');
console.log('src/db/users.ts: patched');
console.log('Android playback files: NOT TOUCHED');
console.log('');
console.log('Safety rules now active:');
console.log('- PostgreSQL is authoritative');
console.log('- DB read failure returns 503');
console.log('- Cache never writes itself back after DB failure');
console.log('- Cache updates only after DB success');
console.log('- Full sync cannot delete favorites');
console.log('- Full sync cannot wipe playlist tracks with []');
console.log('- Full sync cannot wipe custom songs with []');
console.log('- Auto My Morning Favorites creation removed');
console.log('- Legacy Favorites playlists hidden but NOT deleted');
