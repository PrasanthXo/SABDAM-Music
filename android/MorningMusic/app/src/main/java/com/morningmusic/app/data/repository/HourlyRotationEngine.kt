package com.morningmusic.app.data.repository

import com.morningmusic.app.data.model.Track
import kotlin.math.abs

object HourlyRotationEngine {

    fun getCurrentHourIndex(): Long {
        return System.currentTimeMillis() / (1000L * 60L * 60L)
    }

    private fun stringHash(str: String): Int {
        var hash = 0
        for (ch in str) {
            hash = (hash shl 5) - hash + ch.code
        }
        return abs(hash)
    }

    private class SeededRng(seed: Long) {
        private var s = if (seed % 2147483647L <= 0) (seed % 2147483647L) + 2147483646L else seed % 2147483647L

        fun nextDouble(): Double {
            s = (s * 16807L) % 2147483647L
            return (s - 1.0) / 2147483646.0
        }
    }

    fun getHourlyRotatedCatalog(
        pool: List<Track>,
        catalogKey: String,
        hourIndex: Long = getCurrentHourIndex(),
        targetCount: Int = 18
    ): List<Track> {
        if (pool.isEmpty()) return emptyList()

        val uniquePool = pool.distinctBy { it.id }
        val n = uniquePool.size
        if (n <= targetCount) return uniquePool

        val desiredCount = targetCount.coerceAtMost(n)

        val prevHourIndex = hourIndex - 1
        val prevSeed = prevHourIndex * 1000003L + stringHash(catalogKey)
        val prevRng = SeededRng(prevSeed)

        val prevIndices = (0 until n).toMutableList()
        for (i in (n - 1) downTo 1) {
            val j = (prevRng.nextDouble() * (i + 1)).toInt()
            val temp = prevIndices[i]
            prevIndices[i] = prevIndices[j]
            prevIndices[j] = temp
        }
        val prevVisibleSet = prevIndices.take(desiredCount).toSet()

        val unseenTracks = mutableListOf<Track>()
        val seenTracks = mutableListOf<Track>()

        for (i in 0 until n) {
            if (prevVisibleSet.contains(i)) {
                seenTracks.add(uniquePool[i])
            } else {
                unseenTracks.add(uniquePool[i])
            }
        }

        val currentSeed = hourIndex * 1000003L + stringHash(catalogKey)
        val currentRng = SeededRng(currentSeed)

        fun shuffle(list: List<Track>): MutableList<Track> {
            val res = list.toMutableList()
            for (i in (res.size - 1) downTo 1) {
                val j = (currentRng.nextDouble() * (i + 1)).toInt()
                val temp = res[i]
                res[i] = res[j]
                res[j] = temp
            }
            return res
        }

        val shuffledUnseen = shuffle(unseenTracks)
        val shuffledSeen = shuffle(seenTracks)

        val combined = mutableListOf<Track>()
        combined.addAll(shuffledUnseen)
        combined.addAll(shuffledSeen)

        return combined.take(desiredCount)
    }
}
