package com.morningmusic.app.data.model

import java.io.Serializable

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String = "",
    val movie: String = "",
    val durationSeconds: Long = 200L,
    val durationFormatted: String = "3:20",
    val coverUrl: String,
    val audioUrl: String,
    val youtubeVideoId: String = "",
    val language: String,
    val genre: String = "Pop",
    val year: Int = 2024,
    val releaseDate: String = "2024-01-01",
    val popularityScore: Int = 90,
    val streamCount: Long = 1000000L,
    val viewCount: Long = 5000000L,
    val isTrendingNow: Boolean = false,
    val lyrics: String = ""
) : Serializable
