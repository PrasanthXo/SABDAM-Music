package com.morningmusic.app.data.network

import android.content.Context
import com.morningmusic.app.auth.SabdhamAuthService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class SupportReportResult(
    val success: Boolean,
    val message: String,
    val reference: String? = null
)

object SabdhamSupportService {
    private const val BASE_URL =
        "https://sabdham-backend.onrender.com"

    suspend fun sendReport(
        context: Context,
        report: String
    ): SupportReportResult = withContext(Dispatchers.IO) {
        val token = SabdhamAuthService.getToken(context)

        if (token.isNullOrBlank()) {
            return@withContext SupportReportResult(
                false,
                "Please sign in before sending a support report."
            )
        }

        val connection =
            URL("$BASE_URL/api/support/report")
                .openConnection() as HttpURLConnection

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.doOutput = true
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty(
                "Authorization",
                "Bearer $token"
            )

            val payload = JSONObject()
                .put("report", report.trim())

            connection.outputStream.use {
                it.write(
                    payload.toString()
                        .toByteArray(Charsets.UTF_8)
                )
            }

            val status = connection.responseCode
            val stream =
                if (status in 200..299)
                    connection.inputStream
                else
                    connection.errorStream

            val text =
                stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            val json = try {
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } catch (_: Exception) {
                JSONObject()
            }

            if (status in 200..299 && json.optBoolean("success")) {
                SupportReportResult(
                    true,
                    json.optString(
                        "message",
                        "Report sent to SABDHAM Support."
                    ),
                    json.optString("reference")
                        .takeIf { it.isNotBlank() }
                )
            } else {
                SupportReportResult(
                    false,
                    json.optString(
                        "error",
                        "Unable to send report right now."
                    )
                )
            }
        } catch (_: Exception) {
            SupportReportResult(
                false,
                "Unable to connect to SABDHAM Support. Check your internet connection."
            )
        } finally {
            connection.disconnect()
        }
    }
}
