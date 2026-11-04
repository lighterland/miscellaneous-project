# Guided primary face scan

New face sessions start a nine-angle primary scan: neutral yaw 0, +/-15, +/-30, +/-45 and chin up/down. Supplementary +/-60, +/-75 and +/-90 angles are offered separately. The primary summary is not a readiness certificate. Dataset quality, coverage and readiness rules are unchanged.

The local `Progress.guidedScan` field stores group and movement phase; no database index/schema migration is needed. Capture selection remains opportunistic inside the selected group. The suggested movement progresses front, left, return front, right, return front, chin up and chin down. Existing sessions retain their flow until Use guided face scan is chosen. Photo IDs and metadata remain unchanged.

A large animated pose diagram and the voice share turning, holding, saving, recovering and complete states. The mirrored front-camera diagram follows the person's left/right. Repeated same-cue updates do not queue speech. Start scan enables voice for this scan, with an immediate mute control; saved preferences remain independently editable. Reduced-motion disables example animation.

The primary counter and ring reflect measured non-risky saved-photo coverage, not requested angles. Holding is green; saved coverage is orange. Pose loss returns the example to front. At 15 active seconds without a save the screen provides help; at 30 it offers a break/continuation. These are provisional interaction timings, not tuned quality thresholds. Capture, pause, calibration and countdown time are excluded. Continue defers gaps and retains shared retry/time budgets.

Supplementary angles reuse the existing automatic capture and timed hands-free capture, with explicit risky review for unmeasured photos. Shutter and Next pose remain under More capture options in guided mode. The existing tolerance, 500 ms hold, five-frame burst, all quality floors/weights/tiers and three/ten/twenty-minute safety nets are unchanged.

## Verification

- Pure tests: group boundaries, stable suggestions, return phases, out-of-order capture, summary transition, deferred reasons/budgets, recovery and legacy enabling.
- Browser fixtures use synthetic pixels; actual camera APIs, JPEG encoding, OPFS and IndexedDB are exercised. Cases cover nine-position acquisition without shutter, separate extras, tracking recovery, stalled help, write failure, progress only after durable save, reload and small/desktop layouts.
- Legacy capture regressions cover full 28-shot flow, Session fix, interruption, retakes and countdown review/cancellation.
- Pages verifier exercises actual face/hair/body workers online/offline, persists a synthetic capture, and rejects image-bearing or third-party network requests.

## Real-device acceptance still required

On iPhone Safari and Samsung Chrome, complete a fresh primary scan without shutter/Next pose, interpreting degrees or assistance. Record duration, any unclear cue, tracking loss and extra taps. Check deliberate left/right movement, hold/saved cues, and a supplementary countdown while facing away. Only text observations are needed; do not upload photos. Synthetic tests do not establish device usability, calibration or fairness rates.
