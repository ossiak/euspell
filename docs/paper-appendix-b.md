# Appendix B. Installing Eupub

*Draft for the white paper (*Spelling Reform: An Engineering Approach*),
replacing the current Appendix B. Condensed from `Eupub/docs/installing.md` in
the [eupub repository](https://github.com/ossiak/eupub), which stays the
maintained version — update that first, then re-condense here.*

*The version in the published paper is wrong in both directions. It is behind on
signing: it tells readers the Windows and macOS builds are unsigned and walks
them through SmartScreen overrides, Gatekeeper's Control-click ritual, and
`xattr -dr com.apple.quarantine`. Both are signed now — the Windows installer
with Authenticode via Azure Trusted Signing, the macOS app and disk image with a
Developer ID certificate and Apple notarization. It is also ahead on
availability: it announces an App Store listing that was never submitted, and an
Android APK that no release carries.*

*One capability claim in the paper's body needs the same treatment: §Epub and
text says Eupub "also handles PDF files on mobile devices", which reads as though
PDF were a mobile-only feature. It is not, and since 16 August it is not even a
desktop-and-Android one — the iOS app reads PDF through the same embedded viewer
(eupub `40d5b31`, verified on device). All five platforms handle PDF; the body
should say so plainly rather than singling out mobile.*

---

Eupub is a standalone reader that shows EPUB, PDF, and plain-text books in
euspell reformed spelling, entirely on the reader's own device. There is no
account and no server: the whole lexicon ships inside the app and every
conversion happens locally.

Released builds are at
[github.com/ossiak/eupub/releases](https://github.com/ossiak/eupub/releases),
under GPL-3.0-or-later.

## B.1 Availability

| Platform | Where | Kind |
| --- | --- | --- |
| **Windows** 10 / 11 (64-bit) | `eupub-Setup-<version>.exe` | Installer, Authenticode-signed |
| **macOS** (Apple Silicon) | `Eupub-<version>-arm64.dmg` | Disk image, signed and notarized |
| **Linux** (x86-64) | `Eupub-<version>.AppImage` | Single portable binary, unsigned |
| **Android** 8.0+ | build it yourself | Sideloaded app (preview), unsigned |
| **iOS** 17+ | build it yourself | Xcode build onto your own device |

Those first three are what a release contains; the release workflow builds and
attaches them automatically. It has no Android or iOS job, so **neither mobile
build is published** and both have to be built from source. iOS has not been
submitted to the App Store, but it does run on a real device once built.

All five read **EPUB, PDF and plain text**. PDF is handled by the same embedded
viewer everywhere, so a PDF is reformed rather than merely displayed.

## B.2 Windows

1. Download `eupub-Setup-<version>.exe` and run it.
2. The installer is **Authenticode-signed**, so the User Account Control prompt
   names *Kamran Ossia* as publisher. *Unknown publisher* means an unofficial or
   self-built copy.
3. Choose the install folder (default `%LOCALAPPDATA%\Programs\Eupub`). The
   installer creates Start-menu and desktop shortcuts.

**SmartScreen may still warn for a while.** Its reputation accrues per signing
certificate as installs accumulate, and this certificate is new, so early
downloads can still see *"Windows protected your PC"* on a correctly signed
installer. **More info → Run anyway**, having checked the publisher name.

## B.3 macOS

Eupub for macOS is a disk image for Apple Silicon (M1 or later); Intel Macs are
not supported.

1. Download `Eupub-<version>-arm64.dmg` and open it. A window shows the Eupub app
   beside an Applications shortcut.
2. Drag Eupub onto Applications, then eject the disk image.
3. Launch it with a normal double-click.

The app is signed with a Developer ID certificate and notarized by Apple, and the
disk image is notarized and stapled as well — so Gatekeeper opens it with no
prompt, on first launch and offline. Stapling the image, not only the app, is
what makes the offline case work: without the ticket attached to the file that
was actually downloaded, a machine with no network has nothing to check against.

## B.4 Linux

The AppImage is one self-contained file — no system install, no root.

```bash
chmod +x Eupub-*.AppImage
./Eupub-*.AppImage
```

**Missing FUSE.** Some distributions no longer ship FUSE 2, which AppImages need.
Either install it (`sudo apt install libfuse2` on Debian/Ubuntu, or the
equivalent) or run it extracted: `./Eupub-*.AppImage --appimage-extract-run`.

**Desktop integration** (optional) — for a menu entry and EPUB/PDF file
associations, use a helper such as AppImageLauncher, or accept the integration
prompt the desktop offers on first run. Eupub is verified on KDE Plasma and also
runs on GNOME and other desktops. Update or remove it by replacing or deleting
the single file.

## B.5 Android

Android is an **early preview**: not on the Google Play Store, and not
release-signed. Expect rough edges, and update by installing a newer APK by hand.
It requires Android 8.0 (Oreo) or newer.

**No APK is published.** With the Android SDK and JDK 17 installed,
`./gradlew assembleDebug` in `android/` produces
`android/app/build/outputs/apk/debug/app-debug.apk`.

1. Transfer the APK you built to the phone.
2. Open it with the **Files** app or the browser's downloads list and tap
   **Install**. The first time, Android asks to allow installing unknown apps for
   whichever app is opening the APK. *(Settings ▸ Apps ▸ Special app access ▸
   Install unknown apps.)*
3. Play Protect may warn about an app from outside the store — choose **Install
   anyway**.

## B.6 iOS

**Eupub is not on the App Store.** It has not been submitted, so there is nothing
to search for — but the app runs on a real iPhone or iPad, and reads both EPUB and
PDF, if it is built from source. It is a universal iPhone/iPad build requiring
**iOS 17 or later**.

On a Mac with Xcode and XcodeGen: stage the assets and generate the project
(`node ios/Eupub/prepare-assets.mjs`, then `xcodegen generate` in `ios/Eupub`),
open `Eupub.xcodeproj`, set a signing **Team**, and **Run**. A free Apple ID
suffices; the result is a development build, not a distributable one.
`ios/Eupub/run.sh` drives the simulator instead.

**Getting books onto the device.** The app's Documents folder is exposed, so it
appears as *On My iPhone ▸ Eupub* in the Files app and under the device in
Finder. EPUB and PDF files dropped there open with the app's **Open** button;
the document picker also reaches iCloud Drive and other providers.

## B.7 First run

- **Open a book** with the **Open** button, or on the desktop by double-clicking
  an `.epub` or `.pdf`. The last book and reading position reopen on launch.
- **Turn euspell on or off** with the toggle in the reader chrome. It re-renders
  the current chapter in place, keeping the reader's spot: off shows the book's
  original spelling, on shows it reformed.
- **Page** with ← / →, space, the scroll wheel on desktop, or a swipe or tap on
  the side thirds on Android. Font size and light/dark controls sit in the same
  chrome; bookmarks, highlights, and book-wide search are in the side tabs.

Everything is local — no book, position, or highlight leaves the device.

## B.8 Troubleshooting

| Symptom | Try |
| --- | --- |
| Windows: *"Windows protected your PC"* | The installer *is* signed, but SmartScreen reputation accrues per certificate and this one is new. **More info → Run anyway** — after checking the UAC prompt names *Kamran Ossia*; *Unknown publisher* means an unofficial copy |
| Linux: AppImage will not start, or a mount error | Install FUSE 2, or run `./Eupub-*.AppImage --appimage-extract-run`. Confirm it is executable (`chmod +x`) |
| Android: *"App not installed"* or blocked | Allow **Install unknown apps** for the app opening the APK; in Play Protect choose **Install anyway**. Check the phone is Android 8.0+ |
| Android: no APK in the release | There is not one — releases carry the Linux, macOS, and Windows assets only. Build the preview from source (§B.5) |
| iOS: cannot find Eupub in the App Store | It is not there. The port has not been submitted, so no search or store region will find it — build it from source (§B.6) |
| iOS: *On My iPhone ▸ Eupub* is missing in Files | It appears once the app has been launched at least once; the folder is created on first run. Check you are in **Browse**, not **Recents** |
| A book opens in original spelling | Toggle euspell **on** in the reader chrome — it is a per-book setting |
| A word looks wrong | Reforms are context-sensitive, and a handful of ambiguous words are left unchanged deliberately |
