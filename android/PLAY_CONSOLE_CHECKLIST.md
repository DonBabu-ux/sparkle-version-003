# Sparkle — Play Console declarations checklist

These are the console-side declarations the native code now makes necessary.
None of them are code changes; each one is a checkbox that, if skipped, gets the
release rejected or silently degraded on user devices.

## 1. Foreground service types (Policy → App content → Foreground service types)

`CallService` declares `android:foregroundServiceType="microphone|camera"`
(see `app/src/main/AndroidManifest.xml`), so both must be declared:

- [ ] **microphone** — used for every Sparkle voice call (starts when the call
      is answered, runs for its duration).
- [ ] **camera** — used for video calls only.

Justification to paste: "Sparkle is a social app with voice and video calls.
The foreground service keeps the call's microphone (and camera during a video
call) alive while the user has the app in the background or the screen locked;
ending the call stops the service immediately."

## 2. App category (Policy → App content → App category)

- [ ] Declare Sparkle in a **calls / messaging**-capable category.

Why it matters beyond labeling: Android 14+ only auto-grants
`USE_FULL_SCREEN_INTENT` to apps whose core purpose is calling or alarms. This
app is a social/calling app and uses full-screen intents for incoming-call
UI on the lock screen — the correct category is what makes that permission
grant automatically. If it is *not* granted, calls still ring as a heads-up
notification; the lock-screen takeover silently degrades.

## 3. Permissions declarations (Policy → App content → Sensitive permissions)

Newly in use by the call stack, in addition to what was already declared:

- [ ] `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` (+ `_CAMERA` when
      the video-call feature is live in the released build).
- [ ] `MANAGE_OWN_CALLS` (Telecom self-managed ConnectionService).
- [ ] `USE_FULL_SCREEN_INTENT` (incoming-call lock screen).
- [ ] `BLUETOOTH` / `BLUETOOTH_ADMIN` (maxSdk 30) — audio routing to headsets
      on Android 11 and below.

Note: `READ_PHONE_STATE` is deliberately **not** used (self-managed Telecom
calls do not need it and it would force a harsher Data safety disclosure).

## 4. Data safety form (Policy → Data safety)

- [ ] Microphone: collected/processed for "App functionality — voice calls and
      voice notes" (transient, not shared).
- [ ] Camera: same, for video calls.
- [ ] Bluetooth: audio routing only, not collected.
- [ ] Crash reports (Crashlytics): crash logs + diagnostics; if the app is
      child-directed or has a sensitive audience, confirm the consent flow
      gates `SparkleDiagnostics.setCollectionEnabled(false)`.

## 5. Dynamic code / OTA updates

- [ ] OtaKit ships JS bundle updates only (no native code). Ensure the
      "Device and Network Abuse" policy description mentions live updates of
      the web layer and that updates do not change the app's declared purpose.

## 6. Pre-release gate (until the targetSdk migration lands)

- [ ] **targetSdk 36** — Play has required API 36 for updates since Aug 31,
      2026. Unblocked by the Capacitor 6 → 8 migration tracked in
      `BUILD_GUIDE.md#migration`.