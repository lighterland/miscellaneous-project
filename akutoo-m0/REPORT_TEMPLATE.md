# M0 device measurements

Date: ______  Tester: ______  Prototype commit/build: ______

Save one copied report per camera and lighting condition. Measure at least 10 seconds before copying. “Left/right” refers to the subject's own left/right; confirm the yaw sign with a deliberate left turn. N/A means unmeasured/no detection, never zero or unsupported.

| Device and OS | Browser (version) | Camera (front/rear) | Stream resolution | Photo method | Photo resolution | Average fps (last 10 s) | Max \|yaw\| left | Max \|yaw\| right | Sharpness: sharp photo | Sharpness: deliberately blurry photo | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| iPhone / iOS ___ | Safari ___ | Front | | | | | | | | | Good light |
| iPhone / iOS ___ | Safari ___ | Front | | | | | | | | | Dim light |
| iPhone / iOS ___ | Safari ___ | Rear | | | | | | | | | Good light |
| iPhone / iOS ___ | Safari ___ | Rear | | | | | | | | | Dim light |
| Android ___ | Chrome ___ | Front | | | | | | | | | Good light |
| Android ___ | Chrome ___ | Front | | | | | | | | | Dim light |
| Android ___ | Chrome ___ | Rear | | | | | | | | | Good light |
| Android ___ | Chrome ___ | Rear | | | | | | | | | Dim light |

## Per-device observations

- Actual track label/lens/facing vs requested camera:
- ImageCapture available / takePhoto failed / canvas fallback:
- Photo file size, orientation, mirroring and visible detail:
- Face size while measuring and time observed:
- Direction sign verified (left negative):
- Tracking loss/reacquisition at profile, up/down, tilt:
- Sharp vs blurred visual comparison (N/A if no face in the captured JPEG):
- Permission denied/retry and stop indicator:
- Offline-ready and offline reload/capture result:
- Heat, battery, stalls, model initialization time:
- Hair segmentation: not implemented (not a device failure).
- Solo pose at 3 m / back turned: not implemented.
- Solo voice/two tones from 3 m: not implemented.

## Copied reports

Paste text reports here. Keep downloaded photos on the device; no image uploads are needed.

## Decision after real tests

- PWA capture sufficient, or investigate native wrapper:
- Device-specific sharpness/face-size starting points (unconfirmed until measured):
- Profile tracking sufficient, or require manual shutter:
- Follow-up hair/Solo experiments needed:
