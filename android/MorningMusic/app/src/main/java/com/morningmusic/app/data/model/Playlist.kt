package com.morningmusic.app.data.model

data class Playlist(
    val id: String,
    val name: String,
    val description: String = "",
    val trackIds: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val isCustom: Boolean = true
)
