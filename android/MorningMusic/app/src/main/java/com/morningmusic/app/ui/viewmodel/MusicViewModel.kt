package com.morningmusic.app.ui.viewmodel

import org.json.JSONObject

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

                if (query.contains("golden", ignoreCase = true)) {
                    incoming.forEachIndexed { index, track ->
                        android.util.Log.d(
                            "SABDHAM_GOLDEN",
                            "#$index title=${track.title} artist=${track.artist} language=${track.language} year=${track.year} id=${track.id}"
                        )
                    }
                }
if (incoming.isEmpty()) {
                    paging.hasMore = false
                    return@launch
                }

                val existingIds = target.value
                    .map { it.id }
                    .toHashSet()

                val newTracks =
                    if (query.contains("sinhala", ignoreCase = true) &&
                        query.contains("golden", ignoreCase = true)
                    ) {
                        incoming.filter {
                            it.id !in existingIds &&
                            (
                                it.language.trim().equals("sinhala", ignoreCase = true) ||
                                it.artist.contains("Amaradeva", ignoreCase = true) ||
                                it.artist.contains("Victor Ratnayake", ignoreCase = true) ||
                                it.artist.contains("Sanath Nandasiri", ignoreCase = true) ||
                                it.artist.contains("Milton Mallawarachchi", ignoreCase = true) ||
                                it.artist.contains("Nanda Malini", ignoreCase = true) ||
                                it.artist.contains("T. M. Jayaratne", ignoreCase = true) ||
                                it.artist.contains("Sunil Edirisinghe", ignoreCase = true) ||
                                it.artist.contains("Clarence Wijewardena", ignoreCase = true)
                            )
                        }
                    } else {
                        incoming.filter {
                            it.id !in existingIds &&
                            (
                                language.equals("all", ignoreCase = true) ||
                                it.language.trim().equals(language, ignoreCase = true)
                            )
                        }
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

    private val _sinhalaClassics = MutableStateFlow<List<Track>>(emptyList())
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
        loadMoreCatalog(_sinhalaClassics, sinhalaClassicsPaging, "old sri lankan sinhala songs classics", "all")

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
    private var searchQueueMode = false
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
                                        saveLastPlayedTrack(matchingTrack)
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
     * 5:00 AM - 11:59 AM -> "Good morning"
     * 12:00 PM - 5:59 PM -> "Good afternoon"
     * 6:00 PM - 4:59 AM -> "Good night"
     */
    fun getTimeGreeting(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 5..11 -> "Good morning"
            hour in 12..17 -> "Good afternoon"
            else -> "Good night"
        }
    }

    private fun normalizeSearchText(value: String): String {
        return value
            .trim()
            .replace(Regex("\\s+"), " ")
            .lowercase()
    }

    private fun hasSearchPlaybackSource(track: Track): Boolean {
        val audio = track.audioUrl.trim()

        if (track.youtubeVideoId.isNotBlank()) return true
        if (audio.startsWith("yt:", ignoreCase = true)) return true
        if (audio.startsWith("yt-", ignoreCase = true)) return true

        // Mirror the player's direct-audio fast path.
        return audio.isNotBlank() &&
            !audio.contains("youtube", ignoreCase = true)
    }

    private fun searchScore(track: Track, rawQuery: String): Int {
        val query = normalizeSearchText(rawQuery)
        if (query.isBlank()) return 0

        val title = normalizeSearchText(track.title)
        val artist = normalizeSearchText(track.artist)
        val album = normalizeSearchText(track.album)
        val movie = normalizeSearchText(track.movie)
        val genre = normalizeSearchText(track.genre)
        val searchable = "$title $artist $album $movie $genre"

        var score = 0

        score += when {
            title == query -> 1200
            title.startsWith(query) -> 1000
            title.contains(query) -> 800
            else -> 0
        }

        score += when {
            artist == query -> 900
            artist.startsWith(query) -> 750
            artist.contains(query) -> 600
            else -> 0
        }

        score += when {
            album == query -> 700
            album.startsWith(query) -> 550
            album.contains(query) -> 450
            else -> 0
        }

        if (movie.contains(query)) score += 350
        if (genre.contains(query)) score += 200

        val tokens = query.split(" ").filter { it.isNotBlank() }
        val matchedTokens = tokens.count { searchable.contains(it) }

        if (tokens.isNotEmpty() && matchedTokens == tokens.size) {
            score += 300
        }

        score += matchedTokens * 40
        return score
    }

    private fun rankSearchResults(
        tracks: List<Track>,
        query: String,
        limit: Int = 50
    ): List<Track> {
        return tracks
            .asSequence()
            .filter { hasSearchPlaybackSource(it) }
            .map { track -> track to searchScore(track, query) }
            .filter { (_, score) -> score > 0 }
            .sortedByDescending { (_, score) -> score }
            .map { (track, _) -> track }
            .distinctBy { track ->
                normalizeSearchText(track.title) +
                    "|" +
                    normalizeSearchText(track.artist)
            }
            .take(limit)
            .toList()
    }

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query

        val trimmed = query
            .trim()
            .replace(Regex("\\s+"), " ")

        lastSearchJob?.cancel()

        if (trimmed.isEmpty()) {
            _searchResults.value = emptyList()
            _suggestions.value = emptyList()
            _isSearching.value = false
            return
        }

        _suggestions.value = generateSuggestions(trimmed)

        val localResults = rankSearchResults(
            tracks = allTracks,
            query = trimmed,
            limit = 40
        )

        // Local playable matches appear immediately.
        _searchResults.value = localResults

        val requestedQuery = normalizeSearchText(trimmed)

        lastSearchJob = viewModelScope.launch {
            _isSearching.value = true

            try {
                // Short debounce prevents one API request per keystroke.
                delay(300)

                val remoteResults = MusicSearchService.searchSongs(
                    query = trimmed,
                    language = "all",
                    page = 1,
                    maxResults = 40
                )

                // Ignore an old request if the user already typed something else.
                if (normalizeSearchText(_searchQuery.value) != requestedQuery) {
                    return@launch
                }

                _searchResults.value = rankSearchResults(
                    tracks = localResults + remoteResults,
                    query = trimmed,
                    limit = 50
                )
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_SEARCH",
                    "Search failed for query=$trimmed",
                    e
                )
            } finally {
                if (normalizeSearchText(_searchQuery.value) == requestedQuery) {
                    _isSearching.value = false
                }
            }
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
            val json = JSONObject().apply {
                put("id", track.id)
                put("title", track.title)
                put("artist", track.artist)
                put("album", track.album)
                put("movie", track.movie)
                put("durationSeconds", track.durationSeconds)
                put("durationFormatted", track.durationFormatted)
                put("coverUrl", track.coverUrl)
                put("audioUrl", track.audioUrl)
                put("youtubeVideoId", track.youtubeVideoId)
                put("language", track.language)
                put("genre", track.genre)
                put("year", track.year)
                put("releaseDate", track.releaseDate)
                put("popularityScore", track.popularityScore)
                put("streamCount", track.streamCount)
                put("viewCount", track.viewCount)
                put("isTrendingNow", track.isTrendingNow)
                put("lyrics", track.lyrics)
            }

            getApplication<android.app.Application>()
                .getSharedPreferences(
                    "sabdham_player",
                    android.content.Context.MODE_PRIVATE
                )
                .edit()
                .putString("last_played_track_json", json.toString())
                .putString("last_played_track_id", track.id)
                .apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun restoreLastPlayedTrack(): Track? {
        return try {
            val prefs =
                getApplication<android.app.Application>()
                    .getSharedPreferences(
                        "sabdham_player",
                        android.content.Context.MODE_PRIVATE
                    )

            val raw = prefs.getString("last_played_track_json", null)

            if (!raw.isNullOrBlank()) {
                val obj = JSONObject(raw)

                return Track(
                    id = obj.optString("id"),
                    title = obj.optString("title", "Unknown"),
                    artist = obj.optString("artist", "Unknown Artist"),
                    album = obj.optString("album"),
                    movie = obj.optString("movie"),
                    durationSeconds = obj.optLong("durationSeconds", 200L),
                    durationFormatted =
                        obj.optString("durationFormatted", "3:20"),
                    coverUrl = obj.optString("coverUrl"),
                    audioUrl = obj.optString("audioUrl"),
                    youtubeVideoId =
                        obj.optString("youtubeVideoId"),
                    language = obj.optString("language", "all"),
                    genre = obj.optString("genre", "Pop"),
                    year = obj.optInt("year", 2024),
                    releaseDate =
                        obj.optString(
                            "releaseDate",
                            "2024-01-01"
                        ),
                    popularityScore =
                        obj.optInt("popularityScore", 90),
                    streamCount =
                        obj.optLong("streamCount", 1000000L),
                    viewCount =
                        obj.optLong("viewCount", 5000000L),
                    isTrendingNow =
                        obj.optBoolean(
                            "isTrendingNow",
                            false
                        ),
                    lyrics = obj.optString("lyrics")
                )
            }

            prefs
                .getString("last_played_track_id", null)
                ?.let { MusicRepository.getTrackById(it) }

        } catch (e: Exception) {
            e.printStackTrace()

            try {
                getApplication<android.app.Application>()
                    .getSharedPreferences(
                        "sabdham_player",
                        android.content.Context.MODE_PRIVATE
                    )
                    .getString("last_played_track_id", null)
                    ?.let { MusicRepository.getTrackById(it) }
            } catch (_: Exception) {
                null
            }
        }
    }


    fun playSearchTrack(
        track: Track,
        sourceResults: List<Track>
    ) {
        searchQueueMode = true

        val selectedLanguage =
            track.language.trim()

        val selectedGenres =
            track.genre
                .lowercase()
                .split(Regex("[,/|&]+"))
                .map { it.trim() }
                .filter { it.isNotBlank() }

        val matchingTracks =
            sourceResults
                .distinctBy { it.id }
                .filter { candidate ->

                    if (candidate.id == track.id) {
                        true
                    } else {
                        val languageMatches =
                            selectedLanguage.isBlank() ||
                                candidate.language
                                    .trim()
                                    .equals(
                                        selectedLanguage,
                                        ignoreCase = true
                                    )

                        val candidateGenres =
                            candidate.genre
                                .lowercase()
                                .split(Regex("[,/|&]+"))
                                .map { it.trim() }
                                .filter { it.isNotBlank() }

                        val genreMatches =
                            selectedGenres.isEmpty() ||
                                candidateGenres.any { candidateGenre ->
                                    selectedGenres.any { selectedGenre ->
                                        candidateGenre == selectedGenre ||
                                            candidateGenre.contains(selectedGenre) ||
                                            selectedGenre.contains(candidateGenre)
                                    }
                                }

                        languageMatches && genreMatches
                    }
                }

        val baseQueue =
            if (matchingTracks.any { it.id == track.id }) {
                matchingTracks
            } else {
                listOf(track) + matchingTracks
            }

        /*
         * Rotate the queue so whichever search song was clicked
         * becomes position #1 while preserving matching-song order.
         */
        val clickedIndex =
            baseQueue.indexOfFirst { it.id == track.id }

        val orderedQueue =
            if (clickedIndex > 0) {
                (
                    baseQueue.drop(clickedIndex) +
                        baseQueue.take(clickedIndex)
                )
                    .distinctBy { it.id }
                    .take(20)
            } else {
                baseQueue
                    .distinctBy { it.id }
                    .take(20)
            }

        /*
         * Show the matching queue immediately in the player Queue tab.
         */
        _queue.value = orderedQueue
        _currentTrack.value = track
        saveLastPlayedTrack(track)

        _isPlaying.value = false
        _currentPosition.value = 0L

        playbackJob?.cancel()

        playbackJob = viewModelScope.launch {

            val controller =
                mediaController ?: run {
                    _isPlaying.value = false
                    return@launch
                }

            /*
             * Resolve only the clicked song first so playback begins quickly.
             */
            val selectedPlayable =
                kotlinx.coroutines.withContext(
                    kotlinx.coroutines.Dispatchers.IO
                ) {
                    buildPlayableTrack(track)
                }

            if (selectedPlayable == null) {
                _isPlaying.value = false

                // This search result cannot be resolved to playable audio.
                // Remove it immediately so the user is not offered a dead song again.
                _searchResults.value =
                    _searchResults.value.filterNot { it.id == track.id }

                _queue.value =
                    _queue.value.filterNot { it.id == track.id }

                android.util.Log.e(
                    "SABDHAM_SEARCH_QUEUE",
                    "Hidden unplayable search song: " +
                        "${track.title} - ${track.artist}"
                )

                return@launch
            }

            controller.stop()
            controller.clearMediaItems()

            controller.setMediaItem(
                selectedPlayable.second
            )

            controller.repeatMode =
                if (_isRepeat.value) {
                    Player.REPEAT_MODE_ONE
                } else {
                    Player.REPEAT_MODE_ALL
                }

            controller.shuffleModeEnabled =
                _isShuffle.value

            controller.prepare()
            controller.playWhenReady = true
            controller.play()

            _currentTrack.value =
                selectedPlayable.first

            _isPlaying.value = true

            /*
             * Build the matching search queue in the background.
             *
             * Sequential resolution is intentional:
             * do NOT fire 20 backend/YouTube requests simultaneously.
             */
            val playableTracks =
                mutableListOf(selectedPlayable.first)

            val remaining =
                orderedQueue.filterNot {
                    it.id == track.id
                }

            for (candidate in remaining) {

                if (playbackJob?.isActive != true) {
                    break
                }

                val playable =
                    kotlinx.coroutines.withContext(
                        kotlinx.coroutines.Dispatchers.IO
                    ) {
                        buildPlayableTrack(candidate)
                    } ?: continue

                if (playbackJob?.isActive != true) {
                    break
                }

                controller.addMediaItem(
                    playable.second
                )

                playableTracks.add(
                    playable.first
                )

                /*
                 * Keep player Queue UI synchronized with actual
                 * playable Media3 items while preserving unresolved
                 * matching songs until resolution completes.
                 */
                android.util.Log.d(
                    "SABDHAM_SEARCH_QUEUE",
                    "QUEUED ${playable.first.title}"
                )
            }

            /*
             * Remove any tracks that failed stream resolution.
             */
            if (playbackJob?.isActive == true) {
                _queue.value =
                    playableTracks.distinctBy {
                        it.id
                    }
            }
        }
    }


    fun playTrack(track: Track, sourceQueue: List<Track>? = null) {
        searchQueueMode = false
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
        searchQueueMode = false
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
                    buildPlayableTrack(track, forceFreshResolve = true)
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
                if (_isRepeat.value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_ALL
            controller.shuffleModeEnabled = _isShuffle.value
            controller.prepare()
            controller.playWhenReady = true
            controller.play()

            _currentTrack.value = selectedPlayable.first
            _isPlaying.value = true

            val remaining = catalogQueue.filter { it.id != track.id }

            if (remaining.isNotEmpty()) {
                launch {
                    val playableRest = buildPlayableQueue(remaining, forceFreshResolve = true)
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
        queueTrack: Track,
        forceFreshResolve: Boolean = false
    ): Pair<Track, MediaItem>? {

        android.util.Log.d(
            "SABDHAM_PLAY",
            "RESOLVE START id=${queueTrack.id} title=${queueTrack.title} yt=${queueTrack.youtubeVideoId} audio=${queueTrack.audioUrl}"
        )

        // FAST PATH: use an existing real audio URL immediately.
        val hasDirectAudio =
            !forceFreshResolve &&
            queueTrack.audioUrl.isNotBlank() &&
            !queueTrack.audioUrl.startsWith("yt:") &&
            !queueTrack.audioUrl.startsWith("yt-") &&
            !queueTrack.audioUrl.contains("youtube", ignoreCase = true)

        // Exact catalogue YouTube ID/ref.
        // Catalogue playback must try this exact item BEFORE title/artist search.
        val exactYouTubeRef =
            when {
                queueTrack.youtubeVideoId.isNotBlank() ->
                    queueTrack.youtubeVideoId

                queueTrack.audioUrl.startsWith("yt:") ||
                    queueTrack.audioUrl.startsWith("yt-") ->
                    queueTrack.audioUrl

                else -> ""
            }

        val hasExactYouTubeId = exactYouTubeRef.isNotBlank()

        // CATALOGUE ONLY:
        // refresh the stream for the exact stored YouTube ID first.
        val exactCatalogueUrl =
            if (forceFreshResolve && hasExactYouTubeId) {
                try {
                    MusicSearchService.getStreamUrl(exactYouTubeRef)
                } catch (e: Exception) {
                    android.util.Log.w(
                        "SABDHAM_CATALOG",
                        "Exact YouTube ID failed: $exactYouTubeRef",
                        e
                    )
                    null
                }
            } else {
                null
            }

        // Search by title/artist ONLY when:
        // - there is no usable exact catalogue ID, or
        // - refreshing that exact ID failed.
        /*
         * CATALOGUE STRONG FIX:
         * Stored catalogue YouTube IDs can become stale/wrong.
         *
         * Catalogue playback therefore resolves by title + artist FIRST.
         * Search/playlist behaviour remains unchanged.
         */
        val resolvedStream =
            if (forceFreshResolve) {
                try {
                    MusicSearchService.resolveCatalogStream(
                        title = queueTrack.title,
                        artist = queueTrack.artist
                    )
                } catch (e: Exception) {
                    android.util.Log.w(
                        "SABDHAM_CATALOG",
                        "Title resolver failed for ${queueTrack.title}",
                        e
                    )
                    null
                }
            } else if (hasDirectAudio || hasExactYouTubeId) {
                null
            } else {
                MusicSearchService.resolveStream(
                    title = queueTrack.title,
                    artist = queueTrack.artist
                )
            }

        /*
         * Backend resolver can return:
         * /api/youtube/stream?id=...
         *
         * ExoPlayer needs a complete absolute URL.
         */
        val normalizedResolvedStreamUrl =
            resolvedStream?.url
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?.let { url ->
                    when {
                        url.startsWith("http://", ignoreCase = true) ||
                            url.startsWith("https://", ignoreCase = true) ->
                            url

                        url.startsWith("/") ->
                            MusicSearchService.activeBackendUrl.trimEnd('/') + url

                        else ->
                            MusicSearchService.activeBackendUrl.trimEnd('/') + "/" + url
                    }
                }

        val resolvedUrl = when {
            /*
             * Catalogue first choice:
             * verified title/artist resolver result.
             */
            forceFreshResolve && !normalizedResolvedStreamUrl.isNullOrBlank() -> {
                android.util.Log.d(
                    "SABDHAM_CATALOG",
                    "RESOLVER PLAY title=${queueTrack.title} url=$normalizedResolvedStreamUrl"
                )
                normalizedResolvedStreamUrl
            }


            // Normal search/playlist behavior remains unchanged.
            hasDirectAudio ->
                queueTrack.audioUrl

            !forceFreshResolve && queueTrack.youtubeVideoId.isNotBlank() ->
                MusicSearchService.getStreamUrl(queueTrack.youtubeVideoId)

            !forceFreshResolve &&
                (
                    queueTrack.audioUrl.startsWith("yt:") ||
                    queueTrack.audioUrl.startsWith("yt-")
                ) ->
                MusicSearchService.getStreamUrl(queueTrack.audioUrl)

            // Catalogue fallback only if exact ID failed.
            !resolvedStream?.url.isNullOrBlank() -> {
                android.util.Log.d(
                    "SABDHAM_CATALOG",
                    "SEARCH FALLBACK title=${queueTrack.title} artist=${queueTrack.artist}"
                )
                normalizedResolvedStreamUrl ?: resolvedStream!!.url
            }

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

        // SABDHAM artwork rule: playback resolution may use YouTube as audio fallback,
        // but artwork must stay with verified catalogue/app metadata.
        val artworkUrl = queueTrack.coverUrl

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
        tracks: List<Track>,
        forceFreshResolve: Boolean = false
    ): List<Pair<Track, MediaItem>> {
        val uniqueTracks = tracks.distinctBy { it.id }

        /*
         * Catalogue:
         * resolve sequentially so Render / YouTube resolver is not hit
         * with many simultaneous requests.
         *
         * Search and playlists retain the existing parallel behaviour.
         */
        if (forceFreshResolve) {
            val result = mutableListOf<Pair<Track, MediaItem>>()

            for (queueTrack in uniqueTracks) {
                try {
                    val playable =
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                            buildPlayableTrack(
                                queueTrack,
                                forceFreshResolve = true
                            )
                        }

                    if (playable != null) {
                        result.add(playable)
                    }
                } catch (e: Exception) {
                    android.util.Log.w(
                        "SABDHAM_CATALOG",
                        "QUEUE RESOLVE SKIP title=${queueTrack.title}",
                        e
                    )
                }

                kotlinx.coroutines.delay(150)
            }

            return result
        }

        return coroutineScope {
            uniqueTracks.map { queueTrack ->
                async(Dispatchers.IO) {
                    buildPlayableTrack(
                        queueTrack,
                        forceFreshResolve = false
                    )
                }
            }.awaitAll().filterNotNull()
        }
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

            // SABDHAM PROGRESSIVE QUEUE:
            // Preserve instant playback of the selected song, but keep a small
            // number of resolved MediaItems ready so Media3 can advance automatically.
            // This does NOT change search/playlist click behavior.
            val remainingPlayable: List<Pair<Track, MediaItem>> =
                buildPlayableQueue(remainingQueue.take(3))

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

        val isCatalogueTrack =
            nextTrack.youtubeVideoId.isNotBlank() ||
            nextTrack.audioUrl.startsWith("yt:") ||
            nextTrack.audioUrl.startsWith("yt-") ||
            nextTrack.audioUrl.contains("youtube", ignoreCase = true)

        if (isCatalogueTrack) {
            playCatalogTrack(
                track = nextTrack,
                sourceQueue = queue
            )
        } else {
            playTrackInternal(
                track = nextTrack,
                queueOverride = queue
            )
        }
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

        val isCatalogueTrack =
            previousTrack.youtubeVideoId.isNotBlank() ||
            previousTrack.audioUrl.startsWith("yt:") ||
            previousTrack.audioUrl.startsWith("yt-") ||
            previousTrack.audioUrl.contains("youtube", ignoreCase = true)

        if (isCatalogueTrack) {
            playCatalogTrack(
                track = previousTrack,
                sourceQueue = queue
            )
        } else {
            playTrackInternal(
                track = previousTrack,
                queueOverride = queue
            )
        }
    }

    fun toggleShuffle() {
        _isShuffle.value = !_isShuffle.value
        mediaController?.shuffleModeEnabled = _isShuffle.value
    }

    fun toggleRepeat() {
        _isRepeat.value = !_isRepeat.value
        mediaController?.repeatMode = if (_isRepeat.value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_ALL
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







































































