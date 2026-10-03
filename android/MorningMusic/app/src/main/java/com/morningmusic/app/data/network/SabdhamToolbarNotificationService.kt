package com.morningmusic.app.data.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class SabdhamToolbarNotification(
    val id: String,
    val title: String,
    val message: String,
    val type: String,
    val createdAt: String
)

object SabdhamToolbarNotificationService {
    private const val ENDPOINT =
        "https://sabdham-backend.onrender.com/api/toolbar-notifications"

    suspend fun fetchActive(): List<SabdhamToolbarNotification> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection =
                    (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 7_000
                        readTimeout = 7_000
                        setRequestProperty("Accept", "application/json")
                        setRequestProperty("Cache-Control", "no-cache")
                    }

                try {
                    if (connection.responseCode !in 200..299) {
                        return@runCatching emptyList()
                    }

                    val body =
                        connection.inputStream
                            .bufferedReader()
                            .use { it.readText() }

                    val root = JSONObject(body)
                    val array = root.optJSONArray("notifications")
                        ?: return@runCatching emptyList()

                    buildList {
                        for (index in 0 until array.length()) {
                            val item = array.optJSONObject(index) ?: continue
                            val id = item.optString("id").trim()
                            val title = item.optString("title").trim()
                            val message = item.optString("message").trim()

                            if (
                                id.isBlank() ||
                                title.isBlank() ||
                                message.isBlank()
                            ) {
                                continue
                            }

                            add(
                                SabdhamToolbarNotification(
                                    id = id,
                                    title = title,
                                    message = message,
                                    type = item.optString("type", "info")
                                        .trim()
                                        .lowercase(),
                                    createdAt = item.optString("createdAt").trim()
                                )
                            )
                        }
                    }
                } finally {
                    connection.disconnect()
                }
            }.getOrDefault(emptyList())
        }
}
