package com.morningmusic.app.service

import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.util.Log

/**
 * Manages native hardware audio effects (Equalizer and LoudnessEnhancer)
 * attached to the active ExoPlayer audioSessionId.
 */
class AudioEffectsManager {

    companion object {
        private const val TAG = "AudioEffectsManager"
    }

    private var equalizer: Equalizer? = null
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var currentSessionId: Int = 0

    // Cached states to re-apply if audio session ID switches
    private var isEqEnabled: Boolean = false
    private var isNormalizationEnabled: Boolean = false
    private var currentPreset: String = "Flat"
    private var currentBands: IntArray = intArrayOf(0, 0, 0, 0, 0)
    private var crossfadeSeconds: Int = 0

    fun attachSession(audioSessionId: Int) {
        if (audioSessionId == 0 || audioSessionId == currentSessionId) return
        currentSessionId = audioSessionId

        release()

        try {
            // 1. Equalizer setup
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = isEqEnabled
            }
            applyEqualizerSettings()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize native Equalizer: ${e.message}")
        }

        try {
            // 2. LoudnessEnhancer (normalization) setup (API 19+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
                    setTargetGain(if (isNormalizationEnabled) 1200 else 0)
                    enabled = isNormalizationEnabled
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize native LoudnessEnhancer: ${e.message}")
        }
    }

    fun setEqualizer(enabled: Boolean, preset: String?, bands: IntArray?) {
        isEqEnabled = enabled
        preset?.let { currentPreset = it }
        bands?.let { currentBands = it }

        equalizer?.let { eq ->
            try {
                eq.enabled = enabled
                if (enabled) {
                    applyEqualizerSettings()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error applying equalizer: ${e.message}")
            }
        }
    }

    private fun applyEqualizerSettings() {
        val eq = equalizer ?: return
        try {
            val numBands = eq.numberOfBands.toInt()
            val minLevel = eq.bandLevelRange[0] // e.g. -1500 mB
            val maxLevel = eq.bandLevelRange[1] // e.g. +1500 mB

            when (currentPreset.lowercase()) {
                "bass boost" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.7f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.4f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), 0)
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.2f).toInt().toShort())
                }
                "acoustic" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.4f).toInt().toShort())
                }
                "rock" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.6f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.5f).toInt().toShort())
                }
                "pop" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), (maxLevel * 0.4f).toInt().toShort())
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (-maxLevel * 0.1f).toInt().toShort())
                }
                "electronic" -> {
                    if (numBands > 0) eq.setBandLevel(0.toShort(), (maxLevel * 0.5f).toInt().toShort())
                    if (numBands > 1) eq.setBandLevel(1.toShort(), (maxLevel * 0.3f).toInt().toShort())
                    if (numBands > 2) eq.setBandLevel(2.toShort(), 0)
                    if (numBands > 3) eq.setBandLevel(3.toShort(), (maxLevel * 0.2f).toInt().toShort())
                    if (numBands > 4) eq.setBandLevel(4.toShort(), (maxLevel * 0.5f).toInt().toShort())
                }
                else -> {
                    for (i in 0 until minOf(numBands, currentBands.size)) {
                        val db = currentBands[i]
                        val mb = (db * 100).coerceIn(minLevel.toInt(), maxLevel.toInt())
                        eq.setBandLevel(i.toShort(), mb.toShort())
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error configuring equalizer bands: ${e.message}")
        }
    }

    fun setVolumeNormalization(enabled: Boolean) {
        isNormalizationEnabled = enabled
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            loudnessEnhancer?.let { le ->
                try {
                    le.setTargetGain(if (enabled) 1200 else 0)
                    le.enabled = enabled
                } catch (e: Exception) {
                    Log.w(TAG, "Error setting loudness enhancer: ${e.message}")
                }
            }
        }
    }

    fun setCrossfade(seconds: Int) {
        crossfadeSeconds = seconds.coerceIn(0, 12)
    }

    fun getCrossfade(): Int = crossfadeSeconds

    fun release() {
        try {
            equalizer?.release()
        } catch (e: Exception) {}
        equalizer = null

        try {
            loudnessEnhancer?.release()
        } catch (e: Exception) {}
        loudnessEnhancer = null
    }
}
