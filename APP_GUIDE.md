# QiuyuRemote App Guide

Languages: English | [简体中文](docs/APP_GUIDE.zh-Hans.md) | [繁體中文](docs/APP_GUIDE.zh-Hant.md) | [日本語](docs/APP_GUIDE.ja.md) | [한국어](docs/APP_GUIDE.ko.md) | [Русский](docs/APP_GUIDE.ru.md)

QiuyuRemote can work as a direct download manager, or as a download manager plus a Push Agent companion.

## Basic Mode And Agent Mode

Without Push Agent, QiuyuRemote can still manage existing qBittorrent, Transmission, and aria2 servers directly through their own Web API or RPC endpoints.

Push Agent is only needed for server-side background features:

| Feature | Push Agent required |
| --- | --- |
| Manage qBittorrent, Transmission, or aria2 tasks | No |
| Add, pause, resume, delete, limit, and inspect qBittorrent, Transmission, or aria2 tasks | No |
| WebDAV file browsing and playback | No, but WebDAV must be configured separately |
| Local offline downloads | No |
| Local offline download notifications | No |
| Remote download completed or failed notifications | Yes |
| Long-running no-data task alerts | Yes |
| Download server offline or online notifications | Yes |
| yt-dlp downloads | Yes |
| yt-dlp cookie management | Yes |
| Share a media URL from another app to QiuyuRemote for remote yt-dlp download | Yes |

## Free Plan And Pro

QiuyuRemote is designed as a free app with optional in-app purchases. The free plan should keep core direct download management usable. Pro can unlock advanced features without blocking the entire app at launch.

Purchases are verified with StoreKit 2. QiuyuRemote checks current App Store entitlements when the app starts, listens for transaction updates, and lets you restore purchases from the Subscription section in Settings.

QiuyuRemote also creates a random purchase device ID in the local Keychain. It is not your Apple ID, APNs token, PushAgent ID, or any download server credential. If server-side activation limits are added later, the server should bind this device ID to a verified App Store purchase transaction instead of using editable names such as "Home Agent".

Pro status and Push Agent pairing are separate. Buying Pro does not pair an Agent by itself, and pairing an Agent does not prove that a Pro purchase exists.

## Servers

When no server exists, the first screen shows an add-server entry.

After at least one server has been added, adding another server is intentionally tucked into the server menu:

- On iPhone, tap the server name at the top to switch servers. Long-press the server name to open the server menu with New, Edit, and Delete.
- On iPhone, the horizontal server cards can switch servers. Long-press a server card for Edit or Delete.
- On iPad or Mac, tap the server name to switch servers. Long-press the server name on iPad, or right-click it on Mac, to open New, Edit, and Delete.
- In the collapsed sidebar, use the plus button below the settings button.
- Right-click or long-press a server row/icon to edit or delete that server.

Deleting a server from QiuyuRemote only removes the saved connection profile from the app. It does not delete tasks or files on the download server.

Supported server types:

- Transmission: connects to the Transmission RPC endpoint.
- aria2: connects to the aria2 JSON-RPC endpoint.
- qBittorrent: connects to the qBittorrent Web UI API.
- yt-dlp: connects to PushAgent's `v1/ytdlp` API. yt-dlp runs on the server, not on the phone or Mac.

## Adding Downloads

Use the add button on the home screen to add a task.

- qBittorrent and Transmission are for magnet links and `.torrent` files.
- aria2 can handle normal HTTP/HTTPS file URLs, metalinks, magnets, and torrents depending on your aria2 configuration.
- yt-dlp accepts HTTP/HTTPS media page URLs, such as YouTube, TikTok, Bilibili, Instagram, X, Threads, and other sites supported by yt-dlp.

On iPhone and iPad, you can share a URL from another app to QiuyuRemote. For yt-dlp sharing, add and connect a yt-dlp PushAgent server first. iOS may open QiuyuRemote to finish submitting the shared link.

## URL Scheme And Shortcuts

QiuyuRemote registers the `qiuyuremote://` URL scheme so Shortcuts or another app can submit a download link.

Basic examples:

```text
qiuyuremote://addTask?url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=ytdlp&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID
```

`addTask` uses the currently selected server by default. Add `type=aria2`, `type=qbit`, `type=transmission`, or `type=ytdlp` to use the first matching server of that type. Add `server=<server name or UUID>` to target a specific saved server.

`autoAdd=true` is the default. With `autoAdd=false`, QiuyuRemote opens the Add Download sheet with the URL filled in, so you can adjust options before submitting.

Compatibility rules still apply:

- qBittorrent and Transmission accept magnet links or `.torrent` URLs.
- aria2 accepts normal file URLs, magnets, and torrents, depending on aria2 configuration.
- yt-dlp accepts HTTP/HTTPS media page URLs and requires a configured yt-dlp PushAgent server.

For Shortcuts, QiuyuRemote also supports `x-callback-url`:

```text
qiuyuremote://x-callback-url/addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip&x-success=shortcuts%3A%2F%2F&x-error=shortcuts%3A%2F%2F
```

On success, `x-success` receives `count`, `gid`, and `gids`. `count` is `1` for a submitted task; `gid` and `gids` are currently empty unless a download service can reliably return task IDs in a future version. On failure, `x-error` receives `errorCode` and `errorMessage`.

Always URL-encode the `url`, `x-success`, and `x-error` values, especially when the download URL itself contains `?`, `&`, or non-ASCII characters.

## Task List

The default task order is optimized for everyday use:

- Active or downloading tasks stay near the top.
- Completed tasks are grouped after active tasks.
- Newer completed tasks appear above older completed tasks.
- If you manually sort by a column, your column sort takes priority over the default grouping.

On iPad and Mac, table columns can be resized by dragging the boundary in the header. The Name column supports a much wider width for long task names.

yt-dlp tasks hide torrent-only fields such as upload speed, uploaded size, seeds, leechers, and share ratio.

## Task Status Mapping

QiuyuRemote shows a normalized app status in the task list. The original service status is still kept when the download service provides it. The app combines normalized status, raw status, progress, transfer speed, and automatic-rule notices, so a completed torrent stopped by a share-ratio or idle rule can show Stopped with a notice instead of plain Complete.

| Service | Service status or condition | App display status |
| --- | --- | --- |
| qBittorrent | `error`, `missingFiles` | Error |
| qBittorrent | `pausedUP`, `stoppedUP`, `stalledUP`, `queuedUP` | Complete; automatic-rule notices can show it as Stopped |
| qBittorrent | values containing `paused`, or `stoppedDL` | Paused |
| qBittorrent | values containing `queued` | Waiting |
| qBittorrent | values containing `checking`, `metadata`, or `allocating`; also `filesChecked`, `metadataReceived` | Checking or Processing |
| qBittorrent | values containing `uploading` or `forcedUP` | Seeding |
| qBittorrent | values containing `stalled` | Stalled |
| qBittorrent | values containing `downloading` or `forcedDL` | Downloading |
| qBittorrent | `moving` | Moving |
| Transmission | `error > 0` | Error |
| Transmission | `0` | Stopped; if progress is complete, QiuyuRemote treats it as Complete unless an automatic-rule notice applies |
| Transmission | `1`, `2` | Checking |
| Transmission | `3`, `4` | Downloading |
| Transmission | `5`, `6` | Seeding |
| aria2 | `active` | Downloading |
| aria2 | `waiting` | Waiting |
| aria2 | `paused` | Paused |
| aria2 | `error` | Error |
| aria2 | `complete` | Complete; automatic-rule notices can show it as Stopped |
| aria2 | `removed` | Removed |
| yt-dlp | `downloading`, `running` | Downloading |
| yt-dlp | `postprocessing`, `processing`, `merge`, `fixup`, `metadata`, `extract`, `remux`, `convert` | Processing |
| yt-dlp | `moving` | Moving |
| yt-dlp | `completed` | Complete |
| yt-dlp | `failed`, `error`, `lost` | Error |
| yt-dlp | `paused` | Paused |
| yt-dlp | `queued` | Waiting |

Other unknown values are shown as the raw service status, or as Unknown if the service returns an empty status.

## Task Actions

Select a task to view details. Long-press or right-click a task to open task actions:

- Resume or pause
- Delete
- Copy name, source link, or path
- Set download or upload speed limit when supported
- Set share ratio when supported
- Force recheck when supported

For qBittorrent and Transmission tasks stopped by automatic rules, Resume shows a choice:

- Continue: keep the current rule. The task may stop automatically again later.
- Disable Rules and Continue: clear only the rule that stopped this task, then continue.
- Not Now: keep the current state.

aria2 resume is simpler. If aria2 still has enough task information, QiuyuRemote asks aria2 to continue or restart the task. Completed tasks show Resume disabled.

When deleting, Remove Task Only keeps downloaded files. Remove Task And Downloaded Files asks the server to delete local data too when that download service supports it. aria2 RPC can remove tasks and history, but it cannot reliably delete completed files from disk.

## Files, WebDAV, And Offline Library

Task details can show files when the download service provides file information.

WebDAV is optional. Configure it globally or per server if the download directory is exposed through WebDAV. QiuyuRemote can then browse files and hand playback URLs to external players.

The Offline Library is local to the current device. Offline files are not synced through iCloud. Local offline download notifications are scheduled directly by QiuyuRemote and do not need Push Agent.

If a file exists on disk but does not appear in WebDAV yet, refresh the WebDAV provider, for example OpenList, or wait for its index/cache to update.

## Notifications

System notification permission is controlled by iOS, iPadOS, or macOS.

- Local offline download notifications are sent by QiuyuRemote itself.
- Remote qBittorrent, Transmission, and aria2 task notifications require a paired Push Agent running on the download server.
- yt-dlp task notifications also come from Push Agent.
- Push Relay test notifications only verify that this device can receive APNs through Push Relay. They do not prove that a server Push Agent is paired or running.

To receive remote download notifications:

1. Enable notifications in QiuyuRemote.
2. Generate an Agent pairing code in QiuyuRemote.
3. Open the PushAgent web page on the server.
4. Enter the pairing code and pair the Agent.
5. Keep PushAgent running on the server.

## yt-dlp And Cookies

yt-dlp downloads run on PushAgent. QiuyuRemote submits a URL and shows the task state returned by the Agent.

Cookie Management is per yt-dlp PushAgent server. Cookies are uploaded directly to the selected PushAgent and stored on that server. They are not sent to Push Relay, not synced through iCloud, and not printed in logs.

Use Netscape-format `cookies.txt` files exported from a browser. Cookies are website login credentials, so do not share them.

On desktop browsers, the `Get cookies.txt LOCALLY` extension can export a standard Netscape-format cookie file when supported by the browser. On iOS, you can use Microsoft Edge with the `Cookie-Editor` extension, set Export Format to `Netscape`, copy the current site's cookies to the clipboard, then run the `Create a new cookie file` Shortcut: `https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`. The Shortcut creates a cookie file in `On My iPhone/Downloads`, which can be imported directly in QiuyuRemote.

For each yt-dlp task, PushAgent uses cookies in this order: a task-specific cookies path, the matching site cookie imported in QiuyuRemote, then the fallback `cookiesPath` from PushAgent `config.json`. An imported site cookie in the app has higher priority than the config file.

The expiration shown in QiuyuRemote is only an estimate based on the cookie file. Cookies can stop working earlier because of logout, password changes, account security checks, server IP/location changes, site-side invalidation, rate limits, or yt-dlp extractor changes.

If YouTube or another site says login or cookies are required, import or update the matching site cookie in Cookie Management. YouTube may also require yt-dlp updates, ffmpeg, and a JavaScript runtime such as Deno for current signature challenge handling.

## Sync And Privacy

Server profiles and app preferences can sync through iCloud. Passwords and tokens use iCloud Keychain. Downloaded files and Offline Library items do not sync.

If privacy protection is enabled, Face ID, Touch ID, or the device password is handled by Apple's system authentication UI.

## Troubleshooting

- If a direct download server cannot connect, check the address, port, path, SSL setting, username, password, token, and whether the service is reachable from the current network.
- For qBittorrent, use the Web UI base URL. Do not manually append `/api/v2`.
- For Transmission, use the RPC endpoint, usually `/transmission/rpc`.
- For aria2, use the JSON-RPC endpoint and token if configured.
- For yt-dlp, connect to PushAgent's `v1/ytdlp` endpoint and enter the Agent `apiKey` if one is set.
- If remote notifications do not arrive, check notification permission, Focus mode, Push Relay registration, Agent pairing, and whether PushAgent is running.
- If WebDAV cannot play or find a file, confirm the WebDAV path maps to the real download directory and refresh the WebDAV provider.
