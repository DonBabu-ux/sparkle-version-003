# 📱 Complete Guide: Building a Production APK with React Native

This guide covers setting up a **React Native** project from scratch and building a production APK. 

> [!IMPORTANT]
> **Difference between Capacitor and React Native:**
> - **Capacitor**: Uses your existing React Web code (HTML/CSS) and runs it in a native "WebView".
> - **React Native**: Uses native UI components. You cannot simply "copy-paste" your web HTML; you must use components like `<View>`, `<Text>`, and `<Image>`.

---

## 📋 Prerequisites

### 1. Node.js & JDK
Same as the Capacitor guide. Ensure you have **Java 17**.

### 2. Android Studio & SDK
Same as the Capacitor guide. Ensure you have:
- Android SDK Platform 33+
- Android Virtual Device (Emulator)

### 3. React Native CLI
```powershell
npm install -g react-native-cli
```

---

## 🚀 Step 1: Initialize a New React Native Project

If you want to start a fresh React Native app in this folder:

```powershell
npx react-native init MyNewApp
```

---

## 🏗️ Step 2: Building the Production APK

### 1. Generate an Upload Key (Keystore)
You need a `.keystore` file to sign your app.

```powershell
keytool -genkeypair -v -storetype unicode -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
- Keep this file safe!
- Place it in the `android/app` folder of your React Native project.

### 2. Configure Gradle Variables
Edit `android/gradle.properties` and add:

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

### 3. Add Signing Config to Gradle
Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

### 4. Generate the APK
Navigate to the `android` folder and run:

```powershell
cd android
./gradlew assembleRelease
```

Your APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 🔄 Development Workflow

### Start the Metro Bundler
```powershell
npm start
```

### Run on Android
```powershell
npm run android
```

---

## 🚨 Common Issues

### Issue: "Could not find SDK"
Ensure `local.properties` in the `android` folder has the correct path:
`sdk.dir = C:\\Users\\user\\AppData\\Local\\Android\\Sdk`

### Issue: Build fails with "Execution failed for task ':app:bundleReleaseJsAndAssets'"
Usually fixed by running:
```powershell
cd android
./gradlew clean
```
