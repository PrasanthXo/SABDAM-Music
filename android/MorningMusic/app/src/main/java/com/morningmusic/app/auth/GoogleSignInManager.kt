package com.morningmusic.app.auth

import android.app.Activity
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await

object GoogleSignInManager {

    private const val WEB_CLIENT_ID =
        "88647605647-r5i6aks4gdpb8b8jicf0ptopv7gmjvuk.apps.googleusercontent.com"

    data class Result(
        val firebaseIdToken: String,
        val displayName: String?,
        val photoUrl: String?
    )

    suspend fun signIn(activity: Activity): Result {
        val credentialManager = CredentialManager.create(activity)

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(WEB_CLIENT_ID)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val response = credentialManager.getCredential(
            context = activity,
            request = request
        )

        val credential = response.credential

        if (
            credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            throw IllegalStateException("Google did not return a valid ID credential.")
        }

        val googleCredential =
            GoogleIdTokenCredential.createFrom(credential.data)

        val firebaseCredential =
            GoogleAuthProvider.getCredential(googleCredential.idToken, null)

        val firebaseResult =
            FirebaseAuth.getInstance()
                .signInWithCredential(firebaseCredential)
                .await()

        val firebaseUser =
            firebaseResult.user
                ?: throw IllegalStateException("Google authentication failed.")

        val firebaseIdToken =
            firebaseUser.getIdToken(true).await().token
                ?: throw IllegalStateException("Unable to obtain Firebase ID token.")

        return Result(
            firebaseIdToken = firebaseIdToken,
            displayName = firebaseUser.displayName,
            photoUrl = firebaseUser.photoUrl?.toString()
        )
    }

    suspend fun clearCredentialState(activity: Activity) {
        try {
            CredentialManager.create(activity)
                .clearCredentialState(ClearCredentialStateRequest())
        } catch (_: Exception) {
        }
    }
}
