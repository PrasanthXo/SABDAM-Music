import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or Custom User ID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  provider: text('provider').notNull().default('otp'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  trackId: text('track_id').notNull(),
  trackData: text('track_data'), // JSON serialized Track metadata
  createdAt: timestamp('created_at').defaultNow(),
});

export const userPlaylists = pgTable('user_playlists', {
  id: text('id').primaryKey(), // Custom Playlist ID (e.g., pl_1710000000000_xyz)
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  isCustom: boolean('is_custom').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const playlistTracks = pgTable('playlist_tracks', {
  id: serial('id').primaryKey(),
  playlistId: text('playlist_id')
    .references(() => userPlaylists.id, { onDelete: 'cascade' })
    .notNull(),
  trackId: text('track_id').notNull(),
  trackData: text('track_data'), // JSON serialized Track metadata
  position: integer('position').default(0),
  addedAt: timestamp('added_at').defaultNow(),
});

export const userCustomSongs = pgTable('user_custom_songs', {
  id: text('id').primaryKey(), // Song ID (e.g., cs_... or custom id)
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  audioUrl: text('audio_url').notNull(),
  artwork: text('artwork'),
  duration: integer('duration').default(0),
  youtubeId: text('youtube_id'),
  lyrics: text('lyrics'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userRecentlyPlayed = pgTable('user_recently_played', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  trackId: text('track_id').notNull(),
  trackData: text('track_data'), // JSON serialized Track metadata
  playedAt: timestamp('played_at').defaultNow(),
});

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  audioQuality: text('audio_quality').default('Normal'),

  crossfade: boolean('crossfade').default(false),
  gapless: boolean('gapless').default(false),
  autoplay: boolean('autoplay').default(false),
  volumeNormalization: boolean('volume_normalization').default(false),

  wifiOnlyDownloads: boolean('wifi_only_downloads').default(false),
  mobileStreaming: boolean('mobile_streaming').default(false),

  downloadQuality: text('download_quality').default('Normal'),
  themeMode: text('theme_mode').default('Dark'),

  equalizerEnabled: boolean('equalizer_enabled').default(false),
  equalizerPreset: text('equalizer_preset').default('Flat'),

  eqBass: real('eq_bass').default(0),
  eqLowMid: real('eq_low_mid').default(0),
  eqMid: real('eq_mid').default(0),
  eqHighMid: real('eq_high_mid').default(0),
  eqTreble: real('eq_treble').default(0),

  offlineMode: boolean('offline_mode').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  favorites: many(userFavorites),
  playlists: many(userPlaylists),
  customSongs: many(userCustomSongs),
  recentlyPlayed: many(userRecentlyPlayed),
  settings: one(userSettings, {
    fields: [users.uid],
    references: [userSettings.userUid],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userUid],
    references: [users.uid],
  }),
}));

export const userPlaylistsRelations = relations(userPlaylists, ({ one, many }) => ({
  user: one(users, {
    fields: [userPlaylists.userUid],
    references: [users.uid],
  }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(userPlaylists, {
    fields: [playlistTracks.playlistId],
    references: [userPlaylists.id],
  }),
}));

export const userCustomSongsRelations = relations(userCustomSongs, ({ one }) => ({
  user: one(users, {
    fields: [userCustomSongs.userUid],
    references: [users.uid],
  }),
}));

export const userRecentlyPlayedRelations = relations(userRecentlyPlayed, ({ one }) => ({
  user: one(users, {
    fields: [userRecentlyPlayed.userUid],
    references: [users.uid],
  }),
}));


