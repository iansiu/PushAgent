# Changelog

All notable changes to QiuyuRemote PushAgent will be documented in this file.

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

### Fixed
- Fixed missing remote notifications when Agent/device bindings were absent or stale.
- Fixed repeated automatic stop hints after a task was already manually stopped.
- Fixed yt-dlp authentication and format errors being exposed as raw stderr instead of friendly error codes.
- Fixed API key guidance for Bearer authorization failures.

## [1.0.0] - 2026-06-10

### Added
- Initial public PushAgent release for QiuyuRemote.
