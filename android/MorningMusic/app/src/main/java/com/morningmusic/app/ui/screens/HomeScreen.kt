package com.morningmusic.app.ui.screens


import androidx.compose.ui.draw.blur
import android.content.Context
import com.morningmusic.app.data.network.CloudPlaylist
import com.morningmusic.app.data.network.SabdhamLibraryService
import com.morningmusic.app.data.network.MusicSearchService
import com.morningmusic.app.data.repository.currentLocalCatalogDay
import com.morningmusic.app.data.repository.dailyRotatedCatalog
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

import androidx.compose.animation.*
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Lyrics
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.morningmusic.app.data.model.Artist
import com.morningmusic.app.data.model.Genre
import com.morningmusic.app.data.model.Track
import com.morningmusic.app.audio.AudioRouteState
import com.morningmusic.app.ui.viewmodel.MusicViewModel
import com.morningmusic.app.auth.AuthViewModel
import com.morningmusic.app.auth.SabdhamAuthDialog
import com.morningmusic.app.auth.SabdhamUser
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.Locale
import com.sabdham.music.R
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource

private fun isMeaningfulArtworkLabel(value: String): Boolean {
    val normalized =
        value.trim()
            .lowercase()
            .replace(Regex("[^a-z0-9\\u0B80-\\u0BFF\\u0D80-\\u0DFF]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    if (normalized.length < 3) return false

    return normalized !in setOf(
        "single",
        "youtube audio",
        "youtube singles",
        "youtube playlist",
        "playlist",
        "trending release",
        "popular hits",
        "imported",
        "unknown",
        "unknown album",
        "featured hits",
        "music"
    )
}

private fun buildVerifiedArtworkFallbackUrl(track: Track): String? {
    if (
        !isMeaningfulArtworkLabel(track.movie) &&
        !isMeaningfulArtworkLabel(track.album)
    ) {
        return null
    }

    return android.net.Uri
        .parse(
            MusicSearchService.activeBackendUrl.trimEnd('/') +
                "/api/artwork/verified"
        )
        .buildUpon()
        .appendQueryParameter("title", track.title)
        .appendQueryParameter("artist", track.artist)
        .appendQueryParameter("album", track.album)
        .appendQueryParameter("movie", track.movie)
        .appendQueryParameter("language", track.language)
        .appendQueryParameter("year", track.year.toString())
        .build()
        .toString()
}

private fun usableExistingArtwork(track: Track): String? {
    val cover = track.coverUrl.trim()

    if (cover.isBlank()) return null
    if (cover.startsWith("data:image/", ignoreCase = true)) return null
    if (cover.contains("ytimg.com", ignoreCase = true)) return null
    if (cover.contains("youtube.com", ignoreCase = true)) return null

    return cover
        .takeIf {
            it.startsWith("http://", ignoreCase = true) ||
                it.startsWith("https://", ignoreCase = true)
        }
}

@Composable
private fun rememberSabdhamArtworkModel(track: Track): Any? {
    val context = androidx.compose.ui.platform.LocalContext.current

    val hasStrongArtworkIdentity =
        remember(
            track.id,
            track.movie,
            track.album,
            track.language,
            track.year
        ) {
            isMeaningfulArtworkLabel(track.movie) ||
                isMeaningfulArtworkLabel(track.album)
        }

    val primary =
        remember(track.id, track.coverUrl) {
            usableExistingArtwork(track)
        }

    val verifiedFallback =
        remember(
            track.id,
            track.title,
            track.artist,
            track.album,
            track.movie,
            track.language,
            track.year
        ) {
            buildVerifiedArtworkFallbackUrl(track)
        }

    var verifiedFailed by remember(
        track.id,
        verifiedFallback
    ) {
        mutableStateOf(false)
    }

    var primaryFailed by remember(
        track.id,
        primary
    ) {
        mutableStateOf(false)
    }

    val selectedUrl =
        when {
            hasStrongArtworkIdentity &&
                verifiedFallback != null &&
                !verifiedFailed ->
                verifiedFallback

            primary != null && !primaryFailed ->
                primary

            !hasStrongArtworkIdentity &&
                verifiedFallback != null &&
                !verifiedFailed ->
                verifiedFallback

            else -> null
        }

    if (selectedUrl == null) {
        return null
    }

    return remember(
        selectedUrl,
        verifiedFallback,
        primary,
        hasStrongArtworkIdentity,
        verifiedFailed,
        primaryFailed
    ) {
        coil.request.ImageRequest.Builder(context)
            .data(selectedUrl)
            .listener(
                onError = { _, _ ->
                    when (selectedUrl) {
                        verifiedFallback ->
                            verifiedFailed = true

                        primary ->
                            primaryFailed = true
                    }
                }
            )
            .build()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: MusicViewModel) {
    val currentTrack by viewModel.currentTrack.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val currentPosition by viewModel.currentPosition.collectAsState()
    val duration by viewModel.duration.collectAsState()
    val likedTrackIds by viewModel.likedTrackIds.collectAsState()
    val likedTracks by viewModel.likedTracks.collectAsState()
    val isShuffle by viewModel.isShuffle.collectAsState()
    val isRepeat by viewModel.isRepeat.collectAsState()
    val isMuted by viewModel.isMuted.collectAsState()
    val volume by viewModel.volume.collectAsState()
    val audioRouteState by viewModel.audioRouteState.collectAsState()
    val playbackInterestVersion by viewModel.playbackInterestVersion.collectAsState()

    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val searchPlaylistResults by
        viewModel.searchPlaylistResults.collectAsState()
    val openedSearchPlaylist by
        viewModel.openedSearchPlaylist.collectAsState()
    val openedSearchPlaylistTracks by
        viewModel.openedSearchPlaylistTracks.collectAsState()
    val loadingSearchPlaylistId by
        viewModel.loadingSearchPlaylistId.collectAsState()
    val searchPlaylistActionId by
        viewModel.searchPlaylistActionId.collectAsState()
    val searchPlaylistMessage by
        viewModel.searchPlaylistMessage.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val suggestions by viewModel.suggestions.collectAsState()

    val popularTamilSource by viewModel.popularTamil.collectAsState()
    val popularEnglishSource by viewModel.popularEnglishFlow.collectAsState()
    val acousticMelodiesSource by viewModel.acousticMelodiesFlow.collectAsState()
    val newReleasesSource by viewModel.newReleasesFlow.collectAsState()

    val tamilEvergreenSource by viewModel.tamilEvergreen.collectAsState()
    val tamilRomanticSource by viewModel.tamilRomantic.collectAsState()
    val tamilDanceSource by viewModel.tamilDance.collectAsState()
    val englishPopSource by viewModel.englishPop.collectAsState()
    val chillRelaxSource by viewModel.chillRelax.collectAsState()
    val partyHitsSource by viewModel.partyHits.collectAsState()
    val throwbacksSource by viewModel.throwbacks.collectAsState()

    val context = androidx.compose.ui.platform.LocalContext.current
    val homeCatalogTarget = 50

    // Native catalogue day changes once at the device's local midnight.
    // The minute check also catches up after the app resumes from background.
    val catalogDay by produceState(initialValue = currentLocalCatalogDay()) {
        while (true) {
            delay(60_000L)
            val freshDay = currentLocalCatalogDay()
            if (freshDay != value) value = freshDay
        }
    }

    val popularTamil = remember(popularTamilSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, popularTamilSource, "popular_tamil", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val popularEnglish = remember(popularEnglishSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, popularEnglishSource, "popular_english", catalogDay, homeCatalogTarget, likedTrackIds)
    }

    val tamilNew = remember(popularTamilSource, catalogDay, likedTrackIds) {
        val pool = popularTamilSource.filter { it.year >= 2023 || it.isTrendingNow }
        dailyRotatedCatalog(context, pool, "tamil_new", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val tamilModern = remember(popularTamilSource, catalogDay, likedTrackIds) {
        val pool = popularTamilSource.filter { it.year in 2010..2022 }
        dailyRotatedCatalog(context, pool, "tamil_modern", catalogDay, homeCatalogTarget, likedTrackIds)
    }

    val acousticMelodies = remember(acousticMelodiesSource, catalogDay, likedTrackIds) {
        val pool = acousticMelodiesSource.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "acoustic", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val newReleases = remember(newReleasesSource, catalogDay, likedTrackIds) {
        val pool = newReleasesSource.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "new_releases", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val tamilEvergreen = remember(tamilEvergreenSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, tamilEvergreenSource, "tamil_evergreen", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val tamilRomantic = remember(tamilRomanticSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, tamilRomanticSource, "tamil_romantic", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val tamilDance = remember(tamilDanceSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, tamilDanceSource, "tamil_dance", catalogDay, homeCatalogTarget, likedTrackIds)
    }

    val englishPop = remember(englishPopSource, catalogDay, likedTrackIds) {
        dailyRotatedCatalog(context, englishPopSource, "international_pop", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val internationalTrending = remember(popularEnglishSource, catalogDay, likedTrackIds) {
        val pool = popularEnglishSource.filter { it.year >= 2023 || it.isTrendingNow }
        dailyRotatedCatalog(context, pool, "international_trending", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val internationalRnB = remember(popularEnglishSource, catalogDay, likedTrackIds) {
        val pool = popularEnglishSource.filter {
            it.genre.contains("R&B", ignoreCase = true) ||
                it.genre.contains("Synthwave", ignoreCase = true)
        }
        dailyRotatedCatalog(context, pool, "international_rnb", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val internationalLove = remember(popularEnglishSource, catalogDay, likedTrackIds) {
        val pool = popularEnglishSource.filter {
            it.genre.contains("Love", ignoreCase = true) ||
                it.genre.contains("Acoustic", ignoreCase = true) ||
                it.genre.contains("Pop", ignoreCase = true)
        }
        dailyRotatedCatalog(context, pool, "international_love", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val internationalThrowbacks = remember(popularEnglishSource, catalogDay, likedTrackIds) {
        val pool = popularEnglishSource.filter { it.year in 1990..2019 }
        dailyRotatedCatalog(context, pool, "international_throwbacks", catalogDay, homeCatalogTarget, likedTrackIds)
    }

    val chillRelax = remember(chillRelaxSource, catalogDay, likedTrackIds) {
        val pool = chillRelaxSource.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "chill_relax", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val partyHits = remember(partyHitsSource, catalogDay, likedTrackIds) {
        val pool = partyHitsSource.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "party_hits", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val throwbacks = remember(throwbacksSource, catalogDay, likedTrackIds) {
        val pool = throwbacksSource.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "throwbacks", catalogDay, homeCatalogTarget, likedTrackIds)
    }
    val dailyTrending = remember(catalogDay, likedTrackIds) {
        val pool = viewModel.trending.filterNot { it.language.equals("sinhala", ignoreCase = true) }
        dailyRotatedCatalog(context, pool, "trending", catalogDay, homeCatalogTarget, likedTrackIds)
    }

    val tamilCatalog = remember(tamilNew, popularTamil, tamilRomantic, tamilDance, tamilEvergreen, tamilModern) {
        (tamilNew + popularTamil + tamilRomantic + tamilDance + tamilEvergreen + tamilModern).distinctBy { it.id }
    }
    val internationalCatalog = remember(
        internationalTrending,
        popularEnglish,
        englishPop,
        internationalRnB,
        internationalLove,
        internationalThrowbacks
    ) {
        (internationalTrending + popularEnglish + englishPop + internationalRnB + internationalLove + internationalThrowbacks)
            .distinctBy { it.id }
    }

    val playbackInterestProfile = remember(playbackInterestVersion) {
        viewModel.getPlaybackInterestProfile()
    }

    val personalizationPool = remember(
        popularTamilSource,
        popularEnglishSource,
        tamilEvergreenSource,
        tamilRomanticSource,
        tamilDanceSource,
        englishPopSource,
        chillRelaxSource,
        partyHitsSource,
        throwbacksSource,
        newReleasesSource,
        acousticMelodiesSource
    ) {
        (
            popularTamilSource +
                popularEnglishSource +
                tamilEvergreenSource +
                tamilRomanticSource +
                tamilDanceSource +
                englishPopSource +
                chillRelaxSource +
                partyHitsSource +
                throwbacksSource +
                newReleasesSource +
                acousticMelodiesSource
            )
            .filterNot { it.language.equals("sinhala", ignoreCase = true) }
            .distinctBy { it.id }
    }

    val personalizedForYou = remember(
        personalizationPool,
        playbackInterestVersion,
        catalogDay
    ) {
        if (playbackInterestProfile.playCount < 3) {
            emptyList()
        } else {
            fun interestScore(track: Track): Int {
                var score = 0

                if (!playbackInterestProfile.preferredLanguage.isNullOrBlank() &&
                    track.language.equals(
                        playbackInterestProfile.preferredLanguage,
                        ignoreCase = true
                    )
                ) {
                    score += 6
                }

                playbackInterestProfile.topGenres.forEachIndexed { index, genre ->
                    if (track.genre.contains(genre, ignoreCase = true) ||
                        genre.contains(track.genre, ignoreCase = true)
                    ) {
                        score += 5 - index
                    }
                }

                playbackInterestProfile.topArtists.forEachIndexed { index, artist ->
                    if (track.artist.contains(artist, ignoreCase = true) ||
                        artist.contains(track.artist, ignoreCase = true)
                    ) {
                        score += 7 - index
                    }
                }

                return score
            }

            personalizationPool
                .map { it to interestScore(it) }
                .filter { it.second > 0 }
                .sortedWith(
                    compareByDescending<Pair<Track, Int>> { it.second }
                        .thenByDescending { it.first.popularityScore }
                )
                .map { it.first }
                .distinctBy { it.id }
                .take(4)
        }
    }

    val personalizedArtistMix = remember(
        personalizationPool,
        personalizedForYou,
        playbackInterestVersion,
        catalogDay
    ) {
        if (playbackInterestProfile.playCount < 3 ||
            playbackInterestProfile.topArtists.isEmpty()
        ) {
            emptyList()
        } else {
            val forYouIds = personalizedForYou.mapTo(mutableSetOf()) { it.id }

            personalizationPool
                .filterNot { it.id in forYouIds }
                .filter { track ->
                    playbackInterestProfile.topArtists.any { artist ->
                        track.artist.contains(artist, ignoreCase = true) ||
                            artist.contains(track.artist, ignoreCase = true)
                    }
                }
                .sortedByDescending { it.popularityScore }
                .distinctBy { it.id }
                .take(4)
        }
    }

    val personalizedHomeIds = remember(personalizedForYou, personalizedArtistMix) {
        (personalizedForYou + personalizedArtistMix)
            .mapTo(mutableSetOf()) { it.id }
    }

    // Keep every Home row unique while targeting at least 50 songs per row.
    // Partition the large raw Tamil/international pools FIRST; daily rotation
    // happens only after ownership is assigned, so the same song cannot land
    // in multiple Home catalogues.
    data class UniqueHomeCatalogs(
        val popularTamil: List<Track>,
        val tamilNew: List<Track>,
        val tamilModern: List<Track>,
        val tamilEvergreen: List<Track>,
        val tamilRomantic: List<Track>,
        val tamilDance: List<Track>,
        val popularEnglish: List<Track>,
        val internationalTrending: List<Track>,
        val englishPop: List<Track>,
        val internationalRnB: List<Track>,
        val internationalLove: List<Track>,
        val internationalThrowbacks: List<Track>
    )

    fun semanticCatalogKey(track: Track): String {
        val title =
            track.title.trim()
                .lowercase()
                .replace(Regex("\\s+"), " ")

        val artist =
            track.artist.trim()
                .lowercase()
                .replace(Regex("\\s+"), " ")

        return "$title|$artist"
    }

    fun allocateUniqueSections(
        master: List<Track>,
        preferredPools: List<List<Track>>,
        targetPerSection: Int
    ): List<List<Track>> {
        if (preferredPools.isEmpty()) return emptyList()

        val masterUnique =
            master
                .filter { it.id.isNotBlank() }
                .distinctBy { semanticCatalogKey(it) }

        if (masterUnique.isEmpty()) {
            return List(preferredPools.size) { emptyList() }
        }

        val remaining = linkedMapOf<String, Track>()
        masterUnique.forEach { track ->
            remaining[semanticCatalogKey(track)] = track
        }

        val sections =
            MutableList(preferredPools.size) {
                mutableListOf<Track>()
            }

        // Every catalogue must reach the visible target before any row is
        // allowed to reserve extra songs for future daily rotation.
        val sectionCapacity = targetPerSection + 10

        preferredPools.forEachIndexed { index, pool ->
            for (
                track in pool.distinctBy {
                    semanticCatalogKey(it)
                }
            ) {
                if (sections[index].size >= targetPerSection) break

                val key = semanticCatalogKey(track)
                val available = remaining.remove(key) ?: continue
                sections[index].add(available)
            }
        }

        // First fill only deficient rows. With 6 rows and a 330-song language
        // pool this guarantees 50 per row before any catalogue can take extras.
        var deficitCursor = 0
        var safety = 0

        while (
            remaining.isNotEmpty() &&
            sections.any { it.size < targetPerSection } &&
            safety < 100_000
        ) {
            val sectionIndex = deficitCursor % sections.size

            if (sections[sectionIndex].size < targetPerSection) {
                val first = remaining.entries.first()
                sections[sectionIndex].add(first.value)
                remaining.remove(first.key)
            }

            deficitCursor++
            safety++
        }

        // Only after the visible minimum is satisfied do we distribute up to
        // 10 reserve songs per row for tomorrow's rotation.
        var reserveCursor = 0
        safety = 0

        while (
            remaining.isNotEmpty() &&
            sections.any { it.size < sectionCapacity } &&
            safety < 100_000
        ) {
            val sectionIndex = reserveCursor % sections.size

            if (sections[sectionIndex].size < sectionCapacity) {
                val first = remaining.entries.first()
                sections[sectionIndex].add(first.value)
                remaining.remove(first.key)
            }

            reserveCursor++
            safety++
        }

        // Emergency backfill comes last. Cross-section uniqueness remains
        // the normal rule; reuse happens only if the live source did not
        // contain enough unique songs to keep every catalogue populated.
        sections.forEachIndexed { index, section ->
            if (section.size >= targetPerSection) {
                return@forEachIndexed
            }

            val sectionKeys =
                section
                    .mapTo(mutableSetOf()) {
                        semanticCatalogKey(it)
                    }

            val emergencyPool =
                (
                    preferredPools.getOrElse(index) { emptyList() } +
                        masterUnique
                    )
                    .filter { it.id.isNotBlank() }
                    .distinctBy { semanticCatalogKey(it) }

            for (track in emergencyPool) {
                if (section.size >= targetPerSection) break

                val key = semanticCatalogKey(track)
                if (sectionKeys.add(key)) {
                    section.add(track)
                }
            }
        }

        return sections.map {
            it.distinctBy { track ->
                semanticCatalogKey(track)
            }
        }
    }

    val uniqueHomeCatalogs = remember(
        catalogDay,
        popularTamilSource,
        tamilEvergreenSource,
        tamilRomanticSource,
        tamilDanceSource,
        popularEnglishSource,
        englishPopSource,
        personalizedHomeIds,
        likedTrackIds
    ) {
        val tamilMaster =
            (
                popularTamilSource +
                    tamilEvergreenSource +
                    tamilRomanticSource +
                    tamilDanceSource
                )
                .filterNot { it.id in personalizedHomeIds }
                .distinctBy { semanticCatalogKey(it) }

        val tamilNewPool =
            popularTamilSource.filter {
                it.year >= 2023 || it.isTrendingNow
            }

        val tamilModernPool =
            popularTamilSource.filter {
                it.year in 2010..2022
            }

        val tamilRomanticPool =
            popularTamilSource.filter {
                it.genre.contains("Love", ignoreCase = true) ||
                    it.genre.contains("Romantic", ignoreCase = true) ||
                    it.genre.contains("Acoustic", ignoreCase = true) ||
                    it.genre.contains("Melody", ignoreCase = true)
            } + tamilRomanticSource

        val tamilDancePool =
            popularTamilSource.filter {
                it.genre.contains("Dance", ignoreCase = true) ||
                    it.genre.contains("Kuthu", ignoreCase = true) ||
                    it.genre.contains("Party", ignoreCase = true) ||
                    it.genre.contains("Pop", ignoreCase = true)
            } + tamilDanceSource

        val tamilEvergreenPool =
            (
                popularTamilSource.filter { it.year in 1900..2009 } +
                    tamilEvergreenSource
                )
                .sortedBy { it.year }

        val tamilSections =
            allocateUniqueSections(
                master = tamilMaster,
                preferredPools = listOf(
                    tamilNewPool,
                    tamilRomanticPool,
                    tamilDancePool,
                    tamilEvergreenPool,
                    tamilModernPool,
                    popularTamilSource
                ),
                targetPerSection = homeCatalogTarget
            )

        val internationalMaster =
            (popularEnglishSource + englishPopSource)
                .filterNot { it.id in personalizedHomeIds }
                .distinctBy { semanticCatalogKey(it) }

        val internationalTrendingPool =
            popularEnglishSource.filter {
                it.year >= 2023 || it.isTrendingNow
            }

        val internationalRnBPool =
            popularEnglishSource.filter {
                it.genre.contains("R&B", ignoreCase = true) ||
                    it.genre.contains("Soul", ignoreCase = true) ||
                    it.genre.contains("Synthwave", ignoreCase = true)
            }

        val internationalLovePool =
            popularEnglishSource.filter {
                it.genre.contains("Love", ignoreCase = true) ||
                    it.genre.contains("Romantic", ignoreCase = true) ||
                    it.genre.contains("Acoustic", ignoreCase = true) ||
                    it.genre.contains("Pop", ignoreCase = true)
            }

        val internationalThrowbackPool =
            popularEnglishSource.filter {
                it.year in 1900..2019
            }

        val internationalSections =
            allocateUniqueSections(
                master = internationalMaster,
                preferredPools = listOf(
                    internationalTrendingPool,
                    internationalRnBPool,
                    internationalLovePool,
                    internationalThrowbackPool,
                    englishPopSource,
                    popularEnglishSource
                ),
                targetPerSection = homeCatalogTarget
            )

        fun rotate(
            tracks: List<Track>,
            key: String
        ): List<Track> {
            return dailyRotatedCatalog(
                context = context,
                pool = tracks,
                catalogKey = key,
                dayIndex = catalogDay,
                targetCount = homeCatalogTarget,
                likedTrackIds = likedTrackIds
            )
        }

        UniqueHomeCatalogs(
            popularTamil =
                rotate(
                    tamilSections.getOrElse(5) { emptyList() },
                    "home_unique_popular_tamil_50"
                ),
            tamilNew =
                rotate(
                    tamilSections.getOrElse(0) { emptyList() },
                    "home_unique_tamil_new_50"
                ),
            tamilModern =
                rotate(
                    tamilSections.getOrElse(4) { emptyList() },
                    "home_unique_tamil_modern_50"
                ),
            tamilEvergreen =
                rotate(
                    tamilSections.getOrElse(3) { emptyList() },
                    "home_unique_tamil_evergreen_50"
                ),
            tamilRomantic =
                rotate(
                    tamilSections.getOrElse(1) { emptyList() },
                    "home_unique_tamil_romantic_50"
                ),
            tamilDance =
                rotate(
                    tamilSections.getOrElse(2) { emptyList() },
                    "home_unique_tamil_dance_50"
                ),
            popularEnglish =
                rotate(
                    internationalSections.getOrElse(5) { emptyList() },
                    "home_unique_international_chart_50"
                ),
            internationalTrending =
                rotate(
                    internationalSections.getOrElse(0) { emptyList() },
                    "home_unique_international_trending_50"
                ),
            englishPop =
                rotate(
                    internationalSections.getOrElse(4) { emptyList() },
                    "home_unique_international_pop_50"
                ),
            internationalRnB =
                rotate(
                    internationalSections.getOrElse(1) { emptyList() },
                    "home_unique_international_rnb_50"
                ),
            internationalLove =
                rotate(
                    internationalSections.getOrElse(2) { emptyList() },
                    "home_unique_international_love_50"
                ),
            internationalThrowbacks =
                rotate(
                    internationalSections.getOrElse(3) { emptyList() },
                    "home_unique_international_throwbacks_50"
                )
        )
    }

    val likedSongs = likedTracks

    // Expand the shared language pools in the background so every main
    // Home catalogue can hold at least 50 unique songs. The ViewModel limits
    // concurrency and deduplicates by title + artist.
    LaunchedEffect(Unit) {
        viewModel.ensureHomeCatalogMinimum(homeCatalogTarget)
    }
    val greeting = remember { viewModel.getTimeGreeting() }

    var selectedCategory by remember { mutableStateOf("All") }
    var activeNavTab by remember { mutableStateOf("home") }
    var isFullPlayerVisible by remember { mutableStateOf(false) }
    var isAudioRouteDialogVisible by remember { mutableStateOf(false) }
    var isEqDialogVisible by remember { mutableStateOf(false) }
    var isSettingsPageVisible by remember { mutableStateOf(false) }
    var isEditProfileDialogVisible by remember { mutableStateOf(false) }
    var isAuthDialogVisible by remember { mutableStateOf(false) }
    var playlistTargetTrack by remember { mutableStateOf<Track?>(null) }
    var cloudPlaylists by remember { mutableStateOf<List<CloudPlaylist>>(emptyList()) }
    var playlistLoading by remember { mutableStateOf(false) }

    LaunchedEffect(isAudioRouteDialogVisible) {
        while (isAudioRouteDialogVisible) {
            viewModel.refreshAudioRoutes()
            delay(1500L)
        }
    }
    var playlistSaving by remember { mutableStateOf(false) }
    var playlistMessage by remember { mutableStateOf<String?>(null) }
    var searchPlaylistMenuId by remember {
        mutableStateOf<String?>(null)
    }
    var searchPlaylistLibraryActionId by remember {
        mutableStateOf<String?>(null)
    }
    var searchPlaylistLibraryMessage by remember {
        mutableStateOf<String?>(null)
    }
    val playlistScope = rememberCoroutineScope()
    // Search page history only
    var recentSearches by remember { mutableStateOf<List<String>>(emptyList()) }
    var recentPlays by remember { mutableStateOf<List<Track>>(emptyList()) }

    LaunchedEffect(searchQuery, searchResults, isSearching) {
        val cleanQuery = searchQuery.trim()
        if (cleanQuery.length >= 2 && !isSearching && searchResults.isNotEmpty()) {
            recentSearches = (listOf(cleanQuery) + recentSearches.filterNot {
                it.equals(cleanQuery, ignoreCase = true)
            }).take(5)
        }
    }

    LaunchedEffect(currentTrack?.id) {
        currentTrack?.let { track ->
            recentPlays = (listOf(track) + recentPlays.filterNot {
                it.id == track.id
            }).take(5)
        }
    }

    LaunchedEffect(playlistTargetTrack) {
        if (playlistTargetTrack != null) {
            playlistLoading = true
            playlistMessage = null
            val result = SabdhamLibraryService.getPlaylists(context)
            if (playlistTargetTrack != null) {
                if (result.success) { cloudPlaylists = result.playlists }
                playlistMessage = if (result.success) null else result.message
                playlistLoading = false
            }
        }
    }

    val authViewModel: AuthViewModel = viewModel()
    val authUser by authViewModel.user.collectAsState()
    val authToken by authViewModel.token.collectAsState()

    LaunchedEffect(authUser?.id, authToken) {
        if (authUser != null && !authToken.isNullOrBlank()) {
            com.morningmusic.app.data.network.SabdhamSettingsSyncService
                .syncFromServer(context)
            applySabdhamAudioPreferences(context)

            viewModel.loadLikedSongsFromCloud()

            playlistLoading = true
            val result = SabdhamLibraryService.getPlaylists(context)
            if (result.success) { cloudPlaylists = result.playlists }
            playlistMessage = if (result.success) null else result.message
            playlistLoading = false
        } else {
            // Keep existing playlists while auth/session is restoring.
            // Temporary null user is NOT a library deletion.
        }
    }
    val authLoading by authViewModel.loading.collectAsState()

    val categories = listOf("All", "Tamil", "International", "Trending", "Liked Songs")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D0D11))
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = if (currentTrack != null) 180.dp else 100.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // App Header & Time Greeting - Home only
            if (activeNavTab == "home") {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "SABDHAM MUSIC",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1DB954),
                            letterSpacing = 1.5.sp
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = greeting,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                    }

                    Image(
                        painter = androidx.compose.ui.res.painterResource(R.drawable.sabdham_logo),
                        contentDescription = "SABDHAM",
                        contentScale = ContentScale.FillBounds,
                        modifier = Modifier
                            .size(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                    )

                }
            }
            }

            // SABDHAM Search Header + Search Box
            if (activeNavTab == "search") {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = "Search",
                            color = Color.White,
                            fontSize = 30.sp,
                            fontWeight = FontWeight.ExtraBold
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { viewModel.onSearchQueryChange(it) },
                            placeholder = {
                                Text(
                                    "Songs, artists, albums, playlists...",
                                    color = Color(0xFF77777F),
                                    fontSize = 14.sp
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = "Search",
                                    tint = Color(0xFF00E676)
                                )
                            },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(
                                        onClick = {
                                            viewModel.onSearchQueryChange("")
                                        }
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Clear,
                                            contentDescription = "Clear search",
                                            tint = Color(0xFF00E676)
                                        )
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                cursorColor = Color(0xFF00E676),
                                focusedBorderColor = Color(0xFF00E676),
                                unfocusedBorderColor = Color(0xFF214D36),
                                focusedContainerColor = Color(0xFF111915),
                                unfocusedContainerColor = Color(0xFF111915)
                            ),
                            singleLine = true
                        )
                    }
                }
            }
            // Category Filter Pills
            if (activeNavTab == "home") {
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(categories) { cat ->
                            val isSelected = selectedCategory == cat
                            FilterChip(
                                selected = isSelected,
                                onClick = { selectedCategory = cat },
                                label = {
                                    Text(
                                        cat,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp
                                    )
                                },
                                shape = RoundedCornerShape(20.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF1DB954),
                                    selectedLabelColor = Color.Black,
                                    containerColor = Color(0xFF1E1E24),
                                    labelColor = Color(0xFFDDDDDD)
                                ),
                                border = null
                            )
                        }
                    }
                }
            }

            // Search Content / Normal Catalog
            if (activeNavTab == "search") {

                if (searchQuery.isBlank()) {

                    // Recent Searches
                    if (recentSearches.isNotEmpty()) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Recent Searches",
                                    color = Color.White,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                Text(
                                    text = "Clear All",
                                    color = Color(0xFF00E676),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.clickable {
                                        recentSearches = emptyList()
                                    }
                                )
                            }
                        }

                        items(
                            items = recentSearches,
                            key = { "recent-search-$it" }
                        ) { recent ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 18.dp, vertical = 3.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFF151A17))
                                    .clickable {
                                        viewModel.onSearchQueryChange(recent)
                                    }
                                    .padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.History,
                                    contentDescription = null,
                                    tint = Color(0xFF00E676),
                                    modifier = Modifier.size(21.dp)
                                )

                                Text(
                                    text = recent,
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(horizontal = 14.dp)
                                )

                                IconButton(
                                    onClick = {
                                        recentSearches =
                                            recentSearches.filterNot { it == recent }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Remove",
                                        tint = Color(0xFF7D8580),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Recent Plays
                    if (recentPlays.isNotEmpty()) {
                        item {
                            Text(
                                text = "Recent Plays",
                                color = Color.White,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(
                                    start = 20.dp,
                                    end = 20.dp,
                                    top = 22.dp,
                                    bottom = 8.dp
                                )
                            )
                        }

                        items(
                            items = recentPlays,
                            key = { "recent-play-${it.id}" }
                        ) { track ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 18.dp, vertical = 4.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFF151A17))
                                    .clickable {
                                        viewModel.playTrack(track, recentPlays)
                                    }
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AsyncImage(
                                    model = rememberSabdhamArtworkModel(track),
                                    placeholder = painterResource(R.drawable.sabdham_default_song),
                                    error = painterResource(R.drawable.sabdham_default_song),
                                    fallback = painterResource(R.drawable.sabdham_default_song),
                                    contentDescription = track.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(54.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                )

                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(start = 12.dp)
                                ) {
                                    Text(
                                        text = track.title,
                                        color = Color.White,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Spacer(modifier = Modifier.height(3.dp))

                                    Text(
                                        text = track.artist,
                                        color = Color(0xFF8B928E),
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                } else {
                    val openedPlaylist = openedSearchPlaylist

                    if (openedPlaylist != null) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(
                                        horizontal = 12.dp,
                                        vertical = 8.dp
                                    ),
                                verticalAlignment =
                                    Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = {
                                        viewModel.closeSearchPlaylist()
                                    }
                                ) {
                                    Icon(
                                        imageVector =
                                            Icons.Default.ArrowBack,
                                        contentDescription =
                                            "Back to search results",
                                        tint = Color.White
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .size(58.dp)
                                        .clip(
                                            RoundedCornerShape(12.dp)
                                        )
                                        .background(
                                            Color(0xFF202922)
                                        ),
                                    contentAlignment =
                                        Alignment.Center
                                ) {
                                    Image(
                                        painter =
                                            painterResource(
                                                R.drawable
                                                    .ic_playlist_sabdham
                                            ),
                                        contentDescription =
                                            "Playlist",
                                        modifier =
                                            Modifier.size(42.dp),
                                        contentScale =
                                            ContentScale.Crop
                                    )
                                }

                                Spacer(Modifier.width(12.dp))

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = openedPlaylist.title,
                                        color = Color.White,
                                        fontSize = 18.sp,
                                        fontWeight =
                                            FontWeight.Bold,
                                        maxLines = 2,
                                        overflow =
                                            TextOverflow.Ellipsis
                                    )

                                    Text(
                                        text = openedPlaylist.owner,
                                        color = Color(0xFF9AA29D),
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow =
                                            TextOverflow.Ellipsis
                                    )

                                    val shownCount =
                                        if (
                                            openedSearchPlaylistTracks
                                                .isNotEmpty()
                                        ) {
                                            openedSearchPlaylistTracks.size
                                        } else {
                                            openedPlaylist.itemCount
                                        }

                                    if (shownCount > 0) {
                                        Text(
                                            text =
                                                "$shownCount songs",
                                            color =
                                                Color(0xFF00E676),
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                        }

                        if (
                            loadingSearchPlaylistId ==
                                openedPlaylist.id &&
                            openedSearchPlaylistTracks.isEmpty()
                        ) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(180.dp),
                                    contentAlignment =
                                        Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        color =
                                            Color(0xFF00E676)
                                    )
                                }
                            }
                        } else if (
                            openedSearchPlaylistTracks.isEmpty()
                        ) {
                            item {
                                Text(
                                    text =
                                        searchPlaylistMessage
                                            ?: "No playable songs found in this playlist",
                                    color = Color(0xFFB8C0BB),
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(
                                        horizontal = 20.dp,
                                        vertical = 24.dp
                                    )
                                )
                            }
                        } else {
                            item {
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(
                                            horizontal = 18.dp,
                                            vertical = 8.dp
                                        )
                                        .clickable {
                                            viewModel.playPlaylist(
                                                openedSearchPlaylistTracks
                                            )
                                        },
                                    shape =
                                        RoundedCornerShape(14.dp),
                                    color = Color(0xFF00E676)
                                ) {
                                    Row(
                                        modifier =
                                            Modifier.padding(
                                                horizontal = 18.dp,
                                                vertical = 13.dp
                                            ),
                                        verticalAlignment =
                                            Alignment.CenterVertically,
                                        horizontalArrangement =
                                            Arrangement.Center
                                    ) {
                                        Icon(
                                            imageVector =
                                                Icons.Default
                                                    .PlayArrow,
                                            contentDescription =
                                                null,
                                            tint =
                                                Color(0xFF07130B)
                                        )

                                        Spacer(
                                            Modifier.width(7.dp)
                                        )

                                        Text(
                                            text = "Play All",
                                            color =
                                                Color(0xFF07130B),
                                            fontWeight =
                                                FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            items(
                                items =
                                    openedSearchPlaylistTracks,
                                key = {
                                    "search-playlist-" +
                                        openedPlaylist.id +
                                        "-" +
                                        it.id
                                }
                            ) { track ->
                                val isThisPlaying =
                                    currentTrack?.id == track.id

                                TrackListItem(
                                    track = track,
                                    isActive = isThisPlaying,
                                    isPlaying =
                                        isThisPlaying &&
                                            isPlaying,
                                    isLiked =
                                        likedTrackIds.contains(
                                            track.id
                                        ),
                                    onTrackClick = {
                                        viewModel
                                            .playPlaylistTrack(
                                                track =
                                                    track,
                                                sourceQueue =
                                                    openedSearchPlaylistTracks
                                            )
                                    },
                                    onLikeClick = {
                                        viewModel.toggleLike(track)
                                    },
                                    onAddToQueue = {
                                        viewModel.addToQueue(
                                            track
                                        )
                                    },
                                    onAddToPlaylist = {
                                        playlistTargetTrack =
                                            track
                                    }
                                )
                            }
                        }
                    } else {

                    val hasSearchContent =
                        searchResults.isNotEmpty() ||
                            searchPlaylistResults.isNotEmpty()

                    if (isSearching && !hasSearchContent) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(220.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    color = Color(0xFF00E676)
                                )
                            }
                        }
                    } else if (!isSearching && !hasSearchContent) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        "No results found",
                                        color = Color.White,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )

                                    Text(
                                        "Try another song, artist or playlist",
                                        color = Color.Gray,
                                        fontSize = 12.sp,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                            }
                        }
                    } else {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(
                                        horizontal = 18.dp,
                                        vertical = 8.dp
                                    ),
                                horizontalArrangement =
                                    Arrangement.spacedBy(10.dp)
                            ) {
                                Surface(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    color = Color(0xFF142019),
                                    border = BorderStroke(
                                        1.dp,
                                        Color(0xFF00E676)
                                            .copy(alpha = 0.24f)
                                    )
                                ) {
                                    Row(
                                        modifier = Modifier.padding(
                                            horizontal = 12.dp,
                                            vertical = 10.dp
                                        ),
                                        verticalAlignment =
                                            Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector =
                                                Icons.Default.MusicNote,
                                            contentDescription = null,
                                            tint = Color(0xFF00E676),
                                            modifier = Modifier.size(19.dp)
                                        )

                                        Spacer(Modifier.width(8.dp))

                                        Column {
                                            Text(
                                                text = "Songs",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight =
                                                    FontWeight.Bold
                                            )
                                            Text(
                                                text =
                                                    searchResults.size
                                                        .toString(),
                                                color =
                                                    Color(0xFF8B928E),
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }

                                Surface(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    color = Color(0xFF142019),
                                    border = BorderStroke(
                                        1.dp,
                                        Color(0xFF00E676)
                                            .copy(alpha = 0.24f)
                                    )
                                ) {
                                    Row(
                                        modifier = Modifier.padding(
                                            horizontal = 12.dp,
                                            vertical = 10.dp
                                        ),
                                        verticalAlignment =
                                            Alignment.CenterVertically
                                    ) {
                                        Image(
                                            painter = painterResource(
                                                R.drawable
                                                    .ic_playlist_sabdham
                                            ),
                                            contentDescription = null,
                                            modifier = Modifier.size(20.dp),
                                            contentScale =
                                                ContentScale.Crop
                                        )

                                        Spacer(Modifier.width(8.dp))

                                        Column {
                                            Text(
                                                text = "Playlists",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight =
                                                    FontWeight.Bold
                                            )
                                            Text(
                                                text =
                                                    searchPlaylistResults
                                                        .size
                                                        .toString(),
                                                color =
                                                    Color(0xFF8B928E),
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        if (searchPlaylistResults.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    "Playlists (${searchPlaylistResults.size})"
                                )
                            }

                            item {
                                LazyRow(
                                    contentPadding =
                                        PaddingValues(
                                            horizontal = 18.dp
                                        ),
                                    horizontalArrangement =
                                        Arrangement.spacedBy(10.dp)
                                ) {
                                    items(
                                        items = searchPlaylistResults,
                                        key = { it.id }
                                    ) { playlist ->
                                        val loading =
                                            loadingSearchPlaylistId ==
                                                playlist.id

                                        Surface(
                                            modifier = Modifier
                                                .width(230.dp)
                                                .clip(
                                                    RoundedCornerShape(
                                                        16.dp
                                                    )
                                                )
                                                .clickable(
                                                    enabled =
                                                        loadingSearchPlaylistId ==
                                                            null
                                                ) {
                                                    viewModel
                                                        .openSearchPlaylist(
                                                            playlist
                                                        )
                                                },
                                            shape =
                                                RoundedCornerShape(16.dp),
                                            color = Color(0xFF171D19),
                                            border = BorderStroke(
                                                1.dp,
                                                Color(0xFF274832)
                                            )
                                        ) {
                                            Row(
                                                modifier =
                                                    Modifier.padding(12.dp),
                                                verticalAlignment =
                                                    Alignment.CenterVertically
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(58.dp)
                                                        .clip(
                                                            RoundedCornerShape(
                                                                12.dp
                                                            )
                                                        )
                                                        .background(
                                                            Color(
                                                                0xFF202922
                                                            )
                                                        ),
                                                    contentAlignment =
                                                        Alignment.Center
                                                ) {
                                                    Image(
                                                        painter =
                                                            painterResource(
                                                                R.drawable
                                                                    .ic_playlist_sabdham
                                                            ),
                                                        contentDescription =
                                                            "Playlist",
                                                        modifier =
                                                            Modifier.size(
                                                                42.dp
                                                            ),
                                                        contentScale =
                                                            ContentScale.Crop
                                                    )
                                                }

                                                Spacer(
                                                    Modifier.width(10.dp)
                                                )

                                                Column(
                                                    modifier =
                                                        Modifier.weight(1f)
                                                ) {
                                                    Text(
                                                        text =
                                                            playlist.title,
                                                        color = Color.White,
                                                        fontSize = 14.sp,
                                                        fontWeight =
                                                            FontWeight
                                                                .SemiBold,
                                                        maxLines = 2,
                                                        overflow =
                                                            TextOverflow
                                                                .Ellipsis
                                                    )

                                                    Spacer(
                                                        Modifier.height(3.dp)
                                                    )

                                                    Text(
                                                        text =
                                                            if (
                                                                playlist.source
                                                                    .equals(
                                                                        "spotify",
                                                                        ignoreCase = true
                                                                    )
                                                            ) {
                                                                "Spotify • " +
                                                                    playlist.owner
                                                            } else {
                                                                playlist.owner
                                                            },
                                                        color =
                                                            Color(
                                                                0xFF8B928E
                                                            ),
                                                        fontSize = 11.sp,
                                                        maxLines = 1,
                                                        overflow =
                                                            TextOverflow
                                                                .Ellipsis
                                                    )

                                                    if (
                                                        playlist.itemCount > 0
                                                    ) {
                                                        Text(
                                                            text =
                                                                "${playlist.itemCount} songs",
                                                            color =
                                                                Color(
                                                                    0xFF00E676
                                                                ),
                                                            fontSize = 10.sp
                                                        )
                                                    }
                                                }

                                                Column(
                                                    horizontalAlignment =
                                                        Alignment.CenterHorizontally
                                                ) {
                                                    if (loading) {
                                                        CircularProgressIndicator(
                                                            modifier =
                                                                Modifier.size(
                                                                    22.dp
                                                                ),
                                                            color =
                                                                Color(
                                                                    0xFF00E676
                                                                ),
                                                            strokeWidth = 2.dp
                                                        )
                                                    } else {
                                                        Icon(
                                                            imageVector =
                                                                Icons.Default
                                                                    .KeyboardArrowRight,
                                                            contentDescription =
                                                                "Open playlist",
                                                            tint =
                                                                Color(
                                                                    0xFF00E676
                                                                ),
                                                            modifier =
                                                                Modifier.size(
                                                                    22.dp
                                                                )
                                                        )
                                                    }

                                                    Box {
                                                        IconButton(
                                                            onClick = {
                                                                searchPlaylistMenuId =
                                                                    playlist.id
                                                            },
                                                            modifier =
                                                                Modifier.size(
                                                                    34.dp
                                                                )
                                                        ) {
                                                            Icon(
                                                                imageVector =
                                                                    Icons.Default
                                                                        .MoreVert,
                                                                contentDescription =
                                                                    "Playlist options",
                                                                tint =
                                                                    Color(
                                                                        0xFF9AA29D
                                                                    ),
                                                                modifier =
                                                                    Modifier.size(
                                                                        20.dp
                                                                    )
                                                            )
                                                        }

                                                        DropdownMenu(
                                                            expanded =
                                                                searchPlaylistMenuId ==
                                                                    playlist.id,
                                                            onDismissRequest = {
                                                                searchPlaylistMenuId =
                                                                    null
                                                            },
                                                            containerColor =
                                                                Color(
                                                                    0xFF171A18
                                                                )
                                                        ) {
                                                            DropdownMenuItem(
                                                                text = {
                                                                    Text(
                                                                        text =
                                                                            if (
                                                                                searchPlaylistLibraryActionId ==
                                                                                    playlist.id
                                                                            ) {
                                                                                "Adding to Library..."
                                                                            } else {
                                                                                "Add to Library"
                                                                            },
                                                                        color =
                                                                            Color.White
                                                                    )
                                                                },
                                                                leadingIcon = {
                                                                    Icon(
                                                                        imageVector =
                                                                            Icons.Default
                                                                                .LibraryAdd,
                                                                        contentDescription =
                                                                            null,
                                                                        tint =
                                                                            Color(
                                                                                0xFF00E676
                                                                            )
                                                                    )
                                                                },
                                                                enabled =
                                                                    searchPlaylistLibraryActionId ==
                                                                        null,
                                                                onClick = {
                                                                    searchPlaylistMenuId =
                                                                        null

                                                                    if (
                                                                        authUser ==
                                                                        null
                                                                    ) {
                                                                        isAuthDialogVisible =
                                                                            true
                                                                    } else if (
                                                                        searchPlaylistLibraryActionId ==
                                                                            null
                                                                    ) {
                                                                        searchPlaylistLibraryActionId =
                                                                            playlist.id
                                                                        searchPlaylistLibraryMessage =
                                                                            null

                                                                        playlistScope.launch {
                                                                            val result =
                                                                                SabdhamLibraryService
                                                                                    .importYouTubePlaylist(
                                                                                        context =
                                                                                            context,
                                                                                        playlistId =
                                                                                            playlist.id,
                                                                                        playlistName =
                                                                                            playlist.title,
                                                                                        playlistOwner =
                                                                                            playlist.owner
                                                                                    )

                                                                            if (
                                                                                result.success
                                                                            ) {
                                                                                if (
                                                                                    result.playlists
                                                                                        .isNotEmpty()
                                                                                ) {
                                                                                    cloudPlaylists =
                                                                                        result.playlists
                                                                                } else {
                                                                                    val refreshed =
                                                                                        SabdhamLibraryService
                                                                                            .getPlaylists(
                                                                                                context
                                                                                            )

                                                                                    if (
                                                                                        refreshed.success
                                                                                    ) {
                                                                                        cloudPlaylists =
                                                                                            refreshed.playlists
                                                                                    }
                                                                                }
                                                                            }

                                                                            searchPlaylistLibraryMessage =
                                                                                result.message

                                                                            if (
                                                                                searchPlaylistLibraryActionId ==
                                                                                    playlist.id
                                                                            ) {
                                                                                searchPlaylistLibraryActionId =
                                                                                    null
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            )

                                                            DropdownMenuItem(
                                                                text = {
                                                                    Text(
                                                                        text =
                                                                            if (
                                                                                searchPlaylistActionId ==
                                                                                    playlist.id
                                                                            ) {
                                                                                "Adding to Queue..."
                                                                            } else {
                                                                                "Add to Queue"
                                                                            },
                                                                        color =
                                                                            Color.White
                                                                    )
                                                                },
                                                                leadingIcon = {
                                                                    Icon(
                                                                        imageVector =
                                                                            Icons.Default
                                                                                .PlaylistAdd,
                                                                        contentDescription =
                                                                            null,
                                                                        tint =
                                                                            Color(
                                                                                0xFF00E676
                                                                            )
                                                                    )
                                                                },
                                                                enabled =
                                                                    searchPlaylistActionId ==
                                                                        null,
                                                                onClick = {
                                                                    searchPlaylistMenuId =
                                                                        null
                                                                    viewModel
                                                                        .addSearchPlaylistToQueue(
                                                                            playlist
                                                                        )
                                                                }
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        val playlistSearchFeedback =
                            searchPlaylistLibraryMessage
                                ?: searchPlaylistMessage

                        if (!playlistSearchFeedback.isNullOrBlank()) {
                            item {
                                val isError =
                                    playlistSearchFeedback
                                        .orEmpty()
                                        .lowercase()
                                        .let { message ->
                                            message.contains("unable") ||
                                                message.contains("failed") ||
                                                message.contains("no playable") ||
                                                message.contains("could not")
                                        }

                                Text(
                                    text =
                                        playlistSearchFeedback.orEmpty(),
                                    color =
                                        if (isError) {
                                            Color(0xFFFFB4AB)
                                        } else {
                                            Color(0xFF00E676)
                                        },
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(
                                        horizontal = 20.dp,
                                        vertical = 8.dp
                                    )
                                )
                            }
                        }

                        if (searchResults.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    "Songs (${searchResults.size})"
                                )
                            }

                            items(
                                items = searchResults,
                                key = { it.id }
                            ) { track ->
                                val isThisPlaying =
                                    currentTrack?.id == track.id

                                TrackListItem(
                                    track = track,
                                    isActive = isThisPlaying,
                                    isPlaying =
                                        isThisPlaying && isPlaying,
                                    isLiked =
                                        likedTrackIds.contains(track.id),
                                    onTrackClick = {
                                        viewModel.playSearchTrack(
                                            track = track,
                                            sourceResults =
                                                searchResults
                                        )
                                    },
                                    onLikeClick = {
                                        viewModel.toggleLike(track)
                                    },
                                    onAddToQueue = {
                                        viewModel.addToQueue(track)
                                    },
                                    onAddToPlaylist = {
                                        playlistTargetTrack = track
                                    }
                                )
                            }
                        }

                        if (isSearching) {
                            item {
                                LinearProgressIndicator(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(
                                            horizontal = 20.dp,
                                            vertical = 10.dp
                                        ),
                                    color = Color(0xFF00E676),
                                    trackColor = Color(0xFF263029)
                                )
                            }
                        }
                    }
                    }
                }            } else if (activeNavTab == "home") {
                // Category-filtered Catalog Views
                when (selectedCategory) {
                    "Tamil" -> {
                        item {
                            SectionHeader("Tamil Collection (${tamilCatalog.size})") { viewModel.playCatalog(tamilCatalog) }
                            VerticalTrackList(
                                tracks = tamilCatalog,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playCatalogTrack(it, tamilCatalog) },
                                onLikeClick = { viewModel.toggleLike(it) }
                            )
                        }
                    }
                    "International" -> {
                        item {
                            SectionHeader("International Collection (${internationalCatalog.size})") { viewModel.playCatalog(internationalCatalog) }
                            VerticalTrackList(
                                tracks = internationalCatalog,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playCatalogTrack(it, internationalCatalog) },
                                onLikeClick = { viewModel.toggleLike(it) }
                            )
                        }
                    }
                    "Trending" -> {
                        item {
                            SectionHeader("Trending Viral Hits (${dailyTrending.size})") { viewModel.playCatalog(dailyTrending) }
                            VerticalTrackList(
                                tracks = dailyTrending,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playCatalogTrack(it, dailyTrending) },
                                onLikeClick = { viewModel.toggleLike(it) }
                            )
                        }
                    }
                    "Liked Songs" -> {
                        val likedList = likedTracks
                        item {
                            SectionHeader("Your Liked Songs (${likedList.size})") { viewModel.playCatalog(likedList) }
                            if (likedList.isEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(180.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("No liked tracks yet. Tap heart on any track!", color = Color.Gray, fontSize = 14.sp)
                                }
                            } else {
                                VerticalTrackList(
                                    tracks = likedList,
                                    currentTrack = currentTrack,
                                    isPlaying = isPlaying,
                                    likedTrackIds = likedTrackIds,
                                    onTrackClick = { viewModel.playCatalogTrack(it, likedList) },
                                    onLikeClick = { viewModel.toggleLike(it) }
                                )
                            }
                        }
                    }
                    else -> {
                        // "All" - Full Rich Multi-Section Layout
                        if (likedSongs.isNotEmpty()) {
                            item {
                                SectionHeader("Liked Songs") { viewModel.playCatalog(likedSongs) }
                                HorizontalTrackGrid(
                                    tracks = likedSongs,
                                    currentTrack = currentTrack,
                                    isPlaying = isPlaying,
                                    likedTrackIds = likedTrackIds,
                                    onTrackClick = { viewModel.playCatalogTrack(it, likedSongs) },
                                    onLikeClick = { viewModel.toggleLike(it) },
                                    onAddToQueue = { viewModel.addToQueue(it) },
                                    onAddToPlaylist = { playlistTargetTrack = it }
                                )
                            }
                        }

                        if (personalizedForYou.isNotEmpty()) {
                            item {
                                SectionHeader("For You") { viewModel.playCatalog(personalizedForYou) }
                                HorizontalTrackGrid(
                                    tracks = personalizedForYou,
                                    currentTrack = currentTrack,
                                    isPlaying = isPlaying,
                                    likedTrackIds = likedTrackIds,
                                    onTrackClick = { viewModel.playCatalogTrack(it, personalizedForYou) },
                                    onLikeClick = { viewModel.toggleLike(it) },
                                    onAddToQueue = { viewModel.addToQueue(it) },
                                    onAddToPlaylist = { playlistTargetTrack = it }
                                )
                            }
                        }

                        if (personalizedArtistMix.isNotEmpty()) {
                            item {
                                SectionHeader("Favorite Artists Mix") { viewModel.playCatalog(personalizedArtistMix) }
                                HorizontalTrackGrid(
                                    tracks = personalizedArtistMix,
                                    currentTrack = currentTrack,
                                    isPlaying = isPlaying,
                                    likedTrackIds = likedTrackIds,
                                    onTrackClick = { viewModel.playCatalogTrack(it, personalizedArtistMix) },
                                    onLikeClick = { viewModel.toggleLike(it) },
                                    onAddToQueue = { viewModel.addToQueue(it) },
                                    onAddToPlaylist = { playlistTargetTrack = it }
                                )
                            }
                        }

                        item {
                            SectionHeader("Popular Tamil Hits") { viewModel.playCatalog(uniqueHomeCatalogs.popularTamil) }
                            HorizontalTrackGrid(
                                tracks = uniqueHomeCatalogs.popularTamil,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playCatalogTrack(it, uniqueHomeCatalogs.popularTamil) },
                                onLikeClick = { viewModel.toggleLike(it) },
                                onAddToQueue = { viewModel.addToQueue(it) },
                                onAddToPlaylist = { playlistTargetTrack = it },
                                onLoadMore = { viewModel.loadMoreTamil() }
                            )
                        }

                        item {
                            SectionHeader("International Chartbusters") { viewModel.playCatalog(uniqueHomeCatalogs.popularEnglish) }
                            HorizontalTrackGrid(
                                tracks = uniqueHomeCatalogs.popularEnglish,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playCatalogTrack(it, uniqueHomeCatalogs.popularEnglish) },
                                onLikeClick = { viewModel.toggleLike(it) },
                                onAddToQueue = { viewModel.addToQueue(it) },
                                onAddToPlaylist = { playlistTargetTrack = it },
                                onLoadMore = { viewModel.loadMoreEnglish() }
                            )
                        }

                        // Featured Artists Row
                        item {
                            SectionHeader("Featured Artists")
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                items(viewModel.artists) { artist ->
                                    ArtistCard(artist = artist, onArtistClick = {
                                        activeNavTab = "search"
                                        viewModel.onSearchQueryChange(artist.name)
                                    })
                                }
                            }
                        }

                        // Explore Genres
                        item {
                            SectionHeader("Explore Genres")
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(viewModel.genres) { genre ->
                                    GenreCard(genre = genre, onGenreClick = {
                                        activeNavTab = "search"
                                        viewModel.onSearchQueryChange(genre.name)
                                    })
                                }
                            }
                        }

                        item {
                            SectionHeader("Tamil New & Trending") { viewModel.playCatalog(uniqueHomeCatalogs.tamilNew) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.tamilNew,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.tamilNew) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                        item {
                            SectionHeader("Tamil Modern Hits") { viewModel.playCatalog(uniqueHomeCatalogs.tamilModern) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.tamilModern,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.tamilModern) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                        item {
                            SectionHeader("Tamil Evergreen Classics") { viewModel.playCatalog(uniqueHomeCatalogs.tamilEvergreen) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.tamilEvergreen,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.tamilEvergreen) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it },
                                onLoadMore={ viewModel.loadMoreTamilEvergreen() }
                            )
                        }

                        item {
                            SectionHeader("Tamil Romantic Hits") { viewModel.playCatalog(uniqueHomeCatalogs.tamilRomantic) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.tamilRomantic,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.tamilRomantic) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it },
                                onLoadMore={ viewModel.loadMoreTamilRomantic() }
                            )
                        }

                        item {
                            SectionHeader("Tamil Party & Dance") { viewModel.playCatalog(uniqueHomeCatalogs.tamilDance) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.tamilDance,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.tamilDance) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it },
                                onLoadMore={ viewModel.loadMoreTamilDance() }
                            )
                        }

                        item {
                            SectionHeader("International Pop Hits") { viewModel.playCatalog(uniqueHomeCatalogs.englishPop) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.englishPop,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.englishPop) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it },
                                onLoadMore={ viewModel.loadMoreEnglishPop() }
                            )
                        }

                        item {
                            SectionHeader("International Trending Now") { viewModel.playCatalog(uniqueHomeCatalogs.internationalTrending) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.internationalTrending,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.internationalTrending) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                        item {
                            SectionHeader("International R&B & Night") { viewModel.playCatalog(uniqueHomeCatalogs.internationalRnB) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.internationalRnB,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.internationalRnB) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                        item {
                            SectionHeader("International Love & Pop") { viewModel.playCatalog(uniqueHomeCatalogs.internationalLove) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.internationalLove,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.internationalLove) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                        item {
                            SectionHeader("International Throwbacks") { viewModel.playCatalog(uniqueHomeCatalogs.internationalThrowbacks) }
                            HorizontalTrackGrid(
                                tracks=uniqueHomeCatalogs.internationalThrowbacks,
                                currentTrack=currentTrack,
                                isPlaying=isPlaying,
                                likedTrackIds=likedTrackIds,
                                onTrackClick={ viewModel.playCatalogTrack(it, uniqueHomeCatalogs.internationalThrowbacks) },
                                onLikeClick={ viewModel.toggleLike(it) },
                                onAddToQueue={ viewModel.addToQueue(it) },
                                onAddToPlaylist={ playlistTargetTrack=it }
                            )
                        }

                    }
                }
            }
            if (activeNavTab == "library") {
                item {
                    if (authUser == null) {
                        SignedOutLibraryView(onLoginClick = { isAuthDialogVisible = true })
                    } else {
                        SignedInLibraryView(
                            user = authUser!!,
                            viewModel = viewModel,
                            currentTrack = currentTrack,
                            isPlaying = isPlaying,
                            likedTrackIds = likedTrackIds,
                            likedTracks = likedTracks,
                            onSearchClick = { activeNavTab = "search" }
                        )
                    }
                }
            }

            if (activeNavTab == "profile") {
                item {
                    if (authUser == null) {
                        SignedOutProfileView(onLoginClick = { isAuthDialogVisible = true })
                    } else {
                        SignedInProfileView(
                            user = authUser!!,
                            isLoading = authLoading,
                            likedSongsCount = likedTracks.size,
                            createdPlaylistsCount = cloudPlaylists.count { !it.description.startsWith("Imported from Spotify", ignoreCase = true) && !it.description.startsWith("Imported from YouTube", ignoreCase = true) },
                            importedPlaylistsCount = cloudPlaylists.count { it.description.startsWith("Imported from Spotify", ignoreCase = true) || it.description.startsWith("Imported from YouTube", ignoreCase = true) },
                            onLogout = { authViewModel.logout() },
                            onSettingsClick = { isSettingsPageVisible = true },
                            onEditProfileClick = { isEditProfileDialogVisible = true }
                        )
                    }
                }
            }
        }

        // Compact/collapsed phone bottom navigation.
        // Inactive tabs remain icon-only; the selected tab expands with its label.
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .windowInsetsPadding(
                    WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)
                )
                .padding(bottom = 6.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(Color(0xFA09090B))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            SabdhamBottomNavItem(
                label = "Home",
                icon = Icons.Default.Home,
                selected = activeNavTab == "home",
                onClick = {
                    activeNavTab = "home"
                    viewModel.onSearchQueryChange("")
                }
            )

            SabdhamBottomNavItem(
                label = "Search",
                icon = Icons.Default.Search,
                selected = activeNavTab == "search",
                onClick = { activeNavTab = "search" }
            )

            SabdhamBottomNavItem(
                label = "Library",
                icon = Icons.Default.LibraryMusic,
                selected = activeNavTab == "library",
                onClick = { activeNavTab = "library" }
            )

            SabdhamBottomNavItem(
                label = "Profile",
                icon = Icons.Default.Person,
                selected = activeNavTab == "profile",
                onClick = { activeNavTab = "profile" }
            )
        }

        // Native Floating Mini Player Docked at Bottom
        currentTrack?.let { track ->
            NativeMiniPlayer(
                track = track,
                isPlaying = isPlaying,
                currentPosition = currentPosition,
                duration = duration,
                isLiked = likedTrackIds.contains(track.id),
                isMuted = isMuted,
                audioRouteName = audioRouteState.displayName,
                multiAudioActive = audioRouteState.multiAudioActive,
                onAudioRouteClick = {
                    viewModel.refreshAudioRoutes()
                    isAudioRouteDialogVisible = true
                },
                onPlayPauseClick = { viewModel.togglePlayPause() },
                onMuteClick = { viewModel.toggleMute() },
                onPreviousClick = { viewModel.playPrevious() },
                onNextClick = { viewModel.playNext() },
                onLikeClick = { viewModel.toggleLike(track) },
                onPlayerClick = { isFullPlayerVisible = true },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .windowInsetsPadding(
                        WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)
                    )
                    .padding(horizontal = 12.dp)
                    .padding(bottom = 88.dp)
            )
        }

        // Full Screen Native Player Modal
        if (isFullPlayerVisible && currentTrack != null) {
            FullPlayerSheet(
                track = currentTrack!!,
                queue = queue,
                isPlaying = isPlaying,
                currentPosition = currentPosition,
                duration = duration,
                isLiked = likedTrackIds.contains(currentTrack!!.id),
                isMuted = isMuted,
                volume = volume,
                audioRouteName = audioRouteState.displayName,
                multiAudioActive = audioRouteState.multiAudioActive,
                isShuffle = isShuffle,
                isRepeat = isRepeat,
                onMute = { viewModel.toggleMute() },
                onVolumeChange = { viewModel.setVolume(it) },
                onAudioRouteClick = {
                    viewModel.refreshAudioRoutes()
                    isAudioRouteDialogVisible = true
                },
                onDismiss = { isFullPlayerVisible = false },
                onPlayPause = { viewModel.togglePlayPause() },
                onNext = { viewModel.playNext() },
                onPrevious = { viewModel.playPrevious() },
                onSeek = { viewModel.seekTo(it) },
                onLike = { viewModel.toggleLike(currentTrack!!) },
                onShuffle = { viewModel.toggleShuffle() },
                onRepeat = { viewModel.toggleRepeat() },
                onMoveQueueItem = { trackId, direction ->
                    viewModel.moveQueuedTrack(trackId, direction)
                },
                onOpenEq = { isEqDialogVisible = true },
                onNavigate = { destination ->
                    activeNavTab = destination
                    if (destination == "home") {
                        viewModel.onSearchQueryChange("")
                    }
                    isFullPlayerVisible = false
                }
            )
        }

        if (isAudioRouteDialogVisible) {
            AudioRouteDialog(
                state = audioRouteState,
                onDismiss = { isAudioRouteDialogVisible = false },
                onSwitch = { routeId ->
                    viewModel.transferAudioTo(routeId)
                },
                onShare = { routeId ->
                    viewModel.addSharedAudioRoute(routeId)
                },
                onRemoveShared = { routeId ->
                    viewModel.removeSharedAudioRoute(routeId)
                }
            )
        }

        playlistTargetTrack?.let { targetTrack ->
            AlertDialog(
                onDismissRequest = {
                    if (!playlistSaving) {
                        playlistTargetTrack = null
                        playlistMessage = null
                        cloudPlaylists = emptyList()
                    }
                },
                containerColor = Color(0xFF18181D),
                shape = RoundedCornerShape(18.dp),
                title = {
                    Column {
                        Text(
                            text = "Add to playlist",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = targetTrack.title,
                            color = Color.White.copy(alpha = 0.65f),
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                },
                text = {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 320.dp)
                    ) {
                        when {
                            playlistLoading -> {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(90.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        color = Color(0xFF1DB954),
                                        modifier = Modifier.size(28.dp),
                                        strokeWidth = 3.dp
                                    )
                                }
                            }

                            playlistMessage != null -> {
                                Text(
                                    text = playlistMessage.orEmpty(),
                                    color = Color.White.copy(alpha = 0.75f),
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(vertical = 12.dp)
                                )
                            }

                            cloudPlaylists.isEmpty() -> {
                                Text(
                                    text = "No playlists yet.",
                                    color = Color.White.copy(alpha = 0.65f),
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(vertical = 12.dp)
                                )
                            }

                            else -> {
                                LazyColumn(
                                    modifier = Modifier.heightIn(max = 260.dp)
                                ) {
                                    items(
                                        items = cloudPlaylists,
                                        key = { it.id }
                                    ) { playlist ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(10.dp))
                                                .clickable(enabled = !playlistSaving) {
                                                    playlistSaving = true
                                                    playlistMessage = null

                                                    playlistScope.launch {
                                                        val result = SabdhamLibraryService.addTrackToPlaylist(
                                                            context = context,
                                                            playlistId = playlist.id,
                                                            track = targetTrack
                                                        )

                                                        playlistSaving = false

                                                        if (result.success) {
                                                            playlistTargetTrack = null
                                                            cloudPlaylists = emptyList()
                                                            playlistMessage = null
                                                        } else {
                                                            playlistMessage = result.message
                                                        }
                                                    }
                                                }
                                                .padding(horizontal = 10.dp, vertical = 10.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(38.dp)
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(Color(0xFF24242A)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                androidx.compose.foundation.Image(
                                                    painter = androidx.compose.ui.res.painterResource(
                                                        com.sabdham.music.R.drawable.ic_playlist_sabdham
                                                    ),
                                                    contentDescription = "Playlist",
                                                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                                    modifier = Modifier
                                                        .fillMaxSize()
                                                        .clip(RoundedCornerShape(8.dp))
                                                )
                                            }

                                            Spacer(Modifier.width(10.dp))

                                            Column(
                                                modifier = Modifier.weight(1f)
                                            ) {
                                                Text(
                                                    text = playlist.name,
                                                    color = Color.White,
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = "${playlist.trackIds.size} songs",
                                                    color = Color.White.copy(alpha = 0.5f),
                                                    fontSize = 11.sp
                                                )
                                            }

                                            if (playlistSaving) {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(18.dp),
                                                    color = Color(0xFF1DB954),
                                                    strokeWidth = 2.dp
                                                )
                                            } else {
                                                Text(
                                                    text = "+",
                                                    color = Color(0xFF1DB954),
                                                    fontSize = 22.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(
                        enabled = !playlistSaving,
                        onClick = {
                            playlistTargetTrack = null
                            playlistMessage = null
                            cloudPlaylists = emptyList()
                        }
                    ) {
                        Text("Cancel", color = Color(0xFF1DB954))
                    }
                }
            )
        }
        if (isSettingsPageVisible) {
            SabdhamSettingsPage(
                onBack = {
                    isSettingsPageVisible = false
                },
                onEqualizerClick = {
                    isSettingsPageVisible = false
                    isEqDialogVisible = true
                },
                onClearSearchHistory = {
                    recentSearches = emptyList()
                }
            )
        }
if (isEditProfileDialogVisible && authUser != null) {
            var editedName by remember(authUser!!.name) {
                mutableStateOf(authUser!!.name)
            }

            AlertDialog(
                onDismissRequest = {
                    isEditProfileDialogVisible = false
                },
                containerColor = Color(0xFF0A1710),
                shape = RoundedCornerShape(24.dp),
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = null,
                            tint = Color(0xFF00E676)
                        )

                        Spacer(Modifier.width(10.dp))

                        Text(
                            text = "Edit Profile",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = editedName,
                            onValueChange = { editedName = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = {
                                Text("Name")
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00E676),
                                unfocusedBorderColor = Color.White.copy(alpha = 0.18f),
                                focusedLabelColor = Color(0xFF00E676),
                                unfocusedLabelColor = Color(0xFF929A95),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )

                        Spacer(Modifier.height(12.dp))

                        OutlinedTextField(
                            value = authUser!!.email,
                            onValueChange = {},
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = false,
                            label = {
                                Text("Email")
                            }
                        )

                        Spacer(Modifier.height(8.dp))

                        Text(
                            text = "Your email is linked to your SABDHAM account.",
                            color = Color(0xFF929A95),
                            fontSize = 11.sp
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            isEditProfileDialogVisible = false
                        }
                    ) {
                        Text(
                            text = "Cancel",
                            color = Color(0xFF929A95)
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            isEditProfileDialogVisible = false
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF00E676),
                            contentColor = Color.Black
                        ),
                        shape = RoundedCornerShape(50.dp)
                    ) {
                        Text(
                            text = "Done",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            )
        }
        if (isAuthDialogVisible) {
            SabdhamAuthDialog(
                authViewModel = authViewModel,
                onDismiss = { isAuthDialogVisible = false }
            )
        }
        // Equalizer Dialog
        if (isEqDialogVisible) {
            EqualizerDialog(
                viewModel = viewModel,
                onDismiss = { isEqDialogVisible = false }
            )
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    onPlayAll: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = 16.dp,
                end = 10.dp,
                top = 8.dp,
                bottom = 6.dp
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        if (onPlayAll != null) {
            TextButton(
                onClick = onPlayAll,
                contentPadding = PaddingValues(
                    horizontal = 10.dp,
                    vertical = 4.dp
                )
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play all",
                    tint = Color(0xFF1DB954),
                    modifier = Modifier.size(19.dp)
                )

                Spacer(modifier = Modifier.width(3.dp))

                Text(
                    text = "Play All",
                    color = Color(0xFF1DB954),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun HorizontalTrackGrid(
    tracks: List<Track>,
    currentTrack: Track?,
    isPlaying: Boolean,
    likedTrackIds: Set<String>,
    onTrackClick: (Track) -> Unit,
    onLikeClick: (Track) -> Unit,
    onAddToQueue: (Track) -> Unit,
    onAddToPlaylist: (Track) -> Unit,
    onLoadMore: (() -> Unit)? = null
) {
    val listState = rememberLazyListState()

    val shouldLoadMore by remember(tracks.size) {
        derivedStateOf {
            val lastVisibleIndex =
                listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1

            tracks.size >= 4 &&
                lastVisibleIndex >= tracks.lastIndex - 2
        }
    }

    LaunchedEffect(shouldLoadMore, tracks.size) {
        if (shouldLoadMore) {
            onLoadMore?.invoke()
        }
    }

    LazyRow(
        state = listState,
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            bottom = 6.dp
        ),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(
            items = tracks,
            key = { it.id }
        ) { track ->

            val isActive = currentTrack?.id == track.id
            var menuExpanded by remember(track.id) {
                mutableStateOf(false)
            }

            Column(
                modifier = Modifier
                    .width(154.dp)
            ) {

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFF202029))
                        .clickable {
                            onTrackClick(track)
                        }
                ) {

                    AsyncImage(
                        model = rememberSabdhamArtworkModel(track),
                        contentDescription = track.title,
                        contentScale = ContentScale.FillBounds,
                        placeholder = androidx.compose.ui.res.painterResource(
                            R.drawable.sabdham_logo
                        ),
                        error = androidx.compose.ui.res.painterResource(
                            R.drawable.sabdham_logo
                        ),
                        fallback = androidx.compose.ui.res.painterResource(
                            R.drawable.sabdham_logo
                        ),
                        modifier = Modifier.fillMaxSize()
                    )

                    if (isActive) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Color.Black.copy(alpha = 0.32f)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .background(
                                        Color.Black.copy(alpha = 0.68f),
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector =
                                        if (isPlaying) {
                                            Icons.Default.Pause
                                        } else {
                                            Icons.Default.PlayArrow
                                        },
                                    contentDescription = null,
                                    tint = Color(0xFF1DB954),
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                    ) {

                        IconButton(
                            onClick = {
                                menuExpanded = true
                            },
                            modifier = Modifier
                                .size(32.dp)
                                .background(
                                    Color.Black.copy(alpha = 0.62f),
                                    CircleShape
                                )
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More options",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        DropdownMenu(
                            expanded = menuExpanded,
                            onDismissRequest = { menuExpanded = false },
                            modifier = Modifier
                                .width(220.dp)
                                .background(
                                    Color(0xFF1A1A1A),
                                    RoundedCornerShape(14.dp)
                                )
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                AsyncImage(
                                    model = rememberSabdhamArtworkModel(track),
                                    contentDescription = null,
                                    contentScale = ContentScale.FillBounds,
                                    placeholder = androidx.compose.ui.res.painterResource(R.drawable.sabdham_logo),
                                    error = androidx.compose.ui.res.painterResource(R.drawable.sabdham_logo),
                                    fallback = androidx.compose.ui.res.painterResource(R.drawable.sabdham_logo),
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )

                                Spacer(modifier = Modifier.width(10.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = track.title,
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = track.artist,
                                        color = Color(0xFF92929F),
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }

                            HorizontalDivider(
                                color = Color.White.copy(alpha = 0.08f)
                            )

                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = if (likedTrackIds.contains(track.id)) "Liked" else "Like",
                                        color = if (likedTrackIds.contains(track.id))
                                            Color(0xFF1DB954)
                                        else
                                            Color.White
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector =
                                            if (likedTrackIds.contains(track.id))
                                                Icons.Default.Favorite
                                            else
                                                Icons.Outlined.FavoriteBorder,
                                        contentDescription =
                                            if (likedTrackIds.contains(track.id))
                                                "Liked"
                                            else
                                                "Like",
                                        tint =
                                            if (likedTrackIds.contains(track.id))
                                                Color(0xFF1DB954)
                                            else
                                                Color.White
                                    )
                                },
                                onClick = {
                                    onLikeClick(track)
                                    menuExpanded = false
                                }
                            )

                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = "Add to Queue",
                                        color = Color.White
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Filled.PlaylistAdd,
                                        contentDescription = "Add to Queue",
                                        tint = Color(0xFF1DB954)
                                    )
                                },
                                onClick = {
                                    onAddToQueue(track)
                                    menuExpanded = false
                                }
                            )

                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = "Add to Playlist",
                                        color = Color.White
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Filled.PlaylistAdd,
                                        contentDescription = "Add to Playlist",
                                        tint = Color(0xFF1DB954)
                                    )
                                },
                                onClick = {
                                    menuExpanded = false
                                    onAddToPlaylist(track)
                                }
                            )
                        }
                    }
                }

                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Text(
                    text = track.title,
                    color =
                        if (isActive) {
                            Color(0xFF1DB954)
                        } else {
                            Color.White
                        },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(
                    modifier = Modifier.height(2.dp)
                )

                Text(
                    text = track.artist,
                    color = Color(0xFF92929F),
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
fun ArtistCard(
    artist: Artist,
    onArtistClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(105.dp)
            .clickable { onArtistClick() }
    ) {
        val localArtistImage = when (artist.id) {
            "artist-anirudh" -> R.drawable.artist_anirudh
            "artist-ar-rahman" -> R.drawable.artist_rahman
            "artist-piyath" -> R.drawable.artist_piyath
            "artist-yohani" -> R.drawable.artist_yohani
            "artist-sabrina" -> R.drawable.artist_sabrina
            "artist-billie" -> R.drawable.artist_billie
            "artist-ilaiyaraaja" -> R.drawable.artist_ilaiyaraaja
            "artist-jothipala" -> R.drawable.artist_jothipala
            "artist-spb" -> R.drawable.artist_spb
            else -> null
        }

        if (localArtistImage != null) {
            Image(
                painter = painterResource(localArtistImage),
                contentDescription = artist.name,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier
                    .size(90.dp)
                    .clip(CircleShape)
            )
        } else {
            AsyncImage(
                model = artist.imageUrl.takeIf { it.isNotBlank() },
                error = painterResource(R.drawable.sabdham_default_artist),
                fallback = painterResource(R.drawable.sabdham_default_artist),
                contentDescription = artist.name,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier
                    .size(90.dp)
                    .clip(CircleShape)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = artist.name,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )
        Text(
            text = "Artist",
            color = Color(0xFF1DB954),
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun GenreCard(
    genre: Genre,
    onGenreClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .width(150.dp)
            .height(85.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF222230))
            .clickable { onGenreClick() }
    ) {
        // SABDHAM native genre artwork - no external/YouTube cover
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF063D22),
                            Color(0xFF00A651),
                            Color(0xFFFFD600)
                        )
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Album,
                    contentDescription = null,
                    tint = Color(0xFFFFEB3B),
                    modifier = Modifier.size(38.dp)
                )

                Spacer(Modifier.height(6.dp))

                Text(
                    text = genre.name,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    maxLines = 2
                )

                Text(
                    text = "SABDHAM",
                    color = Color(0xFFFFEB3B),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
            }
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .padding(10.dp),
            contentAlignment = Alignment.BottomStart
        ) {
            Text(
                text = genre.name,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun VerticalTrackList(
    tracks: List<Track>,
    currentTrack: Track?,
    isPlaying: Boolean,
    likedTrackIds: Set<String>,
    onTrackClick: (Track) -> Unit,
    onLikeClick: (Track) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        tracks.forEach { track ->
            val isThisActive = currentTrack?.id == track.id
            TrackListItem(
                track = track,
                isActive = isThisActive,
                isPlaying = isThisActive && isPlaying,
                isLiked = likedTrackIds.contains(track.id),
                onTrackClick = { onTrackClick(track) },
                onLikeClick = { onLikeClick(track) }
            )
        }
    }
}

@Composable
fun TrackListItem(
    track: Track,
    isActive: Boolean,
    isPlaying: Boolean,
    isLiked: Boolean,
    onTrackClick: () -> Unit,
    onLikeClick: () -> Unit,
    onAddToQueue: (() -> Unit)? = null,
    onAddToPlaylist: (() -> Unit)? = null,
    onRemoveFromPlaylist: (() -> Unit)? = null
) {
    var trackMenuExpanded by remember(track.id) { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTrackClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = rememberSabdhamArtworkModel(track),
                    error = painterResource(R.drawable.sabdham_default_song),
                    fallback = painterResource(R.drawable.sabdham_default_song),
            contentDescription = track.title,
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                color = if (isActive) Color(0xFF1DB954) else Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "${track.artist} - ${track.album.ifEmpty { "Single" }}",
                color = Color(0xFF888899),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        IconButton(onClick = onLikeClick) {
            Icon(
                imageVector = if (isLiked) Icons.Default.Favorite else Icons.Outlined.FavoriteBorder,
                contentDescription = "Like",
                tint = if (isLiked) Color(0xFF1DB954) else Color(0xFF777788),
                modifier = Modifier.size(20.dp)
            )
        }

        if (onAddToQueue != null || onAddToPlaylist != null || onRemoveFromPlaylist != null) {
            Box {
                IconButton(onClick = { trackMenuExpanded = true }) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "More options",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                DropdownMenu(
                    expanded = trackMenuExpanded,
                    onDismissRequest = { trackMenuExpanded = false }
                ) {
                    if (onAddToQueue != null) {
                        DropdownMenuItem(
                            text = { Text("Add to Queue", color = Color.White) },
                            onClick = {
                                trackMenuExpanded = false
                                onAddToQueue()
                            }
                        )
                    }

                    if (onAddToPlaylist != null) {
                        DropdownMenuItem(
                            text = { Text("Add to Playlist", color = Color.White) },
                            onClick = {
                                trackMenuExpanded = false
                                onAddToPlaylist()
                            }
                        )
                    }
                    if (onRemoveFromPlaylist != null) {
                        DropdownMenuItem(
                            text = { Text("Remove from Playlist", color = Color(0xFFFF6B6B)) },
                            onClick = {
                                trackMenuExpanded = false
                                onRemoveFromPlaylist()
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AudioRouteDialog(
    state: AudioRouteState,
    onDismiss: () -> Unit,
    onSwitch: (String) -> Unit,
    onShare: (String) -> Unit,
    onRemoveShared: (String) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF18181D),
        shape = RoundedCornerShape(18.dp),
        title = {
            Column {
                Text(
                    text = "Audio output",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text =
                        if (state.multiAudioActive) {
                            "Sharing to ${state.selectedDeviceNames.size} devices"
                        } else {
                            "Playing on ${state.displayName}"
                        },
                    color = Color(0xFF1DB954),
                    fontSize = 12.sp
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp)
            ) {
                if (!state.supported) {
                    Text(
                        text =
                            "In-app audio switching requires Android 11 or later. " +
                                "Use your phone's Bluetooth/audio output controls on this device.",
                        color = Color.White.copy(alpha = 0.72f),
                        fontSize = 13.sp
                    )
                } else if (state.devices.isEmpty()) {
                    Text(
                        text = "No additional audio devices are available.",
                        color = Color.White.copy(alpha = 0.72f),
                        fontSize = 13.sp
                    )
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            items = state.devices,
                            key = { it.id }
                        ) { device ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (device.selected) {
                                            Color(0xFF1E3326)
                                        } else {
                                            Color(0xFF24242A)
                                        }
                                    )
                                    .padding(11.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector =
                                            if (device.selected) {
                                                Icons.Default.CheckCircle
                                            } else {
                                                Icons.Default.Speaker
                                            },
                                        contentDescription = null,
                                        tint =
                                            if (device.selected) {
                                                Color(0xFF1DB954)
                                            } else {
                                                Color.White.copy(alpha = 0.7f)
                                            },
                                        modifier = Modifier.size(20.dp)
                                    )

                                    Spacer(Modifier.width(10.dp))

                                    Column(
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = device.name,
                                            color = Color.White,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text =
                                                when {
                                                    device.selected &&
                                                        state.multiAudioActive ->
                                                        "Shared output"
                                                    device.selected ->
                                                        "Current output"
                                                    device.selectableForSharing ->
                                                        "Available for sharing"
                                                    else ->
                                                        "Available"
                                                },
                                            color = Color.White.copy(alpha = 0.55f),
                                            fontSize = 11.sp
                                        )
                                    }
                                }

                                if (!device.selected) {
                                    Spacer(Modifier.height(8.dp))
                                    Row(
                                        horizontalArrangement =
                                            Arrangement.spacedBy(8.dp)
                                    ) {
                                        TextButton(
                                            onClick = {
                                                onSwitch(device.id)
                                            }
                                        ) {
                                            Text(
                                                "Switch",
                                                color = Color(0xFF1DB954)
                                            )
                                        }

                                        if (device.selectableForSharing) {
                                            TextButton(
                                                onClick = {
                                                    onShare(device.id)
                                                }
                                            ) {
                                                Text(
                                                    "Share too",
                                                    color = Color.White
                                                )
                                            }
                                        }
                                    }
                                } else if (
                                    state.multiAudioActive &&
                                    device.deselectable
                                ) {
                                    Spacer(Modifier.height(8.dp))
                                    TextButton(
                                        onClick = {
                                            onRemoveShared(device.id)
                                        }
                                    ) {
                                        Text(
                                            "Remove from sharing",
                                            color = Color(0xFFFFB4AB)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (!state.multiAudioAvailable) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text =
                                "Multi-audio sharing is not exposed by this phone/device combination. " +
                                    "SABDHAM will still allow normal output switching.",
                            color = Color.White.copy(alpha = 0.55f),
                            fontSize = 11.sp
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done", color = Color(0xFF1DB954))
            }
        }
    )
}

@Composable
fun NativeMiniPlayer(
    track: Track,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isLiked: Boolean,
    isMuted: Boolean,
    audioRouteName: String,
    multiAudioActive: Boolean,
    onAudioRouteClick: () -> Unit,
    onPlayPauseClick: () -> Unit,
    onMuteClick: () -> Unit,
    onPreviousClick: () -> Unit,
    onNextClick: () -> Unit,
    onLikeClick: () -> Unit,
    onPlayerClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = if (duration > 0) (currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onPlayerClick() },
        color = Color(0xFF1E1E26),
        shadowElevation = 8.dp
    ) {
        Column {
            // Linear playback progress bar along top of mini player
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.5.dp),
                color = Color(0xFF1DB954),
                trackColor = Color(0xFF2E2E38)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AsyncImage(
                    model = rememberSabdhamArtworkModel(track),
                    error = painterResource(R.drawable.sabdham_default_song),
                    fallback = painterResource(R.drawable.sabdham_default_song),
                    contentDescription = track.title,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = track.artist,
                        color = Color(0xFF9999AA),
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable { onAudioRouteClick() }
                            .padding(top = 2.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector =
                                if (multiAudioActive) {
                                    Icons.Default.SpeakerGroup
                                } else {
                                    Icons.Default.Speaker
                                },
                            contentDescription = "Audio output",
                            tint = Color(0xFF1DB954),
                            modifier = Modifier.size(11.dp)
                        )
                        Spacer(Modifier.width(3.dp))
                        Text(
                            text = audioRouteName,
                            color = Color(0xFF1DB954),
                            fontSize = 9.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                IconButton(onClick = onLikeClick) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (isLiked) Color(0xFF1DB954) else Color(0xFF777788),
                        modifier = Modifier.size(20.dp)
                    )
                }
                  IconButton(onClick = onMuteClick, modifier = Modifier.size(32.dp)) {
                      Icon(
                          imageVector = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                          contentDescription = if (isMuted) "Unmute" else "Mute",
                          tint = Color.White,
                          modifier = Modifier.size(21.dp)
                      )
                  }

                  IconButton(onClick = onPreviousClick, modifier = Modifier.size(32.dp)) {
                      Icon(
                          imageVector = Icons.Default.SkipPrevious,
                          contentDescription = "Previous",
                          tint = Color.White,
                          modifier = Modifier.size(23.dp)
                      )
                  }

                  IconButton(
                      onClick = onPlayPauseClick,
                      modifier = Modifier
                          .background(Color(0xFF1DB954), CircleShape)
                          .size(38.dp)
                  ) {
                      Icon(
                          imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                          contentDescription = "Play/Pause",
                          tint = Color.Black,
                          modifier = Modifier.size(22.dp)
                      )
                  }

                  IconButton(onClick = onNextClick, modifier = Modifier.size(32.dp)) {
                      Icon(
                          imageVector = Icons.Default.SkipNext,
                          contentDescription = "Next",
                          tint = Color.White,
                          modifier = Modifier.size(23.dp)
                      )
                  }
            }
        }
    }
}

@Composable
fun FullPlayerSheet(
    track: Track,
    queue: List<Track>,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isLiked: Boolean,
    isMuted: Boolean,
    volume: Float,
    audioRouteName: String,
    multiAudioActive: Boolean,
    isShuffle: Boolean,
    isRepeat: Boolean,
    onMute: () -> Unit,
    onVolumeChange: (Float) -> Unit,
    onAudioRouteClick: () -> Unit,
    onDismiss: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onLike: () -> Unit,
    onShuffle: () -> Unit,
    onRepeat: () -> Unit,
    onMoveQueueItem: (String, Int) -> Boolean,
    onOpenEq: () -> Unit,
    onNavigate: (String) -> Unit
) {
    var activeTab by remember { mutableStateOf("player") }

    var draggedQueueTrackId by remember {
        mutableStateOf<String?>(null)
    }
    var queueDragOffsetY by remember {
        mutableStateOf(0f)
    }

    val queueDragStepPx =
        with(LocalDensity.current) {
            64.dp.toPx()
        }

    val queueUpNext =
        remember(queue, track.id) {
            val currentIndex =
                queue.indexOfFirst { it.id == track.id }

            if (currentIndex >= 0) {
                queue.drop(currentIndex + 1)
            } else {
                queue.filterNot { it.id == track.id }
            }
        }

    val playerAnimation = rememberInfiniteTransition(label = "playerAnimation")

    val glowAlpha by playerAnimation.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )

    val artworkScale by playerAnimation.animateFloat(
        initialValue = 1f,
        targetValue = if (isPlaying) 1.02f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "artworkScale"
    )

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121212))
    ) {
        val compact = maxHeight < 720.dp

        // Keep enough vertical room for controls + volume + fixed bottom navigation.
        val artworkSize = when {
            maxHeight < 650.dp -> 150.dp
            maxHeight < 720.dp -> 180.dp
            maxHeight < 800.dp -> 220.dp
            else -> 260.dp
        }.coerceAtMost(maxWidth - 64.dp)

        val fullPlayerBottomReserve = 78.dp

        // Ambient SABDHAM green glow
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(maxHeight * 0.48f)
                .scale(if (isPlaying) 1.05f else 1f)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0xFF1DB954).copy(alpha = if (isPlaying) 0.21f * glowAlpha else 0.12f),
                            Color(0x161DB954),
                            Color.Transparent
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
                // Reserve fixed space so the bottom navigation never overlaps
                // the volume/control area on short phones.
                .padding(bottom = fullPlayerBottomReserve),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(82.dp)
            ) {
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.CenterStart)
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = "Minimize",
                        tint = Color(0xFFB3B3B3),
                        modifier = Modifier.size(30.dp)
                    )
                }

                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "SABDHAM",
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        letterSpacing = 2.sp
                    )

                    Text(
                        text = track.album.ifBlank { "Featured Hits" },
                        color = Color(0xFF9A9A9A),
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 180.dp)
                    )
                    Spacer(Modifier.height(4.dp))

                    Row(
                        modifier = Modifier
                            .heightIn(min = 38.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFF173D2C))
                            .clickable { onAudioRouteClick() }
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector =
                                if (multiAudioActive) {
                                    Icons.Default.SpeakerGroup
                                } else {
                                    Icons.Default.Speaker
                                },
                            contentDescription = "Audio output",
                            tint = Color(0xFF1ED760),
                            modifier = Modifier.size(19.dp)
                        )
                        Spacer(Modifier.width(7.dp))
                        Text(
                            text =
                                if (audioRouteName.isBlank()) {
                                    "Audio output"
                                } else {
                                    audioRouteName
                                },
                            color = Color(0xFF1ED760),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.widthIn(max = 190.dp)
                        )
                    }
                }
            }

            // Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 2.dp, bottom = if (compact) 8.dp else 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                PlayerTab(
                    text = "Now Playing",
                    selected = activeTab == "player",
                    onClick = { activeTab = "player" }
                )

                Spacer(Modifier.width(6.dp))

                PlayerTab(
                    text = "Lyrics",
                    selected = activeTab == "lyrics",
                    onClick = { activeTab = "lyrics" }
                )

                Spacer(Modifier.width(6.dp))

                PlayerTab(
                    text = "Queue",
                    selected = activeTab == "queue",
                    onClick = { activeTab = "queue" }
                )
            }

            when (activeTab) {
                "lyrics" -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF181818))
                            .padding(20.dp)
                    ) {
                        if (track.lyrics.isNotBlank()) {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize()
                            ) {
                                item {
                                    Text(
                                        text = "Lyrics - ${track.title}",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp
                                    )

                                    Spacer(Modifier.height(12.dp))

                                    Text(
                                        text = track.lyrics,
                                        color = Color(0xFFE0E0E0),
                                        fontSize = 17.sp,
                                        lineHeight = 27.sp
                                    )
                                }
                            }
                        } else {
                            Text(
                                text = "Instrumental track or lyrics not available",
                                color = Color(0xFF999999),
                                modifier = Modifier.align(Alignment.Center),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                }

                "queue" -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF181818))
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "NOW PLAYING",
                            color = Color(0xFF1DB954),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.5.sp
                        )

                        Spacer(Modifier.height(12.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF252525))
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = rememberSabdhamArtworkModel(track),
                    error = painterResource(R.drawable.sabdham_default_song),
                    fallback = painterResource(R.drawable.sabdham_default_song),
                                contentDescription = track.title,
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop
                            )

                            Spacer(Modifier.width(12.dp))

                            Column(
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = track.title,
                                    color = Color(0xFF1DB954),
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Text(
                                    text = track.artist,
                                    color = Color(0xFF999999),
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            Text(
                                text = "Playing",
                                color = Color(0xFF1DB954),
                                fontSize = 11.sp
                            )
                        }

                        Spacer(Modifier.height(20.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "UP NEXT",
                                color = Color(0xFF888888),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.5.sp,
                                modifier = Modifier.weight(1f)
                            )

                            Text(
                                text = if (queueUpNext.isEmpty()) {
                                    "Empty"
                                } else {
                                    "${queueUpNext.size} songs"
                                },
                                color = Color(0xFF666666),
                                fontSize = 11.sp
                            )
                        }

                        Spacer(Modifier.height(6.dp))

                        Text(
                            text = "Hold the drag handle and move songs to change playback order.",
                            color = Color(0xFF777777),
                            fontSize = 11.sp
                        )

                        Spacer(Modifier.height(10.dp))

                        if (queueUpNext.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No songs are queued after this track.",
                                    color = Color(0xFF777777),
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                verticalArrangement =
                                    Arrangement.spacedBy(8.dp)
                            ) {
                                items(
                                    items = queueUpNext,
                                    key = { it.id }
                                ) { queuedTrack ->
                                    val isDragging =
                                        draggedQueueTrackId ==
                                            queuedTrack.id

                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .graphicsLayer {
                                                translationY =
                                                    if (isDragging) {
                                                        queueDragOffsetY
                                                    } else {
                                                        0f
                                                    }
                                            }
                                            .clip(
                                                RoundedCornerShape(12.dp)
                                            )
                                            .background(
                                                if (isDragging) {
                                                    Color(0xFF26352B)
                                                } else {
                                                    Color(0xFF222222)
                                                }
                                            )
                                            .padding(
                                                start = 8.dp,
                                                top = 8.dp,
                                                bottom = 8.dp,
                                                end = 2.dp
                                            ),
                                        verticalAlignment =
                                            Alignment.CenterVertically
                                    ) {
                                        AsyncImage(
                                            model =
                                                rememberSabdhamArtworkModel(
                                                    queuedTrack
                                                ),
                                            error = painterResource(
                                                R.drawable
                                                    .sabdham_default_song
                                            ),
                                            fallback = painterResource(
                                                R.drawable
                                                    .sabdham_default_song
                                            ),
                                            contentDescription =
                                                queuedTrack.title,
                                            modifier = Modifier
                                                .size(46.dp)
                                                .clip(
                                                    RoundedCornerShape(
                                                        8.dp
                                                    )
                                                ),
                                            contentScale =
                                                ContentScale.Crop
                                        )

                                        Spacer(Modifier.width(10.dp))

                                        Column(
                                            modifier =
                                                Modifier.weight(1f)
                                        ) {
                                            Text(
                                                text =
                                                    queuedTrack.title,
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight =
                                                    FontWeight.Medium,
                                                maxLines = 1,
                                                overflow =
                                                    TextOverflow.Ellipsis
                                            )

                                            Text(
                                                text =
                                                    queuedTrack.artist,
                                                color =
                                                    Color(0xFF8B8B8B),
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                overflow =
                                                    TextOverflow.Ellipsis
                                            )
                                        }

                                        Box(
                                            modifier = Modifier
                                                .size(48.dp)
                                                .pointerInput(
                                                    queuedTrack.id
                                                ) {
                                                    detectDragGesturesAfterLongPress(
                                                        onDragStart = {
                                                            draggedQueueTrackId =
                                                                queuedTrack.id
                                                            queueDragOffsetY =
                                                                0f
                                                        },
                                                        onDragCancel = {
                                                            draggedQueueTrackId =
                                                                null
                                                            queueDragOffsetY =
                                                                0f
                                                        },
                                                        onDragEnd = {
                                                            draggedQueueTrackId =
                                                                null
                                                            queueDragOffsetY =
                                                                0f
                                                        },
                                                        onDrag = {
                                                            change,
                                                            dragAmount ->
                                                            change.consume()

                                                            if (
                                                                draggedQueueTrackId !=
                                                                queuedTrack.id
                                                            ) {
                                                                draggedQueueTrackId =
                                                                    queuedTrack.id
                                                            }

                                                            queueDragOffsetY +=
                                                                dragAmount.y

                                                            while (
                                                                queueDragOffsetY >=
                                                                queueDragStepPx
                                                            ) {
                                                                val moved =
                                                                    onMoveQueueItem(
                                                                        queuedTrack.id,
                                                                        1
                                                                    )

                                                                if (moved) {
                                                                    queueDragOffsetY -=
                                                                        queueDragStepPx
                                                                } else {
                                                                    queueDragOffsetY =
                                                                        queueDragOffsetY
                                                                            .coerceAtMost(
                                                                                queueDragStepPx *
                                                                                    0.45f
                                                                            )
                                                                    break
                                                                }
                                                            }

                                                            while (
                                                                queueDragOffsetY <=
                                                                -queueDragStepPx
                                                            ) {
                                                                val moved =
                                                                    onMoveQueueItem(
                                                                        queuedTrack.id,
                                                                        -1
                                                                    )

                                                                if (moved) {
                                                                    queueDragOffsetY +=
                                                                        queueDragStepPx
                                                                } else {
                                                                    queueDragOffsetY =
                                                                        queueDragOffsetY
                                                                            .coerceAtLeast(
                                                                                -queueDragStepPx *
                                                                                    0.45f
                                                                            )
                                                                    break
                                                                }
                                                            }
                                                        }
                                                    )
                                                },
                                            contentAlignment =
                                                Alignment.Center
                                        ) {
                                            Icon(
                                                imageVector =
                                                    Icons.Default
                                                        .DragHandle,
                                                contentDescription =
                                                    "Drag to reorder",
                                                tint =
                                                    if (isDragging) {
                                                        Color(
                                                            0xFF1DB954
                                                        )
                                                    } else {
                                                        Color(
                                                            0xFF777777
                                                        )
                                                    },
                                                modifier =
                                                    Modifier.size(26.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                }

                else -> {
                    // Artwork
                    Box(
                        modifier = Modifier
                            .size(artworkSize)
                            .scale(if (isPlaying) artworkScale else 1f)
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFF242424))
                    ) {
                        AsyncImage(
                            model = rememberSabdhamArtworkModel(track),
                    error = painterResource(R.drawable.sabdham_default_song),
                    fallback = painterResource(R.drawable.sabdham_default_song),
                            contentDescription = track.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }

                    Spacer(Modifier.height(if (compact) 12.dp else 18.dp))

                    // Song title + like
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = track.title,
                                color = Color.White,
                                fontSize = if (compact) 19.sp else 22.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )

                            Spacer(Modifier.height(3.dp))

                            Text(
                                text = buildString {
                                    append(track.artist)
                                    if (track.album.isNotBlank()) {
                                        append(" - ")
                                        append(track.album)
                                    }
                                },
                                color = Color(0xFF9A9A9A),
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        IconButton(onClick = onLike) {
                            Icon(
                                imageVector = if (isLiked) {
                                    Icons.Default.Favorite
                                } else {
                                    Icons.Outlined.FavoriteBorder
                                },
                                contentDescription = "Like",
                                tint = if (isLiked) Color(0xFF1DB954) else Color(0xFFAAAAAA),
                                modifier = Modifier.size(25.dp)
                            )
                        }
                    }

                    Spacer(Modifier.height(if (compact) 8.dp else 12.dp))

                    // Animated SABDHAM music visualizer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(22.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val barTargets = listOf(18f, 11f, 20f, 14f, 19f, 10f)

                        barTargets.forEachIndexed { index, target ->
                            val barHeight by playerAnimation.animateFloat(
                                initialValue = 4f,
                                targetValue = if (isPlaying) target else 4f,
                                animationSpec = infiniteRepeatable(
                                    animation = tween(
                                        durationMillis = 320 + (index * 70)
                                    ),
                                    repeatMode = RepeatMode.Reverse
                                ),
                                label = "musicBar$index"
                            )

                            Box(
                                modifier = Modifier
                                    .padding(horizontal = 2.dp)
                                    .width(3.dp)
                                    .height(barHeight.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (isPlaying) Color(0xFF1DB954)
                                        else Color(0xFF555555)
                                    )
                            )
                        }
                    }

                    Spacer(Modifier.height(if (compact) 4.dp else 6.dp))

                    // Seek bar
                    val maxDuration =
                        if (duration > 0L) duration.toFloat() else 180000f

                    val position =
                        currentPosition.toFloat().coerceIn(0f, maxDuration)

                    Slider(
                        value = position,
                        onValueChange = { onSeek(it.toLong()) },
                        valueRange = 0f..maxDuration,
                        colors = SliderDefaults.colors(
                            thumbColor = Color.White,
                            activeTrackColor = Color(0xFF1DB954),
                            inactiveTrackColor = Color(0xFF292929)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatTime(currentPosition),
                            color = Color(0xFF1DB954),
                            fontSize = 11.sp
                        )

                        Text(
                            text = formatTime(duration),
                            color = Color(0xFF888888),
                            fontSize = 11.sp
                        )
                    }

                    Spacer(Modifier.height(if (compact) 8.dp else 14.dp))

                    // Main controls - same order as AI Studio player
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onShuffle) {
                            Icon(
                                Icons.Default.Shuffle,
                                contentDescription = "Shuffle",
                                tint = if (isShuffle) {
                                    Color(0xFF1DB954)
                                } else {
                                    Color(0xFF8A8A8A)
                                },
                                modifier = Modifier.size(22.dp)
                            )
                        }

                        IconButton(
                            onClick = onPrevious,
                            modifier = Modifier.size(50.dp)
                        ) {
                            Icon(
                                Icons.Default.SkipPrevious,
                                contentDescription = "Previous",
                                tint = Color.White,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        IconButton(
                            onClick = onPlayPause,
                            modifier = Modifier
                                .size(if (compact) 58.dp else 64.dp)
                                .background(Color.White, CircleShape)
                        ) {
                            Icon(
                                imageVector =
                                    if (isPlaying) Icons.Default.Pause
                                    else Icons.Default.PlayArrow,
                                contentDescription =
                                    if (isPlaying) "Pause" else "Play",
                                tint = Color.Black,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        IconButton(
                            onClick = onNext,
                            modifier = Modifier.size(50.dp)
                        ) {
                            Icon(
                                Icons.Default.SkipNext,
                                contentDescription = "Next",
                                tint = Color.White,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        IconButton(onClick = onRepeat) {
                            Icon(
                                Icons.Default.Repeat,
                                contentDescription = "Repeat",
                                tint = if (isRepeat) {
                                    Color(0xFF1DB954)
                                } else {
                                    Color(0xFF8A8A8A)
                                },
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }

                    Spacer(Modifier.height(if (compact) 8.dp else 14.dp))

                    // Native volume panel
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 54.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0xE6222222))
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onMute,
                            modifier = Modifier.size(38.dp)
                        ) {
                            Icon(
                                imageVector =
                                    if (isMuted) Icons.Default.VolumeOff
                                    else Icons.Default.VolumeUp,
                                contentDescription =
                                    if (isMuted) "Unmute" else "Mute",
                                tint = if (isMuted) {
                                    Color(0xFF888888)
                                } else {
                                    Color(0xFF1DB954)
                                },
                                modifier = Modifier.size(22.dp)
                            )
                        }

                        Spacer(Modifier.width(8.dp))

                        Slider(
                            value = if (isMuted) 0f else volume.coerceIn(0f, 1f),
                            onValueChange = onVolumeChange,
                            valueRange = 0f..1f,
                            colors = SliderDefaults.colors(
                                thumbColor = Color.White,
                                activeTrackColor = Color(0xFF1DB954),
                                inactiveTrackColor = Color(0xFF333333)
                            ),
                            modifier = Modifier.weight(1f)
                        )

                        Text(
                            text = "${((if (isMuted) 0f else volume) * 100).toInt()}%",
                            color = Color(0xFFB3B3B3),
                            fontSize = 11.sp,
                            modifier = Modifier.widthIn(min = 34.dp)
                        )

                    }

                    Spacer(Modifier.height(10.dp))
                }
            }
        }

        // Fixed bottom navigation inside the full player.
        // It owns its own area instead of floating over the volume controls.
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .windowInsetsPadding(
                    WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)
                )
                .padding(horizontal = 14.dp, vertical = 6.dp)
                .heightIn(min = 58.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(Color(0xFA09090B))
                .padding(horizontal = 10.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            SabdhamBottomNavItem(
                label = "Home",
                icon = Icons.Default.Home,
                selected = false,
                onClick = { onNavigate("home") }
            )

            SabdhamBottomNavItem(
                label = "Search",
                icon = Icons.Default.Search,
                selected = false,
                onClick = { onNavigate("search") }
            )

            SabdhamBottomNavItem(
                label = "Library",
                icon = Icons.Default.LibraryMusic,
                selected = false,
                onClick = { onNavigate("library") }
            )

            SabdhamBottomNavItem(
                label = "Profile",
                icon = Icons.Default.Person,
                selected = false,
                onClick = { onNavigate("profile") }
            )
        }
    }
}

@Composable
private fun PlayerTab(
    text: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(
                if (selected) Color(0x33FFFFFF)
                else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (selected) Color.White else Color(0xFF999999),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
@Composable
fun EqualizerDialog(
    viewModel: MusicViewModel,
    onDismiss: () -> Unit
) {
    val eqEnabled by viewModel.eqEnabled.collectAsState()
    val currentPreset by viewModel.eqPreset.collectAsState()
    val volNorm by viewModel.volumeNormalization.collectAsState()


    val presets = listOf("Flat", "Bass Boost", "Vocal Booster", "Electronic", "Rock", "Acoustic")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1E26),
        title = {
            Text("Audio Settings", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Equalizer Enabled", color = Color.White, fontSize = 14.sp)
                    Switch(
                        checked = eqEnabled,
                        onCheckedChange = { viewModel.setEqualizer(it, currentPreset) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF1DB954)
                        )
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
                Text("Sound Presets", color = Color(0xFF888899), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(8.dp))

                presets.forEach { preset ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { viewModel.setEqualizer(true, preset) }
                            .padding(vertical = 8.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            preset,
                            color = if (currentPreset == preset && eqEnabled) Color(0xFF1DB954) else Color.White,
                            fontSize = 14.sp
                        )
                        if (currentPreset == preset && eqEnabled) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF1DB954), modifier = Modifier.size(18.dp))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Volume Normalization", color = Color.White, fontSize = 14.sp)
                    Switch(
                        checked = volNorm,
                        onCheckedChange = { viewModel.setVolumeNormalization(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF1DB954)
                        )
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))
                Divider(color = Color(0xFF2C2C38))
                Spacer(modifier = Modifier.height(10.dp))

            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done", color = Color(0xFF1DB954), fontWeight = FontWeight.Bold)
            }
        }
    )
}

fun formatTime(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds)
}














@Composable
private fun SabdhamBottomNavItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit
) {
    val activeColor = Color(0xFF00E676)
    val inactiveColor = Color(0xFF71717A)

    Row(
        modifier = Modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(
                if (selected) Color(0x1A00E676)
                else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(
                horizontal = if (selected) 12.dp else 10.dp,
                vertical = 8.dp
            ),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (selected) activeColor else inactiveColor,
            modifier = Modifier.size(24.dp)
        )

        AnimatedVisibility(visible = selected) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.width(6.dp))
                Text(
                    text = label,
                    color = activeColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1
                )
            }
        }
    }
}

@Composable
private fun SignedOutLibraryView(onLoginClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(68.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0x1A00E676)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.LibraryMusic,
                contentDescription = "Library",
                tint = Color(0xFF00E676),
                modifier = Modifier.size(40.dp)
            )
        }

        Spacer(Modifier.height(12.dp))

        Text(
            text = "My Library",
            color = Color.White,
            fontSize = 25.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(10.dp))

        Text(
            text = "Sign in or sign up with email to view your personalized library, custom playlists, liked songs, listening history, and synced tracks.",
            color = Color(0xFFA1A1AA),
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(14.dp))

        Button(
            onClick = onLoginClick,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF00E676),
                contentColor = Color(0xFF18181B)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                "Sign in or sign up with email",
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SignedOutProfileView(onLoginClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 32.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(Color(0xFF18181B))
            .padding(horizontal = 24.dp, vertical = 42.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(68.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0x1A00E676)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = "Profile",
                tint = Color(0xFF00E676),
                modifier = Modifier.size(40.dp)
            )
        }

        Spacer(Modifier.height(12.dp))

        Text(
            text = "User Profile",
            color = Color.White,
            fontSize = 25.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(10.dp))

        Text(
            text = "Sign in or create an account with your email to sync and protect your music library across devices.",
            color = Color(0xFFA1A1AA),
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(14.dp))

        Button(
            onClick = onLoginClick,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF00E676),
                contentColor = Color(0xFF18181B)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                "Sign In / Create Account",
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SignedInLibraryView(
    user: SabdhamUser,
    viewModel: MusicViewModel,
    currentTrack: Track?,
    isPlaying: Boolean,
    likedTrackIds: Set<String>,
    likedTracks: List<Track>,
    onSearchClick: () -> Unit
) {
    val green = Color(0xFF39E67A)
    val cardColor = Color(0xFF18191E)
    val muted = Color(0xFFA1A1AA)
    var showImportLinkDialog by remember { mutableStateOf(false) }
    var importPlaylistUrl by remember { mutableStateOf("") }
    var importLinkError by remember { mutableStateOf<String?>(null) }
var importingPlaylist by remember { mutableStateOf(false) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }
    var createPlaylistError by remember { mutableStateOf<String?>(null) }
    var creatingPlaylist by remember { mutableStateOf(false) }
    val libraryContext = androidx.compose.ui.platform.LocalContext.current
    val libraryScope = rememberCoroutineScope()
    var libraryPlaylists by remember { mutableStateOf<List<CloudPlaylist>>(emptyList()) }
    var libraryPlaylistsLoading by remember { mutableStateOf(true) }
    var selectedLibraryPlaylist by remember { mutableStateOf<CloudPlaylist?>(null) }
    var librarySection by remember { mutableStateOf("playlists") }
    var playlistManageMenuExpanded by remember { mutableStateOf(false) }
    var showRenamePlaylistDialog by remember { mutableStateOf(false) }
    var renamePlaylistName by remember { mutableStateOf("") }
    var renamePlaylistError by remember { mutableStateOf<String?>(null) }
    var renamingPlaylist by remember { mutableStateOf(false) }
    var showDeletePlaylistDialog by remember { mutableStateOf(false) }
    var deletingPlaylist by remember { mutableStateOf(false) }
    var deletePlaylistError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(user.email) {
        libraryPlaylistsLoading = true
        val result = SabdhamLibraryService.getPlaylists(libraryContext)
        if (result.success) libraryPlaylists = result.playlists
        libraryPlaylistsLoading = false
    }

    val selectedPlaylist = selectedLibraryPlaylist
    if (selectedPlaylist != null) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { selectedLibraryPlaylist = null }
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back to Library",
                        tint = Color.White
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 4.dp)
                ) {
                    Text(
                        text = selectedPlaylist.name,
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Text(
                        text = "${selectedPlaylist.tracks.size} ${if (selectedPlaylist.tracks.size == 1) "song" else "songs"}",
                        color = muted,
                        fontSize = 13.sp
                    )
                }
                Box {
                    IconButton(
                        onClick = {
                            playlistManageMenuExpanded = true
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Playlist options",
                            tint = Color.White
                        )
                    }

                    DropdownMenu(
                        expanded = playlistManageMenuExpanded,
                        onDismissRequest = {
                            playlistManageMenuExpanded = false
                        }
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = "Rename Playlist",
                                    color = Color.White
                                )
                            },
                            onClick = {
                                playlistManageMenuExpanded = false
                                renamePlaylistName = selectedPlaylist.name
                                renamePlaylistError = null
                                showRenamePlaylistDialog = true
                            }
                        )

                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = "Delete Playlist",
                                    color = Color(0xFFFF6B6B)
                                )
                            },
                            onClick = {
                                playlistManageMenuExpanded = false
                                deletePlaylistError = null
                                showDeletePlaylistDialog = true
                            }
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            if (selectedPlaylist.tracks.isEmpty()) {
                Text(
                    text = "No songs in this playlist yet.",
                    color = muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            } else {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            viewModel.playPlaylist(selectedPlaylist.tracks)
                        },
                    shape = RoundedCornerShape(14.dp),
                    color = green
                ) {
                    Row(
                        modifier = Modifier.padding(
                            horizontal = 18.dp,
                            vertical = 13.dp
                        ),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color(0xFF07130B)
                        )

                        Spacer(Modifier.width(7.dp))

                        Text(
                            text = "Play All",
                            color = Color(0xFF07130B),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                selectedPlaylist.tracks.forEach { track ->
                    TrackListItem(
                        track = track,
                        isActive = currentTrack?.id == track.id,
                        isPlaying =
                            isPlaying && currentTrack?.id == track.id,
                        isLiked = track.id in likedTrackIds,
                        onTrackClick = {
                            viewModel.playPlaylistTrack(
                                track,
                                selectedPlaylist.tracks
                            )
                        },
                        onLikeClick = {
                            viewModel.toggleLike(track)
                        },
                        onRemoveFromPlaylist = {
                            libraryScope.launch {
                                val result =
                                    SabdhamLibraryService.removeTrackFromPlaylist(
                                        context = libraryContext,
                                        playlistId = selectedPlaylist.id,
                                        trackId = track.id
                                    )

                                if (result.success) {
                                    if (result.playlists.isNotEmpty()) {
                                        libraryPlaylists = result.playlists
                                        selectedLibraryPlaylist =
                                            result.playlists.firstOrNull {
                                                it.id == selectedPlaylist.id
                                            }
                                    } else {
                                        val refreshed =
                                            SabdhamLibraryService.getPlaylists(
                                                libraryContext
                                            )

                                        if (refreshed.success) {
                                            libraryPlaylists =
                                                refreshed.playlists
                                            selectedLibraryPlaylist =
                                                refreshed.playlists.firstOrNull {
                                                    it.id == selectedPlaylist.id
                                                }
                                        }
                                    }
                                }
                            }
                        }
                    )

                    Spacer(Modifier.height(6.dp))
                }
            }
        }

        if (showRenamePlaylistDialog) {
            AlertDialog(
                onDismissRequest = {
                    if (!renamingPlaylist) {
                        showRenamePlaylistDialog = false
                        renamePlaylistError = null
                    }
                },
                containerColor = Color(0xFF18191E),
                title = {
                    Text("Rename Playlist", color = Color.White, fontWeight = FontWeight.Bold)
                },
                text = {
                    Column {
                        OutlinedTextField(
                            value = renamePlaylistName,
                            onValueChange = {
                                renamePlaylistName = it
                                renamePlaylistError = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !renamingPlaylist,
                            singleLine = true,
                            label = { Text("Playlist name") }
                        )

                        renamePlaylistError?.let {
                            Spacer(Modifier.height(8.dp))
                            Text(it, color = Color(0xFFFF6B6B), fontSize = 12.sp)
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = !renamingPlaylist,
                        onClick = {
                            val name = renamePlaylistName.trim()

                            if (name.isBlank()) {
                                renamePlaylistError = "Enter a playlist name."
                            } else {
                                renamingPlaylist = true
                                libraryScope.launch {
                                    val result = SabdhamLibraryService.renamePlaylist(
                                        context = libraryContext,
                                        playlistId = selectedPlaylist.id,
                                        newName = name
                                    )

                                    renamingPlaylist = false

                                    if (result.success) {
                                        if (result.playlists.isNotEmpty()) {
                                            libraryPlaylists = result.playlists
                                            selectedLibraryPlaylist =
                                                result.playlists.firstOrNull {
                                                    it.id == selectedPlaylist.id
                                                }
                                        } else {
                                            selectedLibraryPlaylist =
                                                selectedPlaylist.copy(name = name)
                                        }

                                        showRenamePlaylistDialog = false
                                        renamePlaylistError = null
                                    } else {
                                        renamePlaylistError = result.message
                                    }
                                }
                            }
                        }
                    ) {
                        Text(
                            if (renamingPlaylist) "Renaming..." else "Rename",
                            color = green,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        enabled = !renamingPlaylist,
                        onClick = {
                            showRenamePlaylistDialog = false
                            renamePlaylistError = null
                        }
                    ) {
                        Text("Cancel", color = Color.White)
                    }
                }
            )
        }


        if (showDeletePlaylistDialog) {
            AlertDialog(
                onDismissRequest = {
                    if (!deletingPlaylist) {
                        showDeletePlaylistDialog = false
                        deletePlaylistError = null
                    }
                },
                containerColor = Color(0xFF18191E),
                title = {
                    Text(
                        text = "Delete Playlist?",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Column {
                        Text(
                            text = "Delete \"${selectedPlaylist.name}\"? This removes the playlist, not the songs from SABDHAM.",
                            color = Color.White
                        )

                        deletePlaylistError?.let {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = it,
                                color = Color(0xFFFF6B6B),
                                fontSize = 12.sp
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = !deletingPlaylist,
                        onClick = {
                            deletingPlaylist = true
                            deletePlaylistError = null

                            libraryScope.launch {
                                val result = SabdhamLibraryService.deletePlaylist(
                                    context = libraryContext,
                                    playlistId = selectedPlaylist.id
                                )

                                deletingPlaylist = false

                                if (result.success) {
                                    libraryPlaylists =
                                        if (result.playlists.isNotEmpty()) {
                                            result.playlists
                                        } else {
                                            libraryPlaylists.filterNot {
                                                it.id == selectedPlaylist.id
                                            }
                                        }

                                    showDeletePlaylistDialog = false
                                    deletePlaylistError = null
                                    selectedLibraryPlaylist = null
                                } else {
                                    deletePlaylistError = result.message
                                }
                            }
                        }
                    ) {
                        Text(
                            text = if (deletingPlaylist) "Deleting..." else "Delete",
                            color = Color(0xFFFF6B6B),
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        enabled = !deletingPlaylist,
                        onClick = {
                            showDeletePlaylistDialog = false
                            deletePlaylistError = null
                        }
                    ) {
                        Text("Cancel", color = Color.White)
                    }
                }
            )
        }


        return
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp, vertical = 20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Library",
                color = Color.White,
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f)
            )

}

        Spacer(Modifier.height(7.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            LibraryTab(
                title = "Playlists",
                selected = librarySection == "playlists",
                green = green,
                onClick = { librarySection = "playlists" }
            )

            LibraryTab(
                title = "Liked",
                selected = librarySection == "liked",
                green = green,
                onClick = { librarySection = "liked" }
            )

            LibraryTab(
                title = "Artists",
                selected = librarySection == "artists",
                green = green,
                onClick = { librarySection = "artists" }
            )

            LibraryTab(
                title = "Albums",
                selected = librarySection == "albums",
                green = green,
                onClick = { librarySection = "albums" }
            )
        }



        if (librarySection == "artists") {
            val libraryArtists = likedTracks
                .filter { it.artist.isNotBlank() }
                .groupBy { it.artist.trim() }
                .toSortedMap(String.CASE_INSENSITIVE_ORDER)

            Text(
                text = "Artists",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(6.dp))

            Text(
                text = "${libraryArtists.size} ${if (libraryArtists.size == 1) "artist" else "artists"}",
                color = muted,
                fontSize = 13.sp
            )

            Spacer(Modifier.height(7.dp))

            if (libraryArtists.isEmpty()) {
                Text(
                    text = "No artists in your library yet.",
                    color = muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            } else {
                libraryArtists.forEach { (artistName, artistTracks) ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFF101115),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = green,
                                    modifier = Modifier.size(42.dp)
                                )

                                Spacer(Modifier.width(12.dp))

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = artistName,
                                        color = Color.White,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold
                                    )

                                    Text(
                                        text = "${artistTracks.size} ${if (artistTracks.size == 1) "song" else "songs"}",
                                        color = muted,
                                        fontSize = 12.sp
                                    )
                                }

                                TextButton(
                                    onClick = { viewModel.playCatalog(artistTracks) }
                                ) {
                                    Text(
                                        text = "Play",
                                        color = green,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Spacer(Modifier.height(8.dp))

                            VerticalTrackList(
                                tracks = artistTracks,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it, artistTracks) },
                                onLikeClick = { viewModel.toggleLike(it) }
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                }
            }

            return@Column
        }

        if (librarySection == "albums") {
            val libraryAlbums = likedTracks
                .filter { it.album.isNotBlank() }
                .groupBy { it.album.trim() }
                .toSortedMap(String.CASE_INSENSITIVE_ORDER)

            Text(
                text = "Albums",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(6.dp))

            Text(
                text = "${libraryAlbums.size} ${if (libraryAlbums.size == 1) "album" else "albums"}",
                color = muted,
                fontSize = 13.sp
            )

            Spacer(Modifier.height(7.dp))

            if (libraryAlbums.isEmpty()) {
                Text(
                    text = "No albums in your library yet.",
                    color = muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            } else {
                libraryAlbums.forEach { (albumName, albumTracks) ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFF101115),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Album,
                                    contentDescription = null,
                                    tint = Color(0xFFFFD600),
                                    modifier = Modifier.size(42.dp)
                                )

                                Spacer(Modifier.width(12.dp))

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = albumName,
                                        color = Color.White,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Text(
                                        text = "${albumTracks.firstOrNull()?.artist.orEmpty()} - ${albumTracks.size} ${if (albumTracks.size == 1) "song" else "songs"}",
                                        color = muted,
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                TextButton(
                                    onClick = { viewModel.playCatalog(albumTracks) }
                                ) {
                                    Text(
                                        text = "Play",
                                        color = green,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Spacer(Modifier.height(8.dp))

                            VerticalTrackList(
                                tracks = albumTracks,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it, albumTracks) },
                                onLikeClick = { viewModel.toggleLike(it) }
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                }
            }

            return@Column
        }
        if (librarySection == "liked") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Liked Songs",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                if (likedTracks.isNotEmpty()) {
                    TextButton(
                        onClick = { viewModel.playCatalog(likedTracks) }
                    ) {
                        Text(
                            text = "Play all",
                            color = green,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = "${likedTracks.size} ${if (likedTracks.size == 1) "song" else "songs"}",
                color = muted,
                fontSize = 13.sp
            )

            Spacer(Modifier.height(7.dp))

            if (likedTracks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No liked songs yet. Tap the heart on any song.",
                        color = muted,
                        fontSize = 14.sp
                    )
                }
            } else {
                VerticalTrackList(
                    tracks = likedTracks,
                    currentTrack = currentTrack,
                    isPlaying = isPlaying,
                    likedTrackIds = likedTrackIds,
                    onTrackClick = { viewModel.playTrack(it, likedTracks) },
                    onLikeClick = { viewModel.toggleLike(it) }
                )
            }

            return@Column
        }
        Spacer(Modifier.height(20.dp))

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    newPlaylistName = ""
                    createPlaylistError = null
                    showCreatePlaylistDialog = true
                },
            color = Color.Transparent,
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.5.dp, green)
        ) {
            Row(
                modifier = Modifier.padding(vertical = 13.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    tint = green
                )

                Spacer(Modifier.width(8.dp))

                Text(
                    text = "Create Playlist",
                    color = green,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF101115),
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.dp, green.copy(alpha = 0.75f))
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Import & Sync",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )

                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = muted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(Modifier.height(12.dp))

                LibrarySyncRow(
                    iconText = "S",
                    iconColor = Color(0xFF1ED760),
                    title = "Connect Spotify",
                    subtitle = "Sync your playlists",
                    onClick = {
                        android.widget.Toast.makeText(
                            libraryContext,
                            "Spotify connection is not configured yet",
                            android.widget.Toast.LENGTH_SHORT
                        ).show()
                    }
                )

                Spacer(Modifier.height(8.dp))

                LibrarySyncRow(
                    iconText = "YT",
                    iconColor = Color(0xFFFF2D2D),
                    title = "Connect YouTube",
                    subtitle = "Sync your playlists",
                    onClick = {
                        android.widget.Toast.makeText(
                            libraryContext,
                            "YouTube connection is not configured yet",
                            android.widget.Toast.LENGTH_SHORT
                        ).show()
                    }
                )

                Spacer(Modifier.height(8.dp))

                LibrarySyncRow(
                    iconText = "URL",
                    iconColor = Color(0xFF2563EB),
                    title = "Import Playlist by URL",
                    subtitle = "Spotify or YouTube playlist link",
                    onClick = {
                        importPlaylistUrl = ""
                        importLinkError = null
                        showImportLinkDialog = true
                    }
                )
            }
        }

        Spacer(Modifier.height(14.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Your Playlists",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )

            Text(
                text = "See all",
                color = green,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(Modifier.height(12.dp))

        LibraryPlaylistRow(
            title = "Liked Songs",
            subtitle = "${likedTracks.size} ${if (likedTracks.size == 1) "song" else "songs"}",
            iconText = "L",
            iconColor = Color(0xFF9B5DE5),
            onClick = { librarySection = "liked" }
        )

        Spacer(Modifier.height(8.dp))

        if (libraryPlaylistsLoading) {
            Text(
                text = "Loading playlists...",
                color = muted,
                fontSize = 13.sp,
                modifier = Modifier.padding(vertical = 12.dp)
            )
        } else if (libraryPlaylists.isEmpty()) {
            Text(
                text = "No playlists yet",
                color = muted,
                fontSize = 13.sp,
                modifier = Modifier.padding(vertical = 12.dp)
            )
        } else {
            libraryPlaylists.forEachIndexed { index, playlist ->
                LibraryPlaylistRow(
                    title = playlist.name,
                    subtitle = "${playlist.trackIds.size} ${if (playlist.trackIds.size == 1) "song" else "songs"}",
                    iconText = "S",
                    iconColor = green,
                    onClick = { selectedLibraryPlaylist = playlist }
                )

                if (index < libraryPlaylists.lastIndex) {
                    Spacer(Modifier.height(8.dp))
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        if (showCreatePlaylistDialog) {
            AlertDialog(
                onDismissRequest = {
                    if (!creatingPlaylist) {
                        showCreatePlaylistDialog = false
                        createPlaylistError = null
                    }
                },
                containerColor = Color(0xFF18191E),
                title = {
                    Text(
                        text = "Create Playlist",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Column {
                        OutlinedTextField(
                            value = newPlaylistName,
                            onValueChange = {
                                newPlaylistName = it
                                createPlaylistError = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !creatingPlaylist,
                            singleLine = true,
                            label = { Text("Playlist name") }
                        )

                        createPlaylistError?.let { message ->
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = message,
                                color = Color(0xFFFF6B6B),
                                fontSize = 12.sp
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = !creatingPlaylist,
                        onClick = {
                            val name = newPlaylistName.trim()

                            if (name.isBlank()) {
                                createPlaylistError = "Enter a playlist name."
                            } else {
                                creatingPlaylist = true
                                createPlaylistError = null

                                libraryScope.launch {
                                    val result =
                                        SabdhamLibraryService.createPlaylist(
                                            context = libraryContext,
                                            name = name
                                        )

                                    creatingPlaylist = false

                                    if (result.success) {
                                        if (result.playlists.isNotEmpty()) {
                                            libraryPlaylists = result.playlists
                                        }
                                        showCreatePlaylistDialog = false
                                        newPlaylistName = ""
                                        createPlaylistError = null
                                    } else {
                                        createPlaylistError = result.message
                                    }
                                }
                            }
                        }
                    ) {
                        Text(
                            text = if (creatingPlaylist) "Creating..." else "Create",
                            color = green,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        enabled = !creatingPlaylist,
                        onClick = {
                            showCreatePlaylistDialog = false
                            createPlaylistError = null
                        }
                    ) {
                        Text("Cancel", color = Color.White)
                    }
                }
            )
        }
        if (showImportLinkDialog) {
            AlertDialog(
                onDismissRequest = {
                    showImportLinkDialog = false
                    importLinkError = null
                },
                containerColor = Color(0xFF18191E),
                title = {
                    Text(
                        text = "Add Playlist by Link",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Column {
                        Text(
                            text = "Paste a Spotify or YouTube playlist link.",
                            color = muted,
                            fontSize = 13.sp
                        )

                        Spacer(Modifier.height(12.dp))

                        OutlinedTextField(
                            value = importPlaylistUrl,
                            onValueChange = {
                                importPlaylistUrl = it.trim()
                                importLinkError = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("Playlist link") },
                            placeholder = { Text("https://...") }
                        )

                        importLinkError?.let { message ->
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = message,
                                color = Color(0xFFFF6B6B),
                                fontSize = 12.sp
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val link = importPlaylistUrl.trim()

                            if (link.isBlank()) {
                                importLinkError = "Enter a playlist link."
                            } else if (!importingPlaylist) {
                                importingPlaylist = true
                                importLinkError = null

                                libraryScope.launch {
                                    val result =
                                        SabdhamLibraryService.importPlaylistByLink(
                                            context = libraryContext,
                                            playlistUrl = link
                                        )

                                    importingPlaylist = false

                                    if (result.success) {
                                        if (result.playlists.isNotEmpty()) {
                                            libraryPlaylists = result.playlists
                                        }

                                        importPlaylistUrl = ""
                                        importLinkError = null
                                        showImportLinkDialog = false
                                    } else {
                                        importLinkError =
                                            result.message.ifBlank {
                                                "Playlist import failed."
                                            }
                                    }
                                }
                            }
                        },
                        enabled = !importingPlaylist
                    ) {
                        Text(if (importingPlaylist) "Importing..." else "Continue", color = green, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showImportLinkDialog = false
                            importLinkError = null
                        }
                    ) {
                        Text("Cancel", color = Color.White)
                    }
                }
            )
        }
        Text(
            text = "Signed in as ${user.name.ifBlank { "Listener" }}",
            color = muted,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
        )
    }
}

@Composable
private fun LibraryTab(
    title: String,
    selected: Boolean,
    green: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = if (selected) green else Color(0xFF1B1C21),
        shape = RoundedCornerShape(22.dp)
    ) {
        Text(
            text = title,
            color = if (selected) Color(0xFF07130B) else Color.White,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
        )
    }
}

@Composable
private fun LibrarySyncRow(
    iconText: String,
    iconColor: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(13.dp))
            .background(Color(0xFF1A1B20))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            val iconRes = when {
                title.contains("Spotify", ignoreCase = true) -> R.drawable.sabdham_spotify
                title.contains("YouTube", ignoreCase = true) -> R.drawable.sabdham_youtube
                title.contains("Import Playlist", ignoreCase = true) -> R.drawable.sabdham_add_playlist
                else -> null
            }

            if (iconRes != null) {
                Image(
                    painter = painterResource(iconRes),
                    contentDescription = title,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(29.dp)
                )
            } else {
                Text(
                    text = iconText,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }}

        Spacer(Modifier.width(12.dp))

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = subtitle,
                color = Color(0xFFA1A1AA),
                fontSize = 12.sp
            )
        }

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = Color(0xFFD4D4D8),
            modifier = Modifier.size(22.dp)
        )
    }
}

@Composable
private fun LibraryPlaylistRow(
    title: String,
    subtitle: String,
    iconText: String,
    iconColor: Color,
    onClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF18191E))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            when {
                title == "Liked Songs" -> {
                    androidx.compose.foundation.Image(
                        painter = androidx.compose.ui.res.painterResource(
                            com.sabdham.music.R.drawable.ic_liked_songs
                        ),
                        contentDescription = "Liked Songs",
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(12.dp))
                    )
                }

                iconText == "S" -> {
                    androidx.compose.foundation.Image(
                        painter = androidx.compose.ui.res.painterResource(
                            com.sabdham.music.R.drawable.ic_playlist_sabdham
                        ),
                        contentDescription = "Playlist",
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(12.dp))
                    )
                }

                else -> {
                    Text(
                        text = iconText,
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(Modifier.height(2.dp))

            Text(
                text = subtitle,
                color = Color(0xFFA1A1AA),
                fontSize = 12.sp
            )
        }

        IconButton(onClick = onClick) {
            Icon(
                imageVector = Icons.Default.MoreVert,
                contentDescription = "Playlist options",
                tint = Color(0xFFA1A1AA)
            )
        }
    }
}
@Composable
private fun SignedInProfileView(
    user: SabdhamUser,
    isLoading: Boolean,
    likedSongsCount: Int,
    createdPlaylistsCount: Int,
    importedPlaylistsCount: Int,
    onLogout: () -> Unit,
    onSettingsClick: () -> Unit,
    onEditProfileClick: () -> Unit
) {
    val green = Color(0xFF00E676)
    val brightGreen = Color(0xFF39FF88)
    val pageBlack = Color(0xFF020403)
    val card = Color(0xFF0B0F0C)
    val cardSoft = Color(0xFF101512)
    val muted = Color(0xFF929A95)
    val divider = Color.White.copy(alpha = 0.07f)

    val displayName = user.name.ifBlank { "SABDHAM Listener" }
    val initial = displayName.trim()
        .firstOrNull()
        ?.uppercaseChar()
        ?.toString() ?: "S"

    val context = androidx.compose.ui.platform.LocalContext.current

    var showProfileAbout by remember { mutableStateOf(false) }
    // SABDHAM_PROFILE_SUPPORT_CENTER
    var showProfileSupport by remember { mutableStateOf(false) }
    fun openProfileSupport() {
        showProfileSupport = true
    }

    val memberSince = if (user.createdAt.isNotBlank()) {
        user.createdAt.take(10)
    } else {
        "SABDHAM Member"
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(pageBlack)
    ) {
        Image(
            painter = painterResource(
                id = com.sabdham.music.R.drawable.sabdham_profile_background
            ),
            contentDescription = null,
            contentScale = ContentScale.FillWidth,
            alignment = Alignment.TopCenter,
            modifier = Modifier
                .matchParentSize()
                .blur(12.dp)
        )

        Box(
            modifier = Modifier
                .matchParentSize()
                .blur(12.dp)
                .background(
                    Color.Black.copy(alpha = 0.16f)
                )
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = 18.dp,
                    end = 18.dp,
                    top = 25.dp,
                    bottom = 125.dp
                ),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
        Text(
            text = "Profile",
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .fillMaxWidth()
                .offset(y = (-15).dp)
                .padding(bottom = 11.dp)
        )

        Box(
            contentAlignment = Alignment.BottomEnd
        ) {
            Surface(
                modifier = Modifier.size(104.dp),
                shape = CircleShape,
                color = Color(0xFF111A14),
                border = BorderStroke(3.dp, green)
            ) {
                if (user.avatarUrl.isNotBlank()) {
                    AsyncImage(
                        model = user.avatarUrl,
                        contentDescription = "Profile photo",
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initial,
                            color = brightGreen,
                            fontSize = 40.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }

            Surface(
                modifier = Modifier.size(32.dp),
                shape = CircleShape,
                color = green,
                border = BorderStroke(3.dp, pageBlack)
            ) {
                Icon(
                    imageVector = Icons.Default.CameraAlt,
                    contentDescription = "Change profile photo",
                    tint = Color.Black,
                    modifier = Modifier.padding(7.dp)
                )
            }
        }

        Spacer(Modifier.height(7.dp))

        Text(
            text = displayName,
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(4.dp))

        Text(
            text = user.email,
            color = muted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )

        if (user.bio.isNotBlank()) {
            Spacer(Modifier.height(7.dp))
            Text(
                text = user.bio,
                color = Color.White.copy(alpha = 0.62f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }

        Spacer(Modifier.height(9.dp))

        Surface(
            shape = RoundedCornerShape(50.dp),
            color = green.copy(alpha = 0.11f),
            border = BorderStroke(1.dp, green.copy(alpha = 0.32f))
        ) {
            Row(
                modifier = Modifier.padding(
                    horizontal = 12.dp,
                    vertical = 6.dp
                ),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Verified,
                    contentDescription = null,
                    tint = brightGreen,
                    modifier = Modifier.size(15.dp)
                )

                Spacer(Modifier.width(6.dp))

                Text(
                    text = "VERIFIED LISTENER",
                    color = brightGreen,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }

        Spacer(Modifier.height(10.dp))

        OutlinedButton(
            onClick = onEditProfileClick,
            shape = RoundedCornerShape(50.dp),
            border = BorderStroke(
                1.dp,
                Color.White.copy(alpha = 0.16f)
            ),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = Color.White
            )
        ) {
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(Modifier.width(7.dp))
            Text(
                text = "Edit Profile",
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {

            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0x331F1018)
                ),
                border = BorderStroke(
                    1.dp,
                    Color(0x66FF5C8A)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp, horizontal = 3.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = likedSongsCount.toString(),
                        color = Color(0xFFFF5C8A),
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Liked Songs",
                        color = muted,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 2
                    )
                }
            }

            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0x3310E676)
                ),
                border = BorderStroke(
                    1.dp,
                    Color(0x6639FF88)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp, horizontal = 3.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = createdPlaylistsCount.toString(),
                        color = Color(0xFF39FF88),
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Playlists",
                        color = muted,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0x3310BFEF)
                ),
                border = BorderStroke(
                    1.dp,
                    Color(0x6645D7FF)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp, horizontal = 3.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = importedPlaylistsCount.toString(),
                        color = Color(0xFF45D7FF),
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Imported",
                        color = muted,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0x33FFB300)
                ),
                border = BorderStroke(
                    1.dp,
                    Color(0x66FFC247)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp, horizontal = 3.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "0",
                        color = Color(0xFFFFC247),
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Recent",
                        color = muted,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(
                containerColor = card
            ),
            border = BorderStroke(
                1.dp,
                Color.White.copy(alpha = 0.06f)
            )
        ) {
            Column {
                SabdhamProfileMenuRow(
                    icon = Icons.Default.Person,
                    title = "Account Information",
                    subtitle = user.email,
                    green = green,
                    onClick = onEditProfileClick
                )

                SabdhamProfileDivider()

                SabdhamProfileMenuRow(
                    icon = Icons.Default.Settings,
                    title = "App Settings",
                    subtitle = "Playback, audio and preferences",
                    green = green,
                    onClick = onSettingsClick
                )


                SabdhamProfileDivider()

                SabdhamProfileMenuRow(
                    icon = Icons.Default.Help,
                    title = "Help & Support",
                    subtitle = "FAQs and report a problem",
                    green = green,
                    onClick = { openProfileSupport() }
                )

                SabdhamProfileDivider()

                SabdhamProfileMenuRow(
                    icon = Icons.Default.Info,
                    title = "About SABDHAM",
                    subtitle = "Santh Creatives",
                    green = green,
                    onClick = { showProfileAbout = true }
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(
                containerColor = cardSoft
            ),
            border = BorderStroke(
                1.dp,
                green.copy(alpha = 0.14f)
            )
        ) {
            Column(
                modifier = Modifier.padding(17.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.VerifiedUser,
                        contentDescription = null,
                        tint = brightGreen,
                        modifier = Modifier.size(21.dp)
                    )

                    Spacer(Modifier.width(10.dp))

                    Column {
                        Text(
                            text = "SABDHAM ACCOUNT",
                            color = brightGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "Signed in securely",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(Modifier.height(9.dp))

                Text(
                    text = "SABDHAM ID",
                    color = muted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = user.id.ifBlank { "N/A" },
                    color = Color.White,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(Modifier.height(12.dp))

                Text(
                    text = "MEMBER SINCE",
                    color = muted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = memberSince,
                    color = Color.White,
                    fontSize = 12.sp
                )
            }
        }

        Spacer(Modifier.height(14.dp))

        OutlinedButton(
            onClick = onLogout,
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(
                1.dp,
                Color(0xFFFF5252).copy(alpha = 0.55f)
            ),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = Color(0xFFFF5252)
            )
        ) {
            Icon(
                imageVector = Icons.Filled.Logout,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )

            Spacer(Modifier.width(8.dp))

            Text(
                text = if (isLoading) "Signing Out..." else "Sign Out",
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.height(14.dp))

        Text(
            text = "SABDHAM",
            color = green,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold
        )

        Text(
            text = "Music without boundaries",
            color = muted,
            fontSize = 10.sp
        )

        if (showProfileSupport) {
            SabdhamProfileSupportDialog(
                onDismiss = {
                    showProfileSupport = false
                }
            )
        }

        if (showProfileAbout) {
            SabdhamLegalDialog(
                title = "About SABDHAM",
                body = SABDHAM_ABOUT_TEXT + "\n\n" +
                    "Developer / Publisher: Santh Creatives\n\n" +
                    "Privacy Policy and Terms & Conditions are available inside App Settings.",
                onDismiss = { showProfileAbout = false },
                onSupport = {
                    showProfileAbout = false
                    openProfileSupport()
                }
            )
        }
    }
    }
}

private fun sabdhamSupportWordCount(text: String): Int =
    text.trim()
        .split(Regex("\\s+"))
        .count { it.isNotBlank() }

private fun sabdhamSupportContainsSensitiveData(
    text: String
): Boolean {
    if (text.isBlank()) return false

    val patterns = listOf(
        Regex("""(?i)\b(?:password|passwd|pwd|api[_ -]?key|secret|token|otp|passcode|verification\s*code)\s*[:=]\s*\S+"""),
        Regex("""(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{12,}"""),
        Regex("""(?i)\b(?:re_|sk_|ghp_|xox[baprs]-|AIza)[A-Za-z0-9_-]{10,}"""),
        Regex("""-----BEGIN [A-Z ]*PRIVATE KEY-----"""),
        Regex("""[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"""),
        Regex("""(?<!\d)\+?\d[\d\s()\-]{7,}\d(?!\d)""")
    )

    return patterns.any { it.containsMatchIn(text) }
}

@Composable
private fun SabdhamProfileSupportDialog(
    onDismiss: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    val green = Color(0xFF00E676)
    val brightGreen = Color(0xFFB8FF20)
    val background = Color(0xFF050706)
    val card = Color(0xFF111511)
    val muted = Color(0xFF9CA39C)

    var report by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var resultMessage by remember { mutableStateOf<String?>(null) }
    var resultSuccess by remember { mutableStateOf(false) }

    val expandedFaqs = remember {
        mutableStateMapOf<Int, Boolean>()
    }

    val faqs = remember {
        listOf(
            "Why am I unable to sign in?" to
                "Check your internet connection and use the same verified account. Never send a password, OTP, verification code, authentication token or secret to support.",

            "I did not receive my verification code." to
                "Check the email address, Spam or Junk folder, wait for the resend timer and request another code. SABDHAM Support will never ask you to send your OTP.",

            "Google sign-in is not working." to
                "Check your internet connection and Google services, then retry with the same Google account. Describe the error without sending credentials.",

            "Why are my liked songs or playlists missing?" to
                "Make sure you are signed in to the same SABDHAM account and allow synchronization to finish. Avoid clearing app data unless necessary.",

            "A song will not play. What should I report?" to
                "Include the song title, artist, where you opened it from, the steps that reproduce the problem, what you expected and what actually happened.",

            "Playback does not move to the next song." to
                "Explain whether the song came from Search, a playlist or the catalogue, your network state and the exact steps that reproduce the issue.",

            "Can support ask for my password or OTP?" to
                "No. SABDHAM Support does not need passwords, OTPs, API keys, authentication tokens, private keys, payment information or secret credentials.",

            "What should I include in a report?" to
                "Write at least 50 words describing the feature, steps to reproduce the issue, expected behaviour and actual behaviour. Do not include email addresses, phone numbers, passwords, codes, tokens or other private information.",

            "Where are the Privacy Policy and Terms?" to
                "Open App Settings to read SABDHAM Privacy Policy, Terms & Conditions, copyright information and related notices."
        )
    }

    val wordCount = sabdhamSupportWordCount(report)
    val containsSensitiveData =
        sabdhamSupportContainsSensitiveData(report)

    androidx.compose.ui.window.Dialog(
        onDismissRequest = {
            if (!sending) onDismiss()
        },
        properties =
            androidx.compose.ui.window.DialogProperties(
                usePlatformDefaultWidth = false
            )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.92f),
            shape = RoundedCornerShape(22.dp),
            color = background,
            border = BorderStroke(
                1.dp,
                green.copy(alpha = 0.28f)
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(18.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Help & Support",
                            color = Color.White,
                            fontSize = 23.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "SABDHAM Support Center",
                            color = green,
                            fontSize = 13.sp
                        )
                    }

                    IconButton(
                        onClick = {
                            if (!sending) onDismiss()
                        }
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {
                    item {
                        Text(
                            "Frequently Asked Questions",
                            color = brightGreen,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Tap a question to read the answer.",
                            color = muted,
                            fontSize = 12.sp
                        )
                    }

                    item {
                        Column(
                            verticalArrangement =
                                Arrangement.spacedBy(10.dp)
                        ) {
                            faqs.forEachIndexed { index, faq ->
                                val expanded =
                                    expandedFaqs[index] == true

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            expandedFaqs[index] =
                                                !expanded
                                        },
                                    colors =
                                        CardDefaults.cardColors(
                                            containerColor = card
                                        ),
                                    shape =
                                        RoundedCornerShape(14.dp),
                                    border =
                                        BorderStroke(
                                            1.dp,
                                            Color.White.copy(
                                                alpha = 0.06f
                                            )
                                        )
                                ) {
                                    Column(
                                        Modifier.padding(14.dp)
                                    ) {
                                        Row(
                                            verticalAlignment =
                                                Alignment.CenterVertically
                                        ) {
                                            Text(
                                                faq.first,
                                                modifier =
                                                    Modifier.weight(1f),
                                                color = Color.White,
                                                fontSize = 14.sp,
                                                fontWeight =
                                                    FontWeight.SemiBold
                                            )
                                            Icon(
                                                if (expanded)
                                                    Icons.Default.KeyboardArrowUp
                                                else
                                                    Icons.Default.KeyboardArrowDown,
                                                contentDescription = null,
                                                tint = green
                                            )
                                        }

                                        if (expanded) {
                                            Spacer(
                                                Modifier.height(9.dp)
                                            )
                                            Text(
                                                faq.second,
                                                color = muted,
                                                fontSize = 13.sp,
                                                lineHeight = 19.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider(
                            color =
                                Color.White.copy(alpha = 0.08f)
                        )
                        Spacer(Modifier.height(18.dp))

                        Text(
                            "Send a Report",
                            color = brightGreen,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(Modifier.height(5.dp))

                        Text(
                            "Explain the issue in at least 50 words.",
                            color = muted,
                            fontSize = 12.sp
                        )

                        Spacer(Modifier.height(8.dp))

                        Surface(
                            color = Color(0xFF201B08),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                Color(0xFFFFC107)
                                    .copy(alpha = 0.35f)
                            )
                        ) {
                            Text(
                                "Security: Never include passwords, OTP codes, verification codes, API keys, authentication tokens, private keys, email addresses, phone numbers or other private details.",
                                modifier = Modifier.padding(12.dp),
                                color = Color(0xFFFFD54F),
                                fontSize = 12.sp,
                                lineHeight = 17.sp
                            )
                        }

                        Spacer(Modifier.height(12.dp))

                        OutlinedTextField(
                            value = report,
                            onValueChange = {
                                if (it.length <= 6000) {
                                    report = it
                                    resultMessage = null
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            label = {
                                Text("Describe the problem")
                            },
                            placeholder = {
                                Text(
                                    "Tell us what happened, how to reproduce it, what you expected and what actually happened..."
                                )
                            },
                            enabled = !sending,
                            minLines = 7,
                            maxLines = 12,
                            colors =
                                OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = green,
                                    focusedLabelColor = green,
                                    cursorColor = green,
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                )
                        )

                        Spacer(Modifier.height(7.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement =
                                Arrangement.SpaceBetween
                        ) {
                            Text(
                                "$wordCount / 50 words minimum",
                                color =
                                    if (wordCount >= 50)
                                        green
                                    else
                                        muted,
                                fontSize = 12.sp
                            )
                            Text(
                                "${report.length} / 6000",
                                color = muted,
                                fontSize = 12.sp
                            )
                        }

                        if (containsSensitiveData) {
                            Spacer(Modifier.height(7.dp))
                            Text(
                                "Remove private or secret information before sending.",
                                color = Color(0xFFFF6B6B),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        resultMessage?.let { status ->
                            Spacer(Modifier.height(9.dp))
                            Text(
                                status,
                                color =
                                    if (resultSuccess)
                                        green
                                    else
                                        Color(0xFFFF6B6B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Spacer(Modifier.height(14.dp))

                        Button(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            enabled =
                                wordCount >= 50 &&
                                !containsSensitiveData &&
                                !sending,
                            colors =
                                ButtonDefaults.buttonColors(
                                    containerColor = green,
                                    contentColor = Color.Black,
                                    disabledContainerColor =
                                        Color(0xFF303630),
                                    disabledContentColor = muted
                                ),
                            shape = RoundedCornerShape(14.dp),
                            onClick = {
                                if (
                                    wordCount >= 50 &&
                                    !containsSensitiveData &&
                                    !sending
                                ) {
                                    scope.launch {
                                        sending = true
                                        resultMessage = null

                                        val result =
                                            com.morningmusic.app.data.network
                                                .SabdhamSupportService
                                                .sendReport(
                                                    context,
                                                    report
                                                )

                                        resultSuccess =
                                            result.success

                                        resultMessage =
                                            if (
                                                result.success &&
                                                !result.reference
                                                    .isNullOrBlank()
                                            ) {
                                                result.message +
                                                    " Reference: " +
                                                    result.reference
                                            } else {
                                                result.message
                                            }

                                        if (result.success) {
                                            report = ""
                                        }

                                        sending = false
                                    }
                                }
                            }
                        ) {
                            if (sending) {
                                CircularProgressIndicator(
                                    modifier =
                                        Modifier.size(21.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.Black
                                )
                                Spacer(Modifier.width(10.dp))
                                Text("Sending...")
                            } else {
                                Icon(
                                    Icons.Default.Send,
                                    contentDescription = null
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "Send Report",
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(Modifier.height(14.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun SabdhamProfileMenuRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    green: Color,
    onClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            modifier = Modifier.size(42.dp),
            shape = RoundedCornerShape(13.dp),
            color = green.copy(alpha = 0.10f),
            border = BorderStroke(
                1.dp,
                green.copy(alpha = 0.18f)
            )
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = green,
                modifier = Modifier.padding(10.dp)
            )
        }

        Spacer(Modifier.width(13.dp))

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(Modifier.height(2.dp))

            Text(
                text = subtitle,
                color = Color.White.copy(alpha = 0.45f),
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = green.copy(alpha = 0.55f),
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun SabdhamProfileDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(
            start = 70.dp,
            end = 16.dp
        ),
        color = Color.White.copy(alpha = 0.055f)
    )
}

@Composable
private fun ProfileInfoRow(
    label: String,
    value: String
) {
    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = label,
            color = Color(0xFF00E676).copy(alpha = 0.65f),
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold
        )

        Spacer(Modifier.height(4.dp))

        Text(
            text = value.ifBlank { "-" },
            color = Color.White.copy(alpha = 0.88f),
            fontSize = 13.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}
































































































private fun applySabdhamAudioPreferences(
    context: android.content.Context
) {
    val appPrefs =
        context.getSharedPreferences(
            "sabdham_app_settings",
            android.content.Context.MODE_PRIVATE
        )

    val eqPrefs =
        context.getSharedPreferences(
            "sabdham_equalizer_settings",
            android.content.Context.MODE_PRIVATE
        )

    val service =
        com.morningmusic.app.service.PlaybackService.instance
            ?: return

    service.setAutoplay(
        appPrefs.getBoolean(
            "autoplay",
            false
        )
    )

    service.setGapless(
        appPrefs.getBoolean(
            "gapless",
            false
        )
    )

    service.setCrossfade(
        if (
            appPrefs.getBoolean(
                "crossfade",
                false
            )
        ) {
            4
        } else {
            0
        }
    )

    service.setVolumeNormalization(
        appPrefs.getBoolean(
            "volume_normalization",
            false
        )
    )

    service.setEqualizer(
        enabled =
            eqPrefs.getBoolean(
                "equalizer_enabled",
                false
            ),
        preset =
            eqPrefs.getString(
                "equalizer_preset",
                "Flat"
            ) ?: "Flat",
        bands =
            intArrayOf(
                eqPrefs.getFloat("eq_bass", 0f).toInt(),
                eqPrefs.getFloat("eq_low_mid", 0f).toInt(),
                eqPrefs.getFloat("eq_mid", 0f).toInt(),
                eqPrefs.getFloat("eq_high_mid", 0f).toInt(),
                eqPrefs.getFloat("eq_treble", 0f).toInt()
            )
    )
}
// ============================================================================
// SABDHAM FULL SETTINGS PAGE
// Isolated UI/preferences implementation.
// Does not change MusicViewModel, MusicSearchService or playback resolution.
// ============================================================================

@Composable
private fun SabdhamSettingsPage(
    onBack: () -> Unit,
    onEqualizerClick: () -> Unit,
    onClearSearchHistory: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current

    val prefs = remember {
        context.getSharedPreferences(
            "sabdham_app_settings",
            android.content.Context.MODE_PRIVATE
        )
    }

    var crossfade by remember {
        mutableStateOf(prefs.getBoolean("crossfade", false))
    }

    var gapless by remember {
        mutableStateOf(prefs.getBoolean("gapless", false))
    }

    var autoplay by remember {
        mutableStateOf(prefs.getBoolean("autoplay", false))
    }

    var volumeNormalization by remember {
        mutableStateOf(prefs.getBoolean("volume_normalization", false))
    }

    var wifiOnlyDownloads by remember {
        mutableStateOf(prefs.getBoolean("wifi_only_downloads", false))
    }

    var mobileStreaming by remember {
        mutableStateOf(prefs.getBoolean("mobile_streaming", false))
    }

    var playbackQuality by remember {
        mutableStateOf(prefs.getString("playback_quality", "Normal") ?: "Normal")
    }

    var downloadQuality by remember {
        mutableStateOf(prefs.getString("download_quality", "Normal") ?: "Normal")
    }

    var themeMode by remember {
        mutableStateOf(prefs.getString("theme_mode", "Dark") ?: "Dark")
    }

    var playbackQualityDialog by remember { mutableStateOf(false) }
    var downloadQualityDialog by remember { mutableStateOf(false) }
    var themeDialog by remember { mutableStateOf(false) }
    var clearDataDialog by remember { mutableStateOf(false) }
    var equalizerPageVisible by remember { mutableStateOf(false) }

    var message by remember { mutableStateOf<String?>(null) }

    var showPrivacyPolicy by remember { mutableStateOf(false) }
    var showTermsConditions by remember { mutableStateOf(false) }
    var showAboutSabdham by remember { mutableStateOf(false) }
    var showCopyrightNotice by remember { mutableStateOf(false) }

    // Internal support destination. Never print this address in visible UI.
    val sabdhamSupportAddress = "sabdhammusic@gmail.com"

    fun openSabdhamSupport(subject: String) {
        try {
            val intent = android.content.Intent(
                android.content.Intent.ACTION_SENDTO
            ).apply {
                data = android.net.Uri.parse(
                    "mailto:" + sabdhamSupportAddress +
                        "?subject=" + android.net.Uri.encode(subject)
                )
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            message = "No email application is available"
        }
    }
    var settingsServerReady by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        com.morningmusic.app.data.network.SabdhamSettingsSyncService
            .syncFromServer(context)
        applySabdhamAudioPreferences(context)

        crossfade =
            prefs.getBoolean("crossfade", false)

        gapless =
            prefs.getBoolean("gapless", false)

        autoplay =
            prefs.getBoolean("autoplay", false)

        volumeNormalization =
            prefs.getBoolean(
                "volume_normalization",
                false
            )

        wifiOnlyDownloads =
            prefs.getBoolean(
                "wifi_only_downloads",
                false
            )

        mobileStreaming =
            prefs.getBoolean(
                "mobile_streaming",
                false
            )

        playbackQuality =
            prefs.getString(
                "playback_quality",
                "Normal"
            ) ?: "Normal"

        downloadQuality =
            prefs.getString(
                "download_quality",
                "Normal"
            ) ?: "Normal"

        themeMode =
            prefs.getString(
                "theme_mode",
                "Dark"
            ) ?: "Dark"

        settingsServerReady = true
    }

    LaunchedEffect(
        settingsServerReady,
        crossfade,
        gapless,
        autoplay,
        volumeNormalization,
        wifiOnlyDownloads,
        mobileStreaming,
        playbackQuality,
        downloadQuality,
        themeMode
    ) {
        if (settingsServerReady) {
            kotlinx.coroutines.delay(350)

            com.morningmusic.app.data.network.SabdhamSettingsSyncService
                .saveFromLocal(context)
        }
    }

    androidx.activity.compose.BackHandler(enabled = true) {
        if (equalizerPageVisible) {
            equalizerPageVisible = false
        } else {
            onBack()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020403))
            .systemBarsPadding()
    ) {
        androidx.compose.foundation.lazy.LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 42.dp)
        ) {

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    androidx.compose.material3.IconButton(
                        onClick = onBack
                    ) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }

                    Spacer(Modifier.width(6.dp))

                    Text(
                        text = "Settings",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            item {
                SabdhamSettingsSectionTitle("AUDIO & PLAYBACK")
            }




            item {
                SabdhamSettingsSwitchRow(
                    title = "Crossfade",
                    subtitle = "Smooth 4 second transition between songs",
                    checked = crossfade,
                    onCheckedChange = {
                        crossfade = it

                        prefs.edit()
                            .putBoolean("crossfade", it)
                            .apply()

                        com.morningmusic.app.service.PlaybackService.instance
                            ?.setCrossfade(
                                if (it) 4 else 0
                            )
                    }
                )
            }

            item {
                SabdhamSettingsSwitchRow(
                    title = "Gapless Playback",
                    subtitle = "Play consecutive tracks without an added pause",
                    checked = gapless,
                    onCheckedChange = {
                        gapless = it

                        prefs.edit()
                            .putBoolean("gapless", it)
                            .apply()

                        com.morningmusic.app.service.PlaybackService.instance
                            ?.setGapless(it)
                    }
                )
            }

            item {
                SabdhamSettingsSwitchRow(
                    title = "Autoplay",
                    subtitle = "Continue playing recommended music",
                    checked = autoplay,
                    onCheckedChange = {
                        autoplay = it
                        prefs.edit().putBoolean("autoplay", it).apply()
                        applySabdhamAudioPreferences(context)
                    }
                )
            }

            item {
                SabdhamSettingsSwitchRow(
                    title = "Volume Normalization",
                    subtitle = "Keep songs at a consistent volume",
                    checked = volumeNormalization,
                    onCheckedChange = {
                        volumeNormalization = it
                        prefs.edit()
                            .putBoolean("volume_normalization", it)
                            .apply()
                        applySabdhamAudioPreferences(context)
                    }
                )
            }

            item {
                SabdhamSettingsValueRow(
                    title = "Equalizer",
                    subtitle = "Adjust sound frequencies",
                    value = "",
                    onClick = {
                        equalizerPageVisible = true
                    }
                )
            }

            item {
                SabdhamSettingsSectionTitle("STORAGE")
            }



            item {
                SabdhamSettingsValueRow(
                    title = "Storage",
                    subtitle = "View SABDHAM storage usage",
                    value = "",
                    onClick = {
                        try {
                            val intent = android.content.Intent(
                                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                android.net.Uri.parse("package:${context.packageName}")
                            )
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            message = "Unable to open storage settings"
                        }
                    }
                )
            }

            item {
                SabdhamSettingsValueRow(
                    title = "Clear Cache",
                    subtitle = "Delete temporary SABDHAM files",
                    value = "",
                    onClick = {
                        try {
                            context.cacheDir.deleteRecursively()
                            context.externalCacheDir?.deleteRecursively()
                            message = "Cache cleared"
                        } catch (_: Exception) {
                            message = "Unable to clear cache"
                        }
                    }
                )
            }

            item {
                SabdhamSettingsValueRow(
                    title = "Clear Search History",
                    subtitle = "Remove recent searches from this device",
                    value = "",
                    onClick = {
                        onClearSearchHistory()
                        message = "Search history cleared"
                    }
                )
            }



            item {
                SabdhamSettingsSectionTitle("NOTIFICATIONS")
            }






item {
                SabdhamSettingsValueRow(
                    title = "Report a Problem",
                    subtitle = "Send feedback about the app",
                    value = "",
                    onClick = {
                        try {
                            val intent = android.content.Intent(
                                android.content.Intent.ACTION_SENDTO
                            ).apply {
                                data = android.net.Uri.parse(
                                    "mailto:" + sabdhamSupportAddress +
                                        "?subject=" +
                                        android.net.Uri.encode("SABDHAM App Feedback")
                                )
                            }

                            context.startActivity(intent)
                        } catch (_: Exception) {
                            message = "No email app available"
                        }
                    }
                )
            }

            item {
                SabdhamSettingsValueRow(
                    title = "Copyright & Rights Holders",
                    subtitle = "Content ownership and removal requests",
                    value = "",
                    onClick = {
                        showCopyrightNotice = true
                    }
                )
            }

            item {
                val versionName = remember {
                    try {
                        val info = context.packageManager.getPackageInfo(
                            context.packageName,
                            0
                        )
                        info.versionName ?: "1.0"
                    } catch (_: Exception) {
                        "1.0"
                    }
                }

                SabdhamSettingsValueRow(
                    title = "About SABDHAM",
                    subtitle = "Santh Creatives\nIndependent project",
                    value = "v$versionName",
                    onClick = {
                        showAboutSabdham = true
                    }
                )
            }
        }

        if (showPrivacyPolicy) {
            SabdhamLegalDialog(
                title = "Privacy Policy",
                body = SABDHAM_PRIVACY_TEXT,
                onDismiss = { showPrivacyPolicy = false },
                onSupport = {
                    showPrivacyPolicy = false
                    openSabdhamSupport("SABDHAM Privacy Request")
                }
            )
        }

        if (showTermsConditions) {
            SabdhamLegalDialog(
                title = "Terms & Conditions",
                body = SABDHAM_TERMS_TEXT,
                onDismiss = { showTermsConditions = false },
                onSupport = {
                    showTermsConditions = false
                    openSabdhamSupport("SABDHAM Legal / Terms Enquiry")
                }
            )
        }

        if (showAboutSabdham) {
            SabdhamLegalDialog(
                title = "About SABDHAM",
                body = SABDHAM_ABOUT_TEXT,
                onDismiss = { showAboutSabdham = false },
                onSupport = {
                    showAboutSabdham = false
                    openSabdhamSupport("SABDHAM Support Request")
                }
            )
        }

        if (showCopyrightNotice) {
            SabdhamLegalDialog(
                title = "Copyright & Rights Holders",
                body = SABDHAM_COPYRIGHT_TEXT,
                onDismiss = { showCopyrightNotice = false },
                onSupport = {
                    showCopyrightNotice = false
                    openSabdhamSupport("SABDHAM Copyright / Removal Request")
                }
            )
        }
        if (message != null) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(20.dp),
                color = Color(0xFF152019),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(
                    text = message!!,
                    color = Color.White,
                    modifier = Modifier.padding(
                        horizontal = 18.dp,
                        vertical = 12.dp
                    )
                )
            }

            LaunchedEffect(message) {
                kotlinx.coroutines.delay(1800)
                message = null
            }
        }
    }

    if (equalizerPageVisible) {
        SabdhamEqualizerSettingsPage(
            onBack = {
                equalizerPageVisible = false
            }
        )
    }

    if (playbackQualityDialog) {
        SabdhamChoiceDialog(
            title = "Playback Quality",
            current = playbackQuality,
            options = listOf("Low", "Normal", "High", "Very High"),
            onDismiss = { playbackQualityDialog = false },
            onSelected = {
                playbackQuality = it
                prefs.edit().putString("playback_quality", it).apply()
                playbackQualityDialog = false
            }
        )
    }

    if (downloadQualityDialog) {
        SabdhamChoiceDialog(
            title = "Download Quality",
            current = downloadQuality,
            options = listOf("Normal", "High", "Very High"),
            onDismiss = { downloadQualityDialog = false },
            onSelected = {
                downloadQuality = it
                prefs.edit().putString("download_quality", it).apply()
                downloadQualityDialog = false
            }
        )
    }

    if (themeDialog) {
        SabdhamChoiceDialog(
            title = "Theme",
            current = themeMode,
            options = listOf("Dark", "Light", "System"),
            onDismiss = { themeDialog = false },
            onSelected = {
                themeMode = it
                prefs.edit().putString("theme_mode", it).apply()
                themeDialog = false
            }
        )
    }

    if (clearDataDialog) {
        AlertDialog(
            onDismissRequest = {
                clearDataDialog = false
            },
            containerColor = Color(0xFF111713),
            title = {
                Text(
                    "Reset local settings?",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    "This resets SABDHAM settings stored on this device. " +
                        "Your account, liked songs and cloud playlists are not deleted.",
                    color = Color(0xFFA6ADA8)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        prefs.edit().clear().apply()

                        crossfade = false
                        gapless = true
                        autoplay = true
                        volumeNormalization = false
                        wifiOnlyDownloads = true
                        mobileStreaming = true
                        playbackQuality = "High"
                        downloadQuality = "High"
                        themeMode = "Dark"

                        clearDataDialog = false
                        message = "Local settings reset"
                    }
                ) {
                    Text(
                        "Reset",
                        color = Color(0xFFFF6B6B)
                    )
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        clearDataDialog = false
                    }
                ) {
                    Text(
                        "Cancel",
                        color = Color(0xFF39FF88)
                    )
                }
            }
        )
    }
}

@Composable
private fun SabdhamSettingsSectionTitle(
    title: String
) {
    Text(
        text = title,
        color = Color(0xFF38EF7D),
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(
            start = 20.dp,
            end = 20.dp,
            top = 23.dp,
            bottom = 8.dp
        )
    )
}

@Composable
private fun SabdhamSettingsSwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                horizontal = 20.dp,
                vertical = 13.dp
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )

            Spacer(Modifier.height(3.dp))

            Text(
                text = subtitle,
                color = Color(0xFF8C9590),
                fontSize = 13.sp
            )
        }

        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = androidx.compose.material3.SwitchDefaults.colors(
                checkedThumbColor = Color.Black,
                checkedTrackColor = Color(0xFF39FF88),
                uncheckedThumbColor = Color(0xFF9A9A9A),
                uncheckedTrackColor = Color(0xFF303531)
            )
        )
    }
}

@Composable
private fun SabdhamSettingsValueRow(
    title: String,
    subtitle: String,
    value: String,
    danger: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(
                horizontal = 20.dp,
                vertical = 15.dp
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = if (danger) {
                    Color(0xFFFF6666)
                } else {
                    Color.White
                },
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )

            Spacer(Modifier.height(3.dp))

            Text(
                text = subtitle,
                color = Color(0xFF8C9590),
                fontSize = 13.sp
            )
        }

        if (value.isNotBlank()) {
            Text(
                text = value,
                color = Color(0xFF39FF88),
                fontSize = 14.sp
            )

            Spacer(Modifier.width(9.dp))
        }

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = Color(0xFF68706B)
        )
    }
}

@Composable
private fun SabdhamChoiceDialog(
    title: String,
    current: String,
    options: List<String>,
    onDismiss: () -> Unit,
    onSelected: (String) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF101512),
        title = {
            Text(
                title,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                options.forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onSelected(option)
                            }
                            .padding(vertical = 13.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = option,
                            color = Color.White,
                            modifier = Modifier.weight(1f)
                        )

                        if (option == current) {
                            Text(
                                text = "\u2713",
                                color = Color(0xFF39FF88),
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {}
    )
}



// ============================================================================
// SABDHAM EQUALIZER SETTINGS
// ============================================================================

@Composable
private fun SabdhamEqualizerSettingsPage(
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current

    val prefs = remember {
        context.getSharedPreferences(
            "sabdham_equalizer_settings",
            android.content.Context.MODE_PRIVATE
        )
    }

    var enabled by remember {
        mutableStateOf(
            prefs.getBoolean("equalizer_enabled", false)
        )
    }

    var preset by remember {
        mutableStateOf(
            prefs.getString("equalizer_preset", "Flat") ?: "Flat"
        )
    }

    var bass by remember {
        mutableFloatStateOf(
            prefs.getFloat("eq_bass", 0f)
        )
    }

    var lowMid by remember {
        mutableFloatStateOf(
            prefs.getFloat("eq_low_mid", 0f)
        )
    }

    var mid by remember {
        mutableFloatStateOf(
            prefs.getFloat("eq_mid", 0f)
        )
    }

    var highMid by remember {
        mutableFloatStateOf(
            prefs.getFloat("eq_high_mid", 0f)
        )
    }

    var treble by remember {
        mutableFloatStateOf(
            prefs.getFloat("eq_treble", 0f)
        )
    }

    var presetDialog by remember {
        mutableStateOf(false)
    }

    LaunchedEffect(
        enabled,
        preset,
        bass,
        lowMid,
        mid,
        highMid,
        treble
    ) {
        applySabdhamAudioPreferences(context)
    }

    var eqServerReady by remember {
        mutableStateOf(false)
    }

    LaunchedEffect(Unit) {
        com.morningmusic.app.data.network.SabdhamSettingsSyncService
            .syncFromServer(context)

        enabled =
            prefs.getBoolean(
                "equalizer_enabled",
                false
            )

        preset =
            prefs.getString(
                "equalizer_preset",
                "Flat"
            ) ?: "Flat"

        bass =
            prefs.getFloat(
                "eq_bass",
                0f
            )

        lowMid =
            prefs.getFloat(
                "eq_low_mid",
                0f
            )

        mid =
            prefs.getFloat(
                "eq_mid",
                0f
            )

        highMid =
            prefs.getFloat(
                "eq_high_mid",
                0f
            )

        treble =
            prefs.getFloat(
                "eq_treble",
                0f
            )

        eqServerReady = true
    }

    LaunchedEffect(
        eqServerReady,
        enabled,
        preset,
        bass,
        lowMid,
        mid,
        highMid,
        treble
    ) {
        if (eqServerReady) {
            kotlinx.coroutines.delay(350)

            com.morningmusic.app.data.network.SabdhamSettingsSyncService
                .saveFromLocal(context)
        }
    }

    fun saveBands() {
        prefs.edit()
            .putFloat("eq_bass", bass)
            .putFloat("eq_low_mid", lowMid)
            .putFloat("eq_mid", mid)
            .putFloat("eq_high_mid", highMid)
            .putFloat("eq_treble", treble)
            .apply()
    }

    fun applyPreset(name: String) {
        preset = name

        when (name) {
            "Flat" -> {
                bass = 0f
                lowMid = 0f
                mid = 0f
                highMid = 0f
                treble = 0f
            }

            "Bass Boost" -> {
                bass = 7f
                lowMid = 4f
                mid = 0f
                highMid = -1f
                treble = 1f
            }

            "Treble Boost" -> {
                bass = -1f
                lowMid = 0f
                mid = 1f
                highMid = 4f
                treble = 7f
            }

            "Vocal" -> {
                bass = -2f
                lowMid = 1f
                mid = 5f
                highMid = 4f
                treble = 1f
            }

            "Rock" -> {
                bass = 5f
                lowMid = 2f
                mid = -1f
                highMid = 3f
                treble = 5f
            }

            "Pop" -> {
                bass = 2f
                lowMid = 3f
                mid = 4f
                highMid = 3f
                treble = 2f
            }
        }

        prefs.edit()
            .putString("equalizer_preset", name)
            .apply()

        saveBands()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020403))
            .systemBarsPadding()
    ) {
        androidx.compose.foundation.lazy.LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 40.dp)
        ) {

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(
                            horizontal = 12.dp,
                            vertical = 14.dp
                        ),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    androidx.compose.material3.IconButton(
                        onClick = onBack
                    ) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }

                    Spacer(Modifier.width(8.dp))

                    Column {
                        Text(
                            text = "Equalizer",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "Customize your sound",
                            color = Color(0xFF8C9590),
                            fontSize = 13.sp
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(
                            horizontal = 20.dp,
                            vertical = 14.dp
                        ),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            "Equalizer",
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        Text(
                            if (enabled)
                                "Sound adjustment enabled"
                            else
                                "Sound adjustment disabled",
                            color = Color(0xFF8C9590),
                            fontSize = 13.sp
                        )
                    }

                    Switch(
                        checked = enabled,
                        onCheckedChange = {
                            enabled = it
                            prefs.edit()
                                .putBoolean(
                                    "equalizer_enabled",
                                    it
                                )
                                .apply()
                        },
                        colors =
                            androidx.compose.material3.SwitchDefaults.colors(
                                checkedThumbColor = Color.Black,
                                checkedTrackColor = Color(0xFF39FF88)
                            )
                    )
                }
            }

            item {
                SabdhamSettingsSectionTitle("PRESET")
            }

            item {
                SabdhamSettingsValueRow(
                    title = "Sound Preset",
                    subtitle = "Choose a predefined sound profile",
                    value = preset,
                    onClick = {
                        presetDialog = true
                    }
                )
            }

            item {
                SabdhamSettingsSectionTitle("FREQUENCIES")
            }

            item {
                SabdhamEqualizerBand(
                    title = "Bass",
                    frequency = "60 Hz",
                    value = bass,
                    enabled = enabled,
                    onValueChange = {
                        bass = it
                        preset = "Custom"
                        prefs.edit()
                            .putString(
                                "equalizer_preset",
                                "Custom"
                            )
                            .apply()
                        saveBands()
                    }
                )
            }

            item {
                SabdhamEqualizerBand(
                    title = "Low Mid",
                    frequency = "230 Hz",
                    value = lowMid,
                    enabled = enabled,
                    onValueChange = {
                        lowMid = it
                        preset = "Custom"
                        prefs.edit()
                            .putString(
                                "equalizer_preset",
                                "Custom"
                            )
                            .apply()
                        saveBands()
                    }
                )
            }

            item {
                SabdhamEqualizerBand(
                    title = "Mid",
                    frequency = "910 Hz",
                    value = mid,
                    enabled = enabled,
                    onValueChange = {
                        mid = it
                        preset = "Custom"
                        prefs.edit()
                            .putString(
                                "equalizer_preset",
                                "Custom"
                            )
                            .apply()
                        saveBands()
                    }
                )
            }

            item {
                SabdhamEqualizerBand(
                    title = "High Mid",
                    frequency = "3.6 kHz",
                    value = highMid,
                    enabled = enabled,
                    onValueChange = {
                        highMid = it
                        preset = "Custom"
                        prefs.edit()
                            .putString(
                                "equalizer_preset",
                                "Custom"
                            )
                            .apply()
                        saveBands()
                    }
                )
            }

            item {
                SabdhamEqualizerBand(
                    title = "Treble",
                    frequency = "14 kHz",
                    value = treble,
                    enabled = enabled,
                    onValueChange = {
                        treble = it
                        preset = "Custom"
                        prefs.edit()
                            .putString(
                                "equalizer_preset",
                                "Custom"
                            )
                            .apply()
                        saveBands()
                    }
                )
            }

            item {
                Spacer(
                    modifier = Modifier.height(16.dp)
                )

                TextButton(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                    onClick = {
                        applyPreset("Flat")
                    }
                ) {
                    Text(
                        text = "Reset Equalizer",
                        color = Color(0xFF39FF88),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }

    if (presetDialog) {
        SabdhamChoiceDialog(
            title = "Equalizer Preset",
            current = preset,
            options = listOf(
                "Flat",
                "Bass Boost",
                "Treble Boost",
                "Vocal",
                "Rock",
                "Pop"
            ),
            onDismiss = {
                presetDialog = false
            },
            onSelected = {
                applyPreset(it)
                presetDialog = false
            }
        )
    }
}

@Composable
private fun SabdhamEqualizerBand(
    title: String,
    frequency: String,
    value: Float,
    enabled: Boolean,
    onValueChange: (Float) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                horizontal = 20.dp,
                vertical = 10.dp
            )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    color = if (enabled)
                        Color.White
                    else
                        Color(0xFF686E6A),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium
                )

                Text(
                    text = frequency,
                    color = Color(0xFF78817C),
                    fontSize = 12.sp
                )
            }

            Text(
                text = String.format(
                    java.util.Locale.US,
                    "%+.1f dB",
                    value
                ),
                color = if (enabled)
                    Color(0xFF39FF88)
                else
                    Color(0xFF686E6A),
                fontSize = 13.sp
            )
        }

        androidx.compose.material3.Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = -10f..10f,
            enabled = enabled,
            colors =
                androidx.compose.material3.SliderDefaults.colors(
                    thumbColor = Color(0xFF39FF88),
                    activeTrackColor = Color(0xFF39FF88),
                    inactiveTrackColor = Color(0xFF29302B)
                )
        )
    }
}












