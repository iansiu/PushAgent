# QiuyuRemote App ガイド

言語：[English](../APP_GUIDE.md) | [简体中文](APP_GUIDE.zh-Hans.md) | [繁體中文](APP_GUIDE.zh-Hant.md) | 日本語 | [한국어](APP_GUIDE.ko.md) | [Русский](APP_GUIDE.ru.md)

QiuyuRemote は、ダウンロードクライアントへ直接接続する管理アプリとしても、Push Agent と組み合わせた通知・yt-dlp 対応アプリとしても使えます。

## 基本モードと Agent モード

Push Agent を設定しなくても、QiuyuRemote は既存の qBittorrent、Transmission、aria2 を直接管理できます。アプリは各サービスの Web API または RPC エンドポイントへ直接接続します。

Push Agent が必要なのは、サーバー側で継続的に動く機能です。

| 機能 | Push Agent が必要か |
| --- | --- |
| qBittorrent、Transmission、aria2 のタスク管理 | 不要 |
| qBittorrent、Transmission、aria2 タスクの追加、一時停止、再開、削除、速度制限、詳細表示 | 不要 |
| WebDAV のファイル閲覧と再生 | 不要。ただし WebDAV の設定は別途必要 |
| ローカルオフラインダウンロード | 不要 |
| ローカルオフラインダウンロード通知 | 不要 |
| リモートダウンロード完了または失敗通知 | 必要 |
| 長時間データが流れていないタスクの通知 | 必要 |
| ダウンロードサーバーのオフラインまたは復帰通知 | 必要 |
| yt-dlp ダウンロード | 必要 |
| yt-dlp Cookie 管理 | 必要 |
| 他のアプリから共有したメディア URL を QiuyuRemote でリモート yt-dlp ダウンロード | 必要 |

## Free プランと Pro

QiuyuRemote は、無料アプリと任意のアプリ内課金を組み合わせる設計です。Free プランでは基本的な直接接続のダウンロード管理を使えるようにし、Pro は高度な機能を解除するためのものです。アプリ起動時に全体をロックする方式ではありません。

購入状態は StoreKit 2 で検証します。QiuyuRemote は起動時に現在の App Store entitlement を確認し、取引更新を監視します。設定の Subscription セクションから購入を復元することもできます。

QiuyuRemote はローカル Keychain にランダムな購入デバイス ID を作成します。これは Apple ID、APNs token、PushAgent ID、ダウンロードサーバーの認証情報ではありません。将来サーバー側の有効化台数制限を追加する場合、サーバーは編集可能な "Home Agent" などの名前ではなく、検証済み App Store 購入取引とこのデバイス ID を結び付けるべきです。

Pro 状態と Push Agent のペアリングは別のものです。Pro を購入しても Agent は自動ペアリングされず、Agent をペアリングしても Pro 購入が存在する証明にはなりません。

## サーバー

サーバーがまだない場合、最初の画面にサーバー追加の入口が表示されます。

すでにサーバーがある場合、新しいサーバーの追加はサーバーメニュー内にあります。

- iPhone では、上部のサーバー名をタップするとサーバーを切り替えられます。サーバー名を長押しすると New、Edit、Delete のサーバーメニューが開きます。
- iPhone の横スクロールのサーバーカードでもサーバーを切り替えられます。カードを長押しすると編集または削除できます。
- iPad または Mac では、サーバー名をタップするとサーバーを切り替えられます。iPad ではサーバー名を長押し、Mac では右クリックすると New、Edit、Delete が開きます。
- 折りたたまれたサイドバーでは、設定ボタンの下にあるプラスボタンを使います。
- サーバー行またはアイコンを右クリック/長押しして、そのサーバーを編集または削除できます。

QiuyuRemote からサーバーを削除しても、アプリに保存された接続設定が削除されるだけです。ダウンロードサーバー上のタスクやファイルは削除されません。

対応サーバー種別：

- Transmission：Transmission RPC に接続します。
- aria2：aria2 JSON-RPC に接続します。
- qBittorrent：qBittorrent Web UI API に接続します。
- yt-dlp：PushAgent の `v1/ytdlp` API に接続します。yt-dlp はサーバー上で実行され、iPhone や Mac 上では実行されません。

## ダウンロードの追加

ホーム画面の追加ボタンからタスクを追加します。

- qBittorrent と Transmission は magnet リンクと `.torrent` ファイル向けです。
- aria2 は通常の HTTP/HTTPS ファイル URL、metalink、magnet、torrent を扱えます。実際の対応範囲は aria2 の設定に依存します。
- yt-dlp は YouTube、TikTok、Bilibili、Instagram、X、Threads など、yt-dlp が対応するサイトの HTTP/HTTPS メディアページ URL を受け付けます。

iPhone と iPad では、他のアプリから URL を QiuyuRemote に共有できます。yt-dlp 共有を使うには、先に yt-dlp PushAgent サーバーを追加して接続してください。iOS の制限により、QiuyuRemote を開いてから送信が完了する場合があります。

## URL Scheme とショートカット

QiuyuRemote は `qiuyuremote://` URL Scheme を登録しています。ショートカットや他のアプリからダウンロード URL を送信できます。

基本例：

```text
qiuyuremote://addTask?url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=ytdlp&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID
```

`addTask` は既定で現在選択中のサーバーを使います。`type=aria2`、`type=qbit`、`type=transmission`、`type=ytdlp` を追加すると、最初に一致した種類のサーバーを使います。`server=<サーバー名または UUID>` を追加すると、保存済みの特定サーバーを指定できます。

`autoAdd=true` が既定です。`autoAdd=false` にすると、QiuyuRemote は URL を入力済みの Add Download シートを開き、送信前にオプションを調整できます。

互換性ルールは通常の追加画面と同じです。

- qBittorrent と Transmission は magnet リンクまたは `.torrent` URL を受け付けます。
- aria2 は通常のファイル URL、magnet、torrent を受け付けます。実際の対応範囲は aria2 の設定に依存します。
- yt-dlp は HTTP/HTTPS のメディアページ URL を受け付け、設定済みの yt-dlp PushAgent サーバーが必要です。

ショートカットでは `x-callback-url` も使えます。

```text
qiuyuremote://x-callback-url/addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip&x-success=shortcuts%3A%2F%2F&x-error=shortcuts%3A%2F%2F
```

成功時、`x-success` には `count`、`gid`、`gids` が渡されます。送信された 1 件のタスクでは `count` は `1` です。各ダウンロードサービスでタスク ID の返し方が統一されていないため、`gid` と `gids` は現在空です。将来、特定サービスで安定して ID を返せる場合に正確な値を追加します。失敗時、`x-error` には `errorCode` と `errorMessage` が渡されます。

`url`、`x-success`、`x-error` の値は必ず URL エンコードしてください。特にダウンロード URL 自体に `?`、`&`、非 ASCII 文字が含まれる場合は重要です。

## タスクリスト

既定の並び順は日常利用向けです。

- アクティブまたはダウンロード中のタスクが上に表示されます。
- 完了済みタスクはアクティブなタスクの後に表示されます。
- 新しく完了したタスクは古い完了タスクより上に表示されます。
- 列ヘッダーで手動ソートした場合は、その列ソートが優先されます。

iPad と Mac では、表ヘッダーの境界をドラッグして列幅を変更できます。Name 列は長いタスク名を見やすくするため、より広くできます。

yt-dlp タスクでは、アップロード速度、アップロード済みサイズ、Seeds、Leeches、Ratio など torrent 専用の項目は非表示になります。

## タスク操作

タスクを選択すると詳細を表示できます。タスクを長押しまたは右クリックすると操作メニューが開きます。

- 再開または一時停止
- 削除
- 名前、元リンク、パスのコピー
- 対応サービスでのダウンロード/アップロード速度制限
- 対応サービスでの共有率制限
- 対応サービスでの強制再チェック

qBittorrent と Transmission のタスクが自動ルールで停止した場合、再開時に選択肢が表示されます。

- Continue：現在のルールを維持します。後でまた自動停止する可能性があります。
- Disable Rules and Continue：このタスクを停止させたルールだけを解除して続行します。
- Not Now：現在の状態を維持します。

aria2 の再開はより単純です。aria2 に十分なタスク情報が残っていれば、QiuyuRemote は aria2 に再開または再追加を依頼します。完了済みタスクでは Resume は無効表示になります。

削除時、Remove Task Only はダウンロード済みファイルを残します。Remove Task And Downloaded Files は、対応サービスにローカルデータの削除も依頼します。aria2 RPC はタスクと履歴を削除できますが、完了済みファイルをディスクから確実に削除することはできません。

## ファイル、WebDAV、オフラインライブラリ

ダウンロードサービスがファイル情報を返す場合、タスク詳細にファイル一覧が表示されます。

WebDAV は任意機能です。ダウンロードディレクトリが WebDAV で公開されている場合、グローバルまたはサーバーごとに WebDAV を設定できます。QiuyuRemote はファイルを閲覧し、外部プレイヤーへ再生 URL を渡せます。

オフラインライブラリは現在のデバイスにのみ保存されます。オフラインファイルは iCloud で同期されません。ローカルオフラインダウンロード通知は QiuyuRemote が直接送信し、Push Agent は不要です。

ディスク上にはファイルがあるのに WebDAV に表示されない場合は、OpenList などの WebDAV プロバイダーを更新するか、インデックス/キャッシュ更新を待ってください。

## 通知

システム通知権限は iOS、iPadOS、macOS が管理します。

- ローカルオフラインダウンロード通知は QiuyuRemote 自身が送信します。
- リモート qBittorrent、Transmission、aria2 タスク通知には、ダウンロードサーバー上で動作しペアリング済みの Push Agent が必要です。
- yt-dlp タスク通知も Push Agent から届きます。
- Push Relay テスト通知は、このデバイスが Push Relay/APNs 経由で通知を受け取れるかだけを確認します。サーバー Push Agent がペアリング済みまたは稼働中であることは保証しません。

リモートダウンロード通知を受け取る手順：

1. QiuyuRemote で通知を有効にします。
2. QiuyuRemote で Agent ペアリングコードを生成します。
3. サーバー上の PushAgent Web ページを開きます。
4. ペアリングコードを入力して Agent をペアリングします。
5. PushAgent をサーバー上で起動し続けます。

## yt-dlp と Cookie

yt-dlp ダウンロードは PushAgent 上で実行されます。QiuyuRemote は URL を送信し、Agent が返すタスク状態を表示します。

Cookie 管理は yt-dlp PushAgent サーバーごとに分離されています。Cookie は選択中の PushAgent に直接アップロードされ、そのサーバーに保存されます。Push Relay には送信されず、iCloud 同期もされず、ログにも書き込まれません。

ブラウザーからエクスポートした Netscape 形式の `cookies.txt` を使ってください。Cookie はサイトのログイン資格情報に相当するため、他人と共有しないでください。

YouTube などのサイトでログインまたは Cookie が必要と表示される場合は、Cookie 管理で該当サイトの Cookie をインポートまたは更新してください。YouTube では、yt-dlp の更新、ffmpeg、Deno などの JavaScript ランタイムが現在の署名チャレンジ処理に必要になることもあります。

## 同期とプライバシー

サーバー設定とアプリ設定は iCloud で同期できます。パスワードと token は iCloud Keychain を使います。ダウンロード済みファイルとオフラインライブラリは同期されません。

プライバシー保護を有効にしている場合、Face ID、Touch ID、またはデバイスパスコードは Apple のシステム認証 UI が処理します。

## トラブルシューティング

- 直接接続のダウンロードサービスに接続できない場合、アドレス、ポート、パス、SSL、ユーザー名、パスワード、token、現在のネットワークから到達できるかを確認してください。
- qBittorrent は Web UI のルート URL を使います。`/api/v2` は手動で追加しないでください。
- Transmission は通常 `/transmission/rpc` の RPC エンドポイントを使います。
- aria2 は JSON-RPC エンドポイントを使います。secret を設定している場合は token も入力します。
- yt-dlp は PushAgent の `v1/ytdlp` エンドポイントに接続します。Agent に `apiKey` を設定している場合、アプリにも同じ API Key を入力してください。
- リモート通知が届かない場合、通知権限、集中モード、Push Relay 登録、Agent ペアリング、PushAgent の稼働状態を確認してください。
- WebDAV で再生できない、またはファイルが見つからない場合、WebDAV パスが実際のダウンロードディレクトリに対応しているか確認し、WebDAV サービスを更新してください。
