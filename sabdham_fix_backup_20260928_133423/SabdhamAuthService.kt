package com.morningmusic.app.auth

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class SabdhamUser(
    val id: String = "",
    val email: String = "",
    val name: String = "",
    val avatarColor: String = "",
    val avatarUrl: String = "",
    val bio: String = "",
    val createdAt: String = ""
)

data class AuthResult(
    val success: Boolean,
    val message: String,
    val user: SabdhamUser? = null,
    val token: String? = null,
    val isNewUser: Boolean = false,
    val action: String? = null
)

object SabdhamAuthService {
    private const val BASE_URL = "https://sabdham-backend.onrender.com"
    private const val PREFS = "sabdham_secure_session"
    private const val TOKEN = "session_token"
    private const val LOGIN_TIME = "login_time"
    private const val USER_JSON = "user_json"
    private const val SESSION_LIFETIME_MS = 7L * 24L * 60L * 60L * 1000L

    private fun parseUser(obj: JSONObject?): SabdhamUser? {
        if (obj == null) return null
        return SabdhamUser(
            id = obj.optString("id"),
            email = obj.optString("email"),
            name = obj.optString("name"),
            avatarColor = obj.optString("avatarColor"),
            avatarUrl = obj.optString("avatarUrl"),
            bio = obj.optString("bio"),
            createdAt = obj.optString("createdAt")
        )
    }

    private suspend fun request(
        path: String,
        method: String = "POST",
        body: JSONObject? = null,
        token: String? = null
    ): Pair<Int, JSONObject> = withContext(Dispatchers.IO) {
        val connection = URL("$BASE_URL$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 20000
            connection.readTimeout = 20000
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
            }
            if (!token.isNullOrBlank()) {
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null) {
                connection.outputStream.use {
                    it.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = try {
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } catch (_: Exception) {
                JSONObject().put("error", "Authentication service returned an invalid response.")
            }
            status to json
        } finally {
            connection.disconnect()
        }
    }

    suspend fun sendOtp(email: String, signUp: Boolean, name: String): AuthResult {
        return try {
            val payload = JSONObject()
                .put("identifier", email.trim().lowercase())
                .put("purpose", if (signUp) "signup" else "signin")

            if (signUp) payload.put("name", name.trim())

            val (status, json) = request("/api/auth/otp/send", body = payload)
            AuthResult(
                success = status in 200..299 && json.optBoolean("success"),
                message = if (status in 200..299)
                    json.optString("message", "Verification code sent.")
                else json.optString("error", "Unable to send verification code."),
                isNewUser = json.optBoolean("isNewUser"),
                action = json.optString("action").takeIf { it.isNotBlank() }
            )
        } catch (e: Exception) {
            AuthResult(false, "Unable to connect to SABDHAM. Check your internet connection.")
        }
    }

    suspend fun verifyOtp(
        context: Context,
        email: String,
        code: String,
        signUp: Boolean,
        name: String,
        rememberMe: Boolean
    ): AuthResult {
        return try {
            val payload = JSONObject()
                .put("identifier", email.trim().lowercase())
                .put("code", code.trim())

            if (signUp) payload.put("name", name.trim())

            val (status, json) = request("/api/auth/otp/verify", body = payload)

            if (status in 200..299 && json.optBoolean("success")) {
                val token = json.optString("token")
                if (rememberMe && token.isNotBlank()) saveSession(context, token, parseUser(json.optJSONObject("user")))
                AuthResult(
                    true,
                    json.optString("message", "Signed in successfully."),
                    parseUser(json.optJSONObject("user")),
                    token,
                    json.optBoolean("isNewUser")
                )
            } else {
                AuthResult(false, json.optString("error", "Verification failed."))
            }
        } catch (e: Exception) {
            AuthResult(false, "Unable to verify the code. Check your internet connection.")
        }
    }

    suspend fun signInWithGoogle(
        context: Context,
        firebaseIdToken: String,
        displayName: String?,
        photoUrl: String?,
        rememberMe: Boolean = true
    ): AuthResult {
        return try {
            val payload = JSONObject()
                .put("displayName", displayName ?: JSONObject.NULL)
                .put("photoUrl", photoUrl ?: JSONObject.NULL)

            val (status, json) = request(
                "/api/auth/google",
                body = payload,
                token = firebaseIdToken
            )

            if (status in 200..299 && json.optBoolean("success")) {
                val sessionToken = json.optString("token")

                if (rememberMe && sessionToken.isNotBlank()) {
                    saveSession(
                        context = context,
                        token = sessionToken,
                        user = parseUser(json.optJSONObject("user"))
                    )
                }

                AuthResult(
                    success = true,
                    message = json.optString("message", "Signed in successfully with Google."),
                    user = parseUser(json.optJSONObject("user")),
                    token = sessionToken
                )
            } else {
                AuthResult(
                    false,
                    json.optString("error", "Google sign-in could not be completed.")
                )
            }
        } catch (e: Exception) {
            AuthResult(false, "Unable to connect Google Sign-In to SABDHAM.")
        }
    }
    suspend fun restoreSession(context: Context): AuthResult {
        val token = getToken(context)
        val savedUser = getSavedUser(context)

        if (token.isNullOrBlank() || savedUser == null) {
            return AuthResult(false, "")
        }

        return try {
            val (status, json) =
                request("/api/auth/me", method = "GET", token = token)

            when {
                status in 200..299 -> {
                    val serverUser =
                        parseUser(json.optJSONObject("user"))

                    if (serverUser != null) {
                        saveSession(context, token, serverUser)
                    }

                    AuthResult(
                        success = true,
                        message = "",
                        user = serverUser ?: savedUser,
                        token = token
                    )
                }

                else -> {
                    // Keep the locally saved SABDHAM account during
                    // Render/network/server failures.
                    AuthResult(
                        success = true,
                        message = "Using saved SABDHAM session.",
                        user = savedUser,
                        token = token
                    )
                }
            }
        } catch (_: Exception) {
            // Offline/Render outage: keep the account signed in locally.
            AuthResult(
                success = true,
                message = "Using saved SABDHAM session.",
                user = savedUser,
                token = token
            )
        }
    }
    suspend fun logout(context: Context, token: String?) {
        try {
            if (!token.isNullOrBlank()) {
                request("/api/auth/logout", token = token)
            }
        } catch (_: Exception) {
        } finally {
            clearToken(context)
        }
    }

    fun saveSession(
        context: Context,
        token: String,
        user: SabdhamUser?
    ) {
        val prefs =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        val editor = prefs.edit()
            .putString(TOKEN, token)
            .putLong(LOGIN_TIME, System.currentTimeMillis())

        if (user != null) {
            val userJson = JSONObject()
                .put("id", user.id)
                .put("email", user.email)
                .put("name", user.name)
                .put("avatarColor", user.avatarColor)
                .put("avatarUrl", user.avatarUrl)
                .put("bio", user.bio)
                .put("createdAt", user.createdAt)

            editor.putString(USER_JSON, userJson.toString())
        }

        editor.apply()
    }

    fun saveToken(context: Context, token: String) {
        saveSession(
            context = context,
            token = token,
            user = getSavedUser(context)
        )
    }
    fun getToken(context: Context): String? {
        // Keep the local SABDHAM session until the user explicitly logs out.
        // Server-side authentication is still validated by /api/auth/me.
        return context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(TOKEN, null)
            ?.takeIf { it.isNotBlank() }
    }

    fun getSavedUser(context: Context): SabdhamUser? {
        val text = context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(USER_JSON, null)
            ?: return null

        return try {
            parseUser(JSONObject(text))
        } catch (_: Exception) {
            null
        }
    }
    fun clearToken(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(TOKEN)
            .remove(LOGIN_TIME)
            .remove(USER_JSON)
            .apply()
    }
}















