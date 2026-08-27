# Changelog

## 3.5.0

- Rebuilt the three-printer landscape grid so the complete camera, status, telemetry, speed, filament, and control stack fits without clipped buttons.
- Upgraded JARVIS Overdrive to the Mark V command-deck treatment with fabrication-bay numbering, illuminated power rails, target frames, stronger reactor depth, and more dramatic cyan/amber contrast.
- Improved narrow-card typography and telemetry density for the Fire HD 10 while preserving touch-friendly controls.
- Kept the cinematic look performant: Balanced mode retains the structural HUD but disables continuous high-cost motion and filters.

## 3.4.0

- Added JARVIS Overdrive as a separate, dramatically stronger full-screen fabrication HUD with a central animated reactor, sweeping optical grid, targeting reticles, telemetry rails, angular cards, and high-contrast cyan/amber controls.
- Stabilized HD external-camera playback at 15 FPS to prevent duplicate RTSP-to-MJPEG work and browser buffer growth while leaving higher selected frame rates available to capable native printer cameras.
- Added explicit external-camera streaming guidance to Display Settings.
- Added automatic Fire/Silk tablet detection and Full, Balanced, and Eco performance profiles; Balanced removes costly blur and continuous HUD rotations while capping video conversion at 12 FPS.

## 3.3.0

- Rebuilt Arc Reactor as the animated JARVIS Command HUD theme with holographic grids, scan lines, reactor effects, camera targeting overlays, and angular telemetry panels.
- Added 15, 24, and 30 FPS camera settings.
- Allow external A1/P1 camera replacements such as Wyze Bridge feeds to use the selected higher frame rate instead of the native-camera cap.

## 3.2.2

- Match Bambuddy's HMS filtering for two uncataloged, non-actionable P2S firmware records.
- Treat Bambuddy severity values above 3 as informational, matching Bambuddy's current behavior.

## 3.2.1

- Ignore Bambuddy's stale `awaiting_plate_clear` flag while a printer is actively printing, preparing, slicing, or paused.
- Prevent the Plate Is Clear action from appearing inside an active-print HMS notification.

## 3.2.0

- Added a live estimated finish time beside each printer's remaining time.
- Added automatic printer-style dialogs for completed, paused, failed, plate-clear, and HMS attention states.
- Added Bambuddy HMS action buttons, clear-alert control, resume, and plate-clear actions directly in notification dialogs.

## 3.1.0

- Replaced the generic printer badge with the Bambu Lab mark.
- Made printer state pills tappable for finished, warning, and current-state details.
- Added a notification dialog that surfaces Bambuddy messages, errors, warnings, job name, and progress.

## 3.0.0

- Added Bambu Dark, Arc Reactor, Workshop, and Clean Light themes.
- Added Command Grid, Camera Wall, Swipe Focus, and Status Rail layouts.
- Added tap-to-focus printer cards and improved three-printer scaling.
- Added saved display preferences and an in-app version indicator.
- Added multi-architecture GHCR builds and automatic Docker updates.
- Retained authenticated Bambuddy camera proxying and corrected remaining-time handling.
