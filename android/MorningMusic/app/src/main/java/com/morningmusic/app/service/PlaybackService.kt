package com.morningmusic.app.service

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Android Media3 Background Playback Service.
 * Provides system notifications, lock screen media controls, and background audio streaming.
 */
class PlaybackService : MediaSessionService() {

    companion object {
        var instance: PlaybackService? = null
            private set
    }

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    val audioEffectsManager = AudioEffectsManager()

    override fun onCreate() {
        super.onCreate()
        instance = this

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        player = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build()

        player?.let { p ->
            val initialSessionId = p.audioSessionId
            if (initialSessionId != C.AUDIO_SESSION_ID_UNSET && initialSessionId != 0) {
                audioEffectsManager.attachSession(initialSessionId)
            }

            p.addAnalyticsListener(object : androidx.media3.exoplayer.analytics.AnalyticsListener {
                override fun onAudioSessionIdChanged(
                    eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                    audioSessionId: Int
                ) {
                    if (audioSessionId != C.AUDIO_SESSION_ID_UNSET && audioSessionId != 0) {
                        audioEffectsManager.attachSession(audioSessionId)
                    }
                }
            })

            mediaSession = MediaSession.Builder(this, p).build()
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    fun setEqualizer(enabled: Boolean, preset: String?, bands: IntArray?) {
        audioEffectsManager.setEqualizer(enabled, preset, bands)
    }

    fun setVolumeNormalization(enabled: Boolean) {
        audioEffectsManager.setVolumeNormalization(enabled)
    }

    fun setCrossfade(seconds: Int) {
        audioEffectsManager.setCrossfade(seconds)
    }

    override fun onDestroy() {
        if (instance == this) {
            instance = null
        }
        audioEffectsManager.release()
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
