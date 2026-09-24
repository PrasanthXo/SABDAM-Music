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
object MusicSearchService {

    const val DEFAULT_PRIMARY_URL = "https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app"
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

    suspend fun searchSongs(query: String, language: String = "all"): List<Track> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<Track>()
        val endpointsToTry = listOf(activeBackendUrl, DEFAULT_PRIMARY_URL, DEFAULT_DEV_URL).distinct()

        for (baseUrl in endpointsToTry) {
            try {
                val encodedQuery = URLEncoder.encode(query, "UTF-8")
                val urlString = "$baseUrl/api/youtube/search?q=$encodedQuery&language=$language"
                val connection = URL(urlString).openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 8000
                connection.readTimeout = 8000

                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(response)
                    val items = json.optJSONArray("tracks") ?: continue
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        val id = item.optString("id")
                        val title = item.optString("title")
                        val artist = item.optString("artist")
                        val album = item.optString("album", "Single")
                        val duration = item.optLong("duration", 180)
                        val coverUrl = item.optString("coverUrl")
                        val audioUrl = item.optString("audioUrl")
                        val lang = item.optString("language", "english")

                        tracks.add(
                            Track(
                                id = id,
                                title = title,
                                artist = artist,
                                album = album,
                                durationSeconds = duration,
                                coverUrl = coverUrl,
                                audioUrl = audioUrl,
                                language = lang
                            )
                        )
                    }
                    if (tracks.isNotEmpty()) {
                        break // successfully fetched
                    }
                }
            } catch (e: Exception) {
                // Fallback to next candidate endpoint if one fails
                e.printStackTrace()
            }
        }
        tracks
    }
}
