# QiuyuRemote Push Agent

言語：[English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | 日本語 | [한국어](README.ko.md) | [Русский](README.ru.md)

公開リポジトリ：<https://github.com/iansiu/PushAgent>

App ガイド：[QiuyuRemote App ガイド](APP_GUIDE.ja.md)

## サポート

QiuyuRemote アプリのサポート、フィードバック、不具合報告、機能要望、PushAgent に関する質問は、こちらで Issue を作成してください：
<https://github.com/iansiu/PushAgent/issues>

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

## Push Agent は必要ですか？

必須ではありません。QiuyuRemote は Push Agent なしでも使えます。既存の qBittorrent、Transmission、aria2 を管理するだけなら、アプリはそれぞれの Web API または RPC エンドポイントへ直接接続します。

Push Agent は、アプリ単体ではバックグラウンドで安定して実行できない機能のための任意のサーバー側コンポーネントです。

| 機能 | Push Agent が必要か |
| --- | --- |
| qBittorrent、Transmission、aria2 のタスク管理 | 不要 |
| qBittorrent、Transmission、aria2 タスクの追加、停止、再開、削除、速度制限、詳細表示 | 不要 |
| WebDAV のファイル閲覧と再生 | 不要。ただし WebDAV の設定は別途必要 |
| QiuyuRemote のローカルオフラインダウンロード | 不要 |
| ローカルオフラインダウンロード通知 | 不要。QiuyuRemote がローカルで通知を予約します |
| リモートダウンロード完了または失敗通知 | 必要 |
| 長時間データが流れていないタスクの通知 | 必要 |
| ダウンロードサーバーのオフラインまたは復帰通知 | 必要 |
| yt-dlp ダウンロード | 必要 |
| yt-dlp Cookie 管理 | 必要 |
| YouTube、TikTok などの URL を QiuyuRemote に共有してリモートダウンロード | 必要。yt-dlp Push Agent の設定が必要です |

つまり、Push Agent は QiuyuRemote を使い始めるための必須条件ではありません。サーバー側監視、プッシュ通知、yt-dlp のための拡張機能です。

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

先にサーバーへ yt-dlp をインストールしてください。既定の `format` が `bv*+ba/b` の場合、動画と音声の結合に ffmpeg が必要になることがあります。診断結果には `ytDlpVersion`、`ffmpegAvailable`、`ffmpegVersion` が表示されます。

YouTube など一部のサイトはログイン Cookie を要求する場合があります。これは Push Agent の障害ではなく、yt-dlp 側の認証要求です。ログイン済みブラウザから Netscape 形式の `cookies.txt` をエクスポートし、QiuyuRemote の Cookie 管理でインポートするか、サーバーへアップロードして `cookiesPath` に絶対パスを設定してください。

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

1 つの Cookie ファイルに複数ドメインの Cookie を入れることができます。yt-dlp は URL に合う Cookie だけを使います。Cookie ファイルは公開しないでください。

Cookie の選択順は、タスクで明示された `cookiesPath`、QiuyuRemote にインポートされ `cookiesDir` に保存された該当サイトの Cookie、`config.json` の fallback `cookiesPath`、Cookie なし、の順です。つまり、アプリにインポートしたサイト Cookie は設定ファイルより優先されます。インポート済みファイルが空、期限切れ、または無効な場合、タスクは Cookie エラーになり、設定ファイルへ静かにフォールバックしません。fallback `cookiesPath` を使い直したい場合は、アプリ側の該当サイト Cookie を更新または削除してください。

デスクトップブラウザーでは `Get cookies.txt LOCALLY` 拡張機能で標準 Netscape 形式の Cookie ファイルをエクスポートできます。iOS では Microsoft Edge と `Cookie-Editor` 拡張機能を使い、Export Format を `Netscape` に設定して現在サイトの Cookie をコピーし、`Create a new cookie file` ショートカットを実行できます: `https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`。ショートカットは `On My iPhone/Downloads` に Cookie ファイルを作成し、QiuyuRemote に直接インポートできます。

QiuyuRemote に表示される Cookie の有効期限は推定値です。実際に使えるかどうかは、ログアウト、パスワード変更、アカウント保護、サーバー IP/地域の変化、サイト側の無効化、レート制限、yt-dlp extractor の変更などにも影響されます。

YouTube では、署名と `n` challenge を解くために yt-dlp の外部 JavaScript サポートが必要になることがあります。Deno をインストールし、現在の shell と systemd の両方から見える場所に置いてください。

```bash
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
/usr/local/bin/deno --version
python3 -m pip install -U "yt-dlp[default]"
apt install -y ffmpeg
```

YouTube Cookie を `/root/PushAgent/cookies/youtube.txt` などにアップロードし、まずサーバー上で単一の動画 URL をテストします。`list=` 付き URL がプレイリスト全体に展開されないよう、`--no-playlist` を付けてください。

```bash
chmod 600 /root/PushAgent/cookies/youtube.txt
yt-dlp -F \
  --no-playlist \
  --cookies /root/PushAgent/cookies/youtube.txt \
  --remote-components ejs:github \
  --js-runtimes deno:/usr/local/bin/deno \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

正常なら `[jsc:deno] Solving JS challenges using deno` が表示され、720p や 1080p などの実際の音声/動画形式が列挙されます。storyboard 画像だけの場合は、yt-dlp、Deno、または EJS コンポーネントを確認してください。`HTTP Error 429: Too Many Requests` は YouTube がサーバー IP を一時的に制限している状態なので、時間を置くか `proxy` を設定してください。

テストに成功したら、同じオプションを yt-dlp サービス設定に入れます。

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

設定変更後は Agent を再起動してください。

```bash
systemctl restart pushagent
```

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

### 6. Agent を継続実行する

```sh
npm start
```

本番運用では systemd などのプロセスマネージャを使うことを推奨します。下に systemd の完全な例があります。

## Web コンソール

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

Web コンソールでは Agent 状態、Relay ID、サービス診断、ペアリング済みデバイス、ペアリングコード、最近のイベント、テスト通知、更新確認を表示できます。グローバルなデバイス、アプリ、Relay ノードの管理は Push Relay 管理画面で行います。

## デバイスを追加する

1 つの Agent で複数の QiuyuRemote デバイスへ通知できます。iPhone、iPad、Mac ごとに Agent を別々に起動する必要はありません。

一番簡単な方法：

1. 新しい QiuyuRemote デバイスで新しいペアリングコードを生成します。
2. Agent Web コンソールを開きます。
3. Pair Device セクションにペアリングコードを入力します。
4. 既存の Agent に新しいデバイスを追加します。

API でペアリングすることもできます。

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

起動前に複数の新しいコードを `config.json` に入れることもできます。

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

配列形式も使えます。

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

同じ設定内の重複コードはスキップされます。使用済み、期限切れ、取り消し済みのコードは、ターミナルと Web コンソールのイベント一覧に表示されます。

`data/relay-identity.json` に保存された Relay identity が Push Relay 側に存在しない場合、Agent Web コンソールで手動ペアリングすると、古い identity を使わずに一度だけ再試行し、Relay が返した新しい Agent ID を保存します。通常は、Relay が保存済みの有効な Agent identity と異なる Agent ID を返した場合、Agent は静かに置き換えません。

1 つの Agent に有効な yt-dlp サービスが複数ある場合、query のない古いリクエストは引き続き最初の有効な yt-dlp を使います。分離したい場合は、QiuyuRemote のパスを `v1/ytdlp?server=<id-or-name>` にしてください。selector には Agent Web コンソールに表示されるサービス `id`、`name`、`storageKey`、endpoint、base URL を指定できます。

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

Web コンソールでは Access セクションに同じ key を入力してください。ページに `API Key Required` と表示される場合、ブラウザが Agent と同じマシンからアクセスしていないか、入力した key が `config.json` と一致していません。

## Relay 認証情報

通常の利用では既定の Relay アドレスをそのまま使えます。

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

特殊なデプロイでない限り、次の静的認証情報を手動で設定しないでください。

- `relay.agentId`
- `relay.secret`

ペアリング時に Push Relay は Agent ID と署名用 secret を返します。Agent はそれらを `data/relay-identity.json` に自動保存します。特殊な静的認証情報デプロイでない限り、secret を `config.json` にコピーする必要はありません。

開発やプライベート Relay のテスト時だけ、カスタム `relay.urls` を使います。

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

特殊なデプロイでは静的 Relay 認証情報も利用できます。

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## 通知

Agent は次のイベントを送信します。

- ダウンロード完了
- ダウンロード失敗
- 実行中のタスクが長時間データを受信していない
- 監視対象サーバーがオフラインになった
- 監視対象サーバーがオンラインに戻った
- テストプッシュイベント

初回スキャンは基準状態として扱われます。Agent 起動時点ですでに完了または失敗している既存タスクでは通知を出しません。その後に発生した終端状態の変化だけを通知します。

実行中のダウンロードでは、Agent は最後にダウンロード速度または進捗増加が見られた時刻を記録します。未完了タスクが `monitor.inactiveDownloadNoticeSeconds` 秒間データを受信しない場合、Agent は `download_inactive` 通知を 1 回送ります。そのタスクが再びデータを受信するまで状態はリセットされないため、ポーリングごとに繰り返し通知されません。

Push Relay がイベントを受け付けたものの、どのデバイスにも届かなかった場合、または一部のデバイスにしか届かなかった場合、Agent はそのイベントを保留として保持し、以降のポーリングで再試行します。すでに受信済みのデバイスは再試行対象から除外され、直近の重複イベントも抑制されるため、復旧時に成功済みデバイスへ重複通知が届くことはありません。

## フィールドリファレンス

| フィールド | 説明 |
| --- | --- |
| `host` | Agent の待ち受けアドレス。既定は `127.0.0.1` でローカル専用です。他のマシンから Web コンソールを開く必要がある場合だけ `0.0.0.0` にし、先に `apiKey` を設定してください。 |
| `port` | Agent のポート。既定は `8765`。 |
| `apiKey` | ローカル API key。ローカルだけで使うなら空でも構いません。リモートアクセスする場合はランダム値を設定してください。 |
| `pairingCode` | 1 つのコード、またはカンマ、空白、セミコロンで区切った複数コード。ペアリング成功後は空にしてください。 |
| `pairingCodes` | 複数のペアリングコードを配列で指定できます。 |
| `agentName` | Push Relay に表示される Agent 名。例：`Home Agent`。 |
| `dataDir` | `relay-identity.json`、タスク状態、サーバー状態を保存する場所。 |
| `relay.urls` | Push Relay アドレス。例には Qiuyu のプライマリ Relay とフォールバック Relay が含まれています。 |
| `monitor.pollIntervalSeconds` | ダウンロードサービスのポーリング間隔。既定は `30` 秒、実行時の最小値は `10` 秒です。 |
| `monitor.inactiveDownloadNoticeEnabled` | 実行中の未完了タスクが長時間データを受信しない場合に通知するかどうか。既定は `true`。 |
| `monitor.inactiveDownloadNoticeSeconds` | データなし判定の秒数。既定は `1800` 秒、つまり 30 分です。 |
| `updateCheck.enabled` | Agent Web ページで公開 PushAgent の新バージョンを確認するかどうか。既定は `true`。 |
| `updateCheck.repositoryURL` | Agent Web ページから開く GitHub ページ。 |
| `updateCheck.url` | 更新メタデータ URL。既定では GitHub 上の公開 `package.json` から version を読みます。 |
| `updateCheck.intervalSeconds` | 更新確認のキャッシュ間隔。既定は `3600` 秒。 |
| `updateCheck.timeoutSeconds` | 更新確認のネットワークタイムアウト。既定は `4` 秒。 |
| `servers` | qBittorrent、Transmission、aria2、任意の yt-dlp 接続設定。 |
| `servers[].name` | 表示名。いつでも変更できます。 |
| `servers[].type` | サービス種別。`qbit`、`transmission`、`aria2`、`ytdlp` をサポートします。 |
| `servers[].enabled` | 監視するかどうか。省略または `true` で有効、`false` でテンプレートだけ残して監視しません。 |
| `servers[].username` / `servers[].password` | qBittorrent と Transmission のログイン情報。不要なら空にします。 |
| `servers[].token` | aria2 RPC secret token。不要なら空にします。 |
| `servers[].allowInvalidTLS` | そのローカルサーバーの無効な TLS 証明書を許可するかどうか。主にローカル aria2 HTTPS RPC 用です。 |
| `servers[].liveEvents` | aria2 のみ。WebSocket 終端イベント通知を有効にします。既定は有効。 |
| `servers[].stoppedTaskLimit` | aria2 のみ。ポーリング時に取得する停止済みタスク数。 |
| `servers[].binaryPath` | yt-dlp のみ。コマンド名または絶対パス。既定は `yt-dlp`。 |
| `servers[].ffmpegPath` | yt-dlp のみ。ffmpeg のコマンド名または絶対パス。既定は `ffmpeg`。 |
| `servers[].downloadDir` | yt-dlp のみ。既定の保存先。QiuyuRemote のタスクごとの保存先が優先されます。 |
| `servers[].storageKey` | yt-dlp のみ。タスク履歴とサイト Cookie 保存に使う安定した key。アップグレードや保存先変更後も変えないでください。 |
| `servers[].statePath` | yt-dlp のみ。タスク履歴 JSON ファイルのパス。既定は `data/yt-dlp-tasks/<storageKey>.json` です。 |
| `servers[].historyLimit` | yt-dlp のみ。Push Agent が保持するタスク履歴数。既定は `1000` です。 |
| `servers[].format` | yt-dlp のみ。既定の format selector。 |
| `servers[].outputTemplate` | yt-dlp のみ。出力ファイル名テンプレート。既定では `%(title).80B.%(ext)s` を使いタイトルを短くします。 |
| `servers[].cookiesPath` | yt-dlp のみ。タスク指定やアプリにインポートされたサイト Cookie がない場合に使う fallback の Netscape Cookie ファイル。 |
| `servers[].cookiesDir` | yt-dlp のみ。QiuyuRemote Cookie 管理がサイト別 Cookie を保存するディレクトリ。既定は `data/ytdlp-cookies/<storageKey>` です。 |
| `servers[].proxy` | yt-dlp のみ。yt-dlp に渡す proxy。 |
| `servers[].requireCookiesForYoutube` | yt-dlp のみ。`true` の場合、タスク指定、アプリインポート、fallback のいずれにも Cookie がない YouTube URL は早めにわかりやすいエラーになります。 |
| `servers[].cleanHashtags` | yt-dlp のみ。既定は `true`。ファイル名生成前にタイトル末尾の hashtag テキストを除去します。 |
| `servers[].maxConcurrent` | yt-dlp のみ。同時実行する yt-dlp プロセス数。既定は `10`。 |
| `servers[].noPlaylist` | yt-dlp のみ。既定は `true`。1 つの URL がプレイリスト全体に展開されるのを防ぎます。 |
| `servers[].restrictFilenames` | yt-dlp のみ。より保守的なファイル名文字を使います。 |
| `servers[].extraArgs` | yt-dlp のみ。上級者向け追加引数の配列。Agent は shell 文字列ではなく spawn の引数配列として渡します。QiuyuRemote が制御する `--output`、`--format`、`--cookies`、`--proxy`、`--paths` はここでは無視されます。 |

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

高速に完了する aria2 タスクが通知されない場合は、`liveEvents` を有効にし、必要に応じて aria2 の `max-download-result` を増やしてください。

## 環境変数

ほとんどのユーザーは使う必要がありません。サービスマネージャやカスタムデプロイで利用できます。

- `QIUYU_AGENT_CONFIG`: 設定ファイルのパス
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`: カンマ区切りのペアリングコード
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`: 開発用のカスタム Relay URL
- `QIUYU_RELAY_URLS`: カンマ区切りのカスタム Relay URL 一覧
- `QIUYU_RELAY_AGENT_ID`: 特殊デプロイ用の静的 Relay Agent ID
- `QIUYU_RELAY_SECRET`: 特殊デプロイ用の静的 Relay Agent secret
- `QIUYU_AGENT_UPDATE_CHECK_ENABLED`
- `QIUYU_AGENT_UPDATE_CHECK_URL`
- `QIUYU_AGENT_REPOSITORY_URL`
- `QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS`
- `QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS`
