# S24 capture follow-up — 5 November 2026

Status: local implementation and core regression checks passed; deployment pending. Public release remains 21b2982 until release verification below is recorded.

The owner reported manual-only eye directions, difficult far head angles, and visible pauses between captures on Samsung S24. They requested vibration and a simpler face-enrollment-like flow. No owner photos were read or uploaded.

## Reproduced causes and changes

- `npx vitest run tests/unit/auto-ready.test.ts` reproduced valid gaze failing readiness. All gaze shots were explicitly manual. Gaze shots now use measured subject-relative eye blendshapes, reject absent/nonfinite/blinking/ambiguous evidence, and revalidate the final selected JPEG. Requested direction and measured gaze are stored/exported separately. Old photos retain null measured evidence.
- `npx playwright test tests/e2e/capture.spec.ts -g "live tracking continues" --reporter=line` reproduced stopped tracking during a delayed OPFS close: live measurement count stayed at 68 instead of increasing. Guided capture now uses one sequential save consumer with at most two waiting full-resolution candidates. Live tracking continues while encoding/storage awaits. Reserved bins are excluded from acquisition; completion remains based on durable storage. Queue overflow releases the incoming frame without awarding progress; pause/stop clear waiting candidates.
- Persisted progress and target index remain owned by the save consumer while it runs, avoiding concurrent revision writes. No quality floor, pose tolerance, tier, readiness score or retry limit changed.
- Optional vibration uses a 25 ms saved cue and 35/70/35 ms return cue. Return cues have a provisional three-second cooldown to avoid repeated pulses under unstable tracking. Unsupported/denied vibration leaves visual/audio guidance usable.

Gaze gesture defaults are provisional: both eyes at least 0.35 for a direction, top direction at least 0.15 above the next, blink below 0.5. These are new gesture-recognition defaults, not calibrated quality thresholds or proven S24 accuracy. No real gaze fixture data or group fairness rates are available. Primary reference: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker (blendshape left/right follow the subject). Vibration reference: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate .

## Evidence and pending work

- Initial implementation: 175 unit tests across 48 files passed; TypeScript/production build passed.
- Scoped browser run: tracking during delayed storage, continuous 15-angle collection, and durable-write failure/recovery passed (3/4). Four gaze photos were automatically saved with matching measured/requested directions; the remaining assertion found 5 confirmation vibrations instead of 4. The initial empty React state reset the prior-photo count on remount, causing an extra cue for a historical photo.
- Corrected the empty-state effect, enabled Pause during guided background saves, added the return-vibration cooldown, added export evidence test and pause/queued-frame regression. These LAST corrections have NOT yet been rebuilt/tested.
- The elevated build command was not executed: automatic approval review failed because its usage limit was reached. This is a review-service failure, not an unsafe-action verdict. Do not bypass approval or describe the last changes as tested/live.
- Next: build; run unit suite; rerun gaze, background tracking/pause, continuous movement, write failure and interruption/countdown regressions. Verify final JPEG gaze mismatch (including sensor stills), no extra cue on session restore, no queued writes after pause/error, unchanged retry budgets, and local privacy/offline.
- Review code diff and memory/cancellation behavior before copying only changed app paths to the deployment checkout. Commit/deploy only akutoo/ after checks pass, then verify actual public HTTPS/offline. Do not commit source workspace user images or unrelated baseline files.
- Real S24 comfort, far-profile tracking range, vibration behavior and 4K memory/thermal performance remain unverified. The bounded queue can retain several native-resolution canvases including active/window/current frames; bounded does not prove low peak memory. Do not claim Face ID-equivalent enrollment speed or full-profile recognition.

## Verification resumed after review-service recovery

The approval-review limit cleared and the final production build passed. All 176 unit tests across 48 files passed. Seven browser cases passed (2.0 minutes): continued tracking under blocked storage, camera interruption, countdown false-green prevention, continuous 15-angle collection, failed-write recovery, all four automatic gaze directions with final-JPEG mismatch rejection and exactly four new-photo vibrations, and Pause clearing queued candidates while preserving durable progress. The historical extra-vibration assertion is now resolved. Additional Android sensor-selection and profile-return haptic checks are being run before deployment. No reviewer bypass was used.

Additional checks completed: Android sensor-path automatic gaze plus far-profile recovery/haptic tests both passed (56.8 seconds). Final local browser result has no failed tests. These use synthetic analysis and real JPEG/OPFS/IndexedDB APIs; they do not establish S24 optical accuracy or comfort.
