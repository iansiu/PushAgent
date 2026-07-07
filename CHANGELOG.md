# Changelog

All notable changes to QiuyuRemote PushAgent will be documented in this file.

## [Unreleased] - 2026-06-26

### Improved
- Improved push delivery recovery so partially delivered events retry only the devices that did not receive the notification.
- Added duplicate suppression and APNs collapse IDs for recent task/server events to avoid repeated successful notifications during retry recovery.
- Clarified localized documentation for yt-dlp cookie priority, iOS cookie export, free/Pro behavior, and delivery retry behavior.
- Documented QiuyuRemote's supported third-party video player handoff targets across the localized App Guides.
- Documented the public GitHub Issues support link across the localized README files.

### Fixed
- Fixed completed, failed, stopped, inactive, and server online/offline events being marked handled when Push Relay accepted the event but no target device actually received it.
- Improved the pairing error shown when the QiuyuRemote device for a pairing code is no longer registered.

## [1.1.0] - 2026-06-13

### Added
- Added yt-dlp server support with task creation, monitoring, history, diagnostics, and friendly error responses.
- Added per-site Cookie management for yt-dlp, including upload, delete, expiration/status metadata, and per-Agent isolation.
- Added ffmpeg, yt-dlp, and JavaScript runtime diagnostics for formats that require audio/video merging or YouTube challenge handling.
- Added version reporting and update-check metadata for the PushAgent web console.
- Added localized App guides in English, Simplified Chinese, Traditional Chinese, Japanese, Korean, and Russian.

### Improved
- Improved download notification timing and wording for completed, failed, and long-running inactive tasks.
- Documented the current QiuyuRemote app display status mapping for qBittorrent, Transmission, aria2, and yt-dlp.
- Improved qBittorrent, Transmission, and aria2 monitoring so manual stop states and automatic-rule stop reasons are handled more consistently.
- Improved yt-dlp filename cleanup, source URL handling, and downloaded-file deletion support.
- Improved Push Relay pairing recovery and multi-device binding behavior from the Agent side.
- Improved public documentation for setup, URL scheme use, cookies, YouTube/Deno guidance, free/Pro app behavior, and Agent-required features.
- Clarified yt-dlp cookie configuration, App-imported cookie priority, desktop and iOS cookie export workflows, and cookie-expiration caveats across localized docs.
- Rewrote the App Guide's Free/Pro section in user-facing language and listed the main Pro capabilities.

### Fixed
- Fixed missing remote notifications when Agent/device bindings were absent or stale.
- Fixed repeated automatic stop hints after a task was already manually stopped.
- Fixed yt-dlp authentication and format errors being exposed as raw stderr instead of friendly error codes.
- Fixed API key guidance for Bearer authorization failures.

## [1.0.0] - 2026-06-10

### Added
- Initial public PushAgent release for QiuyuRemote.
