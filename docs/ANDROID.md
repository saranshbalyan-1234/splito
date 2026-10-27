# Android: build, emulator run and smoke flow

How to build the debug dev client, run it on an emulator with demo data, take screenshots and run the
add-expense + settle-up smoke flow. Checked on macOS (Apple silicon) on 2026-10-26 with Expo 58,
React Native 0.88 (built from source, as Bluesky does) and an API 36 `google_apis` arm64 emulator.

## 1. Tools (once per machine)

- **JDK 17**, keg-only, so the system Java defaults are not touched:

  ```bash
  brew install openjdk@17
  export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"   # this shell only
  ```

- **Android SDK** at `~/Library/Android/sdk` with `platform-tools`, `emulator`, `cmdline-tools/latest`, NDK
  27.1.12297006, CMake 3.22.1 and a system image (`system-images;android-36;google_apis;arm64-v8a`).
  Gradle installs the missing platform (`android-37.0`) and build tools (`37.0.0`) on the first build once the
  SDK licences are accepted.

  ```bash
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  ```

## 2. Emulator

```bash
echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n splito_api36 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7
# Optional: give it 4 GB and the GPU (hw.ramSize=4096M, hw.gpu.enabled=yes in ~/.android/avd/splito_api36.avd/config.ini)
"$ANDROID_HOME/emulator/emulator" -avd splito_api36 -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -port 5584 &
"$ANDROID_HOME/platform-tools/adb" -s emulator-5584 wait-for-device
until [ "$("$ANDROID_HOME/platform-tools/adb" -s emulator-5584 shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
```

Drop `-no-window` to see the emulator. A fixed `-port` gives a fixed serial (`emulator-5584`), so other
emulators on the machine are never picked by mistake.

## 3. Build and run

From `apps/client`:

```bash
EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_TOUR=1 CI=1 npx expo run:android --port 8226 --device emulator-5584
```

- `expo run:android` runs prebuild (generating the gitignored `android/`), builds the debug APK, installs it,
  starts Metro on the port and opens the app. First build about 20 minutes (React Native and Hermes compile
  from source); after a JS-only change Metro is enough, after a native or config change the incremental build
  takes about 2 minutes.
- After changing `app.config.ts` plugins, run `CI=1 npx expo prebuild -p android --no-install` first: `run:android`
  does not re-run prebuild when `android/` already exists.
- Demo data is the Settings > Data > Demo mode switch (a separate local database, ARCHITECTURE 26.1); `EXPO_PUBLIC_TOUR=1` steps through People, drawer, Groups,
  a group's Balances, Analytics, Activity, Settings and Add expense every 8 s (`navigation/DevTour.tsx`), so
  screenshots need no tapping. `CI=1` turns off Metro's watcher and prompts.
- To reopen the app against a running Metro (for example after `adb shell pm clear app.splito`), use the URL
  `expo run:android` opens; its flags keep the dev menu from covering the app on first launch:

  ```bash
  adb reverse tcp:8226 tcp:8226
  adb shell am start -a android.intent.action.VIEW -d \
    "'exp+splito://?__expo_url=http%3A%2F%2Flocalhost%3A8226&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1'"
  ```

## 4. Screenshots

```bash
adb -s emulator-5584 exec-out screencap -p > people.png
adb -s emulator-5584 shell cmd uimode night yes    # system dark mode -> Splito Dim; "no" to go back
```

## 5. Smoke flow (add an expense, then settle up)

Metro must serve the dev bundle without the tour, which would navigate under the test (the script turns
Demo mode on from Settings > Data itself):

```bash
CI=1 npx expo start --dev-client --port 8226 &
ANDROID_SERIAL=emulator-5584 METRO_PORT=8226 pnpm android:smoke /tmp/android-smoke
```

`scripts/android-smoke.ts` clears the app's data, launches it, adds "Smoke test dinner" for INR 1,500 split
equally with Riya Sharma (her balance must move from INR 5,578.00 to INR 6,328.00), opens her page, records
her paying the whole balance and waits for "settled up". It prints `PASS` and saves a screenshot per step,
or `FAIL` with a screenshot and the uiautomator dump. Elements are found by `testID`, which React Native
exposes as the Android `resource-id`.

Bluesky runs these flows with Maestro (`__e2e__/`); this script runs the same steps with only the Android
SDK. If Maestro is installed later, the steps map one to one onto a flow file.

## 6. Clean up

```bash
kill "$(lsof -nP -iTCP:8226 -sTCP:LISTEN -t)"   # Metro
adb -s emulator-5584 emu kill                     # emulator
```

## Android notes

- **System bars:** the app draws edge to edge (`react-native-edge-to-edge`, as Bluesky). The shell's
  `SystemBars` picks dark icons on the light theme and light icons on Dim/Black; without it the status bar
  icons were white on the white header.
- **Bottom sheets:** Bluesky's native sheet module needs `BottomSheetProvider` above every `Dialog`; the
  native shell provides it. Without it every Dialog sheet (people picker, record payment, filters, prompts)
  failed with "Element type is invalid ... BottomSheetNativeComponent".
- **Dev-only warning, not traced yet:** Reanimated logs "Dependencies should only be used on the web" six
  times at launch in debug builds. No Splito source passes a dependency array to a Reanimated hook, so a
  library or the Babel setup adds one; native ignores the array, so behaviour is unaffected.
