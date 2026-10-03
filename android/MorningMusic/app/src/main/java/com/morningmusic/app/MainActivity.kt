package com.morningmusic.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import com.morningmusic.app.ui.screens.HomeScreen
import com.morningmusic.app.ui.viewmodel.MusicViewModel
import com.morningmusic.app.update.SabdhamUpdateGate

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF0D0D11)),
                    color = Color(0xFF0D0D11)
                ) {
                    val musicViewModel: MusicViewModel = viewModel()

                    Box(modifier = Modifier.fillMaxSize()) {
                        HomeScreen(
                            viewModel = musicViewModel
                        )

                        SabdhamUpdateGate()
                    }
                }
            }
        }
    }
}
