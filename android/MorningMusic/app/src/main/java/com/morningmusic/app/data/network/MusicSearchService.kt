package com.morningmusic.app.data.network

import android.content.Context
import android.content.SharedPreferences
import com.morningmusic.app.data.model.Track
import kotlinx.coroutines.Dispatchers
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
}
