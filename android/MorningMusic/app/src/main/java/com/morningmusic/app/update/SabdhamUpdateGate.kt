package com.morningmusic.app.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.pm.PackageInfoCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val UPDATE_ENDPOINT =
    "https://sabdham-backend.onrender.com/api/app/update"

data class SabdhamUpdateInfo(
    val latestVersionCode: Int,
    val minimumVersionCode: Int,
    val latestVersionName: String,
    val downloadUrl: String,
    val forceUpdate: Boolean,
    val message: String,
    val releaseNotes: List<String>
)

object SabdhamUpdateCenter {
    var optionalUpdate by mutableStateOf<SabdhamUpdateInfo?>(null)
        private set

    internal fun publish(
        info: SabdhamUpdateInfo?,
        currentVersionCode: Int
    ) {
        optionalUpdate =
            info?.takeIf {
                it.latestVersionCode > currentVersionCode &&
                    !it.forceUpdate &&
                    currentVersionCode >= it.minimumVersionCode
            }
    }
}

@Composable
fun SabdhamUpdateGate() {
    val context = LocalContext.current
    val packageInfo = remember(context) {
        context.packageManager.getPackageInfo(context.packageName, 0)
    }
    val currentVersionCode = remember(packageInfo) {
        PackageInfoCompat.getLongVersionCode(packageInfo).toInt()
    }
    val currentVersionName = remember(packageInfo) {
        packageInfo.versionName ?: currentVersionCode.toString()
    }

    var updateInfo by remember { mutableStateOf<SabdhamUpdateInfo?>(null) }

    LaunchedEffect(currentVersionCode, currentVersionName) {
        val fetchedInfo =
            runCatching {
                fetchUpdateInfo(
                    currentVersionCode = currentVersionCode,
                    currentVersionName = currentVersionName
                )
            }.getOrNull()

        updateInfo = fetchedInfo
        SabdhamUpdateCenter.publish(
            info = fetchedInfo,
            currentVersionCode = currentVersionCode
        )
    }

    val info = updateInfo ?: return
    if (info.latestVersionCode <= currentVersionCode) return

    val isRequired =
        info.forceUpdate || currentVersionCode < info.minimumVersionCode

    // Optional updates are announced inside the SABDHAM notification bell.
    // Keep this dialog only for genuinely required updates.
    if (!isRequired) return

    BackHandler(enabled = isRequired) {
        // Required updates cannot be dismissed with the Android back button.
    }

    AlertDialog(
        onDismissRequest = {
            // Major/required updates stay on screen until the user updates.
        },
        title = {
            Text(
                text = "Update required",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "SABDHAM ${info.latestVersionName}",
                    fontWeight = FontWeight.Bold
                )

                if (info.message.isNotBlank()) {
                    Text(info.message)
                }

                if (info.releaseNotes.isNotEmpty()) {
                    Text(
                        text = "What's new",
                        modifier = Modifier.padding(top = 4.dp),
                        fontWeight = FontWeight.Bold
                    )

                    info.releaseNotes.forEach { note ->
                        Text("• $note")
                    }
                }

                if (isRequired) {
                    Text(
                        text = "This version of SABDHAM is no longer supported. Download the latest version to continue.",
                        modifier = Modifier.padding(top = 4.dp),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    openSabdhamHiddenDownloadLink(context, info.downloadUrl)
                }
            ) {
                Text("Download update")
            }
        },
        dismissButton = {}
    )
}

private suspend fun fetchUpdateInfo(
    currentVersionCode: Int,
    currentVersionName: String
): SabdhamUpdateInfo =
    withContext(Dispatchers.IO) {
        val connection = (URL(UPDATE_ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 7_000
            readTimeout = 7_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-cache")
        }

        try {
            if (connection.responseCode !in 200..299) {
                error("Update service returned HTTP ${connection.responseCode}")
            }

            val body = connection.inputStream
                .bufferedReader()
                .use { it.readText() }

            val json = JSONObject(body)
            val notesJson = json.optJSONArray("releaseNotes")
            val notes = buildList {
                if (notesJson != null) {
                    for (index in 0 until notesJson.length()) {
                        val note = notesJson.optString(index).trim()
                        if (note.isNotEmpty()) add(note)
                    }
                }
            }

            SabdhamUpdateInfo(
                latestVersionCode = json.optInt("latestVersionCode", currentVersionCode),
                minimumVersionCode = json.optInt("minimumVersionCode", 0),
                latestVersionName = json.optString(
                    "latestVersionName",
                    currentVersionName
                ),
                downloadUrl = json.optString("downloadUrl").trim(),
                forceUpdate = json.optBoolean("forceUpdate", false),
                message = json.optString("message").trim(),
                releaseNotes = notes
            )
        } finally {
            connection.disconnect()
        }
    }

fun openSabdhamHiddenDownloadLink(
    context: Context,
    downloadUrl: String
) {
    val uri = runCatching { Uri.parse(downloadUrl) }.getOrNull() ?: return
    if (uri.scheme != "https") return

    // The direct GitHub APK URL is used internally and is never rendered in the UI.
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    runCatching {
        context.startActivity(intent)
    }
}
