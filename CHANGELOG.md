# Changelog

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
