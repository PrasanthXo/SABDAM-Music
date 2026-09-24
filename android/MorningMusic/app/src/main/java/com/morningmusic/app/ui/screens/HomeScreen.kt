package com.morningmusic.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Lyrics
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import com.morningmusic.app.ui.viewmodel.MusicViewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: MusicViewModel) {
    val currentTrack by viewModel.currentTrack.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val currentPosition by viewModel.currentPosition.collectAsState()
    val duration by viewModel.duration.collectAsState()
    val likedTrackIds by viewModel.likedTrackIds.collectAsState()
    val isShuffle by viewModel.isShuffle.collectAsState()
    val isRepeat by viewModel.isRepeat.collectAsState()

    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val suggestions by viewModel.suggestions.collectAsState()
    val greeting = remember { viewModel.getTimeGreeting() }

    var selectedCategory by remember { mutableStateOf("All") }
    var isFullPlayerVisible by remember { mutableStateOf(false) }
    var isEqDialogVisible by remember { mutableStateOf(false) }

    val categories = listOf("All", "Tamil Hits", "Sinhala Pop", "English Pop", "Trending", "Liked Songs")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D0D11))
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = if (currentTrack != null) 90.dp else 16.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // App Header & Time Greeting
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

                    IconButton(
                        onClick = { isEqDialogVisible = true },
                        modifier = Modifier
                            .background(Color(0xFF1E1E24), CircleShape)
                            .size(42.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Tune,
                            contentDescription = "Equalizer",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Real-time Search Box
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.onSearchQueryChange(it) },
                    placeholder = {
                        Text(
                            "Search Tamil, Sinhala, English songs & artists...",
                            color = Color(0xFF888899),
                            fontSize = 14.sp
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = Color(0xFF888899)
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Clear",
                                    tint = Color.White
                                )
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF1DB954),
                        unfocusedBorderColor = Color(0xFF262630),
                        focusedContainerColor = Color(0xFF1A1A22),
                        unfocusedContainerColor = Color(0xFF16161D)
                    ),
                    singleLine = true
                )
            }

            // Category Filter Pills
            if (searchQuery.isEmpty()) {
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
            if (searchQuery.isNotEmpty()) {
                if (suggestions.isNotEmpty()) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                        ) {
                            Text(
                                "Quick Suggestions",
                                color = Color(0xFFFFB300),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                items(suggestions) { sug ->
                                    Box(
                                        modifier = Modifier
                                            .background(Color(0xFF242430), RoundedCornerShape(14.dp))
                                            .clip(RoundedCornerShape(14.dp))
                                            .clickable { viewModel.onSearchQueryChange(sug) }
                                            .padding(horizontal = 14.dp, vertical = 7.dp)
                                    ) {
                                        Text(
                                            sug,
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                if (isSearching) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp),
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
                                Text("No tracks found", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                Text("Try searching another Tamil, Sinhala, or English song", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                } else {
                    item {
                        SectionHeader("Search Results (${searchResults.size})")
                    }
                    items(searchResults) { track ->
                        val isThisPlaying = currentTrack?.id == track.id
                        TrackListItem(
                            track = track,
                            isActive = isThisPlaying,
                            isPlaying = isThisPlaying && isPlaying,
                            isLiked = likedTrackIds.contains(track.id),
                            onTrackClick = { viewModel.playTrack(track) },
                            onLikeClick = { viewModel.toggleLike(track.id) }
                        )
                    }
                }
            } else {
                // Category-filtered Catalog Views
                when (selectedCategory) {
                    "Tamil Hits" -> {
                        item {
                            SectionHeader("Popular Tamil Hits (${viewModel.popularTamil.size})")
                            VerticalTrackList(
                                tracks = viewModel.popularTamil,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it) },
                                onLikeClick = { viewModel.toggleLike(it.id) }
                            )
                        }
                    }
                    "Sinhala Pop" -> {
                        item {
                            SectionHeader("Modern Sinhala & Classics (${viewModel.popularSinhala.size})")
                            VerticalTrackList(
                                tracks = viewModel.popularSinhala,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it) },
                                onLikeClick = { viewModel.toggleLike(it.id) }
                            )
                        }
                    }
                    "English Pop" -> {
                        item {
                            SectionHeader("Global Pop Chartbusters (${viewModel.popularEnglish.size})")
                            VerticalTrackList(
                                tracks = viewModel.popularEnglish,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it) },
                                onLikeClick = { viewModel.toggleLike(it.id) }
                            )
                        }
                    }
                    "Trending" -> {
                        item {
                            SectionHeader("Trending Viral Hits (${viewModel.trending.size})")
                            VerticalTrackList(
                                tracks = viewModel.trending,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                likedTrackIds = likedTrackIds,
                                onTrackClick = { viewModel.playTrack(it) },
                                onLikeClick = { viewModel.toggleLike(it.id) }
                            )
                        }
                    }
                    "Liked Songs" -> {
                        val likedList = viewModel.allTracks.filter { likedTrackIds.contains(it.id) }
                        item {
                            SectionHeader("Your Liked Songs (${likedList.size})")
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
                                    onTrackClick = { viewModel.playTrack(it) },
                                    onLikeClick = { viewModel.toggleLike(it.id) }
                                )
                            }
                        }
                    }
                    else -> {
                        // "All" - Full Rich Multi-Section Layout
                        item {
                            SectionHeader("Popular Tamil Hits")
                            HorizontalTrackGrid(
                                tracks = viewModel.popularTamil,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                onTrackClick = { viewModel.playTrack(it) }
                            )
                        }

                        item {
                            SectionHeader("Sinhala Hits & Masterpieces")
                            HorizontalTrackGrid(
                                tracks = viewModel.popularSinhala,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                onTrackClick = { viewModel.playTrack(it) }
                            )
                        }

                        item {
                            SectionHeader("Global English Chartbusters")
                            HorizontalTrackGrid(
                                tracks = viewModel.popularEnglish,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                onTrackClick = { viewModel.playTrack(it) }
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
                                        viewModel.onSearchQueryChange(artist.name)
                                    })
                                }
                            }
                        }

                        // Acoustic & Love Melodies
                        item {
                            SectionHeader("Acoustic & Love Melodies")
                            HorizontalTrackGrid(
                                tracks = viewModel.acousticMelodies,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                onTrackClick = { viewModel.playTrack(it) }
                            )
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
                                        viewModel.onSearchQueryChange(genre.name)
                                    })
                                }
                            }
                        }

                        // Fresh Releases
                        item {
                            SectionHeader("Fresh New Releases")
                            HorizontalTrackGrid(
                                tracks = viewModel.newReleases,
                                currentTrack = currentTrack,
                                isPlaying = isPlaying,
                                onTrackClick = { viewModel.playTrack(it) }
                            )
                        }
                    }
                }
            }
        }

        // Native Floating Mini Player Docked at Bottom
        currentTrack?.let { track ->
            NativeMiniPlayer(
                track = track,
                isPlaying = isPlaying,
                currentPosition = currentPosition,
                duration = duration,
                isLiked = likedTrackIds.contains(track.id),
                onPlayPauseClick = { viewModel.togglePlayPause() },
                onLikeClick = { viewModel.toggleLike(track.id) },
                onPlayerClick = { isFullPlayerVisible = true },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            )
        }

        // Full Screen Native Player Modal
        if (isFullPlayerVisible && currentTrack != null) {
            FullPlayerSheet(
                track = currentTrack!!,
                isPlaying = isPlaying,
                currentPosition = currentPosition,
                duration = duration,
                isLiked = likedTrackIds.contains(currentTrack!!.id),
                isShuffle = isShuffle,
                isRepeat = isRepeat,
                onDismiss = { isFullPlayerVisible = false },
                onPlayPause = { viewModel.togglePlayPause() },
                onNext = { viewModel.playNext() },
                onPrevious = { viewModel.playPrevious() },
                onSeek = { viewModel.seekTo(it) },
                onLike = { viewModel.toggleLike(currentTrack!!.id) },
                onShuffle = { viewModel.toggleShuffle() },
                onRepeat = { viewModel.toggleRepeat() },
                onOpenEq = { isEqDialogVisible = true }
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
fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 19.sp,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
    )
}

@Composable
fun HorizontalTrackGrid(
    tracks: List<Track>,
    currentTrack: Track?,
    isPlaying: Boolean,
    onTrackClick: (Track) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        items(tracks) { track ->
            val isActive = currentTrack?.id == track.id
            Column(
                modifier = Modifier
                    .width(148.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF171720))
                    .clickable { onTrackClick(track) }
                    .padding(10.dp)
            ) {
                Box {
                    AsyncImage(
                        model = track.coverUrl,
                        contentDescription = track.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(10.dp))
                    )
                    if (isActive) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .aspectRatio(1f)
                                .background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = Color(0xFF1DB954),
                                modifier = Modifier.size(36.dp)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = track.title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isActive) Color(0xFF1DB954) else Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = track.artist,
                    fontSize = 11.sp,
                    color = Color(0xFF9999AA),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
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
        AsyncImage(
            model = artist.imageUrl,
            contentDescription = artist.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
        )
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
        AsyncImage(
            model = genre.coverUrl,
            contentDescription = genre.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
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
    onLikeClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTrackClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = track.coverUrl,
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
                text = "${track.artist} • ${track.album.ifEmpty { "Single" }}",
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
    }
}

@Composable
fun NativeMiniPlayer(
    track: Track,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isLiked: Boolean,
    onPlayPauseClick: () -> Unit,
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
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AsyncImage(
                    model = track.coverUrl,
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
                }

                IconButton(onClick = onLikeClick) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (isLiked) Color(0xFF1DB954) else Color(0xFF777788),
                        modifier = Modifier.size(20.dp)
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
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullPlayerSheet(
    track: Track,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isLiked: Boolean,
    isShuffle: Boolean,
    isRepeat: Boolean,
    onDismiss: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onLike: () -> Unit,
    onShuffle: () -> Unit,
    onRepeat: () -> Unit,
    onOpenEq: () -> Unit
) {
    var showLyrics by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF121218),
        dragHandle = {
            BottomSheetDefaults.DragHandle(color = Color(0xFF444455))
        },
        modifier = Modifier.fillMaxHeight(0.95f)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Close", tint = Color.White, modifier = Modifier.size(28.dp))
                }
                Text("NOW PLAYING", color = Color(0xFF888899), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                IconButton(onClick = onOpenEq) {
                    Icon(Icons.Outlined.Tune, contentDescription = "Equalizer", tint = Color.White, modifier = Modifier.size(22.dp))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (showLyrics && track.lyrics.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .height(280.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1C1C26))
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = track.lyrics,
                        color = Color(0xFF1DB954),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        lineHeight = 26.sp
                    )
                }
            } else {
                // Large Artwork
                AsyncImage(
                    model = track.coverUrl,
                    contentDescription = track.title,
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(20.dp)),
                    contentScale = ContentScale.Crop
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Title and Like / Lyrics toggle Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${track.artist} • ${track.album.ifEmpty { "Single" }}",
                        color = Color(0xFF9999AA),
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Row {
                    if (track.lyrics.isNotEmpty()) {
                        IconButton(onClick = { showLyrics = !showLyrics }) {
                            Icon(
                                imageVector = Icons.Outlined.Lyrics,
                                contentDescription = "Lyrics",
                                tint = if (showLyrics) Color(0xFF1DB954) else Color(0xFF777788),
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                    IconButton(onClick = onLike) {
                        Icon(
                            imageVector = if (isLiked) Icons.Default.Favorite else Icons.Outlined.FavoriteBorder,
                            contentDescription = "Like",
                            tint = if (isLiked) Color(0xFF1DB954) else Color(0xFF777788),
                            modifier = Modifier.size(26.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Seekbar Slider
            val maxDur = if (duration > 0) duration.toFloat() else 180000f
            val sliderPos = currentPosition.toFloat().coerceIn(0f, maxDur)

            Slider(
                value = sliderPos,
                onValueChange = { onSeek(it.toLong()) },
                valueRange = 0f..maxDur,
                colors = SliderDefaults.colors(
                    thumbColor = Color.White,
                    activeTrackColor = Color(0xFF1DB954),
                    inactiveTrackColor = Color(0xFF2B2B38)
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(formatTime(currentPosition), color = Color(0xFF888899), fontSize = 12.sp)
                Text(formatTime(if (duration > 0) duration else 180000L), color = Color(0xFF888899), fontSize = 12.sp)
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Controls Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onShuffle) {
                    Icon(
                        Icons.Default.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (isShuffle) Color(0xFF1DB954) else Color(0xFF666677),
                        modifier = Modifier.size(24.dp)
                    )
                }

                IconButton(onClick = onPrevious, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                IconButton(
                    onClick = onPlayPause,
                    modifier = Modifier
                        .size(64.dp)
                        .background(Color(0xFF1DB954), CircleShape)
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "Play/Pause",
                        tint = Color.Black,
                        modifier = Modifier.size(34.dp)
                    )
                }

                IconButton(onClick = onNext, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipNext, contentDescription = "Next", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                IconButton(onClick = onRepeat) {
                    Icon(
                        Icons.Default.Repeat,
                        contentDescription = "Repeat",
                        tint = if (isRepeat) Color(0xFF1DB954) else Color(0xFF666677),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
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

    var serverUrlInput by remember { mutableStateOf(viewModel.getBackendUrl()) }
    var isServerExpanded by remember { mutableStateOf(false) }

    val presets = listOf("Flat", "Bass Boost", "Vocal Booster", "Electronic", "Rock", "Acoustic")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1E26),
        title = {
            Text("Audio & Server Settings", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
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

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { isServerExpanded = !isServerExpanded },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Backend Server API", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(if (isServerExpanded) "Hide" else "Configure", color = Color(0xFF1DB954), fontSize = 12.sp)
                }

                if (isServerExpanded) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = serverUrlInput,
                        onValueChange = {
                            serverUrlInput = it
                            viewModel.updateBackendUrl(it)
                        },
                        label = { Text("Server URL", fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF1DB954),
                            unfocusedBorderColor = Color(0xFF444455),
                            focusedContainerColor = Color(0xFF15151C),
                            unfocusedContainerColor = Color(0xFF15151C)
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(
                            onClick = {
                                viewModel.resetBackendUrl()
                                serverUrlInput = viewModel.getBackendUrl()
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("Reset Default", color = Color(0xFFFFB300), fontSize = 11.sp)
                        }
                    }
                }
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
