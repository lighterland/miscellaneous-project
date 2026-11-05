# Continuous guided face scan

New face sessions collect nine primary angles (front, +/-15, +/-30, +/-45 and chin up/down). Extra +/-60, +/-75 and +/-90 angles use the same continuous sweep in an optional second route. Start scan, keep the phone still, and move the head slowly along the example. There is no per-angle shutter, Next pose or pre-capture hold in this guided flow. Primary completion is not full dataset readiness.

## Acquisition

The controller analyzes an exact full-resolution stream snapshot and retains the highest-ranked eligible frame for the current measured bin. It releases replaced canvases immediately and flushes the best on bin exit or after five eligible samples. The frame is JPEG-encoded and analyzed again before durable storage. Angle tolerance, actual-bin membership and quality gates must still pass. This is a rolling best-frame window, not a recording and not a later sensor exposure. At most one best frame is retained between ticks; a flush can temporarily coexist with the next candidate and encoding buffers. No unbounded photo queue is created.

Guided sweep photos use the actual stream dimensions with method canvas. On Samsung this can be lower resolution than takePhoto; manual/static capture retains its existing burst and optional sensor-still comparison. The quality short-side floor remains 1024 px. All hard floors, relative sharpness/exposure rules, weights, tiers and retry budgets are unchanged. The guided-only 500 ms pre-hold is replaced by in-motion selection, based on the reproduced user interaction failure; this is not a calibrated optical threshold change.

## Guidance and recovery

### S24 follow-up

Guided head tracking now continues while a selected JPEG is encoded and written. One sequential consumer owns save progress; up to two later candidates may wait, with reserved bins excluded from reacquisition. The queue is cleared on pause, interruption or failure and never awards coverage before durable storage. Queue overflow drops a transient candidate, leaving that angle unfilled for another sweep. This bounds retained work but does not certify native 4K peak memory or eliminate all model latency.

Eye-direction shots are now automatic when both eyes provide clear subject-relative blendshape evidence. Missing coefficients, blinks and ambiguous directions do not trigger. The final JPEG is checked again, including a sensor still if selected. Export preserves measured gaze separately from requested direction; old photos have no invented gaze measurements. Gesture defaults are provisional; see S24_CAPTURE_FOLLOWUP.md.

On supported devices, one short vibration confirms a newly saved photo and a double vibration requests a return toward the camera. Returning to an existing session does not reconfirm historical photos. Return pulses are limited to one pattern per three seconds; visual and audio guidance remain available if vibration is unsupported or blocked. Guided Pause remains available while a background save finishes; waiting candidates are cleared.

The suggested target is the end of a left/right sweep, independent of the individual bins being collected. Primary movement goes front, left, front, right, front, chin up and down. Extra movement goes left, front, right. The example and voice share the same cue during collection and saving; they do not ask for a stop at each bin. A green collecting label means a frame currently meets requirements; orange ring segments, count and confirmation tone represent saved photos only.

The large code-native diagram sits beside the camera on phone and desktop without covering the face. Movement steps show the current phase. Automatic capture is plain text, not a false shutter button. Reduced-motion disables the example animation.

If extra-angle tracking disappears for one second after a deliberate turn of at least 45 degrees toward the guided side, the unfinished positions on that side are deferred as tracking-limited. The user returns to front and proceeds to the other side. Missing angles do not become photos or measured coverage. The extra summary shows its own actual count, including partial results; revisit and explicit countdown remain available as secondary options. This one-second grace period is provisional interaction recovery, not photo acceptance.

The optional Progress.guidedScan group/phase and summaryOf fields need no schema migration. Existing photos, IDs, attempt limits and readiness are preserved. Older non-guided sessions retain their mode until Use guided face scan is selected. Pause, pagehide, disposal, group changes and countdown clear transient candidate frames. Durable-write errors pause safely without incrementing coverage. The 15/30-active-second help/continuation defaults remain.

## Verification and limits

The original continuous trace saved only 1/9 primary positions. The new regression crosses each target window in under 500 ms and collects 9 primary plus 6 extra positions without shutter/Next or individual stops. Synthetic pose markers travel in captured pixels so JPEG analysis sees the captured frame rather than the later live pose. This is one deterministic interaction regression, not a phone success-rate or fairness measurement.

Unit coverage includes best-frame ownership, bin transitions, stationary selection, missing pose, actual chin coverage, broad suggestions and untrackable-side recovery. Browser checks exercise real camera/JPEG/OPFS/IndexedDB APIs with synthetic analysis, including delayed writes, reload, partial extras, pause and legacy capture flows. The Pages verifier covers actual model workers online/offline and rejects image-bearing or third-party HTTP requests.

Physical iPhone/Samsung usability, real motion blur, memory pressure at native 4K, voice timing and tracking range still need device acceptance. Do not interpret simulated success as a Face ID-equivalent recognition or identity-verification guarantee. No user photos are needed for reporting; only duration, device, stalls, coverage and interruptions.
