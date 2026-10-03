package com.morningmusic.app.data.model

import java.io.Serializable

data class Genre(
    val id: String,
    val name: String,
    val language: String,
    val coverUrl: String,
    val description: String,
    val gradient: String
) : Serializable
