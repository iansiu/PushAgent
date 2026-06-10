# QiuyuRemote Push Agent

言語：[English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | 日本語 | [한국어](README.ko.md) | [Русский](README.ru.md)

公開リポジトリ：<https://github.com/iansiu/PushAgent>

Push Agent はダウンロードサーバー上で動作し、qBittorrent、Transmission、aria2、任意の yt-dlp タスクを監視します。ダウンロード完了、失敗、長時間データが流れていない状態、サーバーのオフライン/復帰などのイベントを Qiuyu's Push Relay に送信し、QiuyuRemote 側でシステム通知を表示します。

Push Agent は軽量です。

- APNs の `.p8` 秘密鍵を含みません。
- APNs デバイストークンを保存しません。
- PHP、MySQL、Nginx、フロントエンドのビルドは不要です。
- 既定では QiuyuRemote の Relay アドレスを使います。

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org` はプライマリ Relay が利用できない場合のフォールバックです。通常の利用では Relay URL を変更する必要はありません。

## クイックスタート

### 1. Agent をインストール

ダウンロードサービスが動いているサーバーに Node.js 18 以降をインストールし、公開リポジトリを clone します。

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. `config.json` を作成

```sh
cp config.example.json config.json
```

通常は次のような先頭設定になります。

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

実際に使うダウンロードサービスだけを `servers` に追加してください。`config.example.json` には qBittorrent、Transmission、aria2、yt-dlp のテンプレートがありますが、既定では `"enabled": false` です。

### 3. ダウンロードサービスを設定

qBittorrent:

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

Transmission:

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

aria2:

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

aria2 が自己署名証明書の HTTPS を使う場合は `allowInvalidTLS` を `true` にできます。`liveEvents` は高速に完了する aria2 タスクを取りこぼしにくくするため、通常は有効のままにしてください。

yt-dlp:

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

先にサーバーへ yt-dlp をインストールしてください。既定の `format` が `bv*+ba/b` の場合、動画と音声の結合に ffmpeg が必要になることがあります。診断結果には `ytDlpVersion`、`ffmpegAvailable`、`ffmpegVersion` が表示されます。

YouTube など一部のサイトはログイン Cookie を要求する場合があります。これは Push Agent の障害ではなく、yt-dlp 側の認証要求です。ログイン済みブラウザから Netscape 形式の `cookies.txt` をエクスポートし、サーバーにアップロードして、`cookiesPath` に絶対パスを設定してください。

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

1 つの Cookie ファイルに複数ドメインの Cookie を入れることができます。yt-dlp は URL に合う Cookie だけを使います。Cookie ファイルは公開しないでください。

### 4. Agent ペアリングコードを生成

QiuyuRemote で：

1. Settings を開きます。
2. Download Completion Notifications を開きます。
3. 通知を有効にし、システム通知権限を許可します。
4. Agent ペアリングコードを生成します。

例：

```text
MBGT-TB7S
```

### 5. Agent をペアリング

初回設定では、コードを `config.json` に入れます。

```json
"pairingCode": "MBGT-TB7S"
```

起動します。

```sh
npm start
```

成功すると Relay の ID が次に保存されます。

```text
data/relay-identity.json
```

成功後は古いコードを空に戻してください。

```json
"pairingCode": ""
```

ペアリングコードは一度だけ使える短時間のコードです。古いコードを残すと、次回起動時に「すでに使用済み」と表示されます。

## Web コンソール

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

Web コンソールでは Agent 状態、Relay ID、サービス診断、ペアリング済みデバイス、ペアリングコード、最近のイベント、テスト通知、更新確認を表示できます。グローバルなデバイス、アプリ、Relay ノードの管理は Push Relay 管理画面で行います。

## API Key

`apiKey` は Agent のローカル管理 API と Web コンソール操作を保護します。

`apiKey` が空の場合：

- `127.0.0.1` からのリクエストは許可されます。
- リモートブラウザ/API からのリクエストは拒否されます。

外部端末から Agent ポートへアクセスする場合は、ランダムな key を設定してください。

```sh
openssl rand -hex 32
```

```json
"apiKey": "paste-the-random-key-here"
```

API には次のヘッダーが必要です。

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

## よく使うコマンド

```sh
npm start
curl http://127.0.0.1:8765/v1/health
curl http://127.0.0.1:8765/v1/update-check
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
curl -X POST http://127.0.0.1:8765/v1/push/test
```

## systemd 例

Agent が `/root/PushAgent` にある場合：

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
which node
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

内容：

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

サービスファイルに実行権限は不要です。

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

管理とログ：

```sh
sudo systemctl start qiuyuremote-push-agent
sudo systemctl stop qiuyuremote-push-agent
sudo systemctl restart qiuyuremote-push-agent
sudo systemctl status qiuyuremote-push-agent
sudo journalctl -u qiuyuremote-push-agent -f
sudo journalctl -u qiuyuremote-push-agent -n 100
sudo journalctl -u qiuyuremote-push-agent -b
```

## トラブルシューティング

通知が届かない場合は、まずペアリング状態とサービス診断を確認します。

```sh
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
```

ペアリングコードが使用済みと表示される場合、そのコードはすでにペアリングに使われています。`pairingCode` を空にして再起動するか、QiuyuRemote で新しいコードを生成してください。

qBittorrent が 403 を返す場合は、`baseUrl` が Web UI のベース URL であること、`/api/v2` を付けていないこと、ユーザー名/パスワードと Cookie 転送が正しいことを確認してください。

aria2 の HTTPS 証明書エラーは、ローカルサービスであれば次を設定できます。

```json
"allowInvalidTLS": true
```
