# Sparkle Android App - Developer Build & Troubleshooting Guide

This guide documents all issues encountered during the build setup and their solutions to help any developer quickly build, update, and deploy the Android APK without friction.

---

## Quick Start (How to Build & Run)

> **⚠️ CRITICAL ORDER:** The backend is deployed on Render (`https://sparkle-version-003-1-f4v3.onrender.com`). The APK is a **client** — it needs the web bundle built with the server URL baked in. **Building the APK without Step 0 makes the app call `localhost:3000` and die after login** (this exact bug happened). Never skip Step 0.

### Step 0: Build the web bundle (from repo root)

```powershell
# frontend/.env.production MUST exist (gitignored) and contain:
#   VITE_API_URL=https://sparkle-version-003-1-f4v3.onrender.com/api
#   VITE_SOCKET_URL=https://sparkle-version-003-1-f4v3.onrender.com
npx vite build           # run from frontend/ — production mode auto-loads .env.production
```

### Step 1: Sync web assets into the Android project

```powershell
# from repo root (NOT inside android/) — needs root package.json overrides (see Issue 8)
npx cap sync android
```

### Step 2: Build the Debug APK

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

### 3. Increment App Version (For Testing Updates)
When creating a new build update to test on phone or emulator, bump `versionCode` and `versionName` in `android/app/build.gradle`:

```groovy
defaultConfig {
    ...
    versionCode 2
    versionName "1.0.1"
}
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
* **Process:** Use `npx cap sync android` from the **repo root** (not `android/`) — it copies `frontend/dist` to `app/src/main/assets/public` **and** updates plugins/manifest/gradle. A bare robocopy misses plugin registration:
  ```powershell
  # preferred
  npx cap sync android
  # fallback (assets only — still run cap sync if plugins changed)
  robocopy "..\frontend\dist" "app\src\main\assets\public" /E /MIR /NP /NDL /NJS /NJH
  ```

---

### Issue 7: Invalid `sdk.dir` Path in `local.properties`
* **Error / Symptom:** Gradle build fails locating Android SDK or throws initialization errors on `AndroidLocationsBuildService`.
* **Cause:** `local.properties` contained a hardcoded path (`C:\Users\user\AppData\Local\Android\Sdk`) from another user profile or environment.
* **Fix:** Updated `local.properties` to point to the local Android SDK directory:
  ```properties
  sdk.dir=C\:\\Users\\Derivo\\AppData\\Local\\Android\\Sdk
  ```

---

### Issue 8: `cap sync` Crashes With `extractTemplate` TypeError
* **Error:**
  ```text
  Cannot read properties of undefined (reading 'extract')
  at extractTemplate ...
  ```
* **Cause:** The committed `package-lock.json` resolved **tar@7.5.22** for `@capacitor/cli` (which requires `^6.1.11`). tar v7's CJS output breaks the CLI's template extraction.
* **Fix:** Root `package.json` pins a compatible tar via npm overrides (already committed):
  ```json
  "overrides": { "@capacitor/cli": { "tar": "^6.1.11" } }
  ```
  Verify with: `node -e "console.log(require('./package-lock.json').packages['node_modules/@capacitor/cli/node_modules/tar'].version)"` → must print `6.x`.

---

### Issue 9: APK Loads but "Dies" After Login (Calls localhost)
* **Symptom:** App opens, login POST fails with `ERR_CONNECTION_RESET` / connection problem card; feed/suggestions/stories/notifications all fail.
* **Cause:** The web bundle was built **without** `frontend/.env.production`, so `VITE_API_URL` defaulted to `http://localhost:3000/api` — inside the APK that means *the phone itself*.
* **Fix:** Always run Step 0 first. Verify the built bundle actually contains the Render URL:
  ```powershell
  Select-String -Path frontend\dist\assets\*.js -Pattern "onrender\.com" -SimpleMatch | Select-Object -First 1
  ```
  Also confirm `frontend/.env.production` is present (gitignored — must exist on every build machine).

---

### Issue 10: Backend Unreachable on Render (`No open ports detected`)
* **Symptom:** Render log shows `Port scan timeout reached, no open ports detected`; every API call fails; `CREATE TABLE` logs still appear (process alive).
* **Cause:** Render runs `node server.js` from the **repo root**, but `backend/server.js` only bound its port when `require.main === module` — false when loaded through the root entry, so nothing ever listened.
* **Fix (committed):** root `server.js` sets `SPARKLE_ROOT_ENTRY=1` + `dns.setDefaultResultOrder('ipv4first')` (also fixes email `ENETUNREACH` on IPv6-less Render); `backend/server.js` listens on `0.0.0.0:${PORT}` when flagged. Render uses its dashboard env vars — `PORT` is injected automatically (default 10000; an override is respected).
* **Verify in deploy log:** `🔥 Sparkle Server running on port NNNN` + no port-scan warnings.

---

## File Modifications Summary

| File | Status | Description |
| :--- | :--- | :--- |
| `android/gradle.properties` | **Created** | Enabled `android.useAndroidX` & `android.enableJetifier`. |
| `android/local.properties` | **Updated** | Corrected `sdk.dir` path to local Android SDK location. (Machine-specific — must NOT be committed; gitignored.) |
| `android/app/build.gradle` | **Modified** | Made `signingConfigs.release` conditional on `hasProperty("STORE_PASSWORD")`; bumped `versionCode` (2) and `versionName` ("1.0.1") for update testing. |
| `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` | **Deleted** | Removed vector overriding real app icon. |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | **Updated** | Replaced default green robot images with scaled Sparkle logo assets. |
| `android/BUILD_GUIDE.md` | **Updated** | Developer guide, versioning instructions, and troubleshooting reference document. |
| `android/gradle/wrapper/gradle-wrapper.properties` | **Updated** | Gradle wrapper 8.2.1 → **8.5** (8.2.1 is incompatible with the JDK 21+ that Android Studio ships); `networkTimeout=300000`. |
| `package.json` (root) | **Updated** | npm `overrides` pinning `tar@^6.1.11` for `@capacitor/cli` (fixes cap sync crash). |
| `frontend/.env.production` | **Created** | Bakes Render API + socket URLs into the APK bundle. **Gitignored — must exist on every build machine.** |

---

## Environment Checklist for New Developers

- [x] Java JDK 17 installed and set in `JAVA_HOME`
- [x] Android SDK installed with platform-tools (`adb`) in PATH
- [x] `ANDROID_PREFS_ROOT` unset if encountering `AndroidLocationsException`
- [x] USB Debugging enabled on mobile test device
