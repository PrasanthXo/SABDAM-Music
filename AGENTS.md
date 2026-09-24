# Sabdham Android & Web Guidelines

## Architecture & Code Standards
1. **100% Native Jetpack Compose Android App**:
   - The primary Android project is located at `android/MorningMusic/`.
   - `MainActivity.kt` MUST use pure Jetpack Compose (`setContent { MorningMusicTheme { HomeScreen(viewModel) } }`).
   - NEVER revert `MainActivity` to an Android `WebView` or hybrid browser wrapper.
   - Background audio playback is powered natively by Android Jetpack `Media3 ExoPlayer` in `PlaybackService`.

2. **Gradle Build Configuration**:
   - `android/MorningMusic/build.gradle.kts` MUST declare explicit plugin IDs and versions (`com.android.application`, `org.jetbrains.kotlin.android`, `org.jetbrains.kotlin.plugin.compose`).
   - `android/MorningMusic/gradle/libs.versions.toml` MUST be maintained with all version catalog dependencies.
   - `gradle.properties` MUST specify:
     ```properties
     org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8
     android.useAndroidX=true
     android.nonTransitiveRClass=true
     kotlin.code.style=official
     org.gradle.daemon=true
     org.gradle.parallel=true
     org.gradle.caching=true
     ```
   - `local.properties` MUST use clean forward slashes for SDK paths (e.g. `sdk.dir=C:/Users/<username>/AppData/Local/Android/Sdk`).
   - All Gradle wrapper scripts (`gradlew.bat`, `gradlew`, `gradle/wrapper/gradle-wrapper.properties`) MUST be present in the project structure and in `src/utils/androidProjectGenerator.ts`.

3. **Greeting Rule**:
   - Only display the exact time-based greeting (*"Good morning"*, *"Good afternoon"*, *"Good night"*).
   - NEVER display or prompt for user personal names.
