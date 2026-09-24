import fs from "node:fs";
import { ALL_TRACKS } from "./src/data/musicCatalog";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/\$/g, "\\$");
}

function str(value: unknown, fallback = ""): string {
  return `"${esc(value ?? fallback)}"`;
}

function nullableStr(value: unknown): string {
  return value === undefined || value === null
    ? "null"
    : `"${esc(value)}"`;
}

const kotlinTracks = ALL_TRACKS.map(t => `        Track(
            id = ${str(t.id)},
            audioSourceId = ${str(t.audio_source_id)},
            title = ${str(t.title)},
            artist = ${str(t.artist)},
            album = ${str(t.album)},
            movie = ${nullableStr(t.movie)},
            singers = ${nullableStr(t.singers)},
            musicDirector = ${nullableStr(t.musicDirector)},
            actors = ${nullableStr(t.actors)},
            durationSeconds = ${Number(t.duration || 0)}L,
            durationFormatted = ${str(t.durationFormatted)},
            coverUrl = ${str(t.coverUrl)},
            coverArtUrl = ${nullableStr(t.coverArtUrl || t.coverUrl)},
            audioUrl = ${str(t.audioUrl)},
            language = ${str(t.language)},
            genre = ${nullableStr(t.genre)},
            year = ${t.year ?? "null"},
            releaseDate = ${nullableStr(t.releaseDate)},
            popularityScore = ${t.popularityScore ?? "null"},
            viewCount = ${t.viewCount != null ? `${t.viewCount}L` : "null"},
            streamCount = ${t.streamCount != null ? `${t.streamCount}L` : "null"},
            isTrendingNow = ${t.isTrendingNow === true},
            trendingGrowthRate = ${t.trendingGrowthRate != null ? Number(t.trendingGrowthRate) : "null"},
            lyrics = ${nullableStr(t.lyrics)},
            youtubeVideoId = ${nullableStr(t.youtubeVideoId)},
            source = ${str(t.source || "catalog")},
            addedByUserId = ${nullableStr(t.addedByUserId)}
        )`).join(",\n");

const output = `package com.morningmusic.app.data.repository

import com.morningmusic.app.data.model.Track

object MusicRepository {

    val allTracks: List<Track> = listOf(
${kotlinTracks}
    )

    val popularTamil: List<Track>
        get() = allTracks.filter { it.language.equals("tamil", true) }

    val popularSinhala: List<Track>
        get() = allTracks.filter { it.language.equals("sinhala", true) }

    val popularEnglish: List<Track>
        get() = allTracks.filter { it.language.equals("english", true) }

    val trending: List<Track>
        get() = allTracks.filter {
            it.isTrendingNow || (it.year ?: 0) >= 2024
        }

    val newReleases: List<Track>
        get() = allTracks
            .filter { (it.year ?: 0) >= 2024 }
            .sortedByDescending { it.releaseDate ?: "" }

    val acousticMelodies: List<Track>
        get() = filterGenre("acoustic", "love", "melody")

    val workoutEnergy: List<Track>
        get() = filterGenre("kuthu", "dance", "pop")

    val chillMidnight: List<Track>
        get() = filterGenre("synthwave", "chill", "pop")

    val romanticMelodies: List<Track>
        get() = filterGenre("love", "melodies", "romance")

    val retroClassics: List<Track>
        get() = allTracks.filter {
            (it.year != null && it.year < 2010) ||
            it.genre.orEmpty().contains("classic", true)
        }

    val anirudhHits: List<Track>
        get() = artistContains("anirudh")

    val taylorSwift: List<Track>
        get() = artistContains("taylor swift")

    val arRahmanHits: List<Track>
        get() = artistContains("rahman")

    val sidSriramHits: List<Track>
        get() = artistContains("sid sriram")

    val edSheeranHits: List<Track>
        get() = artistContains("ed sheeran")

    val weekndHits: List<Track>
        get() = artistContains("weeknd")

    val sinhalaLegends: List<Track>
        get() = allTracks.filter {
            it.language.equals("sinhala", true) &&
            (
                it.genre.orEmpty().contains("classic", true) ||
                it.artist.contains("jothipala", true) ||
                it.artist.contains("amaradeva", true) ||
                it.artist.contains("milton", true)
            )
        }

    fun getTrackById(id: String): Track? =
        allTracks.firstOrNull { it.id == id }

    fun getTrackByAudioSourceId(id: String): Track? =
        allTracks.firstOrNull { it.audioSourceId == id }

    private fun artistContains(name: String): List<Track> =
        allTracks.filter { it.artist.contains(name, true) }

    private fun filterGenre(vararg values: String): List<Track> =
        allTracks.filter { track ->
            values.any { value ->
                track.genre.orEmpty().contains(value, true)
            }
        }
}
`;

const outputPath =
  "./android/MorningMusic/app/src/main/java/com/morningmusic/app/data/repository/MusicRepository.kt";

fs.writeFileSync(outputPath, output, "utf8");

console.log("SUCCESS");
console.log("Tracks converted:", ALL_TRACKS.length);
console.log("Created:", outputPath);
