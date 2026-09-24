package com.morningmusic.app.ui.theme

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
