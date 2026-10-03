package com.morningmusic.app.audio

import android.content.Context
import android.media.MediaRoute2Info
import android.media.MediaRouter2
import android.media.RouteDiscoveryPreference
import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AudioRouteDevice(
    val id: String,
    val name: String,
    val selected: Boolean,
    val selectableForSharing: Boolean,
    val deselectable: Boolean,
    val deviceType: Int
)

data class AudioRouteState(
    val supported: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
    val selectedDeviceNames: List<String> = listOf("This device"),
    val devices: List<AudioRouteDevice> = emptyList(),
    val multiAudioActive: Boolean = false,
    val multiAudioAvailable: Boolean = false
) {
    val displayName: String
        get() =
            when {
                selectedDeviceNames.isEmpty() -> "This device"
                selectedDeviceNames.size == 1 -> selectedDeviceNames.first()
                else -> "${selectedDeviceNames.size} devices"
            }
}

class AudioRouteManager(
    context: Context
) {
    private val appContext = context.applicationContext

    private val _state = MutableStateFlow(AudioRouteState())
    val state: StateFlow<AudioRouteState> = _state.asStateFlow()

    private var impl: Api30Impl? = null

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl =
                Api30Impl(
                    context = appContext,
                    onStateChanged = { _state.value = it }
                ).also { it.start() }
        }
    }

    fun transferTo(routeId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl?.transferTo(routeId)
        }
    }

    fun addSharedRoute(routeId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl?.addSharedRoute(routeId)
        }
    }

    fun removeSharedRoute(routeId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl?.removeSharedRoute(routeId)
        }
    }

    fun refresh() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl?.publishState()
        }
    }

    fun close() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            impl?.stop()
        }
        impl = null
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private class Api30Impl(
        context: Context,
        private val onStateChanged: (AudioRouteState) -> Unit
    ) {
        private val router = MediaRouter2.getInstance(context)
        private val executor = context.mainExecutor

        private val discoveryPreference =
            RouteDiscoveryPreference.Builder(
                listOf(
                    MediaRoute2Info.FEATURE_LIVE_AUDIO,
                    MediaRoute2Info.FEATURE_REMOTE_PLAYBACK
                ),
                false
            ).build()

        private val routeCallback =
            object : MediaRouter2.RouteCallback() {
                override fun onRoutesAdded(
                    router: MediaRouter2,
                    routes: MutableList<MediaRoute2Info>
                ) {
                    publishState()
                }

                override fun onRoutesChanged(
                    router: MediaRouter2,
                    routes: MutableList<MediaRoute2Info>
                ) {
                    publishState()
                }

                override fun onRoutesRemoved(
                    router: MediaRouter2,
                    routes: MutableList<MediaRoute2Info>
                ) {
                    publishState()
                }
            }

        private val controllerCallback =
            object : MediaRouter2.ControllerCallback() {
                override fun onControllerUpdated(
                    controller: MediaRouter2.RoutingController
                ) {
                    publishState()
                }
            }

        fun start() {
            try {
                router.registerRouteCallback(
                    executor,
                    routeCallback,
                    discoveryPreference
                )
                router.registerControllerCallback(
                    executor,
                    controllerCallback
                )
                publishState()
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_AUDIO_ROUTE",
                    "Unable to start route discovery",
                    e
                )
            }
        }

        fun stop() {
            try {
                router.unregisterRouteCallback(routeCallback)
            } catch (_: Exception) {
            }

            try {
                router.unregisterControllerCallback(controllerCallback)
            } catch (_: Exception) {
            }
        }

        private fun controller(): MediaRouter2.RoutingController =
            router.systemController

        fun publishState() {
            try {
                val controller = controller()

                val selected = controller.selectedRoutes
                val selectable = controller.selectableRoutes
                val deselectable = controller.deselectableRoutes

                val selectedIds = selected.mapTo(mutableSetOf()) { it.id }
                val selectableIds =
                    selectable.mapTo(mutableSetOf()) { it.id }
                val deselectableIds =
                    deselectable.mapTo(mutableSetOf()) { it.id }

                val allRoutes = linkedMapOf<String, MediaRoute2Info>()

                selected.forEach { allRoutes[it.id] = it }
                selectable.forEach { allRoutes[it.id] = it }

                router.routes.forEach { route ->
                    if (
                        route.features.contains(
                            MediaRoute2Info.FEATURE_LIVE_AUDIO
                        ) ||
                        route.features.contains(
                            MediaRoute2Info.FEATURE_REMOTE_PLAYBACK
                        )
                    ) {
                        allRoutes[route.id] = route
                    }
                }

                val devices =
                    allRoutes.values
                        .map { route ->
                            AudioRouteDevice(
                                id = route.id,
                                name =
                                    route.name
                                        ?.toString()
                                        ?.trim()
                                        .orEmpty()
                                        .ifBlank { "Audio device" },
                                selected = route.id in selectedIds,
                                selectableForSharing =
                                    route.id in selectableIds,
                                deselectable =
                                    route.id in deselectableIds,
                                deviceType = route.type
                            )
                        }
                        .distinctBy { it.id }
                        .sortedWith(
                            compareByDescending<AudioRouteDevice> {
                                it.selected
                            }.thenBy { it.name.lowercase() }
                        )

                val selectedNames =
                    selected
                        .map {
                            it.name
                                ?.toString()
                                ?.trim()
                                .orEmpty()
                                .ifBlank { "This device" }
                        }
                        .distinct()

                onStateChanged(
                    AudioRouteState(
                        supported = true,
                        selectedDeviceNames =
                            selectedNames.ifEmpty {
                                listOf("This device")
                            },
                        devices = devices,
                        multiAudioActive = selected.size > 1,
                        multiAudioAvailable =
                            selectable.isNotEmpty() ||
                                selected.size > 1
                    )
                )
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_AUDIO_ROUTE",
                    "Unable to read audio routes",
                    e
                )
            }
        }

        fun transferTo(routeId: String) {
            try {
                val route =
                    (
                        router.routes +
                            controller().selectedRoutes +
                            controller().selectableRoutes
                        )
                        .firstOrNull { it.id == routeId }
                        ?: return

                router.transferTo(route)
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_AUDIO_ROUTE",
                    "Audio transfer failed route=$routeId",
                    e
                )
            }
        }

        fun addSharedRoute(routeId: String) {
            try {
                val controller = controller()
                val route =
                    controller.selectableRoutes
                        .firstOrNull { it.id == routeId }
                        ?: return

                controller.selectRoute(route)
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_AUDIO_ROUTE",
                    "Multi-audio add failed route=$routeId",
                    e
                )
            }
        }

        fun removeSharedRoute(routeId: String) {
            try {
                val controller = controller()

                if (controller.selectedRoutes.size <= 1) {
                    return
                }

                val route =
                    controller.deselectableRoutes
                        .firstOrNull { it.id == routeId }
                        ?: return

                controller.deselectRoute(route)
            } catch (e: Exception) {
                android.util.Log.w(
                    "SABDHAM_AUDIO_ROUTE",
                    "Multi-audio remove failed route=$routeId",
                    e
                )
            }
        }
    }
}
