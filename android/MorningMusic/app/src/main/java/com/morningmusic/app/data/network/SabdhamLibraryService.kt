package com.morningmusic.app.data.network

import android.content.Context
import com.morningmusic.app.auth.SabdhamAuthService
import com.morningmusic.app.data.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class CloudPlaylist(
    val id: String,
    val name: String,
    val description: String = "",
    val trackIds: List<String> = emptyList(),
    val tracks: List<Track> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val isCustom: Boolean = true
)

data class LibraryResult(
    val success: Boolean,
    val message: String = "",
    val playlists: List<CloudPlaylist> = emptyList()
)

object SabdhamLibraryService {

    private const val BASE_URL = "https://sabdham-backend.onrender.com"


    data class LikedTracksResult(
        val success: Boolean,
        val message: String = "",
        val likedTrackIds: Set<String> = emptySet(),
        val tracks: List<Track> = emptyList()
    )

    suspend fun loadLikedTracks(context: Context): LikedTracksResult =
        withContext(Dispatchers.IO) {
            val token = SabdhamAuthService.getToken(context)
                ?: return@withContext LikedTracksResult(false, "Please sign in first.")

            try {
                var code = -1
                var text = ""
                var lastError: Exception? = null

                repeat(3) { attempt ->
                    try {
                        val con = URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection
                        con.requestMethod = "GET"
                        con.connectTimeout = 15000
                        con.readTimeout = 15000
                        con.setRequestProperty("Accept", "application/json")
                        con.setRequestProperty("Authorization", "Bearer $token")

                        code = con.responseCode
                        val stream = if (code in 200..299) con.inputStream else con.errorStream
                        text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        con.disconnect()

                        if (code > 0) return@repeat
                    } catch (e: Exception) {
                        lastError = e
                        if (attempt < 2) delay(1500L * (attempt + 1))
                    }
                }

                if (code == -1 && lastError != null) {
                    throw lastError!!
                }

                if (code !in 200..299) {
                    android.util.Log.e(
                        "SABDHAM_LIKES",
                        "GET /api/user/data failed HTTP=$code BODY=$text"
                    )
                    return@withContext LikedTracksResult(
                        false,
                        "Unable to load liked songs. HTTP $code"
                    )
                }

                val data = JSONObject(text).optJSONObject("data") ?: JSONObject()
                val ids = linkedSetOf<String>()
                val a = data.optJSONArray("likedTrackIds") ?: JSONArray()

                for (i in 0 until a.length()) {
                    a.optString(i).trim().takeIf { it.isNotBlank() }?.let { ids += it }
                }

                val tracks = mutableListOf<Track>()

                // 1. Static SABDHAM catalogue.
                ids.forEach { id ->
                    com.morningmusic.app.data.repository.MusicRepository
                        .getTrackById(id)
                        ?.let { tracks += it }
                }

                // 2. Preferred source: metadata stored with each favorite.
                val serverLiked =
                    data.optJSONArray("likedTracks") ?: JSONArray()

                for (i in 0 until serverLiked.length()) {
                    val obj =
                        serverLiked.optJSONObject(i) ?: continue

                    val id =
                        obj.optString("id").trim()

                    if (
                        id in ids &&
                        tracks.none { it.id == id }
                    ) {
                        parseTrack(obj)?.let {
                            tracks += it
                        }
                    }
                }

                // 3. Legacy custom-song storage.
                val custom =
                    data.optJSONArray("customSongs") ?: JSONArray()

                for (i in 0 until custom.length()) {
                    val obj =
                        custom.optJSONObject(i) ?: continue

                    val id =
                        obj.optString("id").trim()

                    if (
                        id in ids &&
                        tracks.none { it.id == id }
                    ) {
                        parseTrack(obj)?.let {
                            tracks += it
                        }
                    }
                }

                // 4. Recover metadata from user's playlists.
                val playlists =
                    data.optJSONArray("customPlaylists") ?: JSONArray()

                for (i in 0 until playlists.length()) {
                    val playlist =
                        playlists.optJSONObject(i) ?: continue

                    val playlistTracks =
                        playlist.optJSONArray("tracks") ?: JSONArray()

                    for (j in 0 until playlistTracks.length()) {
                        val obj =
                            playlistTracks.optJSONObject(j) ?: continue

                        val id =
                            obj.optString("id").trim()

                        if (
                            id in ids &&
                            tracks.none { it.id == id }
                        ) {
                            parseTrack(obj)?.let {
                                tracks += it
                            }
                        }
                    }
                }

                // 5. Recover metadata from recently-played history.
                val recent =
                    data.optJSONArray("recentlyPlayed") ?: JSONArray()

                for (i in 0 until recent.length()) {
                    val obj =
                        recent.optJSONObject(i) ?: continue

                    val id =
                        obj.optString("id").trim()

                    if (
                        id in ids &&
                        tracks.none { it.id == id }
                    ) {
                        parseTrack(obj)?.let {
                            tracks += it
                        }
                    }
                }

                /*
                 * 6. Merge account-specific device cache BEFORE replacing it.
                 * This can recover old search/playlist favorites whose DB
                 * metadata was previously lost.
                 */
                loadLikedCache(context)
                    ?.tracks
                    ?.forEach { cachedTrack ->
                        if (
                            cachedTrack.id in ids &&
                            tracks.none {
                                it.id == cachedTrack.id
                            }
                        ) {
                            tracks += cachedTrack
                        }
                    }

                val finalTracks =
                    tracks.distinctBy { it.id }

                saveLikedCache(
                    context = context,
                    ids = ids,
                    tracks = finalTracks
                )

                LikedTracksResult(
                    true,
                    likedTrackIds = ids,
                    tracks = finalTracks
                )
            } catch (e: Exception) {
                loadLikedCache(context)
                    ?: LikedTracksResult(
                        false,
                        e.message ?: "Unable to load liked songs."
                    )
            }
        }

    /**
     * Atomic like/unlike operation.
     * Does NOT rewrite playlists, recents, settings, or the full user library.
     */
    suspend fun setFavorite(
        context: Context,
        track: Track,
        liked: Boolean
    ): LibraryResult = withContext(Dispatchers.IO) {
        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        var connection: HttpURLConnection? = null
        try {
            val encodedId = URLEncoder.encode(track.id, "UTF-8")
            connection =
                if (liked) {
                    URL("$BASE_URL/api/db/favorites")
                        .openConnection() as HttpURLConnection
                } else {
                    URL("$BASE_URL/api/db/favorites/$encodedId")
                        .openConnection() as HttpURLConnection
                }

            connection.requestMethod = if (liked) "POST" else "DELETE"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")

            if (liked) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")

                val body = JSONObject()
                    .put("trackId", track.id)
                    .put(
                        "trackData",
                        JSONObject()
                            .put("id", track.id)
                            .put("title", track.title)
                            .put("artist", track.artist)
                            .put("album", track.album)
                            .put("coverUrl", track.coverUrl)
                            .put("audioUrl", track.audioUrl)
                            .put("youtubeVideoId", track.youtubeVideoId)
                    )

                connection.outputStream.use {
                    it.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val code = connection.responseCode
            val responseText =
                (if (code in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    .orEmpty()

            if (code in 200..299) {
                LibraryResult(true)
            } else {
                LibraryResult(
                    false,
                    try {
                        JSONObject(responseText).optString(
                            "error",
                            "Unable to update favorite."
                        )
                    } catch (_: Exception) {
                        "Unable to update favorite."
                    }
                )
            }
        } catch (e: Exception) {
            LibraryResult(false, e.message ?: "Unable to update favorite.")
        } finally {
            connection?.disconnect()
        }
    }
    suspend fun saveLikedTracks(
        context: Context,
        tracks: List<Track>
    ): LibraryResult = withContext(Dispatchers.IO) {

        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        try {
            val get = URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection
            get.requestMethod = "GET"
            get.connectTimeout = 15000
            get.readTimeout = 15000
            get.setRequestProperty("Accept", "application/json")
            get.setRequestProperty("Authorization", "Bearer $token")

            val getCode = get.responseCode
            val getStream = if (getCode in 200..299) get.inputStream else get.errorStream
            val getText = getStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            get.disconnect()

            if (getCode !in 200..299) {
                return@withContext LibraryResult(false, "Unable to load your library.")
            }

            val data = JSONObject(getText).optJSONObject("data") ?: JSONObject()
            val unique = tracks.distinctBy { it.id }

            val likedIds = JSONArray()
            unique.forEach { likedIds.put(it.id) }

            val oldCustom = data.optJSONArray("customSongs") ?: JSONArray()
            val customById = linkedMapOf<String, JSONObject>()

            for (i in 0 until oldCustom.length()) {
                val obj = oldCustom.optJSONObject(i) ?: continue
                val id = obj.optString("id")
                if (id.isNotBlank()) customById[id] = obj
            }

            unique.forEach { customById[it.id] = trackToJson(it) }

            val custom = JSONArray()
            customById.values.forEach { custom.put(it) }

            val body = JSONObject().apply {
                put("likedTrackIds", likedIds)
                put("recentlyPlayed", data.optJSONArray("recentlyPlayed") ?: JSONArray())
                put("customPlaylists", data.optJSONArray("customPlaylists") ?: JSONArray())
                put("customSongs", custom)
                data.optJSONObject("settings")?.let { put("settings", it) }
                put("isExplicitClear", unique.isEmpty())
            }

            val post = URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection
            post.requestMethod = "POST"
            post.connectTimeout = 15000
            post.readTimeout = 15000
            post.doOutput = true
            post.setRequestProperty("Accept", "application/json")
            post.setRequestProperty("Content-Type", "application/json")
            post.setRequestProperty("Authorization", "Bearer $token")

            post.outputStream.use {
                it.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val postCode = post.responseCode
            post.inputStream.takeIf { postCode in 200..299 }?.close()
            post.disconnect()

            if (postCode in 200..299)
                LibraryResult(true)
            else
                LibraryResult(false, "Unable to save liked songs.")

        } catch (e: Exception) {
            LibraryResult(false, e.message ?: "Unable to save liked songs.")
        }
    }
    suspend fun getPlaylists(context: Context): LibraryResult =
        withContext(Dispatchers.IO) {
            val token = SabdhamAuthService.getToken(context)
                ?: return@withContext LibraryResult(false, "Please sign in first.")

            try {
                var code = -1
                var text = ""
                var lastError: Exception? = null

                repeat(3) { attempt ->
                    try {
                        val connection =
                            URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

                        connection.requestMethod = "GET"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 15000
                        connection.setRequestProperty("Accept", "application/json")
                        connection.setRequestProperty("Authorization", "Bearer $token")

                        code = connection.responseCode
                        val stream =
                            if (code in 200..299) connection.inputStream else connection.errorStream
                        text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

                        connection.disconnect()

                        if (code > 0) return@repeat
                    } catch (e: Exception) {
                        lastError = e
                        if (attempt < 2) delay(1500L * (attempt + 1))
                    }
                }

                if (code == -1 && lastError != null) {
                    throw lastError!!
                }

                if (code !in 200..299) {
                    return@withContext LibraryResult(
                        false,
                        if (code == 401) "Please sign in again."
                        else "Unable to load playlists."
                    )
                }

                val root = JSONObject(text)
                val data = root.optJSONObject("data") ?: JSONObject()
                val array = data.optJSONArray("customPlaylists") ?: JSONArray()

                val playlists = mutableListOf<CloudPlaylist>()

                for (i in 0 until array.length()) {
                    val obj = array.optJSONObject(i) ?: continue
                    val id = obj.optString("id")
                    if (id.isBlank()) continue

                    val ids = mutableListOf<String>()
                    val idArray = obj.optJSONArray("trackIds") ?: JSONArray()
                    for (j in 0 until idArray.length()) {
                        val trackId = idArray.optString(j)
                        if (trackId.isNotBlank()) ids += trackId
                    }

                    val tracks = mutableListOf<Track>()
                    val trackArray = obj.optJSONArray("tracks") ?: JSONArray()
                    for (j in 0 until trackArray.length()) {
                        val trackObj = trackArray.optJSONObject(j) ?: continue
                        parseTrack(trackObj)?.let { tracks += it }
                    }

                    playlists += CloudPlaylist(
                        id = id,
                        name = obj.optString(
                            "name",
                            obj.optString("title", "Playlist")
                        ),
                        description = obj.optString("description"),
                        trackIds = ids,
                        tracks = tracks,
                        createdAt = obj.optLong(
                            "createdAt",
                            System.currentTimeMillis()
                        ),
                        isCustom = obj.optBoolean("isCustom", true)
                    )
                }

                savePlaylistsCache(
                    context = context,
                    playlists = playlists
                )

                LibraryResult(
                    true,
                    playlists = playlists
                )
            } catch (e: Exception) {
                loadPlaylistsCache(context)
                    ?: LibraryResult(
                        false,
                        e.message ?: "Unable to load playlists."
                    )
            }
        }

    suspend fun createPlaylist(
        context: Context,
        name: String,
        description: String = "",
        tracks: List<Track> = emptyList()
    ): LibraryResult = withContext(Dispatchers.IO) {
        android.util.Log.d("SABDHAM_PLAYLIST", "CREATE entered name=$name tracks=${tracks.size}")
        val cleanName = name.trim()
        if (cleanName.isBlank()) {
            return@withContext LibraryResult(false, "Playlist name is required.")
        }

        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        try {
            val getConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            getConnection.requestMethod = "GET"
            getConnection.connectTimeout = 15000
            getConnection.readTimeout = 15000
            getConnection.setRequestProperty("Accept", "application/json")
            getConnection.setRequestProperty("Authorization", "Bearer $token")

            android.util.Log.d("SABDHAM_PLAYLIST", "CREATE starting library GET")
            val getCode = getConnection.responseCode
            android.util.Log.d("SABDHAM_PLAYLIST", "CREATE library GET HTTP=$getCode")
            val getStream =
                if (getCode in 200..299) getConnection.inputStream
                else getConnection.errorStream
            val getText =
                getStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            getConnection.disconnect()

            if (getCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (getCode == 401) "Please sign in again."
                    else "Unable to load your library."
                )
            }

            val root = JSONObject(getText)
            val data = root.optJSONObject("data") ?: JSONObject()
            val playlists =
                data.optJSONArray("customPlaylists") ?: JSONArray()

            val uniqueTracks = tracks.distinctBy { it.id }
            val playlistId = "playlist-${System.currentTimeMillis()}"

            val trackIdsJson = JSONArray()
            val tracksJson = JSONArray()

            uniqueTracks.forEach { track ->
                trackIdsJson.put(track.id)
                tracksJson.put(trackToJson(track))
            }

            playlists.put(
                JSONObject().apply {
                    put("id", playlistId)
                    put("name", cleanName)
                    put("title", cleanName)
                    put("description", description.trim())
                    put("trackIds", trackIdsJson)
                    put("tracks", tracksJson)
                    put("createdAt", System.currentTimeMillis())
                    put("isCustom", true)
                }
            )

            val body = JSONObject().apply {
                put(
                    "likedTrackIds",
                    data.optJSONArray("likedTrackIds") ?: JSONArray()
                )
                put(
                    "recentlyPlayed",
                    data.optJSONArray("recentlyPlayed") ?: JSONArray()
                )
                put("customPlaylists", playlists)
                put(
                    "customSongs",
                    data.optJSONArray("customSongs") ?: JSONArray()
                )

                data.optJSONObject("settings")?.let {
                    put("settings", it)
                }
            }

            android.util.Log.d("SABDHAM_PLAYLIST", "CREATE JSON ready, starting POST")
            val postConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            postConnection.requestMethod = "POST"
            postConnection.connectTimeout = 15000
            postConnection.readTimeout = 15000
            postConnection.doOutput = true
            postConnection.setRequestProperty("Accept", "application/json")
            postConnection.setRequestProperty(
                "Content-Type",
                "application/json"
            )
            postConnection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            postConnection.outputStream.use {
                it.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            android.util.Log.d("SABDHAM_PLAYLIST", "CREATE POST waiting for response")
            val postCode = postConnection.responseCode
            val postStream =
                if (postCode in 200..299) postConnection.inputStream
                else postConnection.errorStream
            val postText =
                postStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            postConnection.disconnect()

            if (postCode !in 200..299) {
                android.util.Log.e(
                    "SABDHAM_PLAYLIST",
                    "CREATE failed HTTP=$postCode BODY=$postText"
                )
                return@withContext LibraryResult(
                    false,
                    if (postCode == 401) "Please sign in again."
                    else "Failed to create playlist. HTTP $postCode"
                )
            }

            if (postText.isNotBlank()) {
                val response = JSONObject(postText)
                if (!response.optBoolean("success", true)) {
                    return@withContext LibraryResult(
                        false,
                        response.optString("error", "Failed to create playlist.")
                    )
                }
            }

            val refreshed = getPlaylists(context)
            if (refreshed.success) {
                LibraryResult(
                    true,
                    "Playlist created.",
                    refreshed.playlists
                )
            } else {
                LibraryResult(true, "Playlist created.")
            }
        } catch (e: Exception) {
            android.util.Log.e(
                "SABDHAM_PLAYLIST",
                "CREATE exception: ${e.javaClass.simpleName}: ${e.message}",
                e
            )
            LibraryResult(
                false,
                e.message ?: "Failed to create playlist."
            )
        }
    }
    suspend fun addTrackToPlaylist(
        context: Context,
        playlistId: String,
        track: Track
    ): LibraryResult = withContext(Dispatchers.IO) {

        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        try {
            /*
             * Always load the complete current library first.
             * We then modify only customPlaylists and POST the other fields
             * back unchanged so existing likes/recents/custom songs are preserved.
             */
            val getConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            getConnection.requestMethod = "GET"
            getConnection.connectTimeout = 15000
            getConnection.readTimeout = 15000
            getConnection.setRequestProperty("Accept", "application/json")
            getConnection.setRequestProperty("Authorization", "Bearer $token")

            val getCode = getConnection.responseCode
            val getStream =
                if (getCode in 200..299) getConnection.inputStream
                else getConnection.errorStream
            val getText = getStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            getConnection.disconnect()

            if (getCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (getCode == 401) "Please sign in again."
                    else "Unable to load your library."
                )
            }

            val root = JSONObject(getText)
            val data = root.optJSONObject("data") ?: JSONObject()

            val playlists =
                data.optJSONArray("customPlaylists") ?: JSONArray()

            var found = false
            var alreadyAdded = false

            for (i in 0 until playlists.length()) {
                val playlist = playlists.optJSONObject(i) ?: continue
                if (playlist.optString("id") != playlistId) continue

                found = true

                val trackIds =
                    playlist.optJSONArray("trackIds") ?: JSONArray().also {
                        playlist.put("trackIds", it)
                    }

                for (j in 0 until trackIds.length()) {
                    if (trackIds.optString(j) == track.id) {
                        alreadyAdded = true
                        break
                    }
                }

                if (!alreadyAdded) {
                    trackIds.put(track.id)

                    val tracks =
                        playlist.optJSONArray("tracks") ?: JSONArray().also {
                            playlist.put("tracks", it)
                        }

                    tracks.put(trackToJson(track))
                }

                break
            }

            if (!found) {
                return@withContext LibraryResult(false, "Playlist not found.")
            }

            if (alreadyAdded) {
                return@withContext LibraryResult(
                    true,
                    "Song is already in this playlist."
                )
            }

            val body = JSONObject().apply {
                put(
                    "likedTrackIds",
                    data.optJSONArray("likedTrackIds") ?: JSONArray()
                )
                put(
                    "recentlyPlayed",
                    data.optJSONArray("recentlyPlayed") ?: JSONArray()
                )
                put("customPlaylists", playlists)
                put(
                    "customSongs",
                    data.optJSONArray("customSongs") ?: JSONArray()
                )

                data.optJSONObject("settings")?.let {
                    put("settings", it)
                }
            }

            val postConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            postConnection.requestMethod = "POST"
            postConnection.connectTimeout = 15000
            postConnection.readTimeout = 15000
            postConnection.doOutput = true
            postConnection.setRequestProperty("Accept", "application/json")
            postConnection.setRequestProperty(
                "Content-Type",
                "application/json"
            )
            postConnection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            postConnection.outputStream.use {
                it.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val postCode = postConnection.responseCode
            val postStream =
                if (postCode in 200..299) postConnection.inputStream
                else postConnection.errorStream
            val postText =
                postStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            postConnection.disconnect()

            if (postCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (postCode == 401) "Please sign in again."
                    else "Failed to add song to playlist."
                )
            }

            val response =
                if (postText.isBlank()) JSONObject()
                else JSONObject(postText)

            if (!response.optBoolean("success", true)) {
                return@withContext LibraryResult(
                    false,
                    response.optString(
                        "error",
                        "Failed to add song to playlist."
                    )
                )
            }

            LibraryResult(true, "Added to playlist.")
        } catch (e: Exception) {
            LibraryResult(
                false,
                e.message ?: "Failed to add song to playlist."
            )
        }
    }

    suspend fun removeTrackFromPlaylist(
        context: Context,
        playlistId: String,
        trackId: String
    ): LibraryResult = withContext(Dispatchers.IO) {
        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        try {
            val getConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            getConnection.requestMethod = "GET"
            getConnection.connectTimeout = 15000
            getConnection.readTimeout = 15000
            getConnection.setRequestProperty("Accept", "application/json")
            getConnection.setRequestProperty("Authorization", "Bearer $token")

            val getCode = getConnection.responseCode
            val getStream =
                if (getCode in 200..299) getConnection.inputStream
                else getConnection.errorStream
            val getText =
                getStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            getConnection.disconnect()

            if (getCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (getCode == 401) "Please sign in again."
                    else "Unable to load your library."
                )
            }

            val root = JSONObject(getText)
            val data = root.optJSONObject("data") ?: JSONObject()
            val playlists =
                data.optJSONArray("customPlaylists") ?: JSONArray()

            var found = false

            for (i in 0 until playlists.length()) {
                val playlist = playlists.optJSONObject(i) ?: continue
                if (playlist.optString("id") != playlistId) continue

                found = true

                val oldIds =
                    playlist.optJSONArray("trackIds") ?: JSONArray()
                val newIds = JSONArray()

                for (j in 0 until oldIds.length()) {
                    val id = oldIds.optString(j)
                    if (id.isNotBlank() && id != trackId) {
                        newIds.put(id)
                    }
                }

                val oldTracks =
                    playlist.optJSONArray("tracks") ?: JSONArray()
                val newTracks = JSONArray()

                for (j in 0 until oldTracks.length()) {
                    val track = oldTracks.optJSONObject(j) ?: continue
                    if (track.optString("id") != trackId) {
                        newTracks.put(track)
                    }
                }

                playlist.put("trackIds", newIds)
                playlist.put("tracks", newTracks)
                break
            }

            if (!found) {
                return@withContext LibraryResult(false, "Playlist not found.")
            }

            val body = JSONObject().apply {
                put(
                    "likedTrackIds",
                    data.optJSONArray("likedTrackIds") ?: JSONArray()
                )
                put(
                    "recentlyPlayed",
                    data.optJSONArray("recentlyPlayed") ?: JSONArray()
                )
                put("customPlaylists", playlists)
                put(
                    "customSongs",
                    data.optJSONArray("customSongs") ?: JSONArray()
                )
                data.optJSONObject("settings")?.let {
                    put("settings", it)
                }
            }

            val postConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            postConnection.requestMethod = "POST"
            postConnection.connectTimeout = 15000
            postConnection.readTimeout = 15000
            postConnection.doOutput = true
            postConnection.setRequestProperty("Accept", "application/json")
            postConnection.setRequestProperty(
                "Content-Type",
                "application/json"
            )
            postConnection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            postConnection.outputStream.use {
                it.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val postCode = postConnection.responseCode
            val postStream =
                if (postCode in 200..299) postConnection.inputStream
                else postConnection.errorStream
            val postText =
                postStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            postConnection.disconnect()

            if (postCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (postCode == 401) "Please sign in again."
                    else "Failed to remove song."
                )
            }

            if (postText.isNotBlank()) {
                val response = JSONObject(postText)
                if (!response.optBoolean("success", true)) {
                    return@withContext LibraryResult(
                        false,
                        response.optString("error", "Failed to remove song.")
                    )
                }
            }

            val refreshed = getPlaylists(context)

            if (refreshed.success) {
                LibraryResult(
                    true,
                    "Song removed.",
                    refreshed.playlists
                )
            } else {
                LibraryResult(true, "Song removed.")
            }
        } catch (e: Exception) {
            LibraryResult(
                false,
                e.message ?: "Failed to remove song."
            )
        }
    }
    suspend fun renamePlaylist(
        context: Context,
        playlistId: String,
        newName: String
    ): LibraryResult = withContext(Dispatchers.IO) {
        val cleanName = newName.trim()

        if (cleanName.isBlank()) {
            return@withContext LibraryResult(false, "Playlist name cannot be empty.")
        }

        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        try {
            val getConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            getConnection.requestMethod = "GET"
            getConnection.connectTimeout = 15000
            getConnection.readTimeout = 15000
            getConnection.setRequestProperty("Accept", "application/json")
            getConnection.setRequestProperty("Authorization", "Bearer $token")

            val getCode = getConnection.responseCode
            val getStream =
                if (getCode in 200..299) getConnection.inputStream
                else getConnection.errorStream
            val getText =
                getStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            getConnection.disconnect()

            if (getCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (getCode == 401) "Please sign in again."
                    else "Unable to load your library."
                )
            }

            val root = JSONObject(getText)
            val data = root.optJSONObject("data") ?: JSONObject()
            val playlists =
                data.optJSONArray("customPlaylists") ?: JSONArray()

            var found = false

            for (i in 0 until playlists.length()) {
                val playlist = playlists.optJSONObject(i) ?: continue

                if (playlist.optString("id") == playlistId) {
                    playlist.put("name", cleanName)
                    playlist.put("title", cleanName)
                    found = true
                    break
                }
            }

            if (!found) {
                return@withContext LibraryResult(false, "Playlist not found.")
            }

            val body = JSONObject().apply {
                put(
                    "likedTrackIds",
                    data.optJSONArray("likedTrackIds") ?: JSONArray()
                )
                put(
                    "recentlyPlayed",
                    data.optJSONArray("recentlyPlayed") ?: JSONArray()
                )
                put("customPlaylists", playlists)
                put(
                    "customSongs",
                    data.optJSONArray("customSongs") ?: JSONArray()
                )
                data.optJSONObject("settings")?.let {
                    put("settings", it)
                }
            }

            val postConnection =
                URL("$BASE_URL/api/user/data").openConnection() as HttpURLConnection

            postConnection.requestMethod = "POST"
            postConnection.connectTimeout = 15000
            postConnection.readTimeout = 15000
            postConnection.doOutput = true
            postConnection.setRequestProperty("Accept", "application/json")
            postConnection.setRequestProperty(
                "Content-Type",
                "application/json"
            )
            postConnection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            postConnection.outputStream.use {
                it.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val postCode = postConnection.responseCode
            val postStream =
                if (postCode in 200..299) postConnection.inputStream
                else postConnection.errorStream
            val postText =
                postStream?.bufferedReader()?.use { it.readText() }.orEmpty()

            postConnection.disconnect()

            if (postCode !in 200..299) {
                return@withContext LibraryResult(
                    false,
                    if (postCode == 401) "Please sign in again."
                    else "Failed to rename playlist."
                )
            }

            if (postText.isNotBlank()) {
                val response = JSONObject(postText)

                if (!response.optBoolean("success", true)) {
                    return@withContext LibraryResult(
                        false,
                        response.optString(
                            "error",
                            "Failed to rename playlist."
                        )
                    )
                }
            }

            val refreshed = getPlaylists(context)

            if (refreshed.success) {
                LibraryResult(
                    true,
                    "Playlist renamed.",
                    refreshed.playlists
                )
            } else {
                LibraryResult(true, "Playlist renamed.")
            }
        } catch (e: Exception) {
            LibraryResult(
                false,
                e.message ?: "Failed to rename playlist."
            )
        }
    }
    suspend fun deletePlaylist(
        context: Context,
        playlistId: String
    ): LibraryResult = withContext(Dispatchers.IO) {
        val token = SabdhamAuthService.getToken(context)
            ?: return@withContext LibraryResult(false, "Please sign in first.")

        if (playlistId.isBlank()) {
            return@withContext LibraryResult(false, "Invalid playlist.")
        }

        try {
            val encodedPlaylistId =
                URLEncoder.encode(playlistId, "UTF-8")

            val connection =
                URL("$BASE_URL/api/db/playlists/$encodedPlaylistId")
                    .openConnection() as HttpURLConnection

            connection.requestMethod = "DELETE"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            val code = connection.responseCode
            val stream =
                if (code in 200..299) connection.inputStream
                else connection.errorStream

            val responseText =
                stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            connection.disconnect()

            if (code !in 200..299) {
                val message = try {
                    JSONObject(responseText).optString(
                        "error",
                        "Failed to delete playlist."
                    )
                } catch (_: Exception) {
                    "Failed to delete playlist."
                }

                return@withContext LibraryResult(
                    false,
                    if (code == 401) "Please sign in again." else message
                )
            }

            val refreshed = getPlaylists(context)

            if (refreshed.success) {
                LibraryResult(
                    true,
                    "Playlist deleted.",
                    refreshed.playlists
                )
            } else {
                LibraryResult(
                    true,
                    "Playlist deleted."
                )
            }
        } catch (e: Exception) {
            LibraryResult(
                false,
                e.message ?: "Failed to delete playlist."
            )
        }
    }
    suspend fun importPlaylistByLink(
        context: Context,
        playlistUrl: String
    ): LibraryResult = withContext(Dispatchers.IO) {
        val link = playlistUrl.trim()

        if (link.isBlank()) {
            return@withContext LibraryResult(false, "Enter a playlist link.")
        }

        try {
            when {
                link.contains("open.spotify.com/playlist/", ignoreCase = true) ||
                    link.startsWith("spotify:playlist:", ignoreCase = true) -> {

                    val encodedUrl = URLEncoder.encode(link, "UTF-8")

                    // Resolve playlist metadata.
                    val resolveConnection =
                        URL("$BASE_URL/api/spotify/playlist-resolve?url=$encodedUrl")
                            .openConnection() as HttpURLConnection

                    resolveConnection.requestMethod = "GET"
                    resolveConnection.connectTimeout = 15000
                    resolveConnection.readTimeout = 20000
                    resolveConnection.setRequestProperty("Accept", "application/json")

                    val resolveCode = resolveConnection.responseCode
                    val resolveStream =
                        if (resolveCode in 200..299) {
                            resolveConnection.inputStream
                        } else {
                            resolveConnection.errorStream
                        }

                    val resolveText =
                        resolveStream?.bufferedReader()?.use { it.readText() }.orEmpty()

                    resolveConnection.disconnect()

                    if (resolveCode !in 200..299 || resolveText.isBlank()) {
                        return@withContext LibraryResult(
                            false,
                            "Could not load Spotify playlist."
                        )
                    }

                    val playlistInfo = JSONObject(resolveText)

                    val playlistId = playlistInfo.optString("id").trim()
                    val playlistName =
                        playlistInfo.optString("title", "Spotify Playlist").trim()
                            .ifBlank { "Spotify Playlist" }
                    val description =
                        playlistInfo.optString("description").trim()

                    if (playlistId.isBlank()) {
                        return@withContext LibraryResult(
                            false,
                            "Invalid Spotify playlist."
                        )
                    }

                    // Fetch playlist tracks.
                    val encodedId = URLEncoder.encode(playlistId, "UTF-8")

                    val tracksConnection =
                        URL("$BASE_URL/api/spotify/playlist-tracks?playlistId=$encodedId")
                            .openConnection() as HttpURLConnection

                    tracksConnection.requestMethod = "GET"
                    tracksConnection.connectTimeout = 15000
                    tracksConnection.readTimeout = 30000
                    tracksConnection.setRequestProperty("Accept", "application/json")

                    val tracksCode = tracksConnection.responseCode
                    val tracksStream =
                        if (tracksCode in 200..299) {
                            tracksConnection.inputStream
                        } else {
                            tracksConnection.errorStream
                        }

                    val tracksText =
                        tracksStream?.bufferedReader()?.use { it.readText() }.orEmpty()

                    tracksConnection.disconnect()

                    if (tracksCode !in 200..299 || tracksText.isBlank()) {
                        return@withContext LibraryResult(
                            false,
                            "Could not fetch Spotify playlist tracks."
                        )
                    }

                    val array = JSONArray(tracksText)
                    val importedTracks = mutableListOf<Track>()

                    for (i in 0 until array.length()) {
                        val wrapper = array.optJSONObject(i) ?: continue
                        val trackObject =
                            wrapper.optJSONObject("track") ?: continue

                        val title = trackObject.optString("name").trim()
                        if (title.isBlank()) continue

                        val artistsArray = trackObject.optJSONArray("artists")
                        val artistNames = mutableListOf<String>()

                        if (artistsArray != null) {
                            for (j in 0 until artistsArray.length()) {
                                val artistName =
                                    artistsArray.optJSONObject(j)
                                        ?.optString("name")
                                        ?.trim()
                                        .orEmpty()

                                if (artistName.isNotBlank()) {
                                    artistNames += artistName
                                }
                            }
                        }

                        val artist =
                            artistNames.joinToString(", ")
                                .ifBlank { "Unknown Artist" }

                        val albumObject = trackObject.optJSONObject("album")
                        val album =
                            albumObject?.optString("name")?.trim()
                                ?.ifBlank { playlistName }
                                ?: playlistName

                        // Spotify album artwork is verified catalog metadata.
                        val images = albumObject?.optJSONArray("images")
                        val spotifyArtwork =
                            images?.optJSONObject(0)
                                ?.optString("url")
                                ?.trim()
                                .orEmpty()

                        val durationMs =
                            trackObject.optLong("duration_ms", 180000L)
                        val durationSeconds =
                            (durationMs / 1000L).coerceAtLeast(1L)

                        val minutes = durationSeconds / 60L
                        val seconds = durationSeconds % 60L
                        val durationFormatted =
                            "$minutes:${seconds.toString().padStart(2, '0')}"

                        val spotifyId =
                            trackObject.optString("id").trim()
                                .ifBlank {
                                    "${title.lowercase()}-${artist.lowercase()}"
                                        .replace(
                                            Regex("[^a-z0-9]+"),
                                            "-"
                                        )
                                        .trim('-')
                                }

                        importedTracks += Track(
                            id = "spotify-$spotifyId",
                            title = title,
                            artist = artist,
                            album = album,
                            durationSeconds = durationSeconds,
                            durationFormatted = durationFormatted,
                            coverUrl = spotifyArtwork,
                            // Playback will first use SABDHAM's
                            // title + artist stream resolver.
                            audioUrl = "",
                            youtubeVideoId = "",
                            language = "all",
                            genre = "Imported",
                            year = 2024,
                            releaseDate = "2024-01-01",
                            popularityScore = 80,
                            streamCount = 0L,
                            viewCount = 0L,
                            isTrendingNow = false
                        )
                    }

                    val uniqueTracks =
                        importedTracks.distinctBy { it.id }

                    if (uniqueTracks.isEmpty()) {
                        return@withContext LibraryResult(
                            false,
                            "No playable tracks found in this Spotify playlist."
                        )
                    }

                    val result =
                        createPlaylist(
                            context = context,
                            name = playlistName,
                            description =
                                "Imported from Spotify" +
                                    if (description.isNotBlank()) {
                                        ": $description"
                                    } else {
                                        ""
                                    },
                            tracks = uniqueTracks
                        )

                    if (result.success) {
                        result.copy(
                            message =
                                "Imported \"$playlistName\" with ${uniqueTracks.size} songs."
                        )
                    } else {
                        result
                    }
                }

                link.contains("youtube.com/", ignoreCase = true) ||
                    link.contains("youtu.be/", ignoreCase = true) -> {

                    val playlistId =
                        Regex(
                            "[?&]list=([^&#]+)",
                            RegexOption.IGNORE_CASE
                        )
                            .find(link)
                            ?.groupValues
                            ?.getOrNull(1)
                            ?.trim()
                            .orEmpty()

                    if (playlistId.isBlank()) {
                        return@withContext LibraryResult(
                            false,
                            "This is not a YouTube playlist link."
                        )
                    }

                    val encodedId = URLEncoder.encode(playlistId, "UTF-8")

                    // Public endpoint: no Google user token required.
                    val connection =
                        URL(
                            "$BASE_URL/api/youtube/playlist" +
                                "?id=$encodedId&maxResults=100"
                        ).openConnection() as HttpURLConnection

                    connection.requestMethod = "GET"
                    connection.connectTimeout = 15000
                    connection.readTimeout = 30000
                    connection.setRequestProperty("Accept", "application/json")

                    val code = connection.responseCode
                    val responseStream =
                        if (code in 200..299) {
                            connection.inputStream
                        } else {
                            connection.errorStream
                        }

                    val responseText =
                        responseStream?.bufferedReader()?.use { it.readText() }.orEmpty()

                    connection.disconnect()

                    if (code !in 200..299 || responseText.isBlank()) {
                        return@withContext LibraryResult(
                            false,
                            "Could not load YouTube playlist."
                        )
                    }

                    val root = JSONObject(responseText)
                    val array =
                        root.optJSONArray("tracks") ?: JSONArray()

                    val importedTracks = mutableListOf<Track>()

                    for (i in 0 until array.length()) {
                        val obj = array.optJSONObject(i) ?: continue

                        val videoId =
                            obj.optString("youtubeVideoId").trim()
                                .ifBlank {
                                    obj.optString("audio_source_id").trim()
                                }

                        if (videoId.isBlank()) continue

                        val title =
                            obj.optString("title", "Unknown").trim()
                        val artist =
                            obj.optString(
                                "artist",
                                "Sabdham Artist"
                            ).trim()

                        val duration =
                            obj.optLong(
                                "duration",
                                obj.optLong("durationSeconds", 210L)
                            )

                        val durationFormatted =
                            obj.optString("durationFormatted").trim()
                                .ifBlank {
                                    val minutes = duration / 60L
                                    val seconds = duration % 60L
                                    "$minutes:${
                                        seconds.toString().padStart(2, '0')
                                    }"
                                }

                        /*
                         * IMPORTANT:
                         * Never import YouTube thumbnail artwork.
                         *
                         * coverUrl is intentionally blank here even though
                         * the backend currently returns SABDHAM_DEFAULT_ARTWORK.
                         * Native UI will therefore use its own verified
                         * SABDHAM/default song placeholder.
                         */
                        importedTracks += Track(
                            id =
                                obj.optString("id").trim()
                                    .ifBlank { "yt-$videoId" },
                            title = title,
                            artist =
                                artist.ifBlank { "Sabdham Artist" },
                            album =
                                obj.optString(
                                    "album",
                                    "YouTube Playlist"
                                ),
                            durationSeconds =
                                duration.coerceAtLeast(1L),
                            durationFormatted = durationFormatted,
                            coverUrl = "",
                            audioUrl = "yt:$videoId",
                            youtubeVideoId = videoId,
                            language =
                                obj.optString("language", "all"),
                            genre =
                                obj.optString(
                                    "genre",
                                    "Imported"
                                ),
                            year = obj.optInt("year", 2024),
                            releaseDate =
                                obj.optString(
                                    "releaseDate",
                                    "2024-01-01"
                                ),
                            popularityScore =
                                obj.optInt("popularityScore", 80),
                            streamCount =
                                obj.optLong("streamCount", 0L),
                            viewCount =
                                obj.optLong("viewCount", 0L),
                            isTrendingNow =
                                obj.optBoolean(
                                    "isTrendingNow",
                                    false
                                )
                        )
                    }

                    val uniqueTracks =
                        importedTracks.distinctBy { it.id }

                    if (uniqueTracks.isEmpty()) {
                        return@withContext LibraryResult(
                            false,
                            "No songs found in this YouTube playlist."
                        )
                    }

                    /*
                     * The public endpoint currently does not return
                     * playlist metadata, so use a safe SABDHAM name.
                     */
                    val playlistName = "YouTube Playlist"

                    val result =
                        createPlaylist(
                            context = context,
                            name = playlistName,
                            description = "Imported from YouTube",
                            tracks = uniqueTracks
                        )

                    if (result.success) {
                        result.copy(
                            message =
                                "Imported YouTube playlist with ${uniqueTracks.size} songs."
                        )
                    } else {
                        result
                    }
                }

                else -> {
                    LibraryResult(
                        false,
                        "Unsupported link. Paste a Spotify or YouTube playlist URL."
                    )
                }
            }
        } catch (e: Exception) {
            LibraryResult(
                false,
                e.message ?: "Playlist import failed."
            )
        }
    }

    // Account-specific offline library cache.
    // Cache is only written after a successful cloud load.
    private const val CACHE_PREFS = "sabdham_library_cache"

    private fun cacheKey(context: Context, type: String): String? {
        val user = SabdhamAuthService.getSavedUser(context) ?: return null
        val accountId = user.id.ifBlank { user.email.trim().lowercase() }
        if (accountId.isBlank()) return null
        return "${type}_$accountId"
    }

    private fun saveLikedCache(
        context: Context,
        ids: Set<String>,
        tracks: List<Track>
    ) {
        val key = cacheKey(context, "likes") ?: return

        val root = JSONObject()
        val idArray = JSONArray()
        ids.forEach { idArray.put(it) }

        val trackArray = JSONArray()
        tracks.distinctBy { it.id }.forEach {
            trackArray.put(trackToJson(it))
        }

        root.put("likedTrackIds", idArray)
        root.put("tracks", trackArray)

        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(key, root.toString())
            .apply()
    }

    private fun loadLikedCache(context: Context): LikedTracksResult? {
        val key = cacheKey(context, "likes") ?: return null
        val text = context
            .getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .getString(key, null)
            ?: return null

        return try {
            val root = JSONObject(text)
            val ids = linkedSetOf<String>()
            val idArray = root.optJSONArray("likedTrackIds") ?: JSONArray()

            for (i in 0 until idArray.length()) {
                idArray.optString(i)
                    .trim()
                    .takeIf { it.isNotBlank() }
                    ?.let { ids += it }
            }

            val tracks = mutableListOf<Track>()
            val trackArray = root.optJSONArray("tracks") ?: JSONArray()

            for (i in 0 until trackArray.length()) {
                val obj = trackArray.optJSONObject(i) ?: continue
                parseTrack(obj)?.let { tracks += it }
            }

            LikedTracksResult(
                success = true,
                message = "Offline library",
                likedTrackIds = ids,
                tracks = tracks.distinctBy { it.id }
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun savePlaylistsCache(
        context: Context,
        playlists: List<CloudPlaylist>
    ) {
        val key = cacheKey(context, "playlists") ?: return
        val array = JSONArray()

        playlists.forEach { playlist ->
            val obj = JSONObject()
            obj.put("id", playlist.id)
            obj.put("name", playlist.name)
            obj.put("description", playlist.description)
            obj.put("createdAt", playlist.createdAt)
            obj.put("isCustom", playlist.isCustom)

            val ids = JSONArray()
            playlist.trackIds.forEach { ids.put(it) }
            obj.put("trackIds", ids)

            val tracks = JSONArray()
            playlist.tracks.distinctBy { it.id }.forEach {
                tracks.put(trackToJson(it))
            }
            obj.put("tracks", tracks)

            array.put(obj)
        }

        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(key, array.toString())
            .apply()
    }

    private fun loadPlaylistsCache(context: Context): LibraryResult? {
        val key = cacheKey(context, "playlists") ?: return null
        val text = context
            .getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .getString(key, null)
            ?: return null

        return try {
            val array = JSONArray(text)
            val playlists = mutableListOf<CloudPlaylist>()

            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val id = obj.optString("id")
                if (id.isBlank()) continue

                val ids = mutableListOf<String>()
                val idArray = obj.optJSONArray("trackIds") ?: JSONArray()

                for (j in 0 until idArray.length()) {
                    idArray.optString(j)
                        .takeIf { it.isNotBlank() }
                        ?.let { ids += it }
                }

                val tracks = mutableListOf<Track>()
                val trackArray = obj.optJSONArray("tracks") ?: JSONArray()

                for (j in 0 until trackArray.length()) {
                    val trackObj = trackArray.optJSONObject(j) ?: continue
                    parseTrack(trackObj)?.let { tracks += it }
                }

                playlists += CloudPlaylist(
                    id = id,
                    name = obj.optString("name", "Playlist"),
                    description = obj.optString("description"),
                    trackIds = ids,
                    tracks = tracks,
                    createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                    isCustom = obj.optBoolean("isCustom", true)
                )
            }

            LibraryResult(
                success = true,
                message = "Offline library",
                playlists = playlists
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun trackToJson(track: Track): JSONObject =
        JSONObject().apply {
            put("id", track.id)
            put("title", track.title)
            put("artist", track.artist)
            put("album", track.album)
            put("movie", track.movie)
            put("durationSeconds", track.durationSeconds)
            put("durationFormatted", track.durationFormatted)
            put("coverUrl", track.coverUrl)
            put("audioUrl", track.audioUrl)
            put("youtubeVideoId", track.youtubeVideoId)
            put("language", track.language)
            put("genre", track.genre)
            put("year", track.year)
            put("releaseDate", track.releaseDate)
            put("popularityScore", track.popularityScore)
            put("streamCount", track.streamCount)
            put("viewCount", track.viewCount)
            put("isTrendingNow", track.isTrendingNow)
            put("lyrics", track.lyrics)
        }

    private fun parseTrack(obj: JSONObject): Track? {
        val id = obj.optString("id")
        if (id.isBlank()) return null

        return Track(
            id = id,
            title = obj.optString("title", "Unknown"),
            artist = obj.optString("artist", "Unknown Artist"),
            album = obj.optString("album"),
            movie = obj.optString("movie"),
            durationSeconds = obj.optLong("durationSeconds", 200L),
            durationFormatted = obj.optString("durationFormatted", "3:20"),
            coverUrl = obj.optString("coverUrl"),
            audioUrl = obj.optString("audioUrl"),
            youtubeVideoId = obj.optString("youtubeVideoId"),
            language = obj.optString("language", "all"),
            genre = obj.optString("genre", "Pop"),
            year = obj.optInt("year", 2024),
            releaseDate = obj.optString("releaseDate", "2024-01-01"),
            popularityScore = obj.optInt("popularityScore", 90),
            streamCount = obj.optLong("streamCount", 1000000L),
            viewCount = obj.optLong("viewCount", 5000000L),
            isTrendingNow = obj.optBoolean("isTrendingNow", false),
            lyrics = obj.optString("lyrics")
        )
    }
}























