package com.morningmusic.app.service

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Android Media3 Background Playback Service.
 *
 * Autoplay:
 *   controls whether the next queued item starts automatically.
 *
 * Gapless:
 *   when autoplay continues the queue, avoids an intentionally-added
 *   transition pause.
 *
 * Crossfade:
 *   performs a smooth fade-out / fade-in transition using the existing
 *   single ExoPlayer. It does not run a second player, so it is not
 *   simultaneous two-track mixing.
 */
class PlaybackService : MediaSessionService() {

    companion object {
        var instance: PlaybackService? = null
            private set
    }

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null

    val audioEffectsManager = AudioEffectsManager()

    private var autoplayEnabled: Boolean = false
    private var gaplessEnabled: Boolean = false
    private var crossfadeSeconds: Int = 0

    private val transitionHandler =
        Handler(Looper.getMainLooper())

    private var fadeInRunnable: Runnable? = null
    private var isFadingIn = false

    private val transitionMonitor =
        object : Runnable {

            override fun run() {
                val p = player ?: return

                if (
                    autoplayEnabled &&
                    crossfadeSeconds > 0 &&
                    p.isPlaying &&
                    p.hasNextMediaItem() &&
                    p.duration > 0 &&
                    !isFadingIn
                ) {
                    val fadeDurationMs =
                        crossfadeSeconds * 1000L

                    val remaining =
                        p.duration - p.currentPosition

                    if (
                        remaining in 0..fadeDurationMs
                    ) {
                        val level =
                            (
                                remaining.toFloat() /
                                    fadeDurationMs.toFloat()
                            ).coerceIn(
                                0f,
                                1f
                            )

                        p.volume = level
                    } else if (p.volume < 0.999f) {
                        p.volume = 1f
                    }
                } else if (
                    crossfadeSeconds <= 0 &&
                    !isFadingIn &&
                    p.volume < 0.999f
                ) {
                    p.volume = 1f
                }

                transitionHandler.postDelayed(
                    this,
                    80L
                )
            }
        }

    override fun onCreate() {
        super.onCreate()

        instance = this

        val audioAttributes =
            AudioAttributes.Builder()
                .setContentType(
                    C.AUDIO_CONTENT_TYPE_MUSIC
                )
                .setUsage(
                    C.USAGE_MEDIA
                )
                .build()

        val httpDataSourceFactory =
            androidx.media3.datasource
                .DefaultHttpDataSource
                .Factory()
                .setAllowCrossProtocolRedirects(
                    true
                )

        val dataSourceFactory =
            androidx.media3.datasource
                .DefaultDataSource
                .Factory(
                    this,
                    httpDataSourceFactory
                )

        val mediaSourceFactory =
            androidx.media3.exoplayer.source
                .DefaultMediaSourceFactory(
                    dataSourceFactory
                )

        val settingsPrefs =
            getSharedPreferences(
                "sabdham_app_settings",
                android.content.Context.MODE_PRIVATE
            )

        autoplayEnabled =
            settingsPrefs.getBoolean(
                "autoplay",
                false
            )

        gaplessEnabled =
            settingsPrefs.getBoolean(
                "gapless",
                false
            )

        crossfadeSeconds =
            if (
                settingsPrefs.getBoolean(
                    "crossfade",
                    false
                )
            ) {
                4
            } else {
                0
            }

        player =
            ExoPlayer.Builder(this)
                .setMediaSourceFactory(
                    mediaSourceFactory
                )
                .setPauseAtEndOfMediaItems(
                    !autoplayEnabled
                )
                .setAudioAttributes(
                    audioAttributes,
                    true
                )
                .setHandleAudioBecomingNoisy(
                    true
                )
                .build()

        player?.let { p ->

            val initialSessionId =
                p.audioSessionId

            if (
                initialSessionId !=
                    C.AUDIO_SESSION_ID_UNSET &&
                initialSessionId != 0
            ) {
                audioEffectsManager
                    .attachSession(
                        initialSessionId
                    )
            }

            p.addAnalyticsListener(
                object :
                    androidx.media3.exoplayer
                        .analytics.AnalyticsListener {

                    override fun
                        onAudioSessionIdChanged(
                        eventTime:
                            androidx.media3.exoplayer
                                .analytics
                                .AnalyticsListener
                                .EventTime,
                        audioSessionId: Int
                    ) {
                        if (
                            audioSessionId !=
                                C.AUDIO_SESSION_ID_UNSET &&
                            audioSessionId != 0
                        ) {
                            audioEffectsManager
                                .attachSession(
                                    audioSessionId
                                )
                        }
                    }
                }
            )

            p.addListener(
                object : Player.Listener {

                    override fun
                        onMediaItemTransition(
                        mediaItem:
                            androidx.media3.common
                                .MediaItem?,
                        reason: Int
                    ) {
                        if (
                            reason ==
                                Player
                                    .MEDIA_ITEM_TRANSITION_REASON_AUTO
                        ) {

                            if (
                                autoplayEnabled &&
                                crossfadeSeconds > 0
                            ) {
                                startFadeIn(p)
                            } else {

                                p.volume = 1f

                                if (
                                    autoplayEnabled &&
                                    !gaplessEnabled
                                ) {
                                    /*
                                     * Normal transition mode:
                                     * deliberately retain a very small
                                     * track boundary.
                                     *
                                     * Gapless ON skips this completely.
                                     */
                                    p.pause()

                                    transitionHandler
                                        .postDelayed(
                                            {
                                                if (
                                                    autoplayEnabled
                                                ) {
                                                    p.play()
                                                }
                                            },
                                            300L
                                        )
                                }
                            }
                        }
                    }

                    override fun
                        onPlaybackStateChanged(
                        playbackState: Int
                    ) {
                        if (
                            playbackState ==
                                Player.STATE_READY &&
                            crossfadeSeconds <= 0
                        ) {
                            p.volume = 1f
                        }
                    }
                }
            )

            mediaSession =
                MediaSession.Builder(
                    this,
                    p
                ).build()
        }

        transitionHandler.post(
            transitionMonitor
        )

        audioEffectsManager.setCrossfade(
            crossfadeSeconds
        )
    }

    private fun startFadeIn(
        p: ExoPlayer
    ) {
        fadeInRunnable?.let {
            transitionHandler
                .removeCallbacks(it)
        }

        val durationMs =
            (crossfadeSeconds * 1000L)
                .coerceAtLeast(1L)

        val startTime =
            SystemClock.uptimeMillis()

        isFadingIn = true
        p.volume = 0f

        val runnable =
            object : Runnable {

                override fun run() {
                    if (!isFadingIn) {
                        return
                    }

                    val elapsed =
                        SystemClock.uptimeMillis() -
                            startTime

                    val progress =
                        (
                            elapsed.toFloat() /
                                durationMs.toFloat()
                        ).coerceIn(
                            0f,
                            1f
                        )

                    p.volume = progress

                    if (progress < 1f) {
                        transitionHandler
                            .postDelayed(
                                this,
                                50L
                            )
                    } else {
                        p.volume = 1f
                        isFadingIn = false
                        fadeInRunnable = null
                    }
                }
            }

        fadeInRunnable = runnable

        transitionHandler.post(
            runnable
        )
    }

    override fun onGetSession(
        controllerInfo:
            MediaSession.ControllerInfo
    ): MediaSession? {
        return mediaSession
    }

    fun setEqualizer(
        enabled: Boolean,
        preset: String?,
        bands: IntArray?
    ) {
        audioEffectsManager.setEqualizer(
            enabled,
            preset,
            bands
        )
    }

    fun setVolumeNormalization(
        enabled: Boolean
    ) {
        audioEffectsManager
            .setVolumeNormalization(
                enabled
            )
    }

    fun setCrossfade(
        seconds: Int
    ) {
        crossfadeSeconds =
            seconds.coerceIn(
                0,
                8
            )

        audioEffectsManager.setCrossfade(
            crossfadeSeconds
        )

        if (crossfadeSeconds == 0) {
            isFadingIn = false

            fadeInRunnable?.let {
                transitionHandler
                    .removeCallbacks(it)
            }

            fadeInRunnable = null
            player?.volume = 1f
        }
    }

    fun setAutoplay(
        enabled: Boolean
    ) {
        autoplayEnabled = enabled

        player?.setPauseAtEndOfMediaItems(
            !enabled
        )

        if (!enabled) {
            player?.volume = 1f
        }
    }

    fun setGapless(
        enabled: Boolean
    ) {
        gaplessEnabled = enabled
    }

    override fun onDestroy() {
        transitionHandler
            .removeCallbacks(
                transitionMonitor
            )

        fadeInRunnable?.let {
            transitionHandler
                .removeCallbacks(it)
        }

        fadeInRunnable = null
        isFadingIn = false

        if (instance == this) {
            instance = null
        }

        audioEffectsManager.release()

        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }

        player = null

        super.onDestroy()
    }
}
