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
npm run build:apk        # from repo root — sets VITE_PWA_DISABLE=true, builds, syncs, packages
#   ^ preferred: one command, correct env, no PWA in the bundle
# If you must build the web bundle by hand, the variable has to be in the
# SAME environment as the vite build — see the wrapper at
# frontend/scripts/buildForApk.cjs for the shell-agnostic way.
```

### Step 1: Sync web assets into the Android project

```powershell
# from repo root (NOT inside android/) — needs root package.json overrides (see Issue 8)
npx cap sync android
```

### Step 2: Build the Debug APK

Open **PowerShell** in the `android/` directory and run:

```powershell
# 1. JDK 21 is REQUIRED — Capacitor 8's plugin modules compile with
#    sourceCompatibility 21 (JDK 17 fails with "invalid source release: 21").
#    Any JDK 21 works; this machine has Android Studio's:
$env:JAVA_HOME="C:\Users\ADMIN\.jdks\jbr-21.0.11"

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

### 3. Versioning (automatic — do not bump manually)

`versionCode` and `versionName` are **not** edited by hand anymore:

- `versionName` (what users see + the APK filename) is read from
  `frontend/package.json` at configuration time. To rename a release, bump the
  frontend version — never `android/app/build.gradle`.
- `versionCode` auto-increments from `android/version.properties` on every
  **packaging** build (`assemble*`, `bundle*`, `install*`, `package*`), so
  `adb install -r` over an existing build never hits a downgrade error. Gradle
  syncs and `clean` do **not** burn a code.

Two consequences worth knowing:

1. **Every `assembleRelease`/`assembleDebug` increments the counter.** Do not
   run throwaway release builds expecting the same code to be reusable — it
   will not be.
2. **The counter is per-checkout.** Two machines building from different
   branches each increment independently, so both can emit code 15. If you
   branch for a release, the counter travels with the branch — fine for
   Play-bound uploads, a hazard only for adb installs across branches.

### 3a. Build the Release APK (R8 + resource shrinking)

```powershell
# from repo root — build:apk sets VITE_PWA_DISABLE=true for you
npm run build:apk            # debug APK
npm run build:apk:release    # release APK (R8, shrinkResources)
```

Release builds without `-PSTORE_PASSWORD=... -PKEY_ALIAS=... -PKEY_PASSWORD=...`
package **debug-signed** and print a loud warning. They are installable via
adb for testing but **must never be uploaded to Play** — Play rejects them.

### 3b. The WebView bundle must not contain a service worker

`build:apk`/`build:apk:release` run the frontend build with
`VITE_PWA_DISABLE=true`, which keeps `vite-plugin-pwa` from emitting
`registerSW.js` + `manifest.webmanifest`. Without it the WebView would precache
~8 MB of assets it is already served locally.

If you hand-roll the build instead of using the script, set the variable in the
same environment as the `vite build` invocation. The `prebuild` hook
(`verifyRelease.cjs`) fails the build if PWA artifacts show up in `dist/` from
a run that forgot it.

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
* **Cause:** Android Studio / environment defaulted to a Java version the current Gradle rejects (Gradle 8.14.3 accepts up to Java 24; Android Studio's bundled JBR here is 25).
* **Fix:** use JDK 21 (`C:\Users\ADMIN\.jdks\jbr-21.0.11`) or JDK 17 for Gradle 8.x-era builds. Note the asymmetry: **build** with 21 — Capacitor 8 period plugins need Java 21 to compile; the JBR 25 breaks the daemon.

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

## Capacitor 8 period (Nov 2026) — what changed

Play has required targetSdk 36 for updates since Aug 31, 2026, which forced the
toolchain off Capacitor 6 (topped out at 35). Current stack:

| Component | Before | After |
| :--- | :--- | :--- |
| Capacitor | 6.2.1 | **8.6.2** (via the 6→7→8 hop chain) |
| AGP | 8.2.1 | **8.13.0** |
| Gradle wrapper | 8.5 | **8.14.3** |
| google-services plugin | 4.4.0 | **4.4.4** |
| minSdk / compileSdk / targetSdk | 22 / 34 / 34 | **24 / 36 / 36** |
| Build JDK | 17 | **21** |
| Node (engines) | >=18 | **>=22** |
| `android:configChanges` | …uiMode | **…uiMode\|navigation\|density** |
| otakit updater | 3.3.0 | 3.4.0 (peer `@capacitor/core ^7 || ^8`) |

Gotchas worth remembering (all hit during this migration):

- **`npx cap sync android` must run from the repo ROOT** (`sparkle-version-003/`), never from `android/` — the CLI looks for `capacitor.config.json` in the cwd and silently falls back to `webDir: www` otherwise, which then fails on a missing `www`. The `cap migrate` tool additionally assumes a standard per-platform `package.json` layout this repo doesn't have, so its native-dependency step is skipped (`Unable to find android/package.json`) — harmless, the manual steps above cover it.
- **SDK Platform 36 + Build-Tools 35 must be installed** (`platforms;android-36`, `build-tools;35.0.0`) — Gradle auto-install normally handles it; the first attempt here failed transiently and the retry succeeded.
- **Build with JDK 21**: JDK 17 fails on the Capacitor 8 period plugins (`invalid source release: 21`); Android Studio's JBR 25 fails the Gradle daemon. `C:\Users\ADMIN\.jdks\jbr-21.0.11` is the local sweet spot.
- The frontend typecheck was already red before the migration (129 pre-existing app-code errors); it was diffed before/after to prove the upgrade added none. It is **not** green on `main` — do not treat a non-zero count as a migration regression.

## Call stack (Telecom + FGS)

See `app/src/main/java/com/sparkleapp/plugins/` — `SparkleCallPlugin`,
`CallService` (foregroundServiceType `microphone|camera`), the self-managed
`SparkleCallConnectionService`, `IncomingCallActivity` (lock screen), and
`SparkleFirebaseMessagingService` (cold-start call alerts; non-call messages are
forwarded to Capacitor's push plugin). The web layer drives it over socket
signalling via `SparkleCall.*` and the `sparkle://call` deep link.

Verify a build has it: `adb shell dumpsys telecom | Select-String Sparkle` should
show the registered `Sparkle calls` PhoneAccount after a cold start.

## Tests

```powershell
# Unit tests (Robolectric + JUnit — WebView-storage chunking, inset dp math,
# screenshot debounce, call snapshot)
.\gradlew.bat app:testDebugUnitTest

# Both artifacts (release runs R8 — the call stack survives minification)
.\gradlew.bat app:assembleDebug app:assembleRelease
```

Release builds without `STORE_PASSWORD` package successfully but are
**debug-signed** and print a loud warning — installable via adb, never
uploadable (Play rejects them). See `PLAY_CONSOLE_CHECKLIST.md` for the
console-side declarations the call stack requires (FGS types, app category,
USE_FULL_SCREEN_INTENT category, Data safety).

## File Modifications Summary

| File | Status | Description |
| :--- | :--- | :--- |
| `android/gradle.properties` | **Created** | Enabled `android.useAndroidX` & `android.enableJetifier`. |
| `android/local.properties` | **Updated** | Corrected `sdk.dir` path to local Android SDK location. (Machine-specific — must NOT be committed; gitignored.) |
| `android/app/build.gradle` | **Modified** | `signingConfigs.release` conditional on `hasProperty("STORE_PASSWORD")`; **auto-versioning** — `versionName` from `frontend/package.json`, `versionCode` auto-incremented from `version.properties` on packaging builds only; R8 + `shrinkResources` in the release build type. |
| `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` | **Deleted** | Removed vector overriding real app icon. |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | **Updated** | Replaced default green robot images with scaled Sparkle logo assets. |
| `android/BUILD_GUIDE.md` | **Updated** | Developer guide, versioning instructions, and troubleshooting reference document. |
| `android/gradle/wrapper/gradle-wrapper.properties` | **Updated** | Gradle wrapper 8.2.1 → **8.5** → **8.14.3** (Capacitor 8 period upgrade); `networkTimeout=300000`. |
| `android/variables.gradle`, `android/build.gradle`, `android/app/build.gradle` | **Updated** | Capacitor 8 period: AGP **8.13.0**, google-services **4.4.4**, minSdk **24**, compile/target **36**, androidx + cordova-android 14.0.1 versions, `=` property syntax. |
| `android/app/src/main/AndroidManifest.xml` | **Updated** | `configChanges` += `navigation|density`; call services (ConnectionService, CallService with FGS types, IncomingCallActivity, call-messaging service), `sparkle://call` deep link, backup rules, cleartext off. |
| `android/app/src/main/java/com/sparkleapp/plugins/` | **Added** | Call stack (`CallCoordinator`, `CallService`, `SparkleCallConnection(Service)`, `IncomingCallActivity`, `SparkleFirebaseMessagingService`), Crashlytics bridge (`SparkleDiagnostics`), hardened `MediaStoreSaver`, gated screenshot observer. |
| `android/app/src/test/java/com/sparkleapp/plugins/` | **Added** | Unit tests: inset dp math, base64 chunking, screenshot debounce, call snapshot (Robolectric + JUnit). |
| `package.json` (root) | **Updated** | npm `overrides` pinning `tar@^6.1.11` for `@capacitor/cli` (fixes cap sync crash). |
| `frontend/.env.production` | **Created** | Bakes Render API + socket URLs into the APK bundle. **Gitignored — must exist on every build machine.** |

---

## Environment Checklist for New Developers

- [x] Java JDK **21** installed and set in `JAVA_HOME` (`jbr-21.0.11`; 17 is too old for the Capacitor 8 period plugins)
- [x] Android SDK installed with platform-tools (`adb`) in PATH
- [x] `ANDROID_PREFS_ROOT` unset if encountering `AndroidLocationsException`
- [x] USB Debugging enabled on mobile test device
