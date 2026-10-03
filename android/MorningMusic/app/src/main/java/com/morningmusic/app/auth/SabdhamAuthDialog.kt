package com.morningmusic.app.auth



import androidx.compose.foundation.verticalScroll
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.sabdham.music.R

private val SabdhamGreen = Color(0xFFB8FF20)
private val SabdhamGreenSoft = Color(0xFF92E600)
private val SabdhamBlack = Color(0xFF050706)
private val SabdhamSurface = Color(0xFF111411)
private val SabdhamSurface2 = Color(0xFF171B17)
private val SabdhamBorder = Color(0xFF30372F)
private val SabdhamMuted = Color(0xFF9CA39C)

@Composable
fun SabdhamAuthDialog(
    authViewModel: AuthViewModel,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }

    val loading by authViewModel.loading.collectAsState()
    val otpSent by authViewModel.otpSent.collectAsState()
    val message by authViewModel.message.collectAsState()
    val error by authViewModel.error.collectAsState()
    val resendSeconds by authViewModel.resendSeconds.collectAsState()
    val authAction by authViewModel.authAction.collectAsState()

    var signUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(true) }



    var legalConsent by remember { mutableStateOf(true) }



    var showSignupTerms by remember { mutableStateOf(false) }



    var showSignupPrivacy by remember { mutableStateOf(false) }
    LaunchedEffect(authAction) {
        if (authAction == "signup" && !signUp) {
            signUp = true
            code = ""
            authViewModel.resetOtp()
            authViewModel.clearAuthAction()
        }
    }

    Dialog(
        onDismissRequest = {
            if (!loading) {
                authViewModel.resetOtp()
                onDismiss()
            }
        },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = !loading,
            dismissOnClickOutside = false
        )
    ) {
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            Image(
                painter = painterResource(R.drawable.sabdham_auth_background),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.00f to Color.Black.copy(alpha = 0.32f),
                                0.30f to Color(0xFF031007).copy(alpha = 0.48f),
                                0.65f to Color(0xFF020703).copy(alpha = 0.68f),
                                1.00f to Color.Black.copy(alpha = 0.92f)
                            )
                        )
                    )
            )
            IconButton(
                enabled = !loading,
                onClick = {
                    if (otpSent) {
                        code = ""
                        authViewModel.resetOtp()
                    } else {
                        authViewModel.resetOtp()
                        onDismiss()
                    }
                },
                modifier = Modifier
                    .statusBarsPadding()
                    .padding(12.dp)
                    .align(Alignment.TopStart)
            ) {
                Icon(
                    imageVector = if (otpSent)
                        Icons.AutoMirrored.Filled.ArrowBack
                    else
                        Icons.Default.Close,
                    contentDescription = if (otpSent) "Back" else "Close",
                    tint = Color.White
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(Modifier.height(38.dp))

                Image(
                    painter = painterResource(R.drawable.sabdham_logo),
                    contentDescription = "SABDHAM logo",
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(22.dp)),
                    contentScale = ContentScale.Crop
                )

                Spacer(Modifier.height(10.dp))

                Text(
                    text = if (otpSent) "Verify Your Email" else "Welcome to SABDHAM",
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 26.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = if (otpSent)
                        "We've sent a 6-digit verification code to"
                    else
                        "Sign in with your email to continue your music journey. Your library will be synced across all your devices.",
                    color = Color.White.copy(alpha = 0.94f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.widthIn(max = 390.dp)
                )

                if (otpSent) {
                    Spacer(Modifier.height(5.dp))
                    Text(
                        text = email,
                        color = SabdhamGreen,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(Modifier.height(18.dp))

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .widthIn(max = 440.dp),
                    shape = RoundedCornerShape(26.dp),
                    color = Color(0xE6071008),
                    border = BorderStroke(
                        1.dp,
                        SabdhamGreen.copy(alpha = 0.20f)
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp)
                    ) {
                        if (!otpSent) {
                            AuthTabs(
                                signUp = signUp,
                                enabled = !loading,
                                onSignIn = {
                                    signUp = false
                                    authViewModel.clearStatus()
                                },
                                onRegister = {
                                    signUp = true
                                    authViewModel.clearStatus()
                                }
                            )

                            Spacer(Modifier.height(20.dp))

                            if (signUp) {
                                OutlinedTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !loading,
                                    singleLine = true,
                                    label = { Text("Display Name") },
                                    placeholder = { Text("Your name") },
                                    leadingIcon = {
                                        Icon(Icons.Default.Person, null)
                                    },
                                    colors = sabdhamTextFieldColors(),
                                    shape = RoundedCornerShape(14.dp)
                                )

                                Spacer(Modifier.height(12.dp))
                            }

                            Text(
                                "Enter your email",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp
                            )

                            Spacer(Modifier.height(8.dp))

                            OutlinedTextField(
                                value = email,
                                onValueChange = { email = it.trim() },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !loading,
                                singleLine = true,
                                placeholder = { Text("you@example.com") },
                                leadingIcon = {
                                    Icon(Icons.Default.Email, null)
                                },
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Email
                                ),
                                colors = sabdhamTextFieldColors(),
                                shape = RoundedCornerShape(14.dp)
                            )
                            if (signUp) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = legalConsent,
                                        onCheckedChange = { legalConsent = it },
                                        enabled = !loading,
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = SabdhamGreen,
                                            checkmarkColor = Color.Black
                                        )
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "I agree to the",
                                            color = SabdhamMuted,
                                            fontSize = 12.sp
                                        )
                                        Text(
                                            text = "Terms & Conditions",
                                            color = SabdhamGreen,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.clickable {
                                                showSignupTerms = true
                                            }
                                        )
                                        Text(
                                            text = "Privacy Policy",
                                            color = SabdhamGreen,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.clickable {
                                                showSignupPrivacy = true
                                            }
                                        )
                                    }
                                }

                                Spacer(Modifier.height(4.dp))
                            }

                            Spacer(Modifier.height(10.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = rememberMe,
                                    onCheckedChange = { rememberMe = it },
                                    enabled = !loading,
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = SabdhamGreen,
                                        checkmarkColor = Color.Black
                                    )
                                )

                                Text(
                                    "Keep me signed in",
                                    color = SabdhamMuted,
                                    fontSize = 13.sp
                                )
                            }
                        } else {
                            Text(
                                "Verification code",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp
                            )

                            Spacer(Modifier.height(10.dp))

                            OutlinedTextField(
                                value = code,
                                onValueChange = { value ->
                                    val digits = value.filter(Char::isDigit).take(6)
                                    code = digits
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !loading,
                                singleLine = true,
                                placeholder = {
                                    Text(
                                        "0  0  0  0  0  0",
                                        modifier = Modifier.fillMaxWidth(),
                                        textAlign = TextAlign.Center
                                    )
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Lock, null)
                                },
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.NumberPassword
                                ),
                                colors = sabdhamTextFieldColors(),
                                shape = RoundedCornerShape(14.dp),
                                textStyle = LocalTextStyle.current.copy(
                                    textAlign = TextAlign.Center,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 8.sp
                                )
                            )

                            Spacer(Modifier.height(10.dp))

                            Text(
                                "The code is valid for 10 minutes.",
                                modifier = Modifier.fillMaxWidth(),
                                color = SabdhamMuted,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        }

                        error?.takeIf { it.isNotBlank() }?.let {
                            Spacer(Modifier.height(14.dp))
                            AuthStatusBox(
                                text = it,
                                background = Color(0x33220000),
                                textColor = Color(0xFFFFA3A3)
                            )
                        }

                        if (error.isNullOrBlank()) {
                            message?.takeIf { it.isNotBlank() }?.let {
                                Spacer(Modifier.height(14.dp))
                                AuthStatusBox(
                                    text = it,
                                    background = Color(0x2222C55E),
                                    textColor = Color(0xFF9AFF9A)
                                )
                            }
                        }

                        Spacer(Modifier.height(18.dp))

                        Button(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            enabled = !loading &&
                                if (otpSent) code.length == 6
                                else email.isNotBlank() &&
                                    (!signUp || (name.isNotBlank() && legalConsent)),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SabdhamGreen,
                                contentColor = Color(0xFF071000),
                                disabledContainerColor = Color(0xFF3D4A32),
                                disabledContentColor = Color(0xFF89917F)
                            ),
                            onClick = {
                                if (otpSent) {
                                    authViewModel.verifyOtp(
                                        email = email,
                                        code = code,
                                        signUp = signUp,
                                        name = name,
                                        rememberMe = rememberMe
                                    ) {
                                        onDismiss()
                                    }
                                } else {
                                    authViewModel.sendOtp(
                                        email = email,
                                        signUp = signUp,
                                        name = name
                                    )
                                }
                            }
                        ) {
                            if (loading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(21.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.Black
                                )
                            } else {
                                Text(
                                    text = if (otpSent)
                                        "Verify & Continue"
                                    else
                                        "Send Verification Code",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 15.sp
                                )
                            }
                        }

                        if (otpSent) {
                            Spacer(Modifier.height(10.dp))

                            Text(
                                text = if (resendSeconds > 0)
                                    "Didn't receive the code? Resend (${resendSeconds}s)"
                                else
                                    "Didn't receive the code? Resend",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(
                                        enabled = resendSeconds == 0 && !loading
                                    ) {
                                        authViewModel.sendOtp(
                                            email = email,
                                            signUp = signUp,
                                            name = name
                                        )
                                    },
                                color = if (resendSeconds > 0)
                                    SabdhamMuted
                                else
                                    SabdhamGreen,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                        }

                        Spacer(Modifier.height(18.dp))

                        OrDivider()

                        Spacer(Modifier.height(18.dp))

                        OutlinedButton(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            enabled = !loading && activity != null,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color.White,
                                contentColor = Color(0xFF111111),
                                disabledContainerColor = Color(0xFFE0E0E0),
                                disabledContentColor = Color(0xFF666666)
                            ),
                            border = BorderStroke(
                                1.dp,
                                Color.White.copy(alpha = 0.90f)
                            ),
                            onClick = {
                                if (!signUp || legalConsent) {
                                    activity?.let {
                                        authViewModel.signInWithGoogle(
                                            activity = it,
                                            rememberMe = rememberMe
                                        ) {
                                            onDismiss()
                                        }
                                    }
                                }
                            }
                        ) {
                            Image(
                                painter = painterResource(R.drawable.google_g_logo),
                                contentDescription = "Google",
                                modifier = Modifier.size(28.dp),
                                contentScale = ContentScale.Fit
                            )

                            Spacer(Modifier.width(12.dp))

                            Text(
                                "Continue with Google",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(Modifier.height(22.dp))

                if (!otpSent) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .widthIn(max = 440.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        AuthBenefitCompact(
                            symbol = "\u2601",
                            title = "Sync Library",
                            modifier = Modifier.weight(1f)
                        )
                        AuthBenefitCompact(
                            symbol = "\u266B",
                            title = "Your Playlists",
                            modifier = Modifier.weight(1f)
                        )
                        AuthBenefitCompact(
                            symbol = "\u25A3",
                            title = "Listen Anywhere",
                            modifier = Modifier.weight(1f)
                        )
                    }
                } else {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .widthIn(max = 440.dp),
                        shape = RoundedCornerShape(18.dp),
                        color = Color(0xFF10180D),
                        border = BorderStroke(
                            1.dp,
                            SabdhamGreen.copy(alpha = 0.28f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "\u21BB",
                                color = SabdhamGreen,
                                fontSize = 24.sp
                            )

                            Spacer(Modifier.width(14.dp))

                            Column {
                                Text(
                                    "Your Library Will Be Synced",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Spacer(Modifier.height(3.dp))
                                Text(
                                    "Playlists, favorites, and listening history will be available on all your devices.",
                                    color = SabdhamMuted,
                                    fontSize = 12.sp,
                                    lineHeight = 17.sp
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(18.dp))
            }
        }
    }
    if (showSignupTerms) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showSignupTerms = false },
            title = { Text("Terms & Conditions", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = com.morningmusic.app.ui.screens.SABDHAM_TERMS_TEXT,
                    color = SabdhamMuted,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .heightIn(max = 430.dp)
                        .verticalScroll(androidx.compose.foundation.rememberScrollState())
                )
            },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { showSignupTerms = false }) {
                    Text("Close", color = SabdhamGreen)
                }
            },
            containerColor = SabdhamSurface2
        )
    }

    if (showSignupPrivacy) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showSignupPrivacy = false },
            title = { Text("Privacy Policy", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = com.morningmusic.app.ui.screens.SABDHAM_PRIVACY_TEXT,
                    color = SabdhamMuted,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .heightIn(max = 430.dp)
                        .verticalScroll(androidx.compose.foundation.rememberScrollState())
                )
            },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { showSignupPrivacy = false }) {
                    Text("Close", color = SabdhamGreen)
                }
            },
            containerColor = SabdhamSurface2
        )
    }
}

@Composable
private fun AuthTabs(
    signUp: Boolean,
    enabled: Boolean,
    onSignIn: () -> Unit,
    onRegister: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SabdhamSurface2, RoundedCornerShape(12.dp))
            .padding(4.dp)
    ) {
        AuthTab(
            text = "Sign In",
            selected = !signUp,
            enabled = enabled,
            modifier = Modifier.weight(1f),
            onClick = onSignIn
        )

        AuthTab(
            text = "Create Account",
            selected = signUp,
            enabled = enabled,
            modifier = Modifier.weight(1f),
            onClick = onRegister
        )
    }
}

@Composable
private fun AuthTab(
    text: String,
    selected: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .background(
                if (selected) SabdhamGreen else Color.Transparent,
                RoundedCornerShape(9.dp)
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (selected) Color.Black else SabdhamMuted,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun OrDivider() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = SabdhamBorder
        )
        Text(
            "OR",
            modifier = Modifier.padding(horizontal = 12.dp),
            color = SabdhamMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = SabdhamBorder
        )
    }
}

@Composable
private fun AuthBenefitCompact(
    symbol: String,
    title: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .background(
                    SabdhamGreen.copy(alpha = 0.12f),
                    RoundedCornerShape(11.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = symbol,
                color = SabdhamGreen,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        }

        Spacer(Modifier.height(6.dp))

        Text(
            text = title,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}
@Composable
private fun AuthBenefit(
    symbol: String,
    title: String,
    subtitle: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = 440.dp)
            .padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .background(
                    SabdhamGreen.copy(alpha = 0.12f),
                    RoundedCornerShape(12.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                symbol,
                color = SabdhamGreen,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        }

        Spacer(Modifier.width(14.dp))

        Column {
            Text(
                title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Text(
                subtitle,
                color = SabdhamMuted,
                fontSize = 12.sp
            )
        }
    }
}

@Composable
private fun AuthStatusBox(
    text: String,
    background: Color,
    textColor: Color
) {
    Text(
        text = text,
        modifier = Modifier
            .fillMaxWidth()
            .background(background, RoundedCornerShape(10.dp))
            .padding(12.dp),
        color = textColor,
        fontSize = 12.sp,
        lineHeight = 17.sp
    )
}

@Composable
private fun sabdhamTextFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        focusedBorderColor = SabdhamGreen,
        unfocusedBorderColor = SabdhamBorder,
        focusedLabelColor = SabdhamGreen,
        unfocusedLabelColor = SabdhamMuted,
        focusedLeadingIconColor = SabdhamGreen,
        unfocusedLeadingIconColor = SabdhamMuted,
        cursorColor = SabdhamGreen,
        focusedContainerColor = Color(0xFF0C0F0C),
        unfocusedContainerColor = Color(0xFF0C0F0C),
        focusedPlaceholderColor = Color(0xFF626962),
        unfocusedPlaceholderColor = Color(0xFF626962)
    )

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
