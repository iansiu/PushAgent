# QiuyuRemote App 使用指南

語言：[English](../APP_GUIDE.md) | [简体中文](APP_GUIDE.zh-Hans.md) | 繁體中文 | [日本語](APP_GUIDE.ja.md) | [한국어](APP_GUIDE.ko.md) | [Русский](APP_GUIDE.ru.md)

QiuyuRemote 可以只作為直接連接下載器的管理工具使用，也可以搭配 Push Agent 取得伺服器背景通知和 yt-dlp 能力。

## 基礎模式和 Agent 模式

不配置 Push Agent，QiuyuRemote 依然可以直接管理既有的 qBittorrent、Transmission 和 aria2。App 會直接連接這些下載服務自己的 Web API 或 RPC 端點。

Push Agent 只用於伺服器端背景能力：

| 功能 | 是否需要 Push Agent |
| --- | --- |
| 管理 qBittorrent、Transmission、aria2 任務 | 不需要 |
| 新增、暫停、繼續、刪除、限速、查看 qBittorrent、Transmission、aria2 任務詳情 | 不需要 |
| WebDAV 檔案瀏覽與播放 | 不需要，但需要另外配置 WebDAV |
| 本地離線下載 | 不需要 |
| 本地離線下載通知 | 不需要 |
| 遠端下載完成或失敗通知 | 需要 |
| 長時間無資料任務提醒 | 需要 |
| 下載伺服器離線或恢復通知 | 需要 |
| yt-dlp 下載 | 需要 |
| yt-dlp Cookie 管理 | 需要 |
| 從其它 App 分享影片連結到 QiuyuRemote 後遠端 yt-dlp 下載 | 需要 |

## 免費版和 Pro 版

QiuyuRemote 可以免費下載和使用。免費版適合基礎遠端下載管理：你可以連接既有的 qBittorrent、Transmission 或 aria2 伺服器，查看任務，新增下載，暫停、繼續或刪除任務。

Pro 版適合需要更完整遠端管理能力的使用者。購買 Pro 後，可以解鎖：

- yt-dlp 下載
- yt-dlp Cookie 管理，用於需要登入的網站內容
- 透過 Push Agent 接收遠端下載通知
- iCloud 同步伺服器配置和 App 設定
- 離線庫和離線任務管理
- WebDAV 播放和檔案存取
- 下載完成通知
- 進階伺服器設定
- 使用 yt-dlp 服務，並混用 aria2/qBittorrent/Transmission，而不是只能使用一種直連下載服務類型

Pro 狀態和 Push Agent 配對是兩件事。購買 Pro 不會自動完成 Agent 配對，完成 Agent 配對也不代表存在 Pro 購買。

## 伺服器

沒有任何伺服器時，首頁會顯示新增伺服器入口。

已經新增過伺服器之後，新增伺服器入口會放在伺服器選單裡：

- iPhone 上，點擊頂部伺服器名稱可以切換伺服器。長按伺服器名稱會開啟伺服器選單，裡面有新建、編輯、刪除。
- iPhone 上，橫向伺服器卡片可以切換伺服器。長按某個伺服器卡片可以編輯或刪除。
- iPad 或 Mac 上，點擊伺服器名稱可以切換伺服器；iPad 長按伺服器名稱，Mac 右鍵點擊伺服器名稱，可以開啟新建、編輯、刪除。
- 折疊側邊欄時，使用設定按鈕下面的加號按鈕。
- 右鍵或長按伺服器列/圖示可以編輯或刪除該伺服器。

從 QiuyuRemote 刪除伺服器，只會刪除 App 裡保存的連線配置，不會刪除下載伺服器上的任務或檔案。

支援的伺服器類型：

- Transmission：連接 Transmission RPC。
- aria2：連接 aria2 JSON-RPC。
- qBittorrent：連接 qBittorrent Web UI API。
- yt-dlp：連接 PushAgent 的 `v1/ytdlp` API。yt-dlp 在伺服器上執行，不在手機或 Mac 上執行。

## 新增下載

首頁的新增按鈕用於建立下載任務。

- qBittorrent 和 Transmission 適合磁力連結和 `.torrent` 檔案。
- aria2 可以處理一般 HTTP/HTTPS 檔案連結、metalink、磁力連結和種子，具體取決於 aria2 配置。
- yt-dlp 接收 HTTP/HTTPS 媒體頁面連結，例如 YouTube、TikTok、Bilibili、Instagram、X、Threads，以及其它 yt-dlp 支援的網站。

iPhone 和 iPad 上，可以從其它 App 分享連結到 QiuyuRemote。yt-dlp 分享需要先新增並連接 yt-dlp PushAgent 服務。受 iOS 系統限制，有時需要開啟 QiuyuRemote 後才會完成提交。

## URL Scheme 和捷徑

QiuyuRemote 註冊了 `qiuyuremote://` URL Scheme，捷徑或其它 App 可以透過它提交下載連結。

基本範例：

```text
qiuyuremote://addTask?url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=ytdlp&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID
```

`addTask` 預設使用目前選中的伺服器。可以加 `type=aria2`、`type=qbit`、`type=transmission` 或 `type=ytdlp`，使用第一個符合類型的伺服器。也可以加 `server=<伺服器名稱或 UUID>`，指定某個已儲存的伺服器。

`autoAdd=true` 是預設值。設定 `autoAdd=false` 時，QiuyuRemote 會開啟新增下載視窗並填入連結，方便你先調整參數再提交。

相容規則仍然生效：

- qBittorrent 和 Transmission 接收磁力連結或 `.torrent` 連結。
- aria2 可以接收一般檔案連結、磁力連結和種子，具體取決於 aria2 配置。
- yt-dlp 接收 HTTP/HTTPS 媒體頁面連結，並且需要先配置 yt-dlp PushAgent 服務。

捷徑也可以使用 `x-callback-url`：

```text
qiuyuremote://x-callback-url/addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip&x-success=shortcuts%3A%2F%2F&x-error=shortcuts%3A%2F%2F
```

成功時，`x-success` 會收到 `count`、`gid`、`gids`。目前提交一個任務時 `count` 為 `1`；由於各下載服務回傳任務 ID 的方式不統一，`gid` 和 `gids` 目前為空，後續如果某個服務能穩定回傳任務 ID，再補精確值。失敗時，`x-error` 會收到 `errorCode` 和 `errorMessage`。

請始終對 `url`、`x-success`、`x-error` 的值做 URL 編碼，尤其是下載連結本身帶有 `?`、`&` 或非 ASCII 字元時。

## 任務列表

預設排序適合日常查看：

- 活躍或下載中的任務會靠前。
- 已完成任務排在活躍任務之後。
- 新完成的任務會排在舊完成任務上面。
- 如果手動點擊某個欄位排序，手動排序優先，不再強制使用預設分組。

iPad 和 Mac 上，可以拖動表頭分隔線調整欄寬。名稱欄支援拉到更寬，方便查看長任務名。

yt-dlp 任務會隱藏上傳速度、上傳大小、種子、下載者、分享率等種子任務欄位。

## 任務狀態映射

QiuyuRemote 在任務列表裡顯示的是歸一化後的 App 狀態。下載服務有回傳原始狀態時，App 仍會盡量保留。App 會綜合歸一化狀態、原始狀態、進度、傳輸速度和自動規則提示；例如一個已經完成、但因為分享率或無活動規則停止的種子，可能顯示為「已停止」並帶有任務提示，而不是只顯示「已完成」。

| 下載服務 | 服務狀態或條件 | App 顯示狀態 |
| --- | --- | --- |
| qBittorrent | `error`、`missingFiles` | 錯誤 |
| qBittorrent | `pausedUP`、`stoppedUP`、`stalledUP`、`queuedUP` | 已完成；如果有自動規則提示，會顯示為已停止 |
| qBittorrent | 包含 `paused`，或 `stoppedDL` | 已暫停 |
| qBittorrent | 包含 `queued` | 等待中 |
| qBittorrent | 包含 `checking`、`metadata`、`allocating`，以及 `filesChecked`、`metadataReceived` | 校驗中或處理中 |
| qBittorrent | 包含 `uploading` 或 `forcedUP` | 做種中 |
| qBittorrent | 包含 `stalled` | 停滯 |
| qBittorrent | 包含 `downloading` 或 `forcedDL` | 下載中 |
| qBittorrent | `moving` | 正在整理檔案 |
| Transmission | `error > 0` | 錯誤 |
| Transmission | `0` | 已停止；如果進度已完成，QiuyuRemote 會按已完成處理，除非存在自動規則提示 |
| Transmission | `1`、`2` | 校驗中 |
| Transmission | `3`、`4` | 下載中 |
| Transmission | `5`、`6` | 做種中 |
| aria2 | `active` | 下載中 |
| aria2 | `waiting` | 等待中 |
| aria2 | `paused` | 已暫停 |
| aria2 | `error` | 錯誤 |
| aria2 | `complete` | 已完成；如果有自動規則提示，會顯示為已停止 |
| aria2 | `removed` | 已移除 |
| yt-dlp | `downloading`、`running` | 下載中 |
| yt-dlp | `postprocessing`、`processing`、`merge`、`fixup`、`metadata`、`extract`、`remux`、`convert` | 處理中 |
| yt-dlp | `moving` | 正在整理檔案 |
| yt-dlp | `completed` | 已完成 |
| yt-dlp | `failed`、`error`、`lost` | 錯誤 |
| yt-dlp | `paused` | 已暫停 |
| yt-dlp | `queued` | 等待中 |

其它無法識別的狀態會直接顯示下載服務回傳的原始狀態；如果服務回傳空狀態，則顯示為未知。

## 任務操作

點擊任務可以查看詳情。長按或右鍵任務可以開啟任務選單：

- 繼續或暫停
- 刪除
- 複製名稱、來源連結或路徑
- 設定下載或上傳限速，取決於服務是否支援
- 設定分享率，取決於服務是否支援
- 強制校驗，取決於服務是否支援

qBittorrent 和 Transmission 任務如果因為自動規則停止，點擊繼續時會出現選擇：

- 繼續：保留目前規則，後續可能再次自動停止。
- 解除規則並繼續：只解除目前任務觸發的限制，然後繼續。
- 暫不：保持目前狀態。

aria2 的繼續邏輯更簡單。如果 aria2 還保留足夠的任務資訊，QiuyuRemote 會請求 aria2 繼續或重新啟動任務。已完成任務的繼續按鈕會顯示為不可用。

刪除任務時，僅移除任務會保留已下載檔案。移除任務和已下載檔案會請求伺服器同時刪除本機資料，但需要下載服務支援。aria2 RPC 可以移除任務和歷史，但不能可靠刪除磁碟上的已完成檔案。

## 檔案、WebDAV 和離線庫

如果下載服務返回檔案資訊，任務詳情裡會顯示檔案列表。

WebDAV 是可選功能。如果下載目錄透過 WebDAV 暴露，可以在全域或單個伺服器裡配置 WebDAV。QiuyuRemote 可以瀏覽檔案，並把播放連結交給外部播放器。

離線庫只保存在目前裝置。離線檔案不會透過 iCloud 同步。本地離線下載通知由 QiuyuRemote 直接發送，不需要 Push Agent。

如果磁碟上已經有檔案，但 WebDAV 裡還看不到，請刷新 WebDAV 服務，例如 OpenList，或等待它的索引/快取更新。

## 通知

系統通知權限由 iOS、iPadOS 或 macOS 控制。

- 本地離線下載通知由 QiuyuRemote 自己發送。
- 遠端 qBittorrent、Transmission、aria2 任務通知需要下載伺服器上執行並已配對的 Push Agent。
- yt-dlp 任務通知也來自 Push Agent。
- Push Relay 測試通知只驗證這台裝置能透過 Push Relay/APNs 收到通知，不代表伺服器 Push Agent 已經配對或正在執行。

接收遠端下載通知的步驟：

1. 在 QiuyuRemote 開啟通知。
2. 在 QiuyuRemote 生成 Agent 配對碼。
3. 開啟伺服器上的 PushAgent 網頁。
4. 輸入配對碼並完成 Agent 配對。
5. 保持 PushAgent 在伺服器上執行。

## yt-dlp 和 Cookie

yt-dlp 下載在 PushAgent 上執行。QiuyuRemote 只提交連結，並顯示 Agent 返回的任務狀態。

Cookie 管理按每個 yt-dlp PushAgent 服務隔離。Cookie 會直接上傳到選中的 PushAgent 並保存在伺服器上，不會傳送到 Push Relay，不會透過 iCloud 同步，也不會寫入日誌。

請使用瀏覽器匯出的 Netscape 格式 `cookies.txt` 檔案。Cookie 相當於網站登入憑據，請不要分享給他人。

桌面瀏覽器可以使用 `Get cookies.txt LOCALLY` 外掛；如果瀏覽器支援，它可以匯出標準 Netscape 格式的 Cookie 檔案。iOS 上可以使用 Microsoft Edge 瀏覽器搭配 `Cookie-Editor` 外掛，在外掛設定裡把 Export Format 設為 `Netscape`，將目前網站 Cookie 複製到剪貼簿，然後執行 `Create a new cookie file` 捷徑：`https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`。這個捷徑會在 `On My iPhone/Downloads` 目錄產生 Cookie 檔案，之後可以直接在 QiuyuRemote 裡匯入。

每個 yt-dlp 任務使用 Cookie 的優先順序是：任務單獨指定的 cookies path、QiuyuRemote 中匯入的對應站點 Cookie、PushAgent `config.json` 裡的備用 `cookiesPath`。因此，App 裡匯入的站點 Cookie 優先級高於配置檔。

QiuyuRemote 中顯示的 Cookie 有效期只是根據 Cookie 檔案估算。實際能否繼續使用還會受到登出、修改密碼、帳號安全檢查、伺服器 IP/地區變化、網站主動失效、限流，以及 yt-dlp 解析器變化等因素影響。

如果 YouTube 或其它網站提示需要登入或 Cookie，請在 Cookie 管理中匯入或更新對應站點 Cookie。YouTube 還可能需要更新 yt-dlp、安裝 ffmpeg，以及配置 Deno 等 JavaScript 執行環境來處理目前的簽名挑戰。

## 同步和隱私

伺服器配置和 App 偏好可以透過 iCloud 同步。密碼和 token 使用 iCloud 鑰匙圈。已下載檔案和離線庫內容不會同步。

如果開啟隱私保護，Face ID、Touch ID 或裝置密碼由 Apple 系統認證介面處理。

## 排查

- 直連下載服務失敗時，檢查位址、連接埠、路徑、SSL、使用者名稱、密碼、token，以及目前網路是否能訪問該服務。
- qBittorrent 使用 Web UI 根位址，不要手動追加 `/api/v2`。
- Transmission 使用 RPC 位址，通常是 `/transmission/rpc`。
- aria2 使用 JSON-RPC 位址，如果配置了 secret，需要填寫 token。
- yt-dlp 連接 PushAgent 的 `v1/ytdlp` 端點；如果 Agent 配置了 `apiKey`，App 裡也要填寫同一個 API Key。
- 遠端通知收不到時，檢查系統通知權限、勿擾/專注模式、Push Relay 註冊狀態、Agent 配對狀態，以及 PushAgent 是否正在執行。
- WebDAV 不能播放或找不到檔案時，確認 WebDAV 路徑是否對應真實下載目錄，並刷新 WebDAV 服務。
