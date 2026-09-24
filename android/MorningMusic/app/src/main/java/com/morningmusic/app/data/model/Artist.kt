package com.morningmusic.app.data.model

import java.io.Serializable

data class Artist(
    val id: String,
    val name: String,
    val language: String,
    val imageUrl: String,
    val monthlyListeners: String,
    val bio: String
) : Serializable
