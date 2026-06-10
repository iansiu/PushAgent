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

如果你正在 QiuyuRemote 私有工程中開發測試，也可以直接複製 `Services/PushAgent` 資料夾到伺服器。

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

## Web 控制台

Push Agent 自帶一個簡單的 Web 控制台：

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

它可以查看 Agent 狀態、Relay 身分、下載服務診斷、配對裝置、配對碼記錄、最近事件、測試通知和版本更新提示。全域裝置、應用程式、中繼節點等管理功能屬於 Push Relay 後台。

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
