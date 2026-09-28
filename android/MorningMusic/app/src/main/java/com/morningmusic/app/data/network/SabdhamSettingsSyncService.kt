package com.morningmusic.app.data.network

import android.content.Context
import com.morningmusic.app.auth.SabdhamAuthService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object SabdhamSettingsSyncService {

    private const val BASE_URL =
        "https://sabdham-backend.onrender.com"

    private const val MAIN_PREFS =
        "sabdham_app_settings"

    private const val EQ_PREFS =
        "sabdham_equalizer_settings"

    private val requiredKeys = listOf(
        "audioQuality",
        "crossfade",
        "gapless",
        "autoplay",
        "volumeNormalization",
        "wifiOnlyDownloads",
        "mobileStreaming",
        "downloadQuality",
        "themeMode",
        "equalizerEnabled",
        "equalizerPreset",
        "eqBass",
        "eqLowMid",
        "eqMid",
        "eqHighMid",
        "eqTreble",
        "offlineMode"
    )

    private fun defaults(): JSONObject =
        JSONObject().apply {
            put("audioQuality", "Normal")

            put("crossfade", false)
            put("gapless", false)
            put("autoplay", false)
            put("volumeNormalization", false)

            put("wifiOnlyDownloads", false)
            put("mobileStreaming", false)

            put("downloadQuality", "Normal")
            put("themeMode", "Dark")

            put("equalizerEnabled", false)
            put("equalizerPreset", "Flat")

            put("eqBass", 0.0)
            put("eqLowMid", 0.0)
            put("eqMid", 0.0)
            put("eqHighMid", 0.0)
            put("eqTreble", 0.0)

            put("offlineMode", false)
        }

    private fun mergeWithDefaults(
        remote: JSONObject?
    ): JSONObject {
        val merged = defaults()

        if (remote != null) {
            val keys = remote.keys()

            while (keys.hasNext()) {
                val key = keys.next()
                merged.put(key, remote.opt(key))
            }
        }

        return merged
    }

    private fun saveToLocal(
        context: Context,
        settings: JSONObject
    ) {
        context
            .getSharedPreferences(
                MAIN_PREFS,
                Context.MODE_PRIVATE
            )
            .edit()
            .putBoolean(
                "crossfade",
                settings.optBoolean("crossfade", false)
            )
            .putBoolean(
                "gapless",
                settings.optBoolean("gapless", false)
            )
            .putBoolean(
                "autoplay",
                settings.optBoolean("autoplay", false)
            )
            .putBoolean(
                "volume_normalization",
                settings.optBoolean(
                    "volumeNormalization",
                    false
                )
            )
            .putBoolean(
                "wifi_only_downloads",
                settings.optBoolean(
                    "wifiOnlyDownloads",
                    false
                )
            )
            .putBoolean(
                "mobile_streaming",
                settings.optBoolean(
                    "mobileStreaming",
                    false
                )
            )
            .putString(
                "playback_quality",
                settings.optString(
                    "audioQuality",
                    "Normal"
                )
            )
            .putString(
                "download_quality",
                settings.optString(
                    "downloadQuality",
                    "Normal"
                )
            )
            .putString(
                "theme_mode",
                settings.optString(
                    "themeMode",
                    "Dark"
                )
            )
            .putBoolean(
                "offline_mode",
                settings.optBoolean(
                    "offlineMode",
                    false
                )
            )
            .apply()

        context
            .getSharedPreferences(
                EQ_PREFS,
                Context.MODE_PRIVATE
            )
            .edit()
            .putBoolean(
                "equalizer_enabled",
                settings.optBoolean(
                    "equalizerEnabled",
                    false
                )
            )
            .putString(
                "equalizer_preset",
                settings.optString(
                    "equalizerPreset",
                    "Flat"
                )
            )
            .putFloat(
                "eq_bass",
                settings.optDouble(
                    "eqBass",
                    0.0
                ).toFloat()
            )
            .putFloat(
                "eq_low_mid",
                settings.optDouble(
                    "eqLowMid",
                    0.0
                ).toFloat()
            )
            .putFloat(
                "eq_mid",
                settings.optDouble(
                    "eqMid",
                    0.0
                ).toFloat()
            )
            .putFloat(
                "eq_high_mid",
                settings.optDouble(
                    "eqHighMid",
                    0.0
                ).toFloat()
            )
            .putFloat(
                "eq_treble",
                settings.optDouble(
                    "eqTreble",
                    0.0
                ).toFloat()
            )
            .apply()
    }

    private fun readFromLocal(
        context: Context
    ): JSONObject {
        val main =
            context.getSharedPreferences(
                MAIN_PREFS,
                Context.MODE_PRIVATE
            )

        val eq =
            context.getSharedPreferences(
                EQ_PREFS,
                Context.MODE_PRIVATE
            )

        return JSONObject().apply {
            put(
                "audioQuality",
                main.getString(
                    "playback_quality",
                    "Normal"
                ) ?: "Normal"
            )

            put(
                "crossfade",
                main.getBoolean(
                    "crossfade",
                    false
                )
            )

            put(
                "gapless",
                main.getBoolean(
                    "gapless",
                    false
                )
            )

            put(
                "autoplay",
                main.getBoolean(
                    "autoplay",
                    false
                )
            )

            put(
                "volumeNormalization",
                main.getBoolean(
                    "volume_normalization",
                    false
                )
            )

            put(
                "wifiOnlyDownloads",
                main.getBoolean(
                    "wifi_only_downloads",
                    false
                )
            )

            put(
                "mobileStreaming",
                main.getBoolean(
                    "mobile_streaming",
                    false
                )
            )

            put(
                "downloadQuality",
                main.getString(
                    "download_quality",
                    "Normal"
                ) ?: "Normal"
            )

            put(
                "themeMode",
                main.getString(
                    "theme_mode",
                    "Dark"
                ) ?: "Dark"
            )

            put(
                "equalizerEnabled",
                eq.getBoolean(
                    "equalizer_enabled",
                    false
                )
            )

            put(
                "equalizerPreset",
                eq.getString(
                    "equalizer_preset",
                    "Flat"
                ) ?: "Flat"
            )

            put(
                "eqBass",
                eq.getFloat(
                    "eq_bass",
                    0f
                ).toDouble()
            )

            put(
                "eqLowMid",
                eq.getFloat(
                    "eq_low_mid",
                    0f
                ).toDouble()
            )

            put(
                "eqMid",
                eq.getFloat(
                    "eq_mid",
                    0f
                ).toDouble()
            )

            put(
                "eqHighMid",
                eq.getFloat(
                    "eq_high_mid",
                    0f
                ).toDouble()
            )

            put(
                "eqTreble",
                eq.getFloat(
                    "eq_treble",
                    0f
                ).toDouble()
            )

            put(
                "offlineMode",
                main.getBoolean(
                    "offline_mode",
                    false
                )
            )
        }
    }

    private fun getUserData(
        token: String
    ): JSONObject? {
        val connection =
            URL("$BASE_URL/api/user/data")
                .openConnection() as HttpURLConnection

        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000

            connection.setRequestProperty(
                "Accept",
                "application/json"
            )

            connection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            val code = connection.responseCode

            val stream =
                if (code in 200..299) {
                    connection.inputStream
                } else {
                    connection.errorStream
                }

            val text =
                stream
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    .orEmpty()

            if (code !in 200..299 ||
                text.isBlank()
            ) {
                null
            } else {
                JSONObject(text)
                    .optJSONObject("data")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun postUserData(
        token: String,
        data: JSONObject
    ): Boolean {
        val connection =
            URL("$BASE_URL/api/user/data")
                .openConnection() as HttpURLConnection

        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.doOutput = true

            connection.setRequestProperty(
                "Accept",
                "application/json"
            )

            connection.setRequestProperty(
                "Content-Type",
                "application/json"
            )

            connection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            connection.outputStream.use {
                it.write(
                    data.toString()
                        .toByteArray(Charsets.UTF_8)
                )
            }

            connection.responseCode in 200..299
        } finally {
            connection.disconnect()
        }
    }

    suspend fun syncFromServer(
        context: Context
    ): Boolean =
        withContext(Dispatchers.IO) {

            try {
                val token =
                    SabdhamAuthService
                        .getToken(context)
                        ?: return@withContext false

                val data =
                    getUserData(token)
                        ?: return@withContext false

                val remote =
                    data.optJSONObject("settings")

                val merged =
                    mergeWithDefaults(remote)

                saveToLocal(
                    context,
                    merged
                )

                val requiresServerUpdate =
                    remote == null ||
                        requiredKeys.any {
                            !remote.has(it)
                        }

                if (requiresServerUpdate) {
                    data.put(
                        "settings",
                        merged
                    )

                    postUserData(
                        token,
                        data
                    )
                }

                true

            } catch (_: Exception) {
                false
            }
        }

    suspend fun saveFromLocal(
        context: Context
    ): Boolean =
        withContext(Dispatchers.IO) {

            try {
                val token =
                    SabdhamAuthService
                        .getToken(context)
                        ?: return@withContext false

                /*
                 * Always GET the complete current account first.
                 * This preserves liked songs, playlists, recents,
                 * and custom songs while only changing settings.
                 */
                val data =
                    getUserData(token)
                        ?: return@withContext false

                data.put(
                    "settings",
                    readFromLocal(context)
                )

                postUserData(
                    token,
                    data
                )

            } catch (_: Exception) {
                false
            }
        }
}
