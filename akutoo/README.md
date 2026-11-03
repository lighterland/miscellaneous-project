# Akutoo personal PWA

Live path: https://lighterland.github.io/miscellaneous-project/akutoo/

This is the main app, separate from the historical camera measurement prototype in akutoo-m0/.
Face/detail, hair/Solo and body capture, local review/import/dataset ZIP, manual look and prompt contact-sheet package run on-device. Photos are never uploaded. No accounts, analytics or AI backend.

## Use on a phone

Open the HTTPS URL in Safari or Chrome, wait for Ready offline, reload once, then add to the home screen. Grant camera permission. Face forward and hold still for the five-second reference. Follow the requested pose; a green Position ready label means the automatic capture conditions are met. Hold still briefly for the automatic photo. Shots labelled Manual shot still use the shutter.

Settings provides Guidance voice and Listen to voice. Automatic favors identifiable female voice names, preferring on-device voices; voice quality and offline availability depend on the OS. Choose an installed enhanced voice if available. All spoken instructions remain English.

Photos and settings are local to each browser/device and do not sync. Export separate dataset backups. A new URL/origin does not migrate localhost photos. Keep using the same HTTPS URL and close older tabs after app updates.

## Develop and verify

Node 24: npm ci; npm test; npm run build. Local browser checks: npm run test:e2e (after installing Playwright Chromium), or set AKUTOO_BROWSER_CHANNEL=chrome. Run node scripts/verify-pages.mjs after build to test the GitHub Pages subpath, all three real local workers online/offline, synthetic capture and same-origin GET/HEAD-only traffic. Set AKUTOO_LIVE_URL to the live trailing-slash URL to repeat it against deployment.

Real-device calibration, diverse sharp/blur samples, sustained performance/heat/battery and 3 m voice/pose acceptance remain unmeasured backlog. A green readiness label is capture readiness, not proof of identity or calibrated accuracy. Saved photos still require visual review.
