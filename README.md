# QiuyuRemote Push Agent

Public repository: <https://github.com/iansiu/PushAgent>

Languages: English | [简体中文](docs/README.zh-Hans.md) | [繁體中文](docs/README.zh-Hant.md) | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [Русский](docs/README.ru.md)

App guide: [QiuyuRemote App Guide](APP_GUIDE.md)

> **Production build status:** The App Store production build does not include the ~~yt-dlp~~ integration or Cookie Management. The retained ~~yt-dlp~~ sections are for internal builds and existing PushAgent deployments.

## Support

For QiuyuRemote app support, feedback, bug reports, feature requests, and
PushAgent questions, please open an issue here:
<https://github.com/iansiu/PushAgent/issues>

Push Agent runs on the user's download server. It watches qBittorrent,
Transmission, aria2, and optional ~~yt-dlp~~ tasks, then sends signed task events to
Qiuyu's Push Relay so QiuyuRemote devices can receive download-complete,
download-failed, and server online/offline notifications.

The Agent is intentionally lightweight:

- It does not contain APNs `.p8` private keys.
- It does not store APNs device tokens.
- It does not require PHP, MySQL, Nginx, or a frontend build step.
- It uses the built-in Relay addresses by default:

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org` is only a fallback when the primary Relay is unavailable.
Normal users do not need to enter or deploy Relay URLs.

## Do You Need Push Agent?

QiuyuRemote can be used without Push Agent. If you only want to manage an
existing qBittorrent, Transmission, or aria2 server, the app connects directly
to that service's own Web API or RPC endpoint.

Push Agent is an optional server-side helper for background features that cannot
reliably run from the app alone:

| Feature | Requires Push Agent? |
| --- | --- |
| Manage qBittorrent, Transmission, or aria2 tasks | No |
| Add, pause, resume, remove, limit, or inspect qBittorrent, Transmission, or aria2 tasks | No |
| WebDAV file browsing and playback | No, but WebDAV must be configured separately |
| Hand off video playback to supported third-party players | No, this is handled inside QiuyuRemote |
| Local offline downloads in QiuyuRemote | No |
| Local offline download notifications | No, QiuyuRemote schedules them locally |
| Remote download completed or failed notifications | Yes |
| Long-running no-data task alerts | Yes |
| Download server offline or online notifications | Yes |
| <del>yt-dlp downloads</del> | <del>Yes</del> |
| <del>yt-dlp cookie management</del> | <del>Yes</del> |
| <del>Sharing a YouTube, TikTok, or other media URL to QiuyuRemote for remote download</del> | <del>Yes, through a configured yt-dlp Push Agent</del> |

In short: Push Agent is not required for the basic download-manager experience.
It is required for server-side monitoring, push notifications, and ~~yt-dlp~~.

## Quick Start

### 1. Install The Agent

Clone the public repository on the server that runs qBittorrent, Transmission,
aria2, or ~~yt-dlp~~. Install Node.js 18 or later, then enter the Agent folder:

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. Create `config.json`

```sh
cp config.example.json config.json
```

For a normal user, the top of `config.json` should look like this:

```json
{
  "host": "127.0.0.1",
  "port": 8765,
  "apiKey": "",
  "pairingCode": "",
  "pairingCodes": [],
  "agentName": "Home Agent",
  "dataDir": "./data",
  "relay": {
    "urls": [
      "https://push.qiuyu.org",
      "https://push1.qiuyu.org"
    ]
  },
  "monitor": {
    "pollIntervalSeconds": 30,
    "serviceStatusNoticeEnabled": true,
    "inactiveDownloadNoticeEnabled": true,
    "inactiveDownloadNoticeSeconds": 1800
  },
  "updateCheck": {
    "enabled": true,
    "repositoryURL": "https://github.com/iansiu/PushAgent",
    "url": "https://raw.githubusercontent.com/iansiu/PushAgent/main/package.json",
    "intervalSeconds": 3600,
    "timeoutSeconds": 4
  },
  "servers": []
}
```

Only add the download services you actually use to `servers`.
The default `relay.urls` already includes Qiuyu's primary and fallback Relay.
Do not change it unless you are testing your own private Relay.

`config.example.json` also includes qBittorrent, Transmission, aria2, and
~~yt-dlp~~ templates with `"enabled": false`. Keep unused services disabled, or
delete their blocks entirely. Set `"enabled": true` only for services that are
actually running on this server.

### 3. Configure Download Services

qBittorrent example:

```json
{
  "name": "qBittorrent",
  "type": "qbit",
  "enabled": true,
  "baseUrl": "http://127.0.0.1:8081",
  "username": "",
  "password": ""
}
```

`name` is only the display name and can be changed at any time. `type` selects
the protocol. The Agent creates its own internal id from `type` and `baseUrl` to
store task state, notification history, and server status. Changing `type` or
`baseUrl` makes it a different internal service.

Use the qBittorrent Web UI base address only. Do not add `/api/v2`; the Agent
adds API paths internally. qBittorrent may return cookie names such as
`SID`, `QBT_SID`, or `QBT_SID_8081`; the Agent preserves the returned cookie
name automatically.

Transmission example:

```json
{
  "name": "Transmission",
  "type": "transmission",
  "enabled": true,
  "baseUrl": "http://127.0.0.1:9091/transmission/rpc",
  "username": "",
  "password": ""
}
```

aria2 example:

```json
{
  "name": "aria2",
  "type": "aria2",
  "enabled": true,
  "baseUrl": "https://127.0.0.1:7800/jsonrpc",
  "token": "",
  "allowInvalidTLS": true,
  "liveEvents": true,
  "stoppedTaskLimit": 300
}
```

If aria2 uses normal HTTP JSON-RPC, use:

```json
"baseUrl": "http://127.0.0.1:6800/jsonrpc",
"allowInvalidTLS": false
```

If aria2 uses HTTPS with a self-signed or hostname-mismatched certificate, set
`allowInvalidTLS` to `true` for that local aria2 server. `liveEvents` enables the
aria2 WebSocket event listener, which is the best way to catch very fast
downloads that complete between polling cycles.

If you keep `liveEvents` disabled, increase aria2's own `max-download-result`
setting and keep `stoppedTaskLimit` high enough, otherwise very fast completed
tasks may not have details available when the Agent polls.

~~yt-dlp~~ example:

```json
{
  "name": "yt-dlp",
  "type": "ytdlp",
  "enabled": true,
  "binaryPath": "yt-dlp",
  "ffmpegPath": "ffmpeg",
  "downloadDir": "./data/yt-dlp-downloads",
  "storageKey": "default",
  "statePath": "./data/yt-dlp-tasks/default.json",
  "format": "bv*+ba/b",
  "outputTemplate": "%(title).80B.%(ext)s",
  "cookiesPath": "",
  "cookiesDir": "./data/ytdlp-cookies/default",
  "proxy": "",
  "requireCookiesForYoutube": false,
  "cleanHashtags": true,
  "maxConcurrent": 10,
  "historyLimit": 1000,
  "noPlaylist": true,
  "restrictFilenames": false,
  "extraArgs": []
}
```

Install ~~yt-dlp~~ on the Agent server first, for example with `pipx install yt-dlp`
or your system package manager. Install `ffmpeg` too if you keep the default
`format` value `bv*+ba/b`, because ~~yt-dlp~~ may download separate video and audio
streams and then merge them. During diagnostics the Agent reports
`ytDlpVersion`, `ffmpegAvailable`, and `ffmpegVersion`; if a merge format needs
ffmpeg but ffmpeg cannot be found, the server is marked unavailable with
`code: "ffmpeg_missing"` instead of waiting for the first task to fail.

QiuyuRemote does not run ~~yt-dlp~~ on iPhone, iPad, or Mac; it sends the media page
URL to this Agent API and displays the task state returned by the Agent. Keep
`noPlaylist` enabled unless you intentionally want one submitted URL to expand
into a playlist download.

Useful ~~yt-dlp~~ options:

- `binaryPath`: the ~~yt-dlp~~ command. Use `"yt-dlp"` if it is in `PATH`, or an
  absolute path such as `"/usr/local/bin/yt-dlp"` if your service environment
  cannot find it.
- `ffmpegPath`: the ffmpeg command or absolute path. Use `"ffmpeg"` if it is in
  `PATH`.
- `downloadDir`: default directory for ~~yt-dlp~~ downloads. A per-task directory
  entered in QiuyuRemote overrides this value for that task.
- `storageKey`: stable key used for ~~yt-dlp~~ task history and site-cookie storage.
  Keep this value unchanged when you update ~~yt-dlp~~, change `downloadDir`, or
  reinstall QiuyuRemote. For a single ~~yt-dlp~~ service, use `"default"`.
- `statePath`: optional absolute or relative JSON file path for ~~yt-dlp~~ task
  history. If omitted, Push Agent stores history under
  `data/yt-dlp-tasks/<storageKey>.json`. Keep this file when upgrading.
- `historyLimit`: maximum number of ~~yt-dlp~~ task records retained by the Agent.
  The default is `1000`.
- `format`: default ~~yt-dlp~~ format selector. `bv*+ba/b` asks for best video plus
  best audio, then falls back to the best single-file format when needed. A
  per-task format entered in QiuyuRemote overrides this value.
- `outputTemplate`: default filename template. The default omits ~~yt-dlp~~'s media
  id suffix. A per-task output filename entered in QiuyuRemote overrides this
  value.
- `cookiesPath`: optional fallback Netscape-format cookies file path on the
  Agent server. It is used only when a task does not provide an explicit cookie
  path and no matching site cookie has been imported from QiuyuRemote. This can
  be a single file such as `/root/PushAgent/cookies/all-cookies.txt` containing
  cookies for several domains.
- `cookiesDir`: optional directory where QiuyuRemote Cookie Management stores
  site-specific cookies for this ~~yt-dlp~~ service. If omitted, Push Agent uses
  `data/ytdlp-cookies/<storageKey>`. Imported files use stable names such as
  `youtube.txt`, `tiktok.txt`, `douyin.txt`, `bilibili.txt`, and `others.txt`.
- `proxy`: optional proxy URL. A per-task proxy entered in QiuyuRemote overrides
  this value.
- `requireCookiesForYoutube`: if `true`, YouTube URLs fail early with a clear
  cookie-required error when no task, imported YouTube, or fallback cookie file
  is available.
- `extraArgs`: advanced ~~yt-dlp~~ arguments as a JSON array, for example
  `["--merge-output-format", "mp4"]`. The Agent passes these as a spawn argument
  array, not a shell string. Arguments controlled by QiuyuRemote, such as
  `--output`, `--format`, `--cookies`, `--proxy`, and `--paths`, are ignored
  here to keep task handling predictable.

Some sites, especially YouTube, may require login cookies. This is not a
QiuyuRemote or Push Agent failure; it is ~~yt-dlp~~ asking for authentication.
Export a Netscape-format `cookies.txt` from a browser where the account is
already logged in, then either import it in QiuyuRemote Cookie Management or set
`cookiesPath` to an absolute server path such as
`"/root/PushAgent/cookies/youtube.txt"`. Restart the Agent after changing the
config file. A single Netscape-format cookie file can contain cookies for
multiple domains; ~~yt-dlp~~ will use only the cookies matching each submitted URL.

Cookie selection order is:

1. A per-task `cookiesPath` explicitly submitted by QiuyuRemote.
2. A site cookie imported in QiuyuRemote Cookie Management and stored under
   `cookiesDir`, for example `youtube.txt`.
3. The fallback `cookiesPath` from `config.json`.
4. No cookies.

This means an imported site cookie in the app has higher priority than
`config.json`'s `cookiesPath`. If that imported file is empty, expired, or
invalid, the task will fail with a cookie error instead of silently falling back
to the config file. Update or remove the imported site cookie when you want to
use the fallback file again.

On desktop browsers, the `Get cookies.txt LOCALLY` extension can export a
standard Netscape-format cookie file when the browser supports it. On iOS, you
can use Microsoft Edge with the `Cookie-Editor` extension, set the extension's
Export Format to `Netscape`, copy the current site's cookies to the clipboard,
then run the `Create a new cookie file` Shortcut:
`https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`. The
Shortcut creates a cookie file in `On My iPhone/Downloads`, which you can then
import directly in QiuyuRemote.

Keep all cookie files private because they can grant access to browser sessions.
The expiration shown in QiuyuRemote is only an estimate from the cookie file.
Real availability can change earlier because of logout, password changes,
account security checks, server IP/location changes, site-side invalidation,
rate limits, or ~~yt-dlp~~ extractor changes. If downloads start failing, re-export
and re-import the cookie file.

For a personal server, a single fallback file such as
`"/root/PushAgent/cookies/all-cookies.txt"` is usually the simplest config. If
you prefer to keep sites separate at the config level, create multiple ~~yt-dlp~~
service blocks with different `name` values and different `cookiesPath` files,
such as `youtube.txt`, `tiktok.txt`, and `bilibili.txt`. If you want YouTube
downloads to fail early whenever no cookie source is available, set
`requireCookiesForYoutube` to `true`.

YouTube may also require ~~yt-dlp~~'s external JavaScript support for signature and
`n` challenge solving. Install Deno, make it visible to both your shell and
systemd, then test the exact server command before using QiuyuRemote:

```bash
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
/usr/local/bin/deno --version
python3 -m pip install -U "yt-dlp[default]"
apt install -y ffmpeg
```

Export YouTube cookies to the Agent server, for example
`/root/PushAgent/cookies/youtube.txt`, protect the file, and test one video URL
with playlists disabled:

```bash
chmod 600 /root/PushAgent/cookies/youtube.txt
yt-dlp -F \
  --no-playlist \
  --cookies /root/PushAgent/cookies/youtube.txt \
  --remote-components ejs:github \
  --js-runtimes deno:/usr/local/bin/deno \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

The expected output should include `[jsc:deno] Solving JS challenges using deno`
and list real audio/video formats such as 720p or 1080p. If the output only
shows storyboard images, update ~~yt-dlp~~ and check Deno/EJS again. If YouTube
returns `HTTP Error 429: Too Many Requests`, the server IP is being rate limited;
wait before retrying or configure `proxy`.

After that, put the same options into the ~~yt-dlp~~ service config:

```json
{
  "cookiesPath": "/root/PushAgent/cookies/youtube.txt",
  "requireCookiesForYoutube": true,
  "noPlaylist": true,
  "extraArgs": [
    "--remote-components",
    "ejs:github",
    "--js-runtimes",
    "deno:/usr/local/bin/deno"
  ]
}
```

Restart Push Agent after changing the config:

```bash
systemctl restart pushagent
```

In QiuyuRemote, add a download server with type `yt-dlp`, host/port pointing to
this Push Agent, and path `v1/ytdlp`. If the app connects from another device,
set `apiKey` in `config.json`, restart the Agent, and enter the same value in
QiuyuRemote's ~~yt-dlp~~ server API Key field.

If one Agent exposes multiple enabled ~~yt-dlp~~ service blocks, old requests that
do not include a query string continue to use the first enabled ~~yt-dlp~~ service.
To keep multiple ~~yt-dlp~~ services isolated, point QiuyuRemote at
`v1/ytdlp?server=<id-or-name>` where the selector can be the service `id`,
`name`, `storageKey`, endpoint, or base URL shown in the Agent web console.

### 4. Generate A Pairing Code

In QiuyuRemote:

1. Open Settings.
2. Open Download Completion Notifications.
3. Enable notifications and allow the system notification permission.
4. Generate an Agent pairing code.

You will get a short one-time code like:

```text
MBGT-TB7S
```

### 5. Pair The Agent

For first setup, put the code into `config.json`:

```json
"pairingCode": "MBGT-TB7S"
```

Then start the Agent:

```sh
npm start
```

If pairing succeeds, the terminal prints something like:

```text
Push Agent paired with Push Relay as agent_xxx.
```

The Agent saves its Relay identity in:

```text
data/relay-identity.json
```

After pairing succeeds, remove the old code or set it back to empty:

```json
"pairingCode": ""
```

Pairing codes are one-time and short-lived. If you leave an old code in
`config.json`, the Agent will try to redeem it again on every start and show an
"already used" message. That means the code already did its job.

### 6. Keep The Agent Running

```sh
npm start
```

For production, use systemd or another process manager. A systemd example is
included below.

## Web Console

Push Agent includes a built-in web console:

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

The console can:

- show Agent status, config path, uptime, and current Relay identity
- show qBittorrent, Transmission, aria2, and ~~yt-dlp~~ monitor status
- show aria2 live event connection status
- run diagnostics for configured download services
- pair another QiuyuRemote device
- show paired devices and pairing-code records from Push Relay
- remove a device from this Agent
- delete old pairing-code records
- send a test push notification
- show recent local Agent events and Relay delivery events

The console is intentionally simple and local to the Agent. Global device,
Agent, application, and Relay-node administration belongs to the Push Relay
admin console.

## Adding More Devices

One Agent can notify multiple QiuyuRemote devices. You do not need to run one
Agent process per iPhone, iPad, or Mac.

The easiest method:

1. Generate a fresh pairing code on the new QiuyuRemote device.
2. Open the Agent web console.
3. Enter the pairing code in the Pair Device section.
4. Pair it with the existing Agent.

You can also pair by API:

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

Or paste more than one fresh code into `config.json` before starting:

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

The clearer array form is also supported:

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

Duplicate codes in the same config are skipped. Used, expired, or revoked codes
are reported clearly in the terminal and in the web console event list.

If the Relay identity saved in `data/relay-identity.json` no longer exists on
Push Relay, manual pairing from the Agent web console retries once without the
old identity and saves the fresh Agent ID returned by Relay. Normal pairing still
refuses to silently replace a valid saved Agent identity with a different one.

## API Key

`apiKey` protects the Agent's local management API and web console actions.

If `apiKey` is empty:

- requests from `127.0.0.1` are allowed
- remote browser/API requests are rejected

This is fine when you only manage the Agent from the same server:

```json
"apiKey": ""
```

If other machines can access the Agent port, set a random key:

```sh
openssl rand -hex 32
```

Then put it in `config.json`:

```json
"apiKey": "paste-the-random-key-here"
```

When `apiKey` is set, API calls must include:

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

In the web console, enter the same key in the Access section. If the page shows
`API Key Required`, the browser is not local to the Agent or the entered key
does not match `config.json`.

## Relay Credentials

Normal users can keep the default Relay addresses:

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

Do not fill these static credential fields unless you are doing a special
deployment:

- `relay.agentId`
- `relay.secret`

During pairing, Push Relay returns an Agent ID and signing secret. The Agent
saves them automatically in `data/relay-identity.json`. Do not copy the secret
into `config.json` unless you are doing a special static-credential deployment.

For development or private Relay testing only, custom `relay.urls` may be used:

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

Static Relay credentials are also supported only for special deployments:

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## Notifications

The Agent sends events for:

- download completed
- download failed
- download has received no data for a while
- monitored server went offline
- monitored server came back online
- test push events

Initial scan is treated as a baseline. Existing completed or failed tasks found
when the Agent first starts do not trigger new notifications. Future terminal
state changes do.

For active downloads, the Agent records the last time a task reported download
speed or progress growth. If a running, incomplete task receives no data for
`monitor.inactiveDownloadNoticeSeconds` seconds, the Agent sends one
`download_inactive` notification. The notification resets only after that task
receives data again, so it will not repeat every polling cycle.

If Push Relay accepts an event but no device receives it, or only some devices
receive it, the Agent keeps that event pending and retries it on later polling
cycles. Devices that already received the event are excluded from the retry, and
recent duplicate events are suppressed, so recovery does not create duplicate
successful notifications.

## Field Reference

| Field | What To Fill |
| --- | --- |
| `host` | Agent listen address. Default is `127.0.0.1` for local-only access. Use `0.0.0.0` only when other machines need to open the Agent web console, and set `apiKey` first. |
| `port` | Agent port. Default is `8765`. |
| `apiKey` | Optional local API key. Leave empty only when remote access is not needed. |
| `pairingCode` | One code, or multiple codes separated by comma, space, or semicolon. Clear it after pairing succeeds. |
| `pairingCodes` | Optional array of multiple pairing codes. |
| `agentName` | Display name stored on Push Relay, such as `Home Agent`. |
| `dataDir` | Where Agent stores `relay-identity.json`, task state, and server state. |
| `relay.urls` | Push Relay addresses. The example already includes Qiuyu's primary and fallback Relay. |
| `monitor.pollIntervalSeconds` | Poll interval for download services. Default `30`; minimum runtime interval is `10`. |
| `monitor.serviceStatusNoticeEnabled` | Whether to notify when a monitored download service goes offline or comes back online. Default `true`. Set `false` to keep task notifications while muting service status changes. |
| `monitor.inactiveDownloadNoticeEnabled` | Whether to notify when a running incomplete task receives no data for a while. Default `true`. |
| `monitor.inactiveDownloadNoticeSeconds` | No-data threshold in seconds. Default `1800` (`30` minutes). |
| `updateCheck.enabled` | Whether the Agent web page checks for a newer public PushAgent version. Default `true`. |
| `updateCheck.repositoryURL` | GitHub page opened from the Agent web page. |
| `updateCheck.url` | Update metadata URL. By default this reads the public `package.json` version from GitHub. |
| `updateCheck.intervalSeconds` | Minimum cache interval for update checks. Default `3600`. |
| `updateCheck.timeoutSeconds` | Network timeout for update checks. Default `4`. |
| `servers` | qBittorrent, Transmission, aria2, and optional ~~yt-dlp~~ connection configs. |
| `servers[].name` | Display name shown in logs and the Agent web page. You can change it at any time. |
| `servers[].type` | Download service type. Supported values: `qbit`, `transmission`, `aria2`, `ytdlp`. |
| `servers[].enabled` | Whether this service is monitored. Omit it or set `true` to enable; set `false` to keep a template in the config without monitoring it. |
| `servers[].username` / `servers[].password` | Optional login fields for qBittorrent and Transmission. Leave empty if the service does not require authentication. |
| `servers[].token` | Optional aria2 RPC secret token. Leave empty if aria2 does not require one. |
| `servers[].allowInvalidTLS` | Allow invalid TLS certificates for that local server. Mainly useful for local aria2 HTTPS RPC. |
| `servers[].liveEvents` | aria2 only. Enables WebSocket terminal-event notifications. Default is enabled unless explicitly false. |
| `servers[].stoppedTaskLimit` | aria2 only. Number of stopped tasks to query during polling. |
| `servers[].binaryPath` | ~~yt-dlp~~ only. Command name or absolute path, default `yt-dlp`. |
| `servers[].downloadDir` | ~~yt-dlp~~ only. Directory where ~~yt-dlp~~ writes files. |
| `servers[].storageKey` | ~~yt-dlp~~ only. Stable key for task history and site-cookie storage. Keep it unchanged across upgrades. |
| `servers[].statePath` | ~~yt-dlp~~ only. Optional JSON file path for task history. Defaults to `data/yt-dlp-tasks/<storageKey>.json`. |
| `servers[].historyLimit` | ~~yt-dlp~~ only. Number of task history records retained by Push Agent. Default `1000`. |
| `servers[].format` | ~~yt-dlp~~ only. Optional default format selector. |
| `servers[].outputTemplate` | ~~yt-dlp~~ only. Output filename template. The default keeps titles shorter with `%(title).80B.%(ext)s`. |
| `servers[].cookiesPath` | ~~yt-dlp~~ only. Optional fallback Netscape-format cookie file used when no task-specific or App-imported site cookie is available. |
| `servers[].cookiesDir` | ~~yt-dlp~~ only. Directory used by QiuyuRemote Cookie Management for site-specific cookie files. Defaults to `data/ytdlp-cookies/<storageKey>`. |
| `servers[].proxy` | ~~yt-dlp~~ only. Optional proxy passed to ~~yt-dlp~~. |
| <del>`servers[].requireCookiesForYoutube`</del> | <del>yt-dlp only. If `true`, YouTube URLs fail with a friendly cookie-required error when no task, imported, or fallback cookie file is available.</del> |
| `servers[].cleanHashtags` | ~~yt-dlp~~ only. Default `true`; removes trailing hashtag text from titles before filenames are generated. |
| `servers[].maxConcurrent` | ~~yt-dlp~~ only. Maximum active ~~yt-dlp~~ processes for this Agent service. Default `10`. |
| `servers[].noPlaylist` | ~~yt-dlp~~ only. Default `true`; keeps one submitted URL from expanding into a playlist unless explicitly disabled. |

## Common Commands

Check Agent health:

```sh
curl http://127.0.0.1:8765/v1/health
```

Check whether a newer PushAgent version is available:

```sh
curl http://127.0.0.1:8765/v1/update-check
```

Check Agent state:

```sh
curl http://127.0.0.1:8765/v1/state
```

Check all download services:

```sh
curl http://127.0.0.1:8765/v1/diagnostics
```

Check one download service:

```sh
curl http://127.0.0.1:8765/v1/diagnostics?server=aria2
```

Send a test notification through the Agent:

```sh
curl -X POST http://127.0.0.1:8765/v1/push/test
```

If `apiKey` is set, add the authorization header:

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

## systemd Example

This example assumes the Agent folder is here:

```text
/root/PushAgent
```

Make sure `config.json` exists before creating the service:

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
```

If Node.js is not installed at `/usr/bin/node`, check the real path:

```sh
which node
```

Create the systemd service file:

```sh
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

Paste this content:

```ini
[Unit]
Description=QiuyuRemote Push Agent
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/root/PushAgent
ExecStart=/usr/bin/node src/index.mjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

The service file itself does not need executable permission. Use normal root
owned permissions:

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
```

If you do not run the Agent from `/root/PushAgent`, change `WorkingDirectory`.
If `which node` prints a different path, change `ExecStart` too.

Reload systemd and start the Agent:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

Common service commands:

```sh
# Start
sudo systemctl start qiuyuremote-push-agent

# Stop
sudo systemctl stop qiuyuremote-push-agent

# Restart after editing config.json
sudo systemctl restart qiuyuremote-push-agent

# Show current status
sudo systemctl status qiuyuremote-push-agent

# Enable auto-start on boot
sudo systemctl enable qiuyuremote-push-agent

# Disable auto-start on boot
sudo systemctl disable qiuyuremote-push-agent
```

View logs:

```sh
# Follow live logs
sudo journalctl -u qiuyuremote-push-agent -f

# Show recent logs
sudo journalctl -u qiuyuremote-push-agent -n 100

# Show logs since this boot
sudo journalctl -u qiuyuremote-push-agent -b
```

After editing `config.json`, restart the service:

```sh
sudo systemctl restart qiuyuremote-push-agent
```

## Troubleshooting

### No Notification Arrives

1. Check whether the Agent is paired:

```sh
curl http://127.0.0.1:8765/v1/state
```

2. Check whether the download service can be reached:

```sh
curl http://127.0.0.1:8765/v1/diagnostics
```

3. Check the terminal or systemd log. The Agent prints qBittorrent,
Transmission, aria2, ~~yt-dlp~~, pairing, Relay, and APNs delivery summaries.

4. Check Relay health:

```sh
curl https://push.qiuyu.org/v1/health
```

### Pairing Code Was Already Used

The code already paired an Agent. If this Agent is already paired, clear
`pairingCode` and restart normally. If you are adding another device, generate a
fresh code in QiuyuRemote and pair it through the web console or `/v1/agent/pair`.

### qBittorrent Login Accepted But API Returns 403

Make sure `baseUrl` points to the qBittorrent Web UI base address and that the
username/password are correct. If qBittorrent is behind a reverse proxy, ensure
the proxy forwards `Set-Cookie` and subsequent cookie headers correctly.

### aria2 HTTPS Certificate Error

If the terminal shows `ERR_TLS_CERT_ALTNAME_INVALID`, either use the hostname
that matches the certificate or set:

```json
"allowInvalidTLS": true
```

for that local aria2 server.

### Fast aria2 Downloads Are Missed

Keep `liveEvents` enabled so WebSocket terminal events can be received
immediately. Also increase aria2's `max-download-result` if polling needs to
see details for very fast stopped tasks.

## Environment Variables

Most users do not need these. They are useful for service managers or custom
deployments:

- `QIUYU_AGENT_CONFIG`: config file path
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`: comma-separated pairing codes
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`: optional custom Relay URL for development
- `QIUYU_RELAY_URLS`: optional comma-separated custom Relay URL list
- `QIUYU_RELAY_AGENT_ID`: static Relay Agent ID for special deployments
- `QIUYU_RELAY_SECRET`: static Relay Agent secret for special deployments
