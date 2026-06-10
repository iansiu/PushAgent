# QiuyuRemote Push Agent

語言：[English](../README.md) | [简体中文](README.zh-Hans.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Русский](README.ru.md)

公開倉庫：<https://github.com/iansiu/PushAgent>

Push Agent 執行在你的下載伺服器上，用來監控 qBittorrent、Transmission、aria2 和可選的 yt-dlp 任務，並將下載完成、下載失敗、任務長時間無資料、伺服器離線/恢復等事件傳送到 Qiuyu's Push Relay。QiuyuRemote 收到事件後會顯示系統通知。

Push Agent 很輕量：

- 不包含 APNs `.p8` 私鑰。
- 不保存 APNs 裝置 token。
- 不需要 PHP、MySQL、Nginx 或前端建置步驟。
- 預設使用 QiuyuRemote 內建 Relay 位址：

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org` 只會在主 Relay 不可用時作為備用位址。一般使用者不需要自己填寫 Relay 位址。

## 快速開始

### 1. 安裝 Agent

在執行下載服務的伺服器上安裝 Node.js 18 或更新版本，然後複製公開倉庫：

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. 建立 `config.json`

```sh
cp config.example.json config.json
```

一般使用者的配置頂部通常類似這樣：

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

只把你真正使用的下載服務加入 `servers`。`config.example.json` 已提供 qBittorrent、Transmission、aria2、yt-dlp 範本，並且預設都是 `"enabled": false`。沒有執行的服務保持停用即可。

### 3. 配置下載服務

qBittorrent 範例：

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

Transmission 範例：

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

aria2 範例：

```json
{
  "name": "aria2",
  "type": "aria2",
  "enabled": true,
  "baseUrl": "http://127.0.0.1:6800/jsonrpc",
  "token": "",
  "allowInvalidTLS": false,
  "liveEvents": true,
  "stoppedTaskLimit": 300
}
```

如果 aria2 使用 HTTPS 且憑證是自簽或主機名稱不相符，可以把該服務的 `allowInvalidTLS` 改成 `true`。建議保持 `liveEvents` 為 `true`，這樣很快完成的 aria2 任務也更容易被即時捕捉。

yt-dlp 範例：

```json
{
  "name": "yt-dlp",
  "type": "ytdlp",
  "enabled": true,
  "binaryPath": "yt-dlp",
  "ffmpegPath": "ffmpeg",
  "downloadDir": "./data/yt-dlp-downloads",
  "format": "bv*+ba/b",
  "outputTemplate": "%(title).80B.%(ext)s",
  "cookiesPath": "",
  "proxy": "",
  "requireCookiesForYoutube": false,
  "cleanHashtags": true,
  "maxConcurrent": 10,
  "noPlaylist": true,
  "restrictFilenames": false,
  "extraArgs": []
}
```

請先在伺服器安裝 yt-dlp。如果保留預設 `format` 為 `bv*+ba/b`，也建議安裝 ffmpeg，因為許多網站會分別下載影片和音訊後再合併。診斷介面會顯示 `ytDlpVersion`、`ffmpegAvailable` 和 `ffmpegVersion`。

某些網站，尤其是 YouTube，可能需要登入 Cookie。這不是 Push Agent 故障，而是 yt-dlp 需要認證。你可以從已登入的瀏覽器匯出 Netscape 格式的 `cookies.txt`，上傳到伺服器，然後把 `cookiesPath` 設為伺服器上的絕對路徑，例如：

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

一個 Netscape 格式 Cookie 檔案可以包含多個網域的 Cookie，yt-dlp 會依 URL 自動使用對應網域的 Cookie。Cookie 檔案請妥善保存，不要公開。

### 4. 產生 Agent 配對碼

在 QiuyuRemote 中：

1. 開啟設定。
2. 開啟下載完成通知。
3. 啟用通知並允許系統通知權限。
4. 產生 Agent 配對碼。

你會取得一個短的一次性代碼，例如：

```text
MBGT-TB7S
```

### 5. 配對 Agent

第一次配置時，把配對碼寫入 `config.json`：

```json
"pairingCode": "MBGT-TB7S"
```

然後啟動 Agent：

```sh
npm start
```

配對成功後，Agent 會把 Relay 身分保存到：

```text
data/relay-identity.json
```

配對成功後請清空舊配對碼：

```json
"pairingCode": ""
```

配對碼是一次性且有有效期限的。如果舊配對碼留在配置裡，Agent 下次啟動會再次嘗試兌換，並顯示已經使用過的提示。

### 6. 保持 Agent 執行

```sh
npm start
```

正式使用時建議使用 systemd 或其它程序管理器。下面有完整 systemd 範例。

## Web 控制台

Push Agent 自帶一個簡單的 Web 控制台：

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

它可以查看 Agent 狀態、Relay 身分、下載服務診斷、配對裝置、配對碼記錄、最近事件、測試通知和版本更新提示。全域裝置、應用程式、中繼節點等管理功能屬於 Push Relay 後台。

## 新增更多裝置

一個 Agent 可以同時通知多台 QiuyuRemote 裝置。你不需要為每台 iPhone、iPad 或 Mac 分別執行一個 Agent。

最簡單的方法：

1. 在新的 QiuyuRemote 裝置上產生新的配對碼。
2. 開啟 Agent Web 控制台。
3. 在配對裝置區域輸入配對碼。
4. 把新裝置配對到已有 Agent。

也可以透過 API 配對：

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

也可以在啟動前把多個新配對碼寫入 `config.json`：

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

更清楚的陣列寫法也支援：

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

同一個配置裡重複的配對碼會被略過。已使用、已過期或已撤銷的配對碼會在終端和 Web 控制台事件列表中清楚顯示。

## API Key

`apiKey` 用來保護 Agent 的本地管理 API 和 Web 控制台操作。

如果 `apiKey` 為空：

- 來自 `127.0.0.1` 的請求會被允許。
- 遠端瀏覽器或遠端 API 請求會被拒絕。

如果其它裝置需要存取 Agent 連接埠，建議產生隨機 key：

```sh
openssl rand -hex 32
```

然後寫入 `config.json`：

```json
"apiKey": "paste-the-random-key-here"
```

API 請求需要加：

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

在 Web 控制台裡，在存取區域輸入同一個 key。如果頁面顯示需要 API Key，表示目前瀏覽器不是從 Agent 本機存取，或輸入的 key 和 `config.json` 不一致。

## Relay 憑證

一般使用者保持預設 Relay 位址即可：

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

除非你在做特殊部署，否則不要手動填寫這些靜態憑證欄位：

- `relay.agentId`
- `relay.secret`

配對時 Push Relay 會回傳 Agent ID 和簽名密鑰。Agent 會自動保存到 `data/relay-identity.json`。除非你在做特殊靜態憑證部署，否則不要把 secret 複製到 `config.json`。

僅在開發或私有 Relay 測試時，才需要自訂 `relay.urls`：

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

特殊部署也可以使用靜態 Relay 憑證：

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## 通知規則

Agent 會傳送這些事件：

- 下載完成
- 下載失敗
- 任務長時間沒有接收到資料
- 受監控的下載服務離線
- 受監控的下載服務恢復在線
- 測試推送事件

初始掃描會被當作基線。Agent 第一次啟動時已經存在的完成或失敗任務不會觸發新通知，之後發生的終態變化才會通知。

對於正在下載的任務，Agent 會記錄任務最後一次出現下載速度或進度增長的時間。如果一個未完成任務在 `monitor.inactiveDownloadNoticeSeconds` 秒內沒有任何資料，Agent 會傳送一次 `download_inactive` 通知。只有該任務重新收到資料後，這個提醒狀態才會重置，所以它不會每個輪詢週期重複通知。

如果 Push Relay 接受了事件但沒有任何裝置收到通知，Agent 仍會把該任務記錄為已經上報。這樣當所有裝置被停用或還沒有配對裝置時，同一個完成/失敗任務不會在每個輪詢週期反覆傳送。

## 欄位說明

| 欄位 | 說明 |
| --- | --- |
| `host` | Agent 監聽位址。預設 `127.0.0.1`，只允許本機存取。只有在其它機器需要開啟 Agent Web 控制台時才改成 `0.0.0.0`，並且應先設定 `apiKey`。 |
| `port` | Agent 連接埠，預設 `8765`。 |
| `apiKey` | 本地 API Key。只有本機存取可以留空；遠端存取建議設定隨機值。 |
| `pairingCode` | 單個配對碼，或用逗號、空格、分號分隔多個配對碼。配對成功後請清空。 |
| `pairingCodes` | 可選的多個配對碼陣列。 |
| `agentName` | Relay 上顯示的 Agent 名稱，例如 `Home Agent`。 |
| `dataDir` | Agent 存放 `relay-identity.json`、任務狀態和服務狀態的位置。 |
| `relay.urls` | Push Relay 位址。範例已經包含 Qiuyu 的主 Relay 和備用 Relay。 |
| `monitor.pollIntervalSeconds` | 下載服務輪詢間隔，預設 `30` 秒，執行時最小值為 `10` 秒。 |
| `monitor.inactiveDownloadNoticeEnabled` | 是否在執行中的未完成任務長時間無資料時通知。預設 `true`。 |
| `monitor.inactiveDownloadNoticeSeconds` | 無資料閾值，預設 `1800` 秒，也就是 30 分鐘。 |
| `updateCheck.enabled` | Agent Web 頁面是否檢查公開 PushAgent 新版本。預設 `true`。 |
| `updateCheck.repositoryURL` | Agent Web 頁面開啟的 GitHub 頁面。 |
| `updateCheck.url` | 更新中繼資料位址，預設讀取 GitHub 上公開 `package.json` 的版本號。 |
| `updateCheck.intervalSeconds` | 更新檢查快取間隔，預設 `3600` 秒。 |
| `updateCheck.timeoutSeconds` | 更新檢查網路逾時，預設 `4` 秒。 |
| `servers` | qBittorrent、Transmission、aria2、可選 yt-dlp 的連線配置。 |
| `servers[].name` | 顯示名稱，可隨時修改。 |
| `servers[].type` | 下載服務類型。支援 `qbit`、`transmission`、`aria2`、`ytdlp`。 |
| `servers[].enabled` | 是否監控該服務。省略或設為 `true` 表示啟用，設為 `false` 可保留範本但不監控。 |
| `servers[].username` / `servers[].password` | qBittorrent 和 Transmission 登入欄位。不需要認證時留空。 |
| `servers[].token` | aria2 RPC secret token。不需要時留空。 |
| `servers[].allowInvalidTLS` | 是否允許該本地服務使用無效 TLS 憑證，主要用於本地 aria2 HTTPS RPC。 |
| `servers[].liveEvents` | 僅 aria2。啟用 WebSocket 終端事件通知，預設啟用。 |
| `servers[].stoppedTaskLimit` | 僅 aria2。輪詢時查詢的已停止任務數量。 |
| `servers[].binaryPath` | 僅 yt-dlp。命令名或絕對路徑，預設 `yt-dlp`。 |
| `servers[].ffmpegPath` | 僅 yt-dlp。ffmpeg 命令名或絕對路徑，預設 `ffmpeg`。 |
| `servers[].downloadDir` | 僅 yt-dlp。預設下載目錄。QiuyuRemote 中每個任務填寫的目錄會覆蓋它。 |
| `servers[].format` | 僅 yt-dlp。預設格式選擇器。 |
| `servers[].outputTemplate` | 僅 yt-dlp。輸出檔名範本。預設使用 `%(title).80B.%(ext)s` 縮短標題。 |
| `servers[].cookiesPath` | 僅 yt-dlp。需要登入 Cookie 的網站可填寫 Cookie 檔案路徑。 |
| `servers[].proxy` | 僅 yt-dlp。傳給 yt-dlp 的代理位址。 |
| `servers[].requireCookiesForYoutube` | 僅 yt-dlp。若為 `true`，YouTube URL 在未配置 Cookie 時會提前回傳友好錯誤。 |
| `servers[].cleanHashtags` | 僅 yt-dlp。預設 `true`，產生檔名前移除標題末尾 hashtag 文字。 |
| `servers[].maxConcurrent` | 僅 yt-dlp。最大並發 yt-dlp 程序數，預設 `10`。 |
| `servers[].noPlaylist` | 僅 yt-dlp。預設 `true`，避免單個 URL 自動展開成播放清單下載。 |
| `servers[].restrictFilenames` | 僅 yt-dlp。讓 yt-dlp 使用更保守的檔名字元。 |
| `servers[].extraArgs` | 僅 yt-dlp。進階參數陣列。Agent 使用 spawn 參數陣列傳遞，不使用 shell 拼接。受 QiuyuRemote 控制的 `--output`、`--format`、`--cookies`、`--proxy`、`--paths` 會在這裡被忽略，以保持任務行為可預測。 |

## 常用命令

```sh
npm start
curl http://127.0.0.1:8765/v1/health
curl http://127.0.0.1:8765/v1/update-check
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
curl -X POST http://127.0.0.1:8765/v1/push/test
```

## systemd 範例

假設 Agent 安裝在 `/root/PushAgent`：

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
which node
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

服務內容：

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

服務檔本身不需要執行權限：

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

常用管理命令：

```sh
sudo systemctl start qiuyuremote-push-agent
sudo systemctl stop qiuyuremote-push-agent
sudo systemctl restart qiuyuremote-push-agent
sudo systemctl status qiuyuremote-push-agent
sudo journalctl -u qiuyuremote-push-agent -f
sudo journalctl -u qiuyuremote-push-agent -n 100
sudo journalctl -u qiuyuremote-push-agent -b
```

## 排錯

如果收不到通知，先檢查 Agent 是否已配對，再檢查下載服務是否能連線：

```sh
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
```

如果提示配對碼已使用，表示該代碼已完成過配對。清空 `pairingCode` 後重啟，或在 QiuyuRemote 重新產生一個新的配對碼。

qBittorrent 返回 403 時，確認 `baseUrl` 是 Web UI 基礎位址，不要加 `/api/v2`，並檢查帳號、密碼和反向代理 Cookie。

aria2 HTTPS 憑證錯誤時，可以在本地服務配置中設定：

```json
"allowInvalidTLS": true
```

## 環境變數

大多數使用者不需要這些。它們主要用於服務管理器或自訂部署：

- `QIUYU_AGENT_CONFIG`：配置檔案路徑
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`：逗號分隔的配對碼
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`：開發用自訂 Relay URL
- `QIUYU_RELAY_URLS`：開發用逗號分隔 Relay URL 列表
- `QIUYU_RELAY_AGENT_ID`：特殊部署使用的靜態 Relay Agent ID
- `QIUYU_RELAY_SECRET`：特殊部署使用的靜態 Relay Agent secret
- `QIUYU_AGENT_UPDATE_CHECK_ENABLED`
- `QIUYU_AGENT_UPDATE_CHECK_URL`
- `QIUYU_AGENT_REPOSITORY_URL`
- `QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS`
- `QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS`
