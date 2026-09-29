package com.morningmusic.app.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val _user = MutableStateFlow<SabdhamUser?>(null)
    val user: StateFlow<SabdhamUser?> = _user.asStateFlow()

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _otpSent = MutableStateFlow(false)
    val otpSent: StateFlow<Boolean> = _otpSent.asStateFlow()

    private val _authAction = MutableStateFlow<String?>(null)
    val authAction: StateFlow<String?> = _authAction.asStateFlow()

    private val _resendSeconds = MutableStateFlow(0)
    val resendSeconds: StateFlow<Int> = _resendSeconds.asStateFlow()

    init {
        restoreSession()
    }

    private fun restoreSession() {
        viewModelScope.launch {
            _loading.value = true

            try {
                // 1. Try the existing SABDHAM session first.
                val savedSession =
                    SabdhamAuthService.restoreSession(getApplication())

                if (savedSession.success && savedSession.user != null) {
                    _user.value = savedSession.user
                    _token.value = savedSession.token
                    return@launch
                }

                // 2. If Render/server lost the SABDHAM session,
                // recover silently from Firebase's persisted login.
                val firebaseUser =
                    FirebaseAuth.getInstance().currentUser
                        ?: return@launch

                val firebaseToken =
                    firebaseUser.getIdToken(true).await().token
                        ?: return@launch

                val recovered =
                    SabdhamAuthService.signInWithGoogle(
                        context = getApplication(),
                        firebaseIdToken = firebaseToken,
                        displayName = firebaseUser.displayName,
                        photoUrl = firebaseUser.photoUrl?.toString(),
                        rememberMe = true
                    )

                if (recovered.success && recovered.user != null) {
                    _user.value = recovered.user
                    _token.value = recovered.token

                    android.util.Log.d(
                        "SABDHAM_AUTH",
                        "SABDHAM session automatically recovered from Firebase."
                    )
                }

            } catch (e: Exception) {
                // Temporary Firebase/network/backend failure must NOT
                // explicitly sign the user out.
                android.util.Log.w(
                    "SABDHAM_AUTH",
                    "Session restoration temporarily unavailable.",
                    e
                )
            } finally {
                _loading.value = false
            }
        }
    }

    fun clearStatus() {
        _message.value = null
        _error.value = null
    }

    fun clearAuthAction() {
        _authAction.value = null
    }

    fun resetOtp() {
        _otpSent.value = false
        _resendSeconds.value = 0
        clearStatus()
    }

    fun sendOtp(email: String, signUp: Boolean, name: String) {
        if (_loading.value) return

        val cleanEmail = email.trim().lowercase()
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(cleanEmail).matches()) {
            _error.value = "Please enter a valid email address."
            return
        }
        if (signUp && name.trim().isEmpty()) {
            _error.value = "Please enter your name or display nickname."
            return
        }

        viewModelScope.launch {
            _loading.value = true
            clearStatus()

            val result = SabdhamAuthService.sendOtp(cleanEmail, signUp, name)

            _loading.value = false
            if (result.success) {
                _otpSent.value = true
                _message.value = result.message
                startCountdown()
            } else {
                _error.value = result.message
                _authAction.value = result.action
            }
        }
    }

    fun verifyOtp(
        email: String,
        code: String,
        signUp: Boolean,
        name: String,
        rememberMe: Boolean,
        onSuccess: () -> Unit
    ) {
        if (_loading.value) return

        if (code.length != 6 || !code.all { it.isDigit() }) {
            _error.value = "Please enter the 6-digit verification code."
            return
        }

        viewModelScope.launch {
            _loading.value = true
            clearStatus()

            val result = SabdhamAuthService.verifyOtp(
                getApplication(),
                email,
                code,
                signUp,
                name,
                rememberMe
            )

            _loading.value = false

            if (result.success && result.user != null) {
                _user.value = result.user
                _token.value = result.token
                _message.value = result.message
                _otpSent.value = false
                onSuccess()
            } else {
                _error.value = result.message
            }
        }
    }

    fun signInWithGoogle(
        activity: android.app.Activity,
        rememberMe: Boolean = true,
        onSuccess: () -> Unit
    ) {
        if (_loading.value) return

        viewModelScope.launch {
            _loading.value = true
            clearStatus()

            try {
                val googleResult = GoogleSignInManager.signIn(activity)

                val result = SabdhamAuthService.signInWithGoogle(
                    context = getApplication(),
                    firebaseIdToken = googleResult.firebaseIdToken,
                    displayName = googleResult.displayName,
                    photoUrl = googleResult.photoUrl,
                    rememberMe = rememberMe
                )

                if (result.success && result.user != null) {
                    _user.value = result.user
                    _token.value = result.token
                    _message.value = result.message
                    _otpSent.value = false
                    onSuccess()
                } else {
                    _error.value = result.message
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Google Sign-In was not completed."
            } finally {
                _loading.value = false
            }
        }
    }
    private fun startCountdown() {
        viewModelScope.launch {
            _resendSeconds.value = 60
            while (_resendSeconds.value > 0) {
                delay(1000)
                _resendSeconds.value -= 1
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            _loading.value = true
            SabdhamAuthService.logout(getApplication(), _token.value)
            _user.value = null
            _token.value = null
            _otpSent.value = false
            clearStatus()
            _loading.value = false
        }
    }
}



