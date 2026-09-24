package com.morningmusic.app.ui.viewmodel

import android.app.Application
import android.content.ComponentName
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.morningmusic.app.data.model.Artist
import com.morningmusic.app.data.model.Genre
import com.morningmusic.app.data.model.Track
import com.morningmusic.app.data.repository.MusicRepository
import com.morningmusic.app.data.network.MusicSearchService
import com.morningmusic.app.service.PlaybackService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import java.util.Calendar

/**
 * Architecture: Unidirectional Data Flow ViewModel with strictly time-based greeting logic and rich music catalog.
 * Integrates natively with Android Media3 PlaybackService to support robust, continuous background playback
 * and lock screen controls when the device display is switched off.
 */
class MusicViewModel(application: Application) : AndroidViewModel(application) {

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _queue = MutableStateFlow<List<Track>>(emptyList())
    val queue: StateFlow<List<Track>> = _queue.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private val _isShuffle = MutableStateFlow(false)
    val isShuffle: StateFlow<Boolean> = _isShuffle.asStateFlow()

    private val _isRepeat = MutableStateFlow(false)
    val isRepeat: StateFlow<Boolean> = _isRepeat.asStateFlow()

    private val _likedTrackIds = MutableStateFlow<Set<String>>(setOf("tamil-hukum", "tamil-katchi-sera", "english-espresso"))
    val likedTrackIds: StateFlow<Set<String>> = _likedTrackIds.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Track>>(emptyList())
    val searchResults: StateFlow<List<Track>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _suggestions = MutableStateFlow<List<String>>(emptyList())
    val suggestions: StateFlow<List<String>> = _suggestions.asStateFlow()

    val genres: List<Genre> = MusicRepository.genres
    val artists: List<Artist> = MusicRepository.artists

    val popularTamil: List<Track> = MusicRepository.popularTamil
    val popularSinhala: List<Track> = MusicRepository.popularSinhala
    val popularEnglish: List<Track> = MusicRepository.popularEnglish
    val trending: List<Track> = MusicRepository.trending
    val newReleases: List<Track> = MusicRepository.newReleases
    val acousticMelodies: List<Track> = MusicRepository.acousticMelodies
    val workoutEnergy: List<Track> = MusicRepository.workoutEnergy
    val chillMidnight: List<Track> = MusicRepository.chillMidnight
    val allTracks: List<Track> = MusicRepository.allTracks

    private var lastSearchJob: Job? = null
    private var mediaController: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null

    init {
        MusicSearchService.init(application)
        _currentTrack.value = popularTamil.firstOrNull() ?: allTracks.firstOrNull()

        // Asynchronously initialize modern Jetpack Media3 MediaController
        try {
            val sessionToken = SessionToken(
                application,
                ComponentName(application, PlaybackService::class.java)
            )
            controllerFuture = MediaController.Builder(application, sessionToken).buildAsync()
            controllerFuture?.addListener({
                try {
                    val controller = controllerFuture?.get()
                    mediaController = controller
                    if (controller != null) {
                        _isPlaying.value = controller.isPlaying
                        
                        // Keep state of isPlaying and currentPosition in sync with controller
                        viewModelScope.launch {
                            while (true) {
                                _currentPosition.value = controller.currentPosition.coerceAtLeast(0L)
                                _duration.value = if (controller.duration > 0) controller.duration else (_currentTrack.value?.durationSeconds?.times(1000) ?: 180000L)
                                _isPlaying.value = controller.isPlaying
                                delay(500)
                            }
                        }

                        // Attach transition listener to automatically sync _currentTrack state with ExoPlayer playlist transitions!
                        controller.addListener(object : Player.Listener {
                            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                                val currentId = mediaItem?.mediaId
                                if (currentId != null) {
                                    val matchingTrack = _queue.value.find { it.id == currentId } ?: MusicRepository.getTrackById(currentId)
                                    if (matchingTrack != null) {
                                        _currentTrack.value = matchingTrack
                                    }
                                }
                            }

                            override fun onIsPlayingChanged(playing: Boolean) {
                                _isPlaying.value = playing
                            }
                        })
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }, { command -> command?.run() })
        } catch (e: Exception) {
            e.printStackTrace()
        }
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
        val trimmed = query.trim()
        if (trimmed.isEmpty()) {
            _searchResults.value = emptyList()
            _suggestions.value = emptyList()
            return
        }

        // Generate similar word suggestions with at least 5 results
        _suggestions.value = generateSuggestions(trimmed)

        lastSearchJob?.cancel()
        lastSearchJob = viewModelScope.launch {
            _isSearching.value = true
            
            // First search local catalog instantly
            val localMatches = allTracks.filter {
                it.title.contains(trimmed, ignoreCase = true) ||
                it.artist.contains(trimmed, ignoreCase = true) ||
                it.album.contains(trimmed, ignoreCase = true) ||
                it.movie.contains(trimmed, ignoreCase = true) ||
                it.genre.contains(trimmed, ignoreCase = true)
            }

            // Debounce for 400ms before making remote API search
            delay(400)
            val remoteResults = try {
                MusicSearchService.searchSongs(query)
            } catch (e: Exception) {
                emptyList()
            }

            val combined = (localMatches + remoteResults).distinctBy { it.id }
            _searchResults.value = combined
            _isSearching.value = false
        }
    }

    private fun generateSuggestions(query: String): List<String> {
        val qLower = query.lowercase().trim()
        if (qLower.isEmpty()) return emptyList()

        val results = mutableListOf<String>()

        // Gather track titles, artists and albums from local MusicRepository
        val wordsSet = mutableSetOf<String>()
        for (t in allTracks) {
            wordsSet.add(t.title)
            wordsSet.add(t.artist)
            if (t.album.isNotEmpty()) wordsSet.add(t.album)

            // Extract individual words of length > 2
            val parts = "${t.title} ${t.artist} ${t.album}"
                .split(Regex("[\\s(),\\-:._+]+"))
                .map { it.trim() }
                .filter { it.length > 2 }
            for (p in parts) {
                wordsSet.add(p)
            }
        }

        for (a in artists) {
            wordsSet.add(a.name)
        }

        val allWords = wordsSet.toList()

        // 1. Prefix matches (starts with typed letters)
        val startMatches = allWords.filter { it.lowercase().startsWith(qLower) }
        for (w in startMatches) {
            if (results.size >= 5) break
            if (!results.any { it.equals(w, ignoreCase = true) }) {
                results.add(w)
            }
        }

        // 2. Substring matches (contains typed letters)
        if (results.size < 5) {
            val containMatches = allWords.filter { it.lowercase().contains(qLower) }
            for (w in containMatches) {
                if (results.size >= 5) break
                if (!results.any { it.equals(w, ignoreCase = true) }) {
                    results.add(w)
                }
            }
        }

        // 3. Defaults backfill to ensure at least 5 suggestions are always returned
        val defaults = listOf("Hukum", "Katchi Sera", "Dawasak Ewi", "Espresso", "Aasa Kooda", "Badass")
        if (results.size < 5) {
            for (d in defaults) {
                if (results.size >= 5) break
                if (!results.any { it.equals(d, ignoreCase = true) }) {
                    results.add(d)
                }
            }
        }

        return results.take(8)
    }

    private fun getQueueForTrack(track: Track): List<Track> {
        if (searchResults.value.any { it.id == track.id }) {
            return searchResults.value
        }
        if (popularTamil.any { it.id == track.id }) {
            return popularTamil
        }
        if (popularSinhala.any { it.id == track.id }) {
            return popularSinhala
        }
        if (popularEnglish.any { it.id == track.id }) {
            return popularEnglish
        }
        if (trending.any { it.id == track.id }) {
            return trending
        }
        if (newReleases.any { it.id == track.id }) {
            return newReleases
        }
        // Fallback queue: combine all available catalog
        return allTracks
    }

    fun playTrack(track: Track) {
        val activeQueue = getQueueForTrack(track)
        _queue.value = activeQueue
        _currentTrack.value = track
        _isPlaying.value = true
        _currentPosition.value = 0L

        mediaController?.let { controller ->
            val index = activeQueue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
            
            val mediaItems = activeQueue.map { t ->
                val rawUrl = t.audioUrl
                val streamUrl = if (rawUrl.startsWith("yt:") || rawUrl.startsWith("yt-") || t.id.startsWith("yt-")) {
                    val videoId = rawUrl.replace("yt:", "").replace("yt-", "").ifEmpty { t.id.replace("yt-", "") }
                    MusicSearchService.getStreamUrl(videoId)
                } else {
                    rawUrl
                }

                MediaItem.Builder()
                    .setUri(streamUrl)
                    .setMediaId(t.id)
                    .setMediaMetadata(
                        androidx.media3.common.MediaMetadata.Builder()
                            .setTitle(t.title)
                            .setArtist(t.artist)
                            .setAlbumTitle(t.album)
                            .setArtworkUri(android.net.Uri.parse(t.coverUrl))
                            .build()
                    )
                    .build()
            }

            controller.stop()
            controller.setMediaItems(mediaItems)
            controller.seekTo(index, 0L)
            controller.prepare()
            controller.play()
        }
    }

    fun togglePlayPause() {
        mediaController?.let { controller ->
            if (controller.isPlaying) {
                controller.pause()
                _isPlaying.value = false
            } else {
                controller.play()
                _isPlaying.value = true
            }
        } ?: run {
            _isPlaying.value = !_isPlaying.value
        }
    }

    fun seekTo(positionMs: Long) {
        _currentPosition.value = positionMs
        mediaController?.seekTo(positionMs)
    }

    fun playNext() {
        val current = _currentTrack.value ?: return
        val activeQueue = _queue.value
        if (activeQueue.isEmpty()) return

        val currentIndex = activeQueue.indexOfFirst { it.id == current.id }
        val nextIndex = if (_isShuffle.value) {
            (0 until activeQueue.size).filter { it != currentIndex }.randomOrNull() ?: 0
        } else {
            (currentIndex + 1) % activeQueue.size
        }
        playTrack(activeQueue[nextIndex])
    }

    fun playPrevious() {
        val current = _currentTrack.value ?: return
        val activeQueue = _queue.value
        if (activeQueue.isEmpty()) return

        val currentIndex = activeQueue.indexOfFirst { it.id == current.id }
        val prevIndex = if (currentIndex > 0) currentIndex - 1 else activeQueue.size - 1
        playTrack(activeQueue[prevIndex])
    }

    fun toggleShuffle() {
        _isShuffle.value = !_isShuffle.value
    }

    fun toggleRepeat() {
        _isRepeat.value = !_isRepeat.value
        mediaController?.repeatMode = if (_isRepeat.value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
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

    private val _eqEnabled = MutableStateFlow(false)
    val eqEnabled: StateFlow<Boolean> = _eqEnabled.asStateFlow()

    private val _eqPreset = MutableStateFlow("Flat")
    val eqPreset: StateFlow<String> = _eqPreset.asStateFlow()

    private val _volumeNormalization = MutableStateFlow(false)
    val volumeNormalization: StateFlow<Boolean> = _volumeNormalization.asStateFlow()

    fun setEqualizer(enabled: Boolean, preset: String = "Flat", bands: IntArray? = null) {
        _eqEnabled.value = enabled
        _eqPreset.value = preset
        PlaybackService.instance?.setEqualizer(enabled, preset, bands)
    }

    fun setVolumeNormalization(enabled: Boolean) {
        _volumeNormalization.value = enabled
        PlaybackService.instance?.setVolumeNormalization(enabled)
    }

    fun setCrossfade(seconds: Int) {
        PlaybackService.instance?.setCrossfade(seconds)
    }

    fun getBackendUrl(): String {
        return MusicSearchService.activeBackendUrl
    }

    fun updateBackendUrl(newUrl: String) {
        MusicSearchService.setBackendUrl(getApplication(), newUrl)
    }

    fun resetBackendUrl() {
        MusicSearchService.resetToDefault(getApplication())
    }

    override fun onCleared() {
        super.onCleared()
        controllerFuture?.let { future ->
            MediaController.releaseFuture(future)
        }
    }
}
