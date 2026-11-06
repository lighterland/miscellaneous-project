# Continuous eye scan

## Owner evidence and audit

6 November 2026: the owner reports reduced pauses and felt vibration on Samsung S24, but requests easier eye direction. No duration, per-direction result or optical accuracy was supplied. The attached enrollment-style brief requests incremental refactoring. This iteration covers face/eye capture; it does not expand body/hair scope, introduce uploads, add new pose requirements or change photos per bin.

The React/TypeScript PWA already uses CameraSource, local MediaPipe workers, OPFS images, Dexie metadata and precached models. Head sweeps already select original frames and save through a bounded queue. Gaze previously required sequential targets, a 500 ms hold, then a new five-frame burst and optional sensor exposure. Tracking paused during that capture. There was no gaze diagram; generic guidance could demand a larger face even though gaze readiness did not require it.

## Changes

- Gaze uses the existing native-resolution stream window and sequential save queue: best of up to five eligible frames, or the retained best when the direction changes. No additional hold, countdown or later sensor exposure for continuous gaze. Manual and explicit single-photo retakes retain their existing path.
- Four edge dots show the suggested subject-relative direction. Checkmarks mean durable saves. Any unfinished measured direction may be collected; completed/deferred positions are excluded. Failed slots retain their budget and cannot jump to another direction until resolved. Legacy photos and IDs are untouched.
- Tracking continues during saving. Pause clears waiting frames; an in-flight valid save may finish. Queued candidates never count as saved. Final JPEG gaze and frontal pose are independently checked.
- Text and optional voice share the suggested target. Three seconds without a new save adds specific help; this is an interaction default. Pause, defer and manual fallback remain available. Existing haptics remain tied to saved photos.
- Main/extra rings use 54 visual ticks grouped by actual saved bins. These are not 54 measured directions; counts remain x/9 and x/6. Saved groups turn green.

## Quality and limits

No change to gaze confidence 0.35, directional margin 0.15, blink boundary 0.5, frontal tolerance, quality floors, tiers, session reference or attempt limits. JPEGs remain full stream resolution and canvas-reencoded. No new dependency, API, image upload or telemetry. Device pass/fairness rates remain unmeasured. This is guided photo capture, not biometric authentication or a depth scan.

## Verification

Before changes, unit tests failed on out-of-order gaze selection, returning to missing directions, and misleading `closer` guidance. All 181 unit cases passed after the logic fix. Initial four browser regressions passed. The final verification additionally tests short glances encoded in synthetic pixels, tracking while OPFS saving is blocked, pause/resume, wrong final gaze rejection, durable-only progress and unchanged head sweeps. Synthetic evidence does not establish S24 comfort or eye accuracy.

Final prepublish evidence: production build and all 181 unit cases pass in the deployment checkout. Five source browser regressions pass; four final deployment cases pass (2.4 minutes), covering the complete 28-photo path, nine-position guided scan, short-glance queue/pause behavior, four out-of-order eye directions and mismatched final JPEGs. Layout checks cover 375x667, 390x844 and 1280x900. The subpath verifier passes with all three real workers online/offline, a persisted synthetic photo and zero image-bearing requests. Real phone optical accuracy and completion time are not established by these tests.
