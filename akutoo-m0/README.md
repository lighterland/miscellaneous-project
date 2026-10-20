# Akutoo camera prototype (M0)

Throwaway measurement page, isolated from the future app. No React, storage, quality gates, sessions, or ZIP export. Photos exist only in memory and as explicit local downloads; starting a new run clears the last photo and measurements. Stopping preserves the report until a new run or reload.

## Unlisted GitHub Pages deployment

Open https://lighterland.github.io/miscellaneous-project/akutoo-m0/ directly in Safari on iPhone or Chrome on Android and allow camera access. This project is omitted from the root catalog and uses `noindex,nofollow`; its URL and source remain public. Follow the ten per-device steps below. GitHub Pages provides the HTTPS needed for camera access and service workers.

The five model/WASM assets (26,269,669 bytes total) are committed in `public/`.
CI runs `npm ci`, `npm test`, and `npm run build`; it does not run browser tests
or download model assets. Every build verifies `assets.sha256.json` offline.
`npm run assets` is an optional maintenance command: it verifies or restores
the pinned model and copies WASM from the pinned npm package. Distribution
terms and official license sources are in `THIRD_PARTY_NOTICES.txt`, which is
also included in the build.

After assembling the monorepo `_site/` as in `.github/workflows/deploy.yml`,
run these from `akutoo-m0/` to check the real deployment sub-path:

```powershell
npm run test:site
$env:M0_BROWSER_CHANNEL = 'chrome'
npm run test:e2e:deployed
```

The first command verifies all four project entry points, the unchanged
unlisted catalog, relative HTML assets, model/WASM byte equality, and the
service-worker precache. The second reuses the network privacy and capture
tests under `/miscellaneous-project/akutoo-m0/`, including offline reload.

## Run on Windows

Use Node.js 20.19+ (CI uses Node 20), 22.12+, or 24. From the monorepo root:

```powershell
cd akutoo-m0
npm ci
npm test
npm run build
npm run preview
```

Open `http://localhost:5173` on this computer. For development use `npm run dev` instead of preview. **Offline reload works only with the built preview**, not the Vite development server. Keep the page online until “Offline files ready”, reload once, then test with the network disabled. The service worker precaches JS, CSS, the model and all WASM loaders/binaries. Capture still needs browser camera permission. No installable app shell is built in M0; that belongs to M1.

## Phone: trusted HTTPS tunnel (recommended)

Install the official [Cloudflare Tunnel client](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). In one terminal, run `npm run preview` (or `npm run dev`). In another:

```powershell
cloudflared tunnel --url http://localhost:5173
```

Open its **HTTPS** `https://<random-name>.trycloudflare.com` URL in Safari on iPhone or Chrome on Android. Grant camera permission. Do not open the phone's `localhost`; that points to the phone itself. The tunnel carries application/model downloads; photo pixels remain in the browser and are never uploaded. Anyone with the temporary URL can load the prototype while the tunnel is running. Stop cloudflared when finished.

If Vite rejects the tunnel host, stop the server, set its exact hostname (no scheme), then restart the same preview/dev command:

```powershell
$env:M0_TUNNEL_HOST = '<random-name>.trycloudflare.com'
npm run preview
```

Keep the same URL for offline testing: a new tunnel hostname is a new origin with a new cache and permissions. On the phone, disable Wi-Fi/mobile data only after the offline-ready message, then reload the same page and start the camera again.

## Phone: self-signed HTTPS fallback

A certificate warning bypass alone may **not** enable camera access or service workers. The phone must trust the certificate, with a SAN matching your computer's LAN IP. Both devices must be on the same network. With OpenSSL installed, replace `192.168.1.20` with your computer's IPv4 address:

```powershell
New-Item -ItemType Directory -Force .cert
openssl req -x509 -newkey rsa:2048 -nodes -keyout .cert/key.pem -out .cert/cert.pem -days 7 -subj '/CN=Akutoo M0' -addext 'subjectAltName=IP:192.168.1.20' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign' -addext 'extendedKeyUsage=serverAuth'
openssl x509 -in .cert/cert.pem -outform DER -out .cert/cert.cer
$env:M0_HTTPS = '1'
npm run dev
```

Transfer **only** `cert.cer` to the phone and install/trust it. On iOS install the downloaded profile, then enable full trust in Settings → General → About → Certificate Trust Settings. On Android import it as a CA certificate through the device's certificate settings (wording varies). Keep `key.pem` private. Open `https://192.168.1.20:5173`; allow the Windows firewall on the private LAN if needed. If trust cannot be established, use the tunnel. Remove the temporary certificate/profile afterward. `.cert/` is ignored by Git. For offline tests use the built preview with a trusted HTTPS reverse proxy/tunnel; the self-signed Vite dev route is for camera testing only.

## Per-device test (10 steps)

1. Record device, OS version, browser/version and date in `REPORT_TEMPLATE.md`. Clean the lens and disable camera beauty effects where available.
2. In good indirect daylight, choose **Front** and start a new run. Record requested vs actual stream resolution and the actual camera label/facing value (a browser may ignore your preference).
3. Hold a frontal face still for at least 10 seconds. Record analysis fps and face-height percentage. Confirm that the preview is mirrored only for the front camera.
4. Slowly turn **your left**, then right, until tracking disappears; return to front between turns. Confirm that a left turn produces negative yaw; record any sign mismatch. Record both maximum absolute yaw values. Check approximately 90° manually without assuming tracking will work.
5. Look up/down and tilt left/right. Observe pitch/roll separately; note jumps, tracking losses, heat or UI stalls.
6. Hold still and capture a sharp photo. Download it, check dimensions/detail, and record photo method, file size and capture sharpness. Photo orientation must look correct and the download must be unmirrored.
7. Deliberately move your head during a second capture. Download it, record its sharpness and visually confirm blur. If no face is found in the captured image the score is N/A, never the old live score. Compare scores only with similar crop/framing.
8. Copy the report (or select its textarea manually), paste it into your device notes, then repeat the measurements in dim light. Save separate reports before starting a new run.
9. Switch to **Rear**, start a new run, repeat steps 3–8 with the phone supported and a helper if necessary. Note whether takePhoto succeeds or falls back, and whether the chosen camera/lens matches your intent. Also deny camera permission once and verify that retry works after restoring permission.
10. With the built preview, wait for offline-ready, disable the network, reload, start and capture again. Stop the camera and verify the browser camera indicator turns off. Fill notes; bring at least one iPhone Safari and one Android Chrome result back before deciding whether PWA capture is sufficient.

## Measurement definitions and assumptions

- Main-thread CPU inference is the deliberately simple M0 baseline; target 15 processed frames/s with the longest analysis side at 480 px. This is **not** a claim of smoothness on a real phone. A worker can be evaluated after device results.
- FPS counts completed live analyses (including frames without a face) divided by elapsed wall time over the trailing 10 seconds, or the elapsed run if shorter. Photo processing pauses live analysis and counts toward elapsed time. The observation duration is in the report; measure for at least 10 seconds.
- Face bounds are the clamped, unpadded min/max of normalized landmarks. Sharpness uses that crop, resized to **256 × 256**, Rec.601 grayscale and population variance of the four-neighbor Laplacian, excluding border pixels. These are raw scores, **not acceptance thresholds**. Upsampling a small face and camera noise can distort comparison.
- Pose assumes the MediaPipe column-major canonical-to-detected 4 × 4 matrix and decomposes `Rz(roll) · Ry(yaw) · Rx(pitch)` in degrees, removing column scale. Input pixels and downloaded photos are unmirrored. Convention: negative yaw = subject left, positive = subject right. Physical direction, near-profile instability and orientation must be verified on each phone. At gimbal lock roll is set to zero.
- Capture first tries `ImageCapture.takePhoto()`; missing API or failure uses the current native-size video frame. Both paths are re-encoded through canvas to JPEG at 0.92. Capture sharpness is recomputed from the **decoded exported JPEG** using fresh face detection. No detected face = N/A; manual capture is still available.
- CameraSource is an interface around browser camera access, so fixtures can replace the camera independently of analysis. Model-load failure leaves manual capture usable. No hard quality gate, retake logic or thresholds are introduced.
- Optional hair segmentation, Pose Landmarker and Solo voice/tone experiments are **skipped** to keep M0 focused. They are recorded as not implemented, not as unsupported by the device. No Solo feasibility conclusion can be drawn yet.
- No images or analytics leave the device. Do not paste photos into remote diagnostics. Copy report contains text only (including user agent/camera label).

## Verification

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

If you prefer installed Chrome over Playwright's browser download:

```powershell
$env:M0_BROWSER_CHANNEL = 'chrome'
npm run test:e2e
```

Unit tests use synthetic grayscale pixels and known rotation/crop examples. Browser tests use a fake camera, exercise canvas and takePhoto paths, verify JPEG dimensions/EXIF removal, camera retry, report copying, offline reload and require every HTTP request to be a same-origin GET/HEAD with no body. They do not measure phone optical quality or real Safari camera capabilities.

## Model provenance

The [official Face Landmarker model list](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models) links Google's model bucket. This prototype pins bundle **float16/version 1**:

`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
`npm run assets` verifies this checksum and the three TFLite entry names, and copies WASM from the pinned npm package into `public/wasm/`. Browser tests additionally load the bundle and execute inference. No runtime CDN is used. See the [official web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) for model options and the synchronous inference limitation, and [Vite server options](https://vite.dev/config/server-options) for HTTPS/host configuration.

M0 is ready for device measurement only when automated checks pass; the milestone itself remains pending until the real-phone reports are filled and reviewed. M1 has not started.
