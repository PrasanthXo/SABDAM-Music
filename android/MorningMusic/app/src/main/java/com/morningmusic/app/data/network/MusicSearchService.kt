package com.morningmusic.app.data.network

import android.content.Context
import android.content.SharedPreferences
import com.morningmusic.app.data.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Clean, provider-independent Android service to search and fetch songs from the backend proxy.
 * Supports configurable backend URLs, fallback endpoints, and runtime customization.
 */
data class ResolvedStream(
    val url: String,
    val coverUrl: String?,
    val duration: Long?,
    val source: String
)

data class SearchPlaylistResult(
    val id: String,
    val title: String,
    val owner: String,
    val itemCount: Int,
    val source: String = "youtube"
)

object MusicSearchService {

    const val DEFAULT_PRIMARY_URL = "https://sabdham-backend.onrender.com"
    const val DEFAULT_DEV_URL = "https://ais-dev-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app"

    private const val PREFS_NAME = "morning_music_network_prefs"
    private const val KEY_BACKEND_URL = "custom_backend_url"

    var activeBackendUrl: String = DEFAULT_PRIMARY_URL
        private set

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_BACKEND_URL, null)
        if (!saved.isNullOrBlank()) {
            activeBackendUrl = saved.trim().removeSuffix("/")
        }
    }

    fun setBackendUrl(context: Context, newUrl: String) {
        val cleanUrl = newUrl.trim().removeSuffix("/")
        activeBackendUrl = if (cleanUrl.isNotBlank()) cleanUrl else DEFAULT_PRIMARY_URL
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_BACKEND_URL, activeBackendUrl).apply()
    }

    fun resetToDefault(context: Context) {
        activeBackendUrl = DEFAULT_PRIMARY_URL
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_BACKEND_URL).apply()
    }

    fun getStreamUrl(videoIdOrRaw: String): String {
        val videoId = videoIdOrRaw.replace("yt:", "").replace("yt-", "").trim()
        return "$activeBackendUrl/api/youtube/stream?id=$videoId"
    }

    private fun isPlayableMediaContentType(
        rawContentType: String?
    ): Boolean {
        val contentType =
            rawContentType
                ?.substringBefore(";")
                ?.trim()
                ?.lowercase()
                .orEmpty()

        return contentType.startsWith("audio/") ||
            contentType.startsWith("video/") ||
            contentType == "application/octet-stream"
    }

    suspend fun isPlayableMediaUrl(
        rawUrl: String,
        timeoutMs: Int = 4500
    ): Boolean = withContext(Dispatchers.IO) {
        val url = rawUrl.trim()

        if (
            !url.startsWith("https://", ignoreCase = true) &&
            !url.startsWith("http://", ignoreCase = true)
        ) {
            return@withContext false
        }

        var connection: HttpURLConnection? = null

        try {
            connection =
                URL(url).openConnection() as HttpURLConnection

            connection.instanceFollowRedirects = true
            connection.requestMethod = "GET"
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.setRequestProperty(
                "Range",
                "bytes=0-1023"
            )
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 15) " +
                    "AppleWebKit/537.36 Chrome/154 Mobile Safari/537.36"
            )
            connection.setRequestProperty(
                "Accept",
                "audio/*,video/*,application/octet-stream;q=0.9,*/*;q=0.1"
            )

            val code = connection.responseCode
            val contentType =
                connection.getHeaderField("Content-Type")

            val playable =
                code in 200..299 &&
                    isPlayableMediaContentType(contentType)

            if (!playable) {
                android.util.Log.w(
                    "SABDHAM_STREAM_CHECK",
                    "Rejected url=$url code=$code type=$contentType"
                )
            }

            playable
        } catch (e: Exception) {
            android.util.Log.w(
                "SABDHAM_STREAM_CHECK",
                "Stream preflight failed url=$url",
                e
            )
            false
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun resolveYouTubeOnDevice(
        videoIdOrRaw: String
    ): String? = withContext(Dispatchers.IO) {
        val videoId =
            videoIdOrRaw
                .replace("yt:", "")
                .replace("yt-", "")
                .trim()

        if (!Regex("^[A-Za-z0-9_-]{11}$").matches(videoId)) {
            return@withContext null
        }

        // These URLs are attempted from the user's Android connection rather
        // than Render. Cloud IPs are frequently challenged by YouTube while
        // a normal device connection can still succeed.
        val candidates =
            listOf(
                "https://invidious.tiekoetter.com/latest_version" +
                    "?id=$videoId&itag=140&local=false",
                "https://invidious.no-logs.com/latest_version" +
                    "?id=$videoId&itag=140&local=false",
                "https://yewtu.be/latest_version" +
                    "?id=$videoId&itag=140&local=false",
                "https://inv.nadeko.net/latest_version" +
                    "?id=$videoId&itag=140&local=false"
            )

        // Probe providers in parallel. Previously these ran one-by-one
        // (up to ~12 seconds before the next fallback). Keeping a short
        // per-provider timeout caps this stage at roughly 2-3 seconds.
        val playableCandidate =
            coroutineScope {
                candidates
                    .map { candidate ->
                        async(Dispatchers.IO) {
                            if (
                                isPlayableMediaUrl(
                                    rawUrl = candidate,
                                    timeoutMs = 2200
                                )
                            ) {
                                candidate
                            } else {
                                null
                            }
                        }
                    }
                    .awaitAll()
                    .firstOrNull { !it.isNullOrBlank() }
            }

        if (!playableCandidate.isNullOrBlank()) {
            android.util.Log.d(
                "SABDHAM_STREAM_CHECK",
                "Device YouTube fallback succeeded id=$videoId"
            )
        }

        playableCandidate
    }

    suspend fun resolveStream(
        title: String,
        artist: String
    ): ResolvedStream? = withContext(Dispatchers.IO) {
        try {
            android.util.Log.d(
                "SABDHAM_RESOLVER",
                "START title=$title artist=$artist backend=$activeBackendUrl"
            )
            val encodedTitle = URLEncoder.encode(title, "UTF-8")
            val encodedArtist = URLEncoder.encode(artist, "UTF-8")

            val urlString =
                "$activeBackendUrl/api/stream/resolve?title=$encodedTitle&artist=$encodedArtist"

            val connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")

            try {
                if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                    return@withContext null
                }

                val response =
                    connection.inputStream.bufferedReader().use { it.readText() }

                val json = JSONObject(response)

                val resolvedUrl = json.optString("url").trim()
                val source = json.optString("source").trim().lowercase()

                android.util.Log.d(
                    "SABDHAM_RESOLVER",
                    "SUCCESS title=$title source=$source url=$resolvedUrl"
                )

                val coverUrl = json.optString("coverUrl")
                    .trim()
                    .takeIf { it.isNotBlank() }

                val duration = json.optLong("duration", 0L)
                    .takeIf { it > 0L }

                if (resolvedUrl.isBlank()) {
                    return@withContext null
                }

                if (
                    source == "youtube" ||
                    resolvedUrl.contains("/api/youtube/stream")
                ) {
                    return@withContext null
                }

                ResolvedStream(
                    url = resolvedUrl,
                    coverUrl = coverUrl,
                    duration = duration,
                    source = source
                )
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
    suspend fun resolveAudiusStream(
        title: String,
        artist: String
    ): ResolvedStream? = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null

        try {
            val encodedTitle = URLEncoder.encode(title, "UTF-8")
            val encodedArtist = URLEncoder.encode(artist, "UTF-8")

            val urlString =
                "$activeBackendUrl/api/audius/resolve" +
                    "?title=$encodedTitle&artist=$encodedArtist"

            connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.setRequestProperty("Accept", "application/json")

            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                return@withContext null
            }

            val response =
                connection.inputStream.bufferedReader().use { it.readText() }

            val json = JSONObject(response)
            val resolvedUrl = json.optString("url").trim()
            val source = json.optString("source").trim().lowercase()

            if (resolvedUrl.isBlank() || source != "audius") {
                return@withContext null
            }

            val coverUrl =
                json.optString("coverUrl")
                    .trim()
                    .takeIf { it.isNotBlank() }

            val duration =
                json.optLong("duration", 0L)
                    .takeIf { it > 0L }

            android.util.Log.d(
                "SABDHAM_AUDIUS",
                "FINAL FALLBACK title=$title artist=$artist"
            )

            ResolvedStream(
                url = resolvedUrl,
                coverUrl = coverUrl,
                duration = duration,
                source = source
            )
        } catch (e: Exception) {
            android.util.Log.w(
                "SABDHAM_AUDIUS",
                "Audius final fallback failed title=$title",
                e
            )
            null
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun resolveCatalogStream(
        title: String,
        artist: String
    ): ResolvedStream? = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null

        try {
            val encodedTitle = URLEncoder.encode(title, "UTF-8")
            val encodedArtist = URLEncoder.encode(artist, "UTF-8")

            val urlString =
                "$activeBackendUrl/api/stream/resolve?title=$encodedTitle&artist=$encodedArtist&direct=1"

            connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")

            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                return@withContext null
            }

            val response =
                connection.inputStream.bufferedReader().use { it.readText() }

            val json = JSONObject(response)

            val rawUrl = json.optString("url").trim()
            val source = json.optString("source").trim().lowercase()

            if (rawUrl.isBlank()) {
                return@withContext null
            }

            val absoluteUrl =
                when {
                    rawUrl.startsWith("https://", ignoreCase = true) ||
                        rawUrl.startsWith("http://", ignoreCase = true) ->
                        rawUrl

                    rawUrl.startsWith("/") ->
                        activeBackendUrl.trimEnd('/') + rawUrl

                    else ->
                        activeBackendUrl.trimEnd('/') + "/" + rawUrl
                }

            val coverUrl =
                json.optString("coverUrl")
                    .trim()
                    .takeIf { it.isNotBlank() }

            val duration =
                json.optLong("duration", 0L)
                    .takeIf { it > 0L }

            android.util.Log.d(
                "SABDHAM_CATALOG",
                "CATALOG RESOLVE SUCCESS title=$title source=$source raw=$rawUrl absolute=$absoluteUrl"
            )

            ResolvedStream(
                url = absoluteUrl,
                coverUrl = coverUrl,
                duration = duration,
                source = source
            )
        } catch (e: Exception) {
            android.util.Log.w(
                "SABDHAM_CATALOG",
                "CATALOG RESOLVE ERROR title=$title",
                e
            )
            null
        } finally {
            connection?.disconnect()
        }
    }
    suspend fun resolveStreamUrl(title: String, artist: String): String? = withContext(Dispatchers.IO) {
        try {
            val encodedTitle = URLEncoder.encode(title, "UTF-8")
            val encodedArtist = URLEncoder.encode(artist, "UTF-8")

            val urlString =
                "$activeBackendUrl/api/stream/resolve?title=$encodedTitle&artist=$encodedArtist"

            val connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")

            try {
                if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                    return@withContext null
                }

                val response =
                    connection.inputStream.bufferedReader().use { it.readText() }

                val json = JSONObject(response)

                val resolvedUrl = json.optString("url").trim()
                val source = json.optString("source").trim().lowercase()

                if (resolvedUrl.isBlank()) {
                    return@withContext null
                }

                // Native Media3 must receive a real audio URL, not our YouTube proxy.
                if (
                    source == "youtube" ||
                    resolvedUrl.contains("/api/youtube/stream")
                ) {
                    return@withContext null
                }

                resolvedUrl
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
    suspend fun searchSongs(
        query: String,
        language: String = "all",
        page: Int = 1,
        maxResults: Int = 15
    ): List<Track> = withContext(Dispatchers.IO) {

        val catalogTracks = mutableListOf<Track>()
        val youtubeTracks = mutableListOf<Track>()

        val endpointsToTry =
            listOf(activeBackendUrl, DEFAULT_PRIMARY_URL)
                .distinct()

        val encodedQuery = URLEncoder.encode(query.trim(), "UTF-8")

        // ------------------------------------------------------------
        // 1. PRIMARY SABDHAM / VERIFIED MUSIC CATALOG SEARCH
        // ------------------------------------------------------------
        for (baseUrl in endpointsToTry) {
            try {
                val urlString =
                    "$baseUrl/api/youtube/search?q=$encodedQuery&language=$language&maxResults=$maxResults"

                val connection =
                    URL(urlString).openConnection() as HttpURLConnection

                connection.requestMethod = "GET"
                connection.connectTimeout = 4000
                connection.readTimeout = 4000

                if (connection.responseCode == 200) {

                    val response =
                        connection.inputStream.bufferedReader().use {
                            it.readText()
                        }

                    val json = JSONObject(response)
                    val items = json.optJSONArray("tracks")

                    if (items != null) {
                        for (i in 0 until items.length()) {

                            val item = items.getJSONObject(i)

                            val id = item.optString("id")
                            val title = item.optString("title")

                            if (id.isBlank() || title.isBlank()) continue

                            catalogTracks.add(
                                Track(
                                    id = id,
                                    title = title,
                                    artist = item.optString(
                                        "artist",
                                        "Unknown Artist"
                                    ),
                                    album = item.optString(
                                        "album",
                                        "Single"
                                    ),
                                    movie = item.optString("movie"),
                                    durationSeconds =
                                        item.optLong("duration", 180),
                                    durationFormatted =
                                        item.optString(
                                            "durationFormatted",
                                            ""
                                        ),
                                    coverUrl =
                                        item.optString("coverUrl"),
                                    audioUrl =
                                        item.optString("audioUrl"),
                                    youtubeVideoId =
                                        item.optString(
                                            "youtubeVideoId"
                                        ),
                                    language =
                                        item.optString(
                                            "language",
                                            "english"
                                        ),
                                    genre =
                                        item.optString(
                                            "genre",
                                            "Music"
                                        )
                                )
                            )
                        }
                    }

                    // A working backend answered.
                    break
                }

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // ------------------------------------------------------------
        // 2. YOUTUBE DISCOVERY FALLBACK
        //
        // Search YouTube as well so songs missing from the normal
        // catalog can still appear in SABDHAM.
        //
        // IMPORTANT:
        // YouTube thumbnail is intentionally NOT copied to coverUrl.
        // Playback can use YouTube, artwork cannot.
        // ------------------------------------------------------------
        if (page == 1) {

            for (baseUrl in endpointsToTry) {
                try {
                    val urlString =
                        "$baseUrl/api/youtube/search?q=$encodedQuery&language=$language&maxResults=$maxResults"

                    val connection =
                        URL(urlString).openConnection() as HttpURLConnection

                    connection.requestMethod = "GET"
                    connection.connectTimeout = 4000
                connection.readTimeout = 4000

                    if (connection.responseCode == 200) {

                        val response =
                            connection.inputStream.bufferedReader().use {
                                it.readText()
                            }

                        val json = JSONObject(response)
                        val items = json.optJSONArray("tracks")

                        if (items != null) {

                            for (i in 0 until items.length()) {

                                val item =
                                    items.getJSONObject(i)

                                val videoId =
                                    item.optString(
                                        "youtubeVideoId",
                                        item.optString(
                                            "audio_source_id"
                                        )
                                    )

                                val title =
                                    item.optString("title")

                                if (
                                    videoId.isBlank() ||
                                    title.isBlank()
                                ) {
                                    continue
                                }

                                youtubeTracks.add(
                                    Track(
                                        id =
                                            item.optString(
                                                "id",
                                                "yt-$videoId"
                                            ),

                                        title = title,

                                        artist =
                                            item.optString(
                                                "artist",
                                                "Unknown Artist"
                                            ),

                                        album =
                                            item.optString(
                                                "album",
                                                "YouTube Audio"
                                            ),

                                        durationSeconds =
                                            item.optLong(
                                                "duration",
                                                180
                                            ),

                                        durationFormatted =
                                            item.optString(
                                                "durationFormatted",
                                                ""
                                            ),

                                        // NEVER USE YOUTUBE THUMBNAILS
                                        coverUrl = "",

                                        audioUrl =
                                            item.optString(
                                                "audioUrl",
                                                "yt:$videoId"
                                            ),

                                        youtubeVideoId =
                                            videoId,

                                        language =
                                            item.optString(
                                                "language",
                                                language
                                            ),

                                        genre =
                                            item.optString(
                                                "genre",
                                                "Music"
                                            )
                                    )
                                )
                            }
                        }

                        break
                    }

                } catch (e: Exception) {
                    android.util.Log.w(
                        "SABDHAM_SEARCH",
                        "YouTube fallback failed for $baseUrl",
                        e
                    )
                }
            }
        }

        // ------------------------------------------------------------
        // 3. MERGE + REMOVE DUPLICATES
        //
        // Catalog stays first because it has verified metadata/artwork.
        // YouTube fills songs missing from the catalog.
        // ------------------------------------------------------------

        val combined =
            (catalogTracks + youtubeTracks)
                .distinctBy { track ->
                    (
                        track.title.trim().lowercase() +
                        "|" +
                        track.artist.trim().lowercase()
                    )
                }
                .take(maxResults)

        android.util.Log.d(
            "SABDHAM_SEARCH",
            "query=$query catalog=${catalogTracks.size} youtube=${youtubeTracks.size} combined=${combined.size}"
        )

        combined
    }

    suspend fun searchPlaylists(
        query: String,
        maxResults: Int = 12
    ): List<SearchPlaylistResult> = withContext(Dispatchers.IO) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) {
            return@withContext emptyList()
        }

        val encodedQuery =
            URLEncoder.encode(trimmed, "UTF-8")

        val endpointsToTry =
            listOf(activeBackendUrl, DEFAULT_PRIMARY_URL)
                .distinct()

        for (baseUrl in endpointsToTry) {
            var connection: HttpURLConnection? = null

            try {
                val urlString =
                    "$baseUrl/api/youtube/search-playlists" +
                        "?q=$encodedQuery&maxResults=" +
                        maxResults.coerceIn(1, 20)

                connection =
                    URL(urlString).openConnection() as HttpURLConnection

                connection.requestMethod = "GET"
                connection.connectTimeout = 4500
                connection.readTimeout = 4500
                connection.setRequestProperty(
                    "Accept",
                    "application/json"
                )

                if (connection.responseCode != 200) {
                    continue
                }

                val response =
                    connection.inputStream
                        .bufferedReader()
                        .use { it.readText() }

                val json = JSONObject(response)
                val items =
                    json.optJSONArray("playlists")
                        ?: return@withContext emptyList()

                val results =
                    mutableListOf<SearchPlaylistResult>()

                for (index in 0 until items.length()) {
                    val item = items.optJSONObject(index) ?: continue

                    val id = item.optString("id").trim()
                    val title = item.optString("title").trim()

                    if (id.isBlank() || title.isBlank()) {
                        continue
                    }

                    results +=
                        SearchPlaylistResult(
                            id = id,
                            title = title,
                            owner =
                                item.optString(
                                    "owner",
                                    "YouTube"
                                ),
                            itemCount =
                                item.optInt(
                                    "itemCount",
                                    0
                                ).coerceAtLeast(0),
                            source =
                                item.optString(
                                    "source",
                                    "youtube"
                                )
                        )
                }

                return@withContext results
                    .distinctBy { it.id }
                    .take(maxResults.coerceIn(1, 20))
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_PLAYLIST_SEARCH",
                    "Playlist search failed for $baseUrl",
                    e
                )
            } finally {
                connection?.disconnect()
            }
        }

        emptyList()
    }

    suspend fun fetchPlaylistTracks(
        playlistId: String,
        maxResults: Int = 100
    ): List<Track> = withContext(Dispatchers.IO) {
        val cleanId = playlistId.trim()

        if (cleanId.isBlank()) {
            return@withContext emptyList()
        }

        val encodedId =
            URLEncoder.encode(cleanId, "UTF-8")

        val endpointsToTry =
            listOf(activeBackendUrl, DEFAULT_PRIMARY_URL)
                .distinct()

        for (baseUrl in endpointsToTry) {
            var connection: HttpURLConnection? = null

            try {
                val urlString =
                    "$baseUrl/api/youtube/playlist" +
                        "?id=$encodedId&maxResults=" +
                        maxResults.coerceIn(20, 100)

                connection =
                    URL(urlString).openConnection() as HttpURLConnection

                connection.requestMethod = "GET"
                connection.connectTimeout = 10000
                connection.readTimeout =
                    if (maxResults > 20) 30000 else 15000
                connection.setRequestProperty(
                    "Accept",
                    "application/json"
                )

                if (connection.responseCode != 200) {
                    continue
                }

                val response =
                    connection.inputStream
                        .bufferedReader()
                        .use { it.readText() }

                val json = JSONObject(response)
                val items =
                    json.optJSONArray("tracks")
                        ?: return@withContext emptyList()

                val tracks = mutableListOf<Track>()

                for (index in 0 until items.length()) {
                    val item = items.optJSONObject(index) ?: continue

                    val id = item.optString("id").trim()
                    val title = item.optString("title").trim()

                    if (id.isBlank() || title.isBlank()) {
                        continue
                    }

                    val youtubeVideoId =
                        item.optString(
                            "youtubeVideoId",
                            item.optString("audio_source_id")
                        ).trim()

                    tracks +=
                        Track(
                            id = id,
                            title = title,
                            artist =
                                item.optString(
                                    "artist",
                                    "Unknown Artist"
                                ),
                            album =
                                item.optString(
                                    "album",
                                    "Playlist"
                                ),
                            movie = item.optString("movie"),
                            durationSeconds =
                                item.optLong(
                                    "duration",
                                    180
                                ),
                            durationFormatted =
                                item.optString(
                                    "durationFormatted",
                                    ""
                                ),
                            // Preserve SABDHAM artwork policy:
                            // never use YouTube thumbnails.
                            coverUrl = "",
                            audioUrl =
                                item.optString(
                                    "audioUrl",
                                    if (youtubeVideoId.isNotBlank()) {
                                        "yt:$youtubeVideoId"
                                    } else {
                                        ""
                                    }
                                ),
                            youtubeVideoId = youtubeVideoId,
                            language =
                                item.optString(
                                    "language",
                                    "all"
                                ),
                            genre =
                                item.optString(
                                    "genre",
                                    "Playlist"
                                )
                        )
                }

                return@withContext tracks.distinctBy { it.id }
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_PLAYLIST_SEARCH",
                    "Playlist load failed for $baseUrl id=$cleanId",
                    e
                )
            } finally {
                connection?.disconnect()
            }
        }

        emptyList()
    }
}
