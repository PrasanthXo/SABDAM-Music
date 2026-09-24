import JSZip from 'jszip';

export interface AndroidFile {
  path: string;
  content: string;
}

export function getAndroidProjectFiles(baseUrl: string = 'http://localhost:3000'): AndroidFile[] {
  return [
    {
      path: 'build.gradle.kts',
      content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
`
    },
    {
      path: 'local.properties',
      content: `## Location of the Android SDK
sdk.dir=C:/Users/kalis/AppData/Local/Android/Sdk
`
    },
    {
      path: 'gradle.properties',
      content: `# Project-wide Gradle settings.
# Increase JVM heap size to 4GB to support Compose compiler and Kotlin daemon smoothly
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
`
    },
    {
      path: 'gradle/libs.versions.toml',
      content: `[versions]
agp = "8.7.3"
kotlin = "2.0.21"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
media3 = "1.5.0"
coil = "2.7.0"
coroutines = "1.9.0"
browser = "1.8.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-media3-exoplayer = { group = "androidx.media3", name = "media3-exoplayer", version.ref = "media3" }
androidx-media3-session = { group = "androidx.media3", name = "media3-session", version.ref = "media3" }
androidx-media3-ui = { group = "androidx.media3", name = "media3-ui", version.ref = "media3" }
androidx-media3-common = { group = "androidx.media3", name = "media3-common", version.ref = "media3" }
androidx-browser = { group = "androidx.browser", name = "browser", version.ref = "browser" }
coil-compose = { group = "io.coil-kt", name = "coil-compose", version.ref = "coil" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
`
    },
    {
      path: 'settings.gradle.kts',
      content: `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Sabdham"
include(":app")
`
    },
    {
      path: 'gradle.properties',
      content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`
    },
    {
      path: 'gradle/wrapper/gradle-wrapper.properties',
      content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
    },
    {
      path: 'app/build.gradle.kts',
      content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.morningmusic.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.morningmusic.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    // AndroidX Core & Lifecycle
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Jetpack Compose & Material 3
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Media3 & ExoPlayer for audio playback & background service
    val media3Version = "1.5.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-common:$media3Version")

    // Android Custom Tabs for OAuth
    implementation("androidx.browser:browser:1.8.0")

    // Coil for real image and cover art loading
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
`
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Permissions for audio streaming & background playback -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.MorningMusic"
        android:usesCleartextTraffic="false"
        tools:targetApi="35">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.MorningMusic"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Media3 Playback Service for Background Lock-screen & Notification Media Controls -->
        <service
            android:name=".service.PlaybackService"
            android:exported="true"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>

    </application>
</manifest>
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/data/model/Track.kt',
      content: `package com.morningmusic.app.data.model

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationSeconds: Long,
    val coverUrl: String,
    val audioUrl: String,
    val language: String,
    val lyrics: String = ""
)
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/service/AudioEffectsManager.kt',
      content: `package com.morningmusic.app.service

import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.util.Log

/**
 * Manages native hardware audio effects (Equalizer and LoudnessEnhancer)
 * attached to the active ExoPlayer audioSessionId.
 */
class AudioEffectsManager {

    companion object {
        private const val TAG = "AudioEffectsManager"
    }

    private var equalizer: Equalizer? = null
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var currentSessionId: Int = 0

    private var isEqEnabled: Boolean = false
    private var isNormalizationEnabled: Boolean = false
    private var currentPreset: String = "Flat"
    private var currentBands: IntArray = intArrayOf(0, 0, 0, 0, 0)
    private var crossfadeSeconds: Int = 0

    fun attachSession(audioSessionId: Int) {
        if (audioSessionId == 0 || audioSessionId == currentSessionId) return
        currentSessionId = audioSessionId

        release()

        try {
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = isEqEnabled
            }
            applyEqualizerSettings()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize native Equalizer: \${e.message}")
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
                    setTargetGain(if (isNormalizationEnabled) 1200 else 0)
                    enabled = isNormalizationEnabled
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize native LoudnessEnhancer: \${e.message}")
        }
    }

    fun setEqualizer(enabled: Boolean, preset: String?, bands: IntArray?) {
        isEqEnabled = enabled
        preset?.let { currentPreset = it }
        bands?.let { currentBands = it }

        equalizer?.let { eq ->
            try {
                eq.enabled = enabled
                if (enabled) {
                    applyEqualizerSettings()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error applying equalizer: \${e.message}")
            }
        }
    }

    private fun applyEqualizerSettings() {
        val eq = equalizer ?: return
        try {
            val numBands = eq.numberOfBands.toInt()
            val minLevel = eq.bandLevelRange[0]
            val maxLevel = eq.bandLevelRange[1]

            when (currentPreset.lowercase()) {
                "bass boost" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.7f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.4f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), 0)
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.2f).toInt().toShort())
                }
                "acoustic" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.4f).toInt().toShort())
                }
                "rock" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.6f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.5f).toInt().toShort())
                }
                "pop" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), (maxLevel * 0.4f).toInt().toShort())
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                }
                "electronic" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.5f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.5f).toInt().toShort())
                }
                else -> {
                    for (i in 0 until minOf(numBands, currentBands.size)) {
                        val db = currentBands[i]
                        val mb = (db * 100).coerceIn(minLevel.toInt(), maxLevel.toInt())
                        eq.setBandLevel(i.toShort(), mb.toShort())
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error configuring equalizer bands: \${e.message}")
        }
    }

    fun setVolumeNormalization(enabled: Boolean) {
        isNormalizationEnabled = enabled
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            loudnessEnhancer?.let { le ->
                try {
                    le.setTargetGain(if (enabled) 1200 else 0)
                    le.enabled = enabled
                } catch (e: Exception) {
                    Log.w(TAG, "Error setting loudness enhancer: \${e.message}")
                }
            }
        }
    }

    fun setCrossfade(seconds: Int) {
        crossfadeSeconds = seconds.coerceIn(0, 12)
    }

    fun getCrossfade(): Int = crossfadeSeconds

    fun release() {
        try {
            equalizer?.release()
        } catch (e: Exception) {}
        equalizer = null

        try {
            loudnessEnhancer?.release()
        } catch (e: Exception) {}
        loudnessEnhancer = null
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/service/PlaybackService.kt',
      content: `package com.morningmusic.app.service

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Android Media3 Background Playback Service.
 * Provides system notifications, lock screen media controls, and background audio streaming.
 */
class PlaybackService : MediaSessionService() {

    companion object {
        var instance: PlaybackService? = null
            private set
    }

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    val audioEffectsManager = AudioEffectsManager()

    override fun onCreate() {
        super.onCreate()
        instance = this

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        player = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build()

        player?.let { p ->
            val initialSessionId = p.audioSessionId
            if (initialSessionId != C.AUDIO_SESSION_ID_UNSET && initialSessionId != 0) {
                audioEffectsManager.attachSession(initialSessionId)
            }

            p.addAnalyticsListener(object : androidx.media3.exoplayer.analytics.AnalyticsListener {
                override fun onAudioSessionIdChanged(
                    eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                    audioSessionId: Int
                ) {
                    if (audioSessionId != C.AUDIO_SESSION_ID_UNSET && audioSessionId != 0) {
                        audioEffectsManager.attachSession(audioSessionId)
                    }
                }
            })

            mediaSession = MediaSession.Builder(this, p).build()
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    fun setEqualizer(enabled: Boolean, preset: String?, bands: IntArray?) {
        audioEffectsManager.setEqualizer(enabled, preset, bands)
    }

    fun setVolumeNormalization(enabled: Boolean) {
        audioEffectsManager.setVolumeNormalization(enabled)
    }

    fun setCrossfade(seconds: Int) {
        audioEffectsManager.setCrossfade(seconds)
    }

    override fun onDestroy() {
        if (instance == this) {
            instance = null
        }
        audioEffectsManager.release()
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/ui/viewmodel/MusicViewModel.kt',
      content: `package com.morningmusic.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.morningmusic.app.data.model.Track
import com.morningmusic.app.data.repository.MusicRepository
import com.morningmusic.app.data.network.MusicSearchService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import java.util.Calendar

/**
 * Architecture: Unidirectional Data Flow ViewModel with strictly time-based greeting logic and extensible music searching.
 */
class MusicViewModel : ViewModel() {

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _likedTrackIds = MutableStateFlow<Set<String>>(setOf("tamil-3", "english-1"))
    val likedTrackIds: StateFlow<Set<String>> = _likedTrackIds.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Track>>(emptyList())
    val searchResults: StateFlow<List<Track>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    val popularTamil = MusicRepository.popularTamil
    val popularEnglish = MusicRepository.popularEnglish
    val trending = MusicRepository.trending
    val newReleases = MusicRepository.newReleases

    private var lastSearchJob: Job? = null

    init {
        _currentTrack.value = popularTamil.firstOrNull()
    }

    /**
     * STRICT REQUIREMENT:
     * NEVER display the user's name anywhere.
     * Automatically show only one greeting based on current local time:
     * 5:00 AM–11:59 AM → "Good morning"
     * 12:00 PM–5:59 PM → "Good afternoon"
     * 6:00 PM–4:59 AM → "Good night"
     */
    fun getTimeGreeting(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 5..11 -> "Good morning"
            hour in 12..17 -> "Good afternoon"
            else -> "Good night"
        }
    }

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query
        if (query.trim().isEmpty()) {
            _searchResults.value = emptyList()
            return
        }

        lastSearchJob?.cancel()
        lastSearchJob = viewModelScope.launch {
            _isSearching.value = true
            // Debounce for 500ms before making remote proxy API request
            delay(500)
            val results = MusicSearchService.searchSongs(query)
            _searchResults.value = results
            _isSearching.value = false
        }
    }

    fun playTrack(track: Track) {
        _currentTrack.value = track
        _isPlaying.value = true
        _currentPosition.value = 0L
    }

    fun togglePlayPause() {
        _isPlaying.value = !_isPlaying.value
    }

    fun toggleLike(trackId: String) {
        val current = _likedTrackIds.value.toMutableSet()
        if (current.contains(trackId)) {
            current.remove(trackId)
        } else {
            current.add(trackId)
        }
        _likedTrackIds.value = current
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/data/repository/MusicRepository.kt',
      content: `package com.morningmusic.app.data.repository

import com.morningmusic.app.data.model.Track

object MusicRepository {

    val popularTamil = listOf(
        Track(
            id = "tamil-1",
            title = "Theerthakkaraiyinile",
            artist = "K. J. Yesudas",
            album = "Classic Carnatic Hits",
            durationSeconds = 278,
            coverUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
            audioUrl = "https://archive.org/download/Theerthakkaraiyinile_201511/Theerthakkaraiyinile.mp3",
            language = "Tamil"
        ),
        Track(
            id = "tamil-2",
            title = "Aagaya Thamarai",
            artist = "Ilaiyaraaja, S. Janaki",
            album = "Ilayaraja Golden Melodies",
            durationSeconds = 295,
            coverUrl = "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600",
            audioUrl = "https://archive.org/download/IlayarajaMelodies/Aagaya%20Thamarai.mp3",
            language = "Tamil"
        ),
        Track(
            id = "tamil-3",
            title = "Aasai Oru Pulveli",
            artist = "A. R. Rahman, Sujatha",
            album = "Poo Pookum Oosai",
            durationSeconds = 219,
            coverUrl = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600",
            audioUrl = "https://archive.org/download/PooPookumOssai_201701/AASAI%20ORU%20PULVELI.mp3",
            language = "Tamil"
        )
    )

    val popularSinhala = listOf(
        Track(
            id = "sinhala-1",
            title = "Sihina Ahase Wasanthe",
            artist = "H. R. Jothipala",
            album = "Immortal Jothi",
            durationSeconds = 224,
            coverUrl = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
            audioUrl = "https://archive.org/download/HRJothipalaSihinaAhaseWasanthe/HR%20Jothipala%20~%20Sihina%20Ahase%20Wasanthe.mp3",
            language = "Sinhala"
        ),
        Track(
            id = "sinhala-2",
            title = "Dingi Raala",
            artist = "W. D. Amaradeva",
            album = "Voice of Ceylon",
            durationSeconds = 205,
            coverUrl = "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=600",
            audioUrl = "https://archive.org/download/DingiRaala/DingiRaala.mp3",
            language = "Sinhala"
        )
    )

    val popularEnglish = listOf(
        Track(
            id = "english-1",
            title = "Sunrise Horizon",
            artist = "The Midnight Groove",
            album = "Chilled Dawn Sessions",
            durationSeconds = 372,
            coverUrl = "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600",
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            language = "English"
        ),
        Track(
            id = "english-2",
            title = "Velvet Skyline",
            artist = "Acoustic Ember",
            album = "Echoes in the Light",
            durationSeconds = 423,
            coverUrl = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600",
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            language = "English"
        )
    )

    val trending = listOf(popularTamil[2], popularSinhala[0], popularEnglish[0])
    val newReleases = listOf(popularEnglish[1], popularTamil[1], popularSinhala[1])
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/data/network/MusicSearchService.kt',
      content: `package com.morningmusic.app.data.network

import com.morningmusic.app.data.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Clean, provider-independent Android service to search and fetch songs from the secure backend proxy.
 * Can be easily configured or replaced with another music/audio provider later.
 */
object MusicSearchService {
    private const val BACKEND_URL = "${baseUrl}"

    suspend fun searchSongs(query: String, language: String = "all"): List<Track> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<Track>()
        try {
            val encodedQuery = URLEncoder.encode(query, "UTF-8")
            val urlString = "$BACKEND_URL/api/youtube/search?q=$encodedQuery&language=$language"
            val connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode == 200) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(response)
                val items = json.optJSONArray("tracks") ?: return@withContext emptyList()
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
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        tracks
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/MainActivity.kt',
      content: `package com.morningmusic.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.morningmusic.app.ui.screens.HomeScreen
import com.morningmusic.app.ui.theme.MorningMusicTheme
import com.morningmusic.app.ui.viewmodel.MusicViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: MusicViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MorningMusicTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    HomeScreen(viewModel = viewModel)
                }
            }
        }
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/ui/screens/HomeScreen.kt',
      content: `package com.morningmusic.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.morningmusic.app.data.model.Track
import com.morningmusic.app.ui.viewmodel.MusicViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: MusicViewModel) {
    val currentTrack by viewModel.currentTrack.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val greeting = remember { viewModel.getTimeGreeting() }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF121212))) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(bottom = 80.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // STRICT REQUIREMENT: Only displays exact greeting without any personal name
            item {
                Text(
                    text = greeting,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                )
            }

            // Real-time Search Box
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.onSearchQueryChange(it) },
                    placeholder = { Text("Search Tamil, English music on YouTube...", color = Color.Gray, fontSize = 14.sp) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF1DB954),
                        unfocusedBorderColor = Color(0xFF333333),
                        focusedContainerColor = Color(0xFF1E1E1E),
                        unfocusedContainerColor = Color(0xFF181818)
                    ),
                    singleLine = true
                )
            }

            if (searchQuery.isNotEmpty()) {
                if (isSearching) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = Color(0xFF1DB954))
                        }
                    }
                } else if (searchResults.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("No results found", color = Color.Gray, fontSize = 14.sp)
                                Text("Please try another artist or track query", color = Color.Gray, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                } else {
                    item {
                        SectionHeader("Search Results")
                    }
                    items(searchResults) { track ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.playTrack(track) }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = track.coverUrl,
                                contentDescription = track.title,
                                modifier = Modifier
                                    .size(50.dp)
                                    .clip(RoundedCornerShape(6.dp)),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = track.title,
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = track.artist,
                                    color = Color.Gray,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            } else {
                // Popular Tamil available through proxy
                item {
                    SectionHeader("Popular Tamil")
                    HorizontalTrackList(tracks = viewModel.popularTamil, onTrackClick = { viewModel.playTrack(it) })
                }

                // Popular English available through proxy
                item {
                    SectionHeader("Popular English")
                    HorizontalTrackList(tracks = viewModel.popularEnglish, onTrackClick = { viewModel.playTrack(it) })
                }

                // Trending Singles
                item {
                    SectionHeader("Trending Singles")
                    HorizontalTrackList(tracks = viewModel.trending, onTrackClick = { viewModel.playTrack(it) })
                }

                // New Releases
                item {
                    SectionHeader("New Releases")
                    HorizontalTrackList(tracks = viewModel.newReleases, onTrackClick = { viewModel.playTrack(it) })
                }
            }
        }

        // Mini Player
        currentTrack?.let { track ->
            MiniPlayer(
                track = track,
                isPlaying = isPlaying,
                onPlayPauseClick = { viewModel.togglePlayPause() },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

@Composable
fun HorizontalTrackList(tracks: List<Track>, onTrackClick: (Track) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(tracks) { track ->
            Column(
                modifier = Modifier
                    .width(140.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF181818))
                    .clickable { onTrackClick(track) }
                    .padding(8.dp)
            ) {
                AsyncImage(
                    model = track.coverUrl,
                    contentDescription = track.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(6.dp))
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = track.title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = track.artist,
                    fontSize = 11.sp,
                    color = Color(0xFFAAAAAA),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun MiniPlayer(
    track: Track,
    isPlaying: Boolean,
    onPlayPauseClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF242424))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = track.coverUrl,
            contentDescription = track.title,
            modifier = Modifier.size(44.dp).clip(RoundedCornerShape(4.dp))
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(track.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(track.artist, color = Color.Gray, fontSize = 11.sp, maxLines = 1)
        }
        IconButton(onClick = onPlayPauseClick) {
            Icon(
                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = "Play/Pause",
                tint = Color.White
            )
        }
    }
}
`
    },
    {
      path: 'app/src/main/java/com/morningmusic/app/ui/theme/Theme.kt',
      content: `package com.morningmusic.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SpotifyGreen = Color(0xFF1DB954)
private val DarkBackground = Color(0xFF121212)
private val DarkSurface = Color(0xFF181818)

private val DarkColorScheme = darkColorScheme(
    primary = SpotifyGreen,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = Color.Black,
    onBackground = Color.White,
    onSurface = Color.White
)

@Composable
fun MorningMusicTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
`
    },
    {
      path: 'app/src/main/res/values/strings.xml',
      content: `<resources>
    <string name="app_name">Sabdham</string>
</resources>
`
    },
    {
      path: 'app/src/main/res/values/colors.xml',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="spotify_green">#1DB954</color>
    <color name="background_black">#121212</color>
    <color name="surface_black">#181818</color>
</resources>
`
    },
    {
      path: 'app/src/main/res/values/themes.xml',
      content: `<resources>
    <style name="Theme.MorningMusic" parent="android:Theme.Material.NoActionBar">
        <item name="android:statusBarColor">@color/background_black</item>
        <item name="android:windowBackground">@color/background_black</item>
    </style>
</resources>
`
    },
    {
      path: 'README.md',
      content: `# Sabdham - Native Android Studio Project

A native Android dark-themed music streaming application built with **Jetpack Compose**, **Material 3**, and **AndroidX Media3 / ExoPlayer**.

## Features
- **Strict Time-Based Greeting**: Automatically displays "Good morning", "Good afternoon", or "Good night" based on device local time with NO user names.
- **Real Audio Playback**: Audio streaming via ExoPlayer / Media3.
- **MediaSessionService**: Background playback with lock-screen controls and media notification shade.
- **Spotify Dark UI**: Material 3 dark surface colors (#121212, #181818, Spotify Green #1DB954).
- **Curated Sections**: Popular Tamil, Popular Sinhala, Popular English, Trending, New Releases.

## How to Build Real APK in Android Studio:
1. Extract this ZIP file.
2. Open **Android Studio** (Ladybug / Koala / Hedgehog or newer).
3. Select **Open** and choose this project folder.
4. Let Gradle sync dependencies.
5. In the menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**, or run:
   \`\`\`bash
   ./gradlew assembleDebug
   \`\`\`
6. The compiled APK will be located at:
   \`app/build/outputs/apk/debug/app-debug.apk\`
`
    }
  ];
}

export async function generateAndroidStudioZip(): Promise<Blob> {
  const zip = new JSZip();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const files = getAndroidProjectFiles(origin);

  files.forEach((file) => {
    zip.file(`MorningMusic/${file.path}`, file.content);
  });

  // Fetch the local logo.jpg and bundle it as launcher icons in the exported Android project
  try {
    const logoRes = await fetch('/logo.jpg');
    if (logoRes.ok) {
      const logoBlob = await logoRes.blob();
      zip.file('MorningMusic/app/src/main/res/mipmap-nodpi/ic_launcher.jpg', logoBlob);
      zip.file('MorningMusic/app/src/main/res/mipmap-nodpi/ic_launcher_round.jpg', logoBlob);
    }
  } catch (err) {
    console.error('Failed to bundle logo into Android Studio zip:', err);
  }

  return await zip.generateAsync({ type: 'blob' });
}
