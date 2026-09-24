package com.morningmusic.app

import android.annotation.SuppressLint
import android.content.ComponentName
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.ViewGroup
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.webkit.WebViewAssetLoader
import com.google.common.util.concurrent.ListenableFuture
import com.morningmusic.app.service.PlaybackService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native Android Host for Sabdham Music.
 * Renders the complete, rich Sabdham application UI (React, Tailwind, Firebase Authentication,
 * Firestore Playlists, Lyrics, Equalizer, Search, and Library) with offline HTTPS asset loading
 * via WebViewAssetLoader, backed natively by Android Jetpack Media3 ExoPlayer for background audio
 * and lock screen media notification controls.
 */
class MainActivity : ComponentActivity() {

    private var mainWebView: WebView? = null
    private var popupWebView: WebView? = null
    private var container: FrameLayout? = null

    private var mediaController: MediaController? = null
    private lateinit var controllerFuture: ListenableFuture<MediaController>
    private var playerListener: Player.Listener? = null
    private lateinit var assetLoader: WebViewAssetLoader

    companion object {
        private const val LOCAL_HOST_URL = "https://appassets.androidplatform.net/assets/public/index.html"
        private const val REMOTE_BACKEND_URL = "https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize AndroidX WebViewAssetLoader for safe origin HTTPS local loading
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)

        container = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF0F0F12.toInt())
        }

        mainWebView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportMultipleWindows(true)
                javaScriptCanOpenWindowsAutomatically = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                userAgentString = "$userAgentString SabdhamAndroidBridge/1.0"
            }

            cookieManager.setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    return assetLoader.shouldInterceptRequest(uri)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    syncPlayerStateToWeb()
                }

                override fun onReceivedError(
                    view: WebView?,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String?
                ) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    if (failingUrl?.contains("appassets.androidplatform.net") == true) {
                        mainWebView?.loadUrl(REMOTE_BACKEND_URL)
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                // Support OAuth and Firebase popup login windows
                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: Message?
                ): Boolean {
                    popupWebView = WebView(this@MainActivity).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.setSupportMultipleWindows(true)
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(v: WebView?, url: String?) {
                                super.onPageFinished(v, url)
                                if (url?.contains("run.app") == true && !url.contains("accounts.google") && !url.contains("firebaseapp")) {
                                    closePopup()
                                }
                            }
                        }
                        webChromeClient = object : WebChromeClient() {
                            override fun onCloseWindow(window: WebView?) {
                                closePopup()
                            }
                        }
                        layoutParams = FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                        )
                    }

                    container?.addView(popupWebView)
                    val transport = resultMsg?.obj as? WebView.WebViewTransport
                    transport?.webView = popupWebView
                    resultMsg?.sendToTarget()
                    return true
                }

                override fun onCloseWindow(window: WebView?) {
                    closePopup()
                }
            }

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        }

        container?.addView(mainWebView)
        setContentView(container)

        // Load through high-speed local AssetLoader
        mainWebView?.loadUrl(LOCAL_HOST_URL)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (popupWebView != null) {
                    closePopup()
                } else if (mainWebView?.canGoBack() == true) {
                    mainWebView?.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun closePopup() {
        popupWebView?.let { popup ->
            container?.removeView(popup)
            popup.destroy()
            popupWebView = null
        }
    }

    override fun onStart() {
        super.onStart()
        val sessionToken = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, sessionToken).buildAsync()
        controllerFuture.addListener({
            try {
                mediaController = controllerFuture.get()
                setupPlayerListener()
                syncPlayerStateToWeb()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    override fun onStop() {
        playerListener?.let {
            mediaController?.removeListener(it)
        }
        MediaController.releaseFuture(controllerFuture)
        super.onStop()
    }

    private fun setupPlayerListener() {
        mediaController?.let { controller ->
            playerListener = object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    notifyWebPlaybackState(isPlaying, controller.currentPosition, controller.duration)
                }

                override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                    mediaItem?.mediaId?.let { trackId ->
                        notifyWebTrackTransition(trackId)
                    }
                }

                override fun onPositionDiscontinuity(
                    oldPosition: Player.PositionInfo,
                    newPosition: Player.PositionInfo,
                    reason: Int
                ) {
                    notifyWebPlaybackState(controller.isPlaying, controller.currentPosition, controller.duration)
                }
            }
            controller.addListener(playerListener!!)
        }
    }

    private fun syncPlayerStateToWeb() {
        mediaController?.let { controller ->
            notifyWebPlaybackState(controller.isPlaying, controller.currentPosition, controller.duration)
            controller.currentMediaItem?.mediaId?.let { id ->
                notifyWebTrackTransition(id)
            }
        }
    }

    private fun notifyWebPlaybackState(isPlaying: Boolean, positionMs: Long, durationMs: Long) {
        runOnUiThread {
            mainWebView?.evaluateJavascript(
                "if (window.onAndroidPlaybackStateChanged) { window.onAndroidPlaybackStateChanged($isPlaying, $positionMs, $durationMs); }",
                null
            )
        }
    }

    private fun notifyWebTrackTransition(trackId: String) {
        runOnUiThread {
            mainWebView?.evaluateJavascript(
                "if (window.onAndroidTrackTransition) { window.onAndroidTrackTransition('$trackId'); }",
                null
            )
        }
    }

    inner class AndroidBridge {

        @JavascriptInterface
        fun playTrack(id: String, url: String, title: String, artist: String, coverUrl: String) {
            runOnUiThread {
                mediaController?.let { controller ->
                    val resolvedUrl = if (url.startsWith("yt:") || url.startsWith("yt-") || id.startsWith("yt-")) {
                        val videoId = url.replace("yt:", "").replace("yt-", "").ifEmpty { id.replace("yt-", "") }
                        "$REMOTE_BACKEND_URL/api/youtube/stream?id=$videoId"
                    } else {
                        url
                    }

                    val mediaItem = MediaItem.Builder()
                        .setUri(resolvedUrl)
                        .setMediaId(id)
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(title)
                                .setArtist(artist)
                                .setArtworkUri(Uri.parse(coverUrl))
                                .build()
                        )
                        .build()
                    controller.stop()
                    controller.setMediaItem(mediaItem)
                    controller.prepare()
                    controller.play()
                }
            }
        }

        @JavascriptInterface
        fun pauseTrack() {
            runOnUiThread {
                mediaController?.pause()
            }
        }

        @JavascriptInterface
        fun resumeTrack() {
            runOnUiThread {
                mediaController?.play()
            }
        }

        @JavascriptInterface
        fun seekTrack(positionMs: Long) {
            runOnUiThread {
                mediaController?.seekTo(positionMs)
            }
        }

        @JavascriptInterface
        fun setQueue(queueJson: String, index: Int) {
            runOnUiThread {
                mediaController?.let { controller ->
                    try {
                        val jsonArray = JSONArray(queueJson)
                        val mediaItems = mutableListOf<MediaItem>()
                        for (i in 0 until jsonArray.length()) {
                            val obj = jsonArray.getJSONObject(i)
                            val id = obj.optString("id")
                            val title = obj.optString("title")
                            val artist = obj.optString("artist")
                            val coverUrl = obj.optString("coverUrl")
                            val audioUrl = obj.optString("audioUrl")

                            val resolvedUrl = if (audioUrl.startsWith("yt:") || audioUrl.startsWith("yt-") || id.startsWith("yt-")) {
                                val videoId = audioUrl.replace("yt:", "").replace("yt-", "").ifEmpty { id.replace("yt-", "") }
                                "$REMOTE_BACKEND_URL/api/youtube/stream?id=$videoId"
                            } else {
                                audioUrl
                            }

                            val mediaItem = MediaItem.Builder()
                                .setUri(resolvedUrl)
                                .setMediaId(id)
                                .setMediaMetadata(
                                    MediaMetadata.Builder()
                                        .setTitle(title)
                                        .setArtist(artist)
                                        .setArtworkUri(Uri.parse(coverUrl))
                                        .build()
                                )
                                .build()
                            mediaItems.add(mediaItem)
                        }
                        controller.stop()
                        controller.setMediaItems(mediaItems)
                        controller.seekTo(index, 0L)
                        controller.prepare()
                        controller.play()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        @JavascriptInterface
        fun getPlaybackState(): String {
            val controller = mediaController
            val isPlaying = controller?.isPlaying ?: false
            val position = controller?.currentPosition ?: 0L
            val duration = controller?.duration ?: 0L
            return JSONObject().apply {
                put("isPlaying", isPlaying)
                put("position", position)
                put("duration", duration)
            }.toString()
        }

        @JavascriptInterface
        fun setEqualizer(enabled: Boolean, preset: String, bandsJson: String) {
            runOnUiThread {
                try {
                    val bandsArray = mutableListOf<Int>()
                    if (bandsJson.isNotEmpty()) {
                        val arr = JSONArray(bandsJson)
                        for (i in 0 until arr.length()) {
                            bandsArray.add(arr.optInt(i, 0))
                        }
                    }
                    PlaybackService.instance?.setEqualizer(
                        enabled = enabled,
                        preset = preset,
                        bands = if (bandsArray.isNotEmpty()) bandsArray.toIntArray() else null
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @JavascriptInterface
        fun setVolumeNormalization(enabled: Boolean) {
            runOnUiThread {
                PlaybackService.instance?.setVolumeNormalization(enabled)
            }
        }

        @JavascriptInterface
        fun setCrossfade(seconds: Int) {
            runOnUiThread {
                PlaybackService.instance?.setCrossfade(seconds)
            }
        }
    }
}
