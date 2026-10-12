# Sparkle Android App - Developer Build & Troubleshooting Guide

This guide documents all issues encountered during the build setup and their solutions to help any developer quickly build, update, and deploy the Android APK without friction.

---

## Quick Start (How to Build & Run)

### 1. Build the Debug APK
Open **PowerShell** in the `android/` directory and run:

```powershell
# 1. Set JDK 17 path (Gradle 8.5 compatibility)
$env:JAVA_HOME="C:\Users\Derivo\.jdks\jbr-17.0.14"

# 2. Prevent AGP environment variable conflict
Remove-Item Env:\ANDROID_PREFS_ROOT -ErrorAction SilentlyContinue

# 3. Build Debug APK
.\gradlew.bat app:assembleDebug --console=plain
```

The output APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 2. Install to Connected USB Device via ADB

```powershell
# Ensure device is recognized
adb devices

# Install/update the APK on phone
adb install -r "app\build\outputs\apk\debug\app-debug.apk"

# Launch the app
adb shell am start -n com.sparkleapp/.MainActivity
```

---

## Problems Encountered & Exact Fixes

Below is the complete troubleshooting log from initial build failure to successful deployment.

---

### Issue 1: Incompatible Gradle JVM Version (Java 25)
* **Error:**
  ```text
  Incompatible Gradle JVM version: The project's Gradle version 8.5 is incompatible
  with the Gradle JVM version 25 currently selected to run Gradle build.
  ```
* **Cause:** Android Studio / environment defaulted to Java 25. Gradle 8.5 requires Java 8 – 21.
* **Fix:** Set `JAVA_HOME` to a compatible JDK version (e.g. JDK 17 at `C:\Users\Derivo\.jdks\jbr-17.0.14`) in your terminal before running `./gradlew`.

---

### Issue 2: `AndroidLocationsException` Environment Variable Conflict
* **Error:**
  ```text
  com.android.prefs.AndroidLocationsException: Several environment variables and/or
  system properties contain different paths to the Android Preferences folder.
  - ANDROID_PREFS_ROOT(environment variable): C:\Users\Derivo\.android
  - ANDROID_USER_HOME(environment variable): C:\Users\Derivo\.android
  ```
* **Cause:** Having both `ANDROID_PREFS_ROOT` (deprecated) and `ANDROID_USER_HOME` set in Windows environment variables crashes the Android Gradle Plugin build service.
* **Fix:** Unset `ANDROID_PREFS_ROOT` prior to running Gradle:
  ```powershell
  Remove-Item Env:\ANDROID_PREFS_ROOT -ErrorAction SilentlyContinue
  ```

---

### Issue 3: Missing `STORE_PASSWORD` Property in `app/build.gradle`
* **Error:**
  ```text
  Could not get unknown property 'STORE_PASSWORD' for project ':app'
  ```
* **Cause:** `app/build.gradle` directly accessed `project.property("STORE_PASSWORD")` during project evaluation, causing failures when building Debug mode without release properties configured.
* **Fix:** Modified `app/build.gradle` to conditionally check if release properties exist:
  ```groovy
  signingConfigs {
      release {
          if (project.hasProperty("STORE_PASSWORD")) {
              storeFile file("sparkle-release.jks")
              storePassword project.property("STORE_PASSWORD")
              keyAlias project.property("KEY_ALIAS")
              keyPassword project.property("KEY_PASSWORD")
          }
      }
  }
  ```

---

### Issue 4: AndroidX Dependencies Flag Missing
* **Error:**
  ```text
  Configuration ':app:debugRuntimeClasspath' contains AndroidX dependencies,
  but the 'android.useAndroidX' property is not enabled.
  ```
* **Cause:** Capacitor and modern Android dependencies require AndroidX and Jetifier to be explicitly enabled in `gradle.properties`.
* **Fix:** Created `android/gradle.properties`:
  ```properties
  android.useAndroidX=true
  android.enableJetifier=true
  ```

---

### Issue 5: App Launcher Icon Showing Green Default Android Robot
* **Symptom:** The installed app icon on device showed the default green Android Studio template robot instead of the Sparkle app logo.
* **Cause:**
  1. A vector file `app/src/main/res/drawable-v24/ic_launcher_foreground.xml` was overriding the app icon on Android API 24+.
  2. Mipmap PNGs in `src/main/res/mipmap-*` contained default template assets.
* **Fix:**
  1. Deleted `drawable-v24/ic_launcher_foreground.xml`.
  2. Scaled `logo.png` (512x512) into appropriate resolution PNGs for all `mipmap-*` densities (`mdpi` through `xxxhdpi`) for:
     - Full launcher icons (`ic_launcher.png`, `ic_launcher_round.png`)
     - Adaptive foreground icons (`ic_launcher_foreground.png`) with safe-zone margin.
  3. Performed a clean rebuild:
     ```powershell
     .\gradlew.bat clean app:assembleDebug
     ```

---

### Issue 6: Syncing Frontend Web Build Assets
* **Process:** Ensure Capacitor assets in `app/src/main/assets/public` are updated when web code in `frontend/dist` changes:
  ```powershell
  robocopy "..\frontend\dist" "app\src\main\assets\public" /E /MIR /NP /NDL /NJS /NJH
  ```

---

## File Modifications Summary

| File | Status | Description |
| :--- | :--- | :--- |
| `android/gradle.properties` | **Created** | Enabled `android.useAndroidX` & `android.enableJetifier`. |
| `android/app/build.gradle` | **Modified** | Made `signingConfigs.release` conditional on `hasProperty("STORE_PASSWORD")`. |
| `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` | **Deleted** | Removed vector overriding real app icon. |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | **Updated** | Replaced default green robot images with scaled Sparkle logo assets. |
| `android/BUILD_GUIDE.md` | **Created** | Developer guide and troubleshooting reference document. |

---

## Environment Checklist for New Developers

- [x] Java JDK 17 installed and set in `JAVA_HOME`
- [x] Android SDK installed with platform-tools (`adb`) in PATH
- [x] `ANDROID_PREFS_ROOT` unset if encountering `AndroidLocationsException`
- [x] USB Debugging enabled on mobile test device
