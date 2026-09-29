package com.morningmusic.app.ui.viewmodel

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import android.util.Base64

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
import com.morningmusic.app.data.network.SabdhamLibraryService
import com.morningmusic.app.service.PlaybackService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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

    private val _likedTrackIds = MutableStateFlow<Set<String>>(emptySet())
    val likedTrackIds: StateFlow<Set<String>> = _likedTrackIds.asStateFlow()

    private val _likedTracks = MutableStateFlow<List<Track>>(emptyList())
    val likedTracks: StateFlow<List<Track>> = _likedTracks.asStateFlow()

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

    private val _popularTamil = MutableStateFlow<List<Track>>(MusicRepository.popularTamil)
    val popularTamil: StateFlow<List<Track>> = _popularTamil.asStateFlow()

    private var tamilCatalogLoading = false
    private var tamilCatalogPage = 1
    private var tamilCatalogHasMore = true

    fun loadMoreTamil() {
        if (tamilCatalogLoading || !tamilCatalogHasMore) return

        tamilCatalogLoading = true

        viewModelScope.launch {
            try {
                val incoming = MusicSearchService.searchSongs(
                    query = "tamil hits",
                    language = "tamil",
                    page = tamilCatalogPage,
                    maxResults = 15
                )

                if (incoming.isEmpty()) {
                    tamilCatalogHasMore = false
                    return@launch
                }

                val existingIds = _popularTamil.value
                    .map { it.id }
                    .toHashSet()

                val newTracks = incoming.filter {
                    it.id !in existingIds &&
                    it.language.trim().equals("tamil", ignoreCase = true)
                }

                if (newTracks.isNotEmpty()) {
                    _popularTamil.value =
                        _popularTamil.value + newTracks
                }

                tamilCatalogPage++

                if (incoming.size < 15) {
                    tamilCatalogHasMore = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                tamilCatalogLoading = false
            }
        }
    }
    private data class CatalogPagingState(
        var page: Int = 1,
        var loading: Boolean = false,
        var hasMore: Boolean = true
    )

    private val _popularSinhala =
        MutableStateFlow<List<Track>>(MusicRepository.popularSinhala)
    val popularSinhalaFlow: StateFlow<List<Track>> =
        _popularSinhala.asStateFlow()
    val popularSinhala: List<Track>
        get() = _popularSinhala.value

    private val _popularEnglish =
        MutableStateFlow<List<Track>>(MusicRepository.popularEnglish)
    val popularEnglishFlow: StateFlow<List<Track>> =
        _popularEnglish.asStateFlow()
    val popularEnglish: List<Track>
        get() = _popularEnglish.value

    val trending: List<Track> = MusicRepository.trending

    private val _newReleases =
        MutableStateFlow<List<Track>>(MusicRepository.newReleases)
    val newReleasesFlow: StateFlow<List<Track>> =
        _newReleases.asStateFlow()
    val newReleases: List<Track>
        get() = _newReleases.value

    private val _acousticMelodies =
        MutableStateFlow<List<Track>>(MusicRepository.acousticMelodies)
    val acousticMelodiesFlow: StateFlow<List<Track>> =
        _acousticMelodies.asStateFlow()
    val acousticMelodies: List<Track>
        get() = _acousticMelodies.value

    private val sinhalaPaging = CatalogPagingState()
    private val englishPaging = CatalogPagingState()
    private val acousticPaging = CatalogPagingState()
    private val newReleasesPaging = CatalogPagingState()

    private fun loadMoreCatalog(
        target: MutableStateFlow<List<Track>>,
        paging: CatalogPagingState,
        query: String,
        language: String
    ) {
        if (paging.loading || !paging.hasMore) return

        paging.loading = true

        viewModelScope.launch {
            try {
                val incoming = MusicSearchService.searchSongs(
                    query = query,
                    language = language,
                    page = paging.page,
                    maxResults = 15
                )

                if (incoming.isEmpty()) {
                    paging.hasMore = false
                    return@launch
                }

                val existingIds = target.value
                    .map { it.id }
                    .toHashSet()

                val newTracks = incoming.filter {
                    it.id !in existingIds &&
                    (
                        language.equals("all", ignoreCase = true) ||
                        it.language.trim().equals(language, ignoreCase = true)
                    )
                }

                if (newTracks.isNotEmpty()) {
                    target.value = target.value + newTracks
                }

                paging.page++

                if (incoming.size < 15) {
                    paging.hasMore = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                paging.loading = false
            }
        }
    }

    fun loadMoreSinhala() =
        loadMoreCatalog(
            _popularSinhala,
            sinhalaPaging,
            "sinhala hits",
            "sinhala"
        )

    fun loadMoreEnglish() =
        loadMoreCatalog(
            _popularEnglish,
            englishPaging,
            "english hits",
            "english"
        )

    fun loadMoreAcoustic() =
        loadMoreCatalog(
            _acousticMelodies,
            acousticPaging,
            "acoustic love songs",
            "all"
        )

    fun loadMoreNewReleases() =
        loadMoreCatalog(
            _newReleases,
            newReleasesPaging,
            "latest new releases",
            "all"
        )
    // SABDHAM - 10 additional dynamic Home catalogs
    private val _tamilEvergreen = MutableStateFlow<List<Track>>(MusicRepository.popularTamil.sortedBy { it.year })
    val tamilEvergreen = _tamilEvergreen.asStateFlow()
    private val tamilEvergreenPaging = CatalogPagingState()

    private val _tamilRomantic = MutableStateFlow<List<Track>>(MusicRepository.popularTamil.filter { it.genre.contains("Love", ignoreCase = true) || it.genre.contains("Acoustic", ignoreCase = true) }.ifEmpty { MusicRepository.popularTamil })
    val tamilRomantic = _tamilRomantic.asStateFlow()
    private val tamilRomanticPaging = CatalogPagingState()

    private val _tamilDance = MutableStateFlow<List<Track>>(MusicRepository.popularTamil.filter { it.genre.contains("Kuthu", ignoreCase = true) || it.genre.contains("Dance", ignoreCase = true) || it.genre.contains("Pop", ignoreCase = true) }.ifEmpty { MusicRepository.popularTamil })
    val tamilDance = _tamilDance.asStateFlow()
    private val tamilDancePaging = CatalogPagingState()

    private val _sinhalaClassics = MutableStateFlow<List<Track>>(MusicRepository.popularSinhala.sortedBy { it.year })
    val sinhalaClassics = _sinhalaClassics.asStateFlow()
    private val sinhalaClassicsPaging = CatalogPagingState()

    private val _sinhalaRomantic = MutableStateFlow<List<Track>>(MusicRepository.popularSinhala.filter { it.genre.contains("Acoustic", ignoreCase = true) || it.genre.contains("Love", ignoreCase = true) || it.title.contains("Saragaye", ignoreCase = true) || it.title.contains("Sandawathiye", ignoreCase = true) || it.title.contains("Mandaaram", ignoreCase = true) }.ifEmpty { MusicRepository.popularSinhala })
    val sinhalaRomantic = _sinhalaRomantic.asStateFlow()
    private val sinhalaRomanticPaging = CatalogPagingState()

    private val _sinhalaTrending = MutableStateFlow<List<Track>>(MusicRepository.popularSinhala.filter { it.isTrendingNow || it.year >= 2024 }.sortedByDescending { it.popularityScore }.ifEmpty { MusicRepository.popularSinhala })
    val sinhalaTrending = _sinhalaTrending.asStateFlow()
    private val sinhalaTrendingPaging = CatalogPagingState()

    private val _englishPop = MutableStateFlow<List<Track>>(MusicRepository.popularEnglish)
    val englishPop = _englishPop.asStateFlow()
    private val englishPopPaging = CatalogPagingState()

    private val _chillRelax = MutableStateFlow<List<Track>>(MusicRepository.chillMidnight.ifEmpty { MusicRepository.acousticMelodies })
    val chillRelax = _chillRelax.asStateFlow()
    private val chillRelaxPaging = CatalogPagingState()

    private val _partyHits = MutableStateFlow<List<Track>>(MusicRepository.workoutEnergy)
    val partyHits = _partyHits.asStateFlow()
    private val partyHitsPaging = CatalogPagingState()

    private val _throwbacks = MutableStateFlow<List<Track>>(MusicRepository.allTracks.filter { it.year <= 2009 }.ifEmpty { MusicRepository.allTracks.sortedBy { it.year }.take(15) })
    val throwbacks = _throwbacks.asStateFlow()
    private val throwbacksPaging = CatalogPagingState()

    fun loadMoreTamilEvergreen() =
        loadMoreCatalog(_tamilEvergreen, tamilEvergreenPaging, "tamil songs", "tamil")

    fun loadMoreTamilRomantic() =
        loadMoreCatalog(_tamilRomantic, tamilRomanticPaging, "tamil love songs", "tamil")

    fun loadMoreTamilDance() =
        loadMoreCatalog(_tamilDance, tamilDancePaging, "tamil hits", "tamil")

    fun loadMoreSinhalaClassics() =
        loadMoreCatalog(_sinhalaClassics, sinhalaClassicsPaging, "sinhala songs", "sinhala")

    fun loadMoreSinhalaRomantic() =
        loadMoreCatalog(_sinhalaRomantic, sinhalaRomanticPaging, "sinhala love songs", "sinhala")

    fun loadMoreSinhalaTrending() =
        loadMoreCatalog(_sinhalaTrending, sinhalaTrendingPaging, "sinhala hits", "sinhala")

    fun loadMoreEnglishPop() =
        loadMoreCatalog(_englishPop, englishPopPaging, "english hits", "english")

    fun loadMoreChillRelax() =
        loadMoreCatalog(_chillRelax, chillRelaxPaging, "chill songs", "all")

    fun loadMorePartyHits() =
        loadMoreCatalog(_partyHits, partyHitsPaging, "dance hits", "all")

    fun loadMoreThrowbacks() =
        loadMoreCatalog(_throwbacks, throwbacksPaging, "classic hits", "all")

    val workoutEnergy: List<Track> = MusicRepository.workoutEnergy
    val chillMidnight: List<Track> = MusicRepository.chillMidnight
    val allTracks: List<Track> = MusicRepository.allTracks

    private var lastSearchJob: Job? = null
    private var playbackJob: Job? = null
    private var mediaController: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null

    init {
        MusicSearchService.init(application)
        loadLikedSongsFromCloud()
        _currentTrack.value = restoreLastPlayedTrack()
        _isPlaying.value = false

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

                            override fun onPlaybackStateChanged(playbackState: Int) {
                                // ExoPlayer owns catalogue transitions. Do not manually
                                // advance here or a completed song can skip an item.
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
     * 5:00 AMÃ¢â‚¬â€œ11:59 AM Ã¢â€ â€™ "Good morning"
     * 12:00 PMÃ¢â‚¬â€œ5:59 PM Ã¢â€ â€™ "Good afternoon"
     * 6:00 PMÃ¢â‚¬â€œ4:59 AM Ã¢â€ â€™ "Good night"
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
        if (popularTamil.value.any { it.id == track.id }) {
            return popularTamil.value
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

    private fun saveLastPlayedTrack(track: Track) {
        try {
            val bytes = ByteArrayOutputStream().use { byteStream ->
                ObjectOutputStream(byteStream).use { it.writeObject(track) }
                byteStream.toByteArray()
            }

            val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)

            getApplication<android.app.Application>()
                .getSharedPreferences("sabdham_player", android.content.Context.MODE_PRIVATE)
                .edit()
                .putString("last_played_track", encoded)
                .putString("last_played_track_id", track.id)
                .apply()
        } catch (_: Exception) {
        }
    }

    private fun restoreLastPlayedTrack(): Track? {
        return try {
            val prefs = getApplication<android.app.Application>()
                .getSharedPreferences("sabdham_player", android.content.Context.MODE_PRIVATE)

            val encoded = prefs.getString("last_played_track", null)
                ?: return prefs.getString("last_played_track_id", null)
                    ?.let { MusicRepository.getTrackById(it) }

            val bytes = Base64.decode(encoded, Base64.NO_WRAP)

            ByteArrayInputStream(bytes).use { byteStream ->
                ObjectInputStream(byteStream).use {
                    it.readObject() as? Track
                }
            }
        } catch (_: Exception) {
            null
        }
    }
    fun playTrack(track: Track, sourceQueue: List<Track>? = null) {
        playTrackInternal(
            track = track,
            queueOverride = sourceQueue
        )
    }

    fun playCatalog(tracks: List<Track>) {
        if (tracks.isEmpty()) return
        val catalogQueue = tracks.distinctBy { it.id }
        playCatalogTrack(
            track = catalogQueue.first(),
            sourceQueue = catalogQueue
        )
    }

    /**
     * Catalogue-only path.
     * Search and playlist playback continue using playTrack() unchanged.
     */
    fun playCatalogTrack(
        track: Track,
        sourceQueue: List<Track>
    ) {
        val catalogQueue = sourceQueue.distinctBy { it.id }

        _queue.value = catalogQueue
        _currentTrack.value = track
        _isPlaying.value = false
        _currentPosition.value = 0L

        playbackJob?.cancel()
        playbackJob = viewModelScope.launch {
            val controller = mediaController ?: return@launch

            val selectedPlayable =
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    buildPlayableTrack(track)
                }

            if (selectedPlayable == null) {
                _isPlaying.value = false
                android.util.Log.e(
                    "SABDHAM_CATALOG",
                    "Unable to resolve catalogue track: ${track.title} - ${track.artist}"
                )
                return@launch
            }

            controller.stop()
            controller.clearMediaItems()
            controller.setMediaItem(selectedPlayable.second)
            controller.repeatMode =
                if (_isRepeat.value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
            controller.shuffleModeEnabled = _isShuffle.value
            controller.prepare()
            controller.playWhenReady = true
            controller.play()

            _currentTrack.value = selectedPlayable.first
            _isPlaying.value = true

            val remaining = catalogQueue.filter { it.id != track.id }

            if (remaining.isNotEmpty()) {
                launch {
                    val playableRest = buildPlayableQueue(remaining)
                    if (playableRest.isNotEmpty()) {
                        controller.addMediaItems(playableRest.map { it.second })
                        _queue.value =
                            listOf(selectedPlayable.first) + playableRest.map { it.first }
                    } else {
                        _queue.value = listOf(selectedPlayable.first)
                    }
                }
            } else {
                _queue.value = listOf(selectedPlayable.first)
            }
        }
    }
    private suspend fun buildPlayableTrack(
        queueTrack: Track
    ): Pair<Track, MediaItem>? {

        android.util.Log.d(
            "SABDHAM_PLAY",
            "RESOLVE START id=${queueTrack.id} title=${queueTrack.title} yt=${queueTrack.youtubeVideoId} audio=${queueTrack.audioUrl}"
        )

        // FAST PATH: use an existing real audio URL immediately.
        val hasDirectAudio =
            queueTrack.audioUrl.isNotBlank() &&
            !queueTrack.audioUrl.startsWith("yt:") &&
            !queueTrack.audioUrl.startsWith("yt-") &&
            !queueTrack.audioUrl.contains("youtube", ignoreCase = true)

        // Imported YouTube playlist tracks already contain the exact video ID.
        // Use it directly instead of searching again by title/artist.
        val hasExactYouTubeId =
            queueTrack.youtubeVideoId.isNotBlank() ||
            queueTrack.audioUrl.startsWith("yt:") ||
            queueTrack.audioUrl.startsWith("yt-")

        val resolvedStream =
            if (hasDirectAudio || hasExactYouTubeId) {
                null
            } else {
                MusicSearchService.resolveStream(
                    title = queueTrack.title,
                    artist = queueTrack.artist
                )
            }

        val resolvedUrl = when {
            hasDirectAudio ->
                queueTrack.audioUrl

            queueTrack.youtubeVideoId.isNotBlank() ->
                MusicSearchService.getStreamUrl(queueTrack.youtubeVideoId)

            queueTrack.audioUrl.startsWith("yt:") ||
                queueTrack.audioUrl.startsWith("yt-") ->
                MusicSearchService.getStreamUrl(queueTrack.audioUrl)

            !resolvedStream?.url.isNullOrBlank() ->
                resolvedStream!!.url

            else -> {
                val fallbackTracks = MusicSearchService.searchSongs(
                    query = "${queueTrack.title} ${queueTrack.artist}",
                    language = queueTrack.language.ifBlank { "all" },
                    page = 1,
                    maxResults = 5
                )

                val youtubeFallback =
                    fallbackTracks.firstOrNull { candidate ->
                        candidate.youtubeVideoId.isNotBlank() ||
                            candidate.audioUrl.startsWith("yt:") ||
                            candidate.audioUrl.startsWith("yt-")
                    }

                when {
                    youtubeFallback?.youtubeVideoId?.isNotBlank() == true ->
                        MusicSearchService.getStreamUrl(
                            youtubeFallback.youtubeVideoId
                        )

                    youtubeFallback != null &&
                        (
                            youtubeFallback.audioUrl.startsWith("yt:") ||
                            youtubeFallback.audioUrl.startsWith("yt-")
                        ) ->
                        MusicSearchService.getStreamUrl(
                            youtubeFallback.audioUrl
                        )

                    else -> return null
                }
            }
        }

        val metadataBuilder =
            androidx.media3.common.MediaMetadata.Builder()
                .setTitle(queueTrack.title)
                .setArtist(queueTrack.artist)
                .setAlbumTitle(queueTrack.album)

        val artworkUrl =
            resolvedStream?.coverUrl.orEmpty()
                .ifBlank { queueTrack.coverUrl }

        if (artworkUrl.isNotBlank()) {
            metadataBuilder.setArtworkUri(
                android.net.Uri.parse(artworkUrl)
            )
        }

        return queueTrack to MediaItem.Builder()
            .setUri(resolvedUrl)
            .setMediaId(queueTrack.id)
            .setMediaMetadata(metadataBuilder.build())
            .build()
    }

    private suspend fun buildPlayableQueue(
        tracks: List<Track>
    ): List<Pair<Track, MediaItem>> = coroutineScope {
        tracks.distinctBy { it.id }.map { queueTrack ->
            async(Dispatchers.IO) {
                buildPlayableTrack(queueTrack)
            }
        }.awaitAll().filterNotNull()
    }
    private fun playTrackInternal(
        track: Track,
        queueOverride: List<Track>? = null
    ) {
        val requestedQueue = if (queueOverride != null) {
            val explicitQueue = queueOverride.distinctBy { it.id }

            if (explicitQueue.any { it.id == track.id }) {
                explicitQueue
            } else {
                listOf(track) + explicitQueue
            }
        } else {
            val catalogueQueue = getQueueForTrack(track)

            val matchingQueue = catalogueQueue
                .filter { candidate ->
                    candidate.language.equals(track.language, ignoreCase = true) &&
                    candidate.genre.equals(track.genre, ignoreCase = true)
                }
                .distinctBy { it.id }

            if (matchingQueue.any { it.id == track.id }) {
                matchingQueue
            } else {
                listOf(track) + matchingQueue.filterNot { it.id == track.id }
            }
        }

        _queue.value = requestedQueue
        _currentTrack.value = track
        saveLastPlayedTrack(track)
        _isPlaying.value = false
        _currentPosition.value = 0L

        playbackJob?.cancel()

        playbackJob = viewModelScope.launch {
            val controller = mediaController ?: return@launch

            /*
             * INSTANT PLAY:
             * Resolve only the song the user clicked.
             * Do NOT wait for the entire playlist.
             */
            val selectedPlayable = buildPlayableTrack(track)

            if (selectedPlayable == null) {
                _isPlaying.value = false
                return@launch
            }

            val selectedTrack = selectedPlayable.first
            val selectedMediaItem = selectedPlayable.second

            _currentTrack.value = selectedTrack

            controller.stop()
            controller.clearMediaItems()
            controller.setMediaItem(selectedMediaItem)

            controller.repeatMode =
                if (_isRepeat.value) {
                    Player.REPEAT_MODE_ONE
                } else {
                    Player.REPEAT_MODE_ALL
                }

            controller.shuffleModeEnabled = false
            controller.prepare()
            controller.volume = 1f
            _isMuted.value = false
            controller.playWhenReady = true
            controller.play()

            _isPlaying.value = true

            /*
             * Resolve the rest only AFTER playback has started.
             */
            val remainingQueue =
                requestedQueue.filterNot { it.id == track.id }

            // LAZY QUEUE:
            // Next/Previous resolves the requested track when it is selected.
            // Do not resolve the entire imported playlist in parallel.
            val remainingPlayable: List<Pair<Track, MediaItem>> =
                emptyList()

            if (playbackJob?.isActive != true) return@launch

            /*
             * Keep the currently playing MediaItem untouched.
             * Build the final queue around it so Previous/Next still follow
             * the original playlist order.
             */
            val resolvedById =
                remainingPlayable.associateBy { it.first.id }

            val finalTracks = mutableListOf<Track>()
            val finalItems = mutableListOf<MediaItem>()

            requestedQueue.forEach { requestedTrack ->
                if (requestedTrack.id == track.id) {
                    finalTracks.add(selectedTrack)
                    finalItems.add(selectedMediaItem)
                } else {
                    val resolved = resolvedById[requestedTrack.id]

                    if (resolved != null) {
                        finalTracks.add(resolved.first)
                        finalItems.add(resolved.second)
                    }
                }
            }

            val selectedIndex =
                finalTracks.indexOfFirst { it.id == track.id }

            if (selectedIndex >= 0 &&
                controller.currentMediaItem?.mediaId == track.id
            ) {
                /*
                 * IMPORTANT:
                 * Never replace/re-prepare the currently playing item.
                 * Insert resolved playlist items around it instead.
                 */
                val beforeItems =
                    if (selectedIndex > 0) {
                        finalItems.subList(0, selectedIndex)
                    } else {
                        emptyList()
                    }

                val afterItems =
                    if (selectedIndex + 1 < finalItems.size) {
                        finalItems.subList(
                            selectedIndex + 1,
                            finalItems.size
                        )
                    } else {
                        emptyList()
                    }

                if (beforeItems.isNotEmpty()) {
                    controller.addMediaItems(
                        0,
                        beforeItems
                    )
                }

                if (afterItems.isNotEmpty()) {
                    controller.addMediaItems(afterItems)
                }

                controller.repeatMode =
                    if (_isRepeat.value) {
                        Player.REPEAT_MODE_ONE
                    } else {
                        Player.REPEAT_MODE_ALL
                    }

                controller.shuffleModeEnabled = _isShuffle.value

                // Preserve the complete active playlist for Next/Previous navigation.

                _queue.value = requestedQueue
                _currentTrack.value = selectedTrack
            }
        }
    }
    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()
    private var volumeBeforeMute = 1f

    fun toggleMute() {
        mediaController?.let { controller ->
            if (_isMuted.value) {
                controller.volume = volumeBeforeMute.coerceAtLeast(0.1f)
                _isMuted.value = false
            } else {
                if (controller.volume > 0f) volumeBeforeMute = controller.volume
                controller.volume = 0f
                _isMuted.value = true
            }
        }
    }

    fun togglePlayPause() {
        mediaController?.let { controller ->
            if (controller.isPlaying) {
                controller.pause()
                _isPlaying.value = false
            } else {
                // After app restart the last track can be restored while the
                // MediaController has no playlist yet. Rebuild the queue first.
                val restoredTrack = _currentTrack.value
                if (controller.mediaItemCount == 0 && restoredTrack != null) {
                    playTrack(restoredTrack)
                } else {
                    controller.playWhenReady = true
                    controller.play()
                    _isPlaying.value = true
                }
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
        val queue = _queue.value.distinctBy { it.id }
        if (queue.isEmpty()) return

        val currentId =
            mediaController?.currentMediaItem?.mediaId
                ?: _currentTrack.value?.id

        val currentIndex =
            queue.indexOfFirst { it.id == currentId }

        val nextIndex = when {
            currentIndex < 0 -> 0
            currentIndex + 1 < queue.size -> currentIndex + 1
            else -> 0
        }

        val nextTrack = queue[nextIndex]

        playTrackInternal(
            track = nextTrack,
            queueOverride = queue
        )
    }

    fun playPrevious() {
        val queue = _queue.value.distinctBy { it.id }
        if (queue.isEmpty()) return

        val currentId =
            mediaController?.currentMediaItem?.mediaId
                ?: _currentTrack.value?.id

        val currentIndex =
            queue.indexOfFirst { it.id == currentId }

        val previousIndex = when {
            currentIndex < 0 -> 0
            currentIndex > 0 -> currentIndex - 1
            else -> queue.lastIndex
        }

        val previousTrack = queue[previousIndex]

        playTrackInternal(
            track = previousTrack,
            queueOverride = queue
        )
    }

    fun toggleShuffle() {
        _isShuffle.value = !_isShuffle.value
        mediaController?.shuffleModeEnabled = _isShuffle.value
    }

    fun toggleRepeat() {
        _isRepeat.value = !_isRepeat.value
        mediaController?.repeatMode = if (_isRepeat.value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    }

    fun addToQueue(track: Track) {
        val currentQueue = _queue.value

        if (currentQueue.none { it.id == track.id }) {
            _queue.value = currentQueue + track
        }
    }

    fun loadLikedSongsFromCloud() {
        viewModelScope.launch {
            val result = SabdhamLibraryService.loadLikedTracks(getApplication())

            if (result.success) {
                _likedTrackIds.value = result.likedTrackIds
                _likedTracks.value = result.tracks

                android.util.Log.d(
                    "SABDHAM_LIKES",
                    "Loaded ${result.likedTrackIds.size} liked songs"
                )
            } else {
                android.util.Log.w(
                    "SABDHAM_LIKES",
                    "Load failed: ${result.message}"
                )
            }
        }
    }
    fun toggleLike(track: Track) {
        val wasLiked = track.id in _likedTrackIds.value

        val newIds = _likedTrackIds.value.toMutableSet()
        val newTracks = _likedTracks.value.toMutableList()

        if (wasLiked) {
            newIds.remove(track.id)
            newTracks.removeAll { it.id == track.id }
        } else {
            newIds.add(track.id)
            newTracks.removeAll { it.id == track.id }
            newTracks.add(0, track)
        }

        _likedTrackIds.value = newIds
        _likedTracks.value = newTracks.distinctBy { it.id }

        viewModelScope.launch {
            val result =
                SabdhamLibraryService.setFavorite(
                    context = getApplication(),
                    track = track,
                    liked = !wasLiked
                )

            if (!result.success) {
                // SABDHAM_LIKES_ROLLBACK
                val rollbackIds = _likedTrackIds.value.toMutableSet()
                val rollbackTracks = _likedTracks.value.toMutableList()

                if (wasLiked) {
                    rollbackIds.add(track.id)
                    rollbackTracks.removeAll { it.id == track.id }
                    rollbackTracks.add(0, track)
                } else {
                    rollbackIds.remove(track.id)
                    rollbackTracks.removeAll { it.id == track.id }
                }

                _likedTrackIds.value = rollbackIds
                _likedTracks.value = rollbackTracks.distinctBy { it.id }

                android.util.Log.w(
                    "SABDHAM_LIKES",
                    "Favorite update failed and was rolled back: ${result.message}"
                )
            }
        }
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






















































