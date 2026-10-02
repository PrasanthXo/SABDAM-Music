package com.morningmusic.app.data.repository

import android.content.Context
import com.morningmusic.app.data.model.Track
import java.util.Calendar
import kotlin.random.Random

private const val DAILY_CATALOG_PREFS = "sabdham_daily_catalog_rotation_v2"

fun currentLocalCatalogDay(): Int {
    val calendar = Calendar.getInstance()
    return calendar.get(Calendar.YEAR) * 1000 + calendar.get(Calendar.DAY_OF_YEAR)
}

/**
 * Persistent daily catalogue rotation for the native Android UI.
 *
 * - Rotates once per device-local calendar day.
 * - Liked songs stay eligible and are never added to seen-history.
 * - Never-before-shown catalogue songs are placed before older songs.
 * - Previously shown songs only fill remaining slots, so older content moves back.
 * - Newly added track IDs are automatically "new" because they are absent from history.
 */
fun dailyRotatedCatalog(
    context: Context,
    pool: List<Track>,
    catalogKey: String,
    dayIndex: Int = currentLocalCatalogDay(),
    targetCount: Int = 18,
    likedTrackIds: Set<String> = emptySet()
): List<Track> {
    if (pool.isEmpty()) return emptyList()

    val uniquePool = pool.distinctBy { it.id }.filter { it.id.isNotBlank() }
    if (uniquePool.isEmpty()) return emptyList()

    val desiredCount = targetCount.coerceAtLeast(1).coerceAtMost(uniquePool.size)
    val prefs = context.getSharedPreferences(DAILY_CATALOG_PREFS, Context.MODE_PRIVATE)
    val seenKey = "seen_$catalogKey"
    val dayKey = "day_$catalogKey"
    val todayKey = "today_$catalogKey"

    val validIds = uniquePool.mapTo(mutableSetOf()) { it.id }
    val seenIds = (prefs.getStringSet(seenKey, emptySet()) ?: emptySet())
        .filterTo(mutableSetOf()) { it in validIds }

    // Keep the same selection for the whole local day, even after recomposition,
    // app resume, or like-state updates.
    if (prefs.getInt(dayKey, -1) == dayIndex) {
        val todayIds = prefs.getString(todayKey, "")
            .orEmpty()
            .split('\u001F')
            .filter { it.isNotBlank() }

        if (todayIds.isNotEmpty()) {
            val byId = uniquePool.associateBy { it.id }
            val sameDay = todayIds.mapNotNull { byId[it] }.take(desiredCount)
            if (sameDay.isNotEmpty()) return sameDay
        }
    }

    val liked = uniquePool.filter { it.id in likedTrackIds }
    val unliked = uniquePool.filterNot { it.id in likedTrackIds }
    val unseenUnliked = unliked.filterNot { it.id in seenIds }
    val seenUnliked = unliked.filter { it.id in seenIds }

    fun shuffled(items: List<Track>, salt: Int): List<Track> {
        val seed = (dayIndex.toLong() * 1_000_003L + catalogKey.hashCode() + salt).toInt()
        return items.shuffled(Random(seed))
    }

    val selected = buildList {
        for (track in shuffled(liked, 11)) {
            if (size >= desiredCount) break
            add(track)
        }
        for (track in shuffled(unseenUnliked, 23)) {
            if (size >= desiredCount) break
            add(track)
        }
        for (track in shuffled(seenUnliked, 37)) {
            if (size >= desiredCount) break
            add(track)
        }
    }

    val nextSeen = seenIds.toMutableSet()
    selected.forEach { track ->
        if (track.id !in likedTrackIds) nextSeen.add(track.id)
    }

    prefs.edit()
        .putStringSet(seenKey, nextSeen)
        .putString(todayKey, selected.joinToString("\u001F") { it.id })
        .putInt(dayKey, dayIndex)
        .apply()

    return selected
}
