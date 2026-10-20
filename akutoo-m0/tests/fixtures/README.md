# Public integration fixture

`portrait.jpg` is the public reference portrait distributed in Google's MediaPipe assets bucket:
https://storage.googleapis.com/mediapipe-assets/portrait.jpg

SHA-256: `a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e`.

It is used only in browser tests to verify the real local Face Landmarker, capture sharpness, and recovery after still-image inference. It is not shipped in `public/` or included in the offline app. Unit tests use tiny synthetic pixel arrays. No owner's photos are used in automation.
