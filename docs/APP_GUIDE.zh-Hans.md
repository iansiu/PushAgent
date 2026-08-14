# QiuyuRemote App 使用指南

语言：[English](../APP_GUIDE.md) | 简体中文 | [繁體中文](APP_GUIDE.zh-Hant.md) | [日本語](APP_GUIDE.ja.md) | [한국어](APP_GUIDE.ko.md) | [Русский](APP_GUIDE.ru.md)

> **生产版状态：** QiuyuRemote 的 App Store 正式版不包含 ~~yt-dlp~~ 集成或 Cookie 管理。下面保留的 ~~yt-dlp~~ 章节用于内部构建和已有 PushAgent 部署。

QiuyuRemote 可以只作为直接连接下载器的管理工具使用，也可以配合 Push Agent 获得服务器后台通知和 ~~yt-dlp~~ 能力。

## 基础模式和 Agent 模式

不配置 Push Agent，QiuyuRemote 依然可以直接管理已有的 qBittorrent、Transmission 和 aria2。App 会直接连接这些下载服务自己的 Web API 或 RPC 接口。

Push Agent 只用于服务器端后台能力：

| 功能 | 是否需要 Push Agent |
| --- | --- |
| 管理 qBittorrent、Transmission、aria2 任务 | 不需要 |
| 添加、暂停、继续、删除、限速、查看 qBittorrent、Transmission、aria2 任务详情 | 不需要 |
| WebDAV 文件浏览和播放 | 不需要，但需要单独配置 WebDAV |
| 本地离线下载 | 不需要 |
| 本地离线下载通知 | 不需要 |
| 远程下载完成或失败通知 | 需要 |
| 长时间无数据任务提醒 | 需要 |
| 下载服务器离线或恢复通知 | 需要 |
| <del>yt-dlp 下载</del> | <del>需要</del> |
| <del>yt-dlp Cookie 管理</del> | <del>需要</del> |
| <del>从其它 App 分享视频链接到 QiuyuRemote 后远程 yt-dlp 下载</del> | <del>需要</del> |

## 免费版和 Pro 版

QiuyuRemote 可以免费下载和使用。免费版适合基础远程下载管理：你可以连接已有的 qBittorrent、Transmission 或 aria2 服务器，查看任务，添加下载，暂停、继续或删除任务。

Pro 版适合需要更完整远程管理能力的用户。购买 Pro 后，可以解锁：

- ~~yt-dlp~~ 下载
- ~~yt-dlp~~ Cookie 管理，用于需要登录的网站内容
- 通过 Push Agent 接收远程下载通知
- iCloud 同步服务器配置和 App 设置
- 离线库和离线任务管理
- WebDAV 播放和文件访问
- 下载完成通知
- 高级服务器设置
- 使用 ~~yt-dlp~~ 服务，并混用 aria2/qBittorrent/Transmission，而不是只能使用一种直连下载服务类型

Pro 状态和 Push Agent 配对是两件事。购买 Pro 不会自动完成 Agent 配对，完成 Agent 配对也不代表存在 Pro 购买。

## 服务器

没有任何服务器时，首页会显示添加服务器入口。

已经添加过服务器之后，新增服务器入口会放在服务器菜单里：

- iPhone 上，点击顶部服务器名称可以切换服务器。长按服务器名称会打开服务器菜单，里面有新建、编辑、删除。
- iPhone 上，横向服务器卡片可以切换服务器。长按某个服务器卡片可以编辑或删除。
- iPad 或 Mac 上，点击服务器名称可以切换服务器；iPad 长按服务器名称，Mac 右键点击服务器名称，可以打开新建、编辑、删除。
- 折叠侧边栏时，使用设置按钮下面的加号按钮。
- 右键或长按服务器行/图标可以编辑或删除该服务器。

从 QiuyuRemote 删除服务器，只会删除 App 里保存的连接配置，不会删除下载服务器上的任务或文件。

支持的服务器类型：

- Transmission：连接 Transmission RPC。
- aria2：连接 aria2 JSON-RPC。
- qBittorrent：连接 qBittorrent Web UI API。
- ~~yt-dlp~~：连接 PushAgent 的 `v1/ytdlp` API。~~yt-dlp~~ 在服务器上运行，不在手机或 Mac 上运行。

## 添加下载

首页的添加按钮用于新增下载任务。

- qBittorrent 和 Transmission 适合磁力链接和 `.torrent` 文件。
- aria2 可以处理普通 HTTP/HTTPS 文件链接、metalink、磁力链接和种子，具体取决于 aria2 配置。
- ~~yt-dlp~~ 接收 HTTP/HTTPS 媒体页面链接，例如 YouTube、TikTok、Bilibili、Instagram、X、Threads，以及其它 ~~yt-dlp~~ 支持的网站。

iPhone 和 iPad 上，可以从其它 App 分享链接到 QiuyuRemote。~~yt-dlp~~ 分享需要先添加并连接 ~~yt-dlp~~ PushAgent 服务。受 iOS 系统限制，有时需要打开 QiuyuRemote 后才会完成提交。

## URL Scheme 和快捷指令

QiuyuRemote 注册了 `qiuyuremote://` URL Scheme，快捷指令或其它 App 可以通过它提交下载链接。

基础示例：

```text
qiuyuremote://addTask?url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=ytdlp&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID
```

`addTask` 默认使用当前选中的服务器。可以加 `type=aria2`、`type=qbit`、`type=transmission` 或 `type=ytdlp`，使用第一个匹配类型的服务器。也可以加 `server=<服务器名称或 UUID>`，指定某个已保存的服务器。

`autoAdd=true` 是默认值。设置 `autoAdd=false` 时，QiuyuRemote 会打开添加下载窗口并填入链接，方便你先调整参数再提交。

兼容规则仍然生效：

- qBittorrent 和 Transmission 接收磁力链接或 `.torrent` 链接。
- aria2 可以接收普通文件链接、磁力链接和种子，具体取决于 aria2 配置。
- ~~yt-dlp~~ 接收 HTTP/HTTPS 媒体页面链接，并且需要先配置 ~~yt-dlp~~ PushAgent 服务。

快捷指令也可以使用 `x-callback-url`：

```text
qiuyuremote://x-callback-url/addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip&x-success=shortcuts%3A%2F%2F&x-error=shortcuts%3A%2F%2F
```

成功时，`x-success` 会收到 `count`、`gid`、`gids`。当前提交一个任务时 `count` 为 `1`；由于各下载服务返回任务 ID 的方式不统一，`gid` 和 `gids` 目前为空，后续如果某个服务能稳定返回任务 ID，再补精确值。失败时，`x-error` 会收到 `errorCode` 和 `errorMessage`。

请始终对 `url`、`x-success`、`x-error` 的值做 URL 编码，尤其是下载链接本身带有 `?`、`&` 或非 ASCII 字符时。

## 任务列表

默认排序适合日常查看：

- 活跃或下载中的任务会靠前。
- 已完成任务排在活跃任务之后。
- 新完成的任务会排在旧完成任务上面。
- 如果手动点击某个列头排序，手动排序优先，不再强制使用默认分组。

iPad 和 Mac 上，可以拖动表头分隔线调整列宽。名称列支持拉到更宽，方便查看长任务名。

~~yt-dlp~~ 任务会隐藏上传速度、上传大小、种子、下载者、分享率等种子任务字段。

## 任务状态映射

QiuyuRemote 在任务列表里显示的是归一化后的 App 状态。下载服务有返回原始状态时，App 仍会尽量保留。App 会综合归一化状态、原始状态、进度、传输速度和自动规则提示；例如一个已经完成、但因为分享率或无活动规则停止的种子，可能显示为“已停止”并带有任务提示，而不是只显示“已完成”。

| 下载服务 | 服务状态或条件 | App 显示状态 |
| --- | --- | --- |
| qBittorrent | `error`、`missingFiles` | 错误 |
| qBittorrent | `pausedUP`、`stoppedUP`、`stalledUP`、`queuedUP` | 已完成；如果有自动规则提示，会显示为已停止 |
| qBittorrent | 包含 `paused`，或 `stoppedDL` | 已暂停 |
| qBittorrent | 包含 `queued` | 等待中 |
| qBittorrent | 包含 `checking`、`metadata`、`allocating`，以及 `filesChecked`、`metadataReceived` | 校验中或处理中 |
| qBittorrent | 包含 `uploading` 或 `forcedUP` | 做种中 |
| qBittorrent | 包含 `stalled` | 停滞 |
| qBittorrent | 包含 `downloading` 或 `forcedDL` | 下载中 |
| qBittorrent | `moving` | 正在整理文件 |
| Transmission | `error > 0` | 错误 |
| Transmission | `0` | 已停止；如果进度已完成，QiuyuRemote 会按已完成处理，除非存在自动规则提示 |
| Transmission | `1`、`2` | 校验中 |
| Transmission | `3`、`4` | 下载中 |
| Transmission | `5`、`6` | 做种中 |
| aria2 | `active` | 下载中 |
| aria2 | `waiting` | 等待中 |
| aria2 | `paused` | 已暂停 |
| aria2 | `error` | 错误 |
| aria2 | `complete` | 已完成；如果有自动规则提示，会显示为已停止 |
| aria2 | `removed` | 已移除 |
| <del>yt-dlp</del> | <del>`downloading`、`running`</del> | <del>下载中</del> |
| <del>yt-dlp</del> | <del>`postprocessing`、`processing`、`merge`、`fixup`、`metadata`、`extract`、`remux`、`convert`</del> | <del>处理中</del> |
| <del>yt-dlp</del> | <del>`moving`</del> | <del>正在整理文件</del> |
| <del>yt-dlp</del> | <del>`completed`</del> | <del>已完成</del> |
| <del>yt-dlp</del> | <del>`failed`、`error`、`lost`</del> | <del>错误</del> |
| <del>yt-dlp</del> | <del>`paused`</del> | <del>已暂停</del> |
| <del>yt-dlp</del> | <del>`queued`</del> | <del>等待中</del> |

其它无法识别的状态会直接显示下载服务返回的原始状态；如果服务返回空状态，则显示为未知。

## 任务操作

点击任务可以查看详情。长按或右键任务可以打开任务菜单：

- 继续或暂停
- 删除
- 复制名称、来源链接或路径
- 设置下载或上传限速，取决于服务是否支持
- 设置分享率，取决于服务是否支持
- 强制校验，取决于服务是否支持

qBittorrent 和 Transmission 任务如果因为自动规则停止，点击继续时会出现选择：

- 继续：保留当前规则，后续可能再次自动停止。
- 解除规则并继续：只解除当前任务触发的限制，然后继续。
- 暂不：保持当前状态。

aria2 的继续逻辑更简单。如果 aria2 还保留足够的任务信息，QiuyuRemote 会请求 aria2 继续或重新启动任务。已完成任务的继续按钮会显示为不可用。

删除任务时，仅移除任务会保留已下载文件。移除任务和已下载文件会请求服务器同时删除本地数据，但需要下载服务支持。aria2 RPC 可以移除任务和历史，但不能可靠删除磁盘上的已完成文件。

## 文件、WebDAV 和离线库

如果下载服务返回文件信息，任务详情里会显示文件列表。

WebDAV 是可选功能。如果下载目录通过 WebDAV 暴露，可以在全局或单个服务器里配置 WebDAV。QiuyuRemote 可以浏览文件，并把播放链接交给外部播放器。

离线库只保存在当前设备。离线文件不会通过 iCloud 同步。本地离线下载通知由 QiuyuRemote 直接发送，不需要 Push Agent。

如果磁盘上已经有文件，但 WebDAV 里还看不到，请刷新 WebDAV 服务，例如 OpenList，或等待它的索引/缓存更新。

## 第三方播放器

开启“允许使用第三方播放器”后，QiuyuRemote 可以把视频播放链接交给已安装并支持 URL Scheme 的播放器。

远程或 WebDAV 播放目前支持以下快捷操作：

- iPhone 和 iPad：nPlayer、Infuse、VidHub、Fileball、SenPlayer、Forward。
- Mac Catalyst：IINA、Infuse、VidHub、SenPlayer、nPlayer、Fileball、Forward。

QiuyuRemote 会先检测设备上已经安装的播放器，再显示快捷操作。对于私有 WebDAV 或 OpenList 文件，App 会优先使用可用的直链，也可能在播放器需要时生成临时本地代理播放链接。TMDB 显示标题和字幕链接只会在对应播放器的 URL Scheme 支持时传递。

离线库本地文件的快捷播放器操作目前只支持 Mac Catalyst。iPhone 和 iPad 上可以使用“用其它播放器打开”或系统分享菜单打开本地离线文件。

## 通知

系统通知权限由 iOS、iPadOS 或 macOS 控制。

- 本地离线下载通知由 QiuyuRemote 自己发送。
- 远程 qBittorrent、Transmission、aria2 任务通知需要下载服务器上运行并已配对的 Push Agent。
- ~~yt-dlp~~ 任务通知也来自 Push Agent。
- Push Relay 测试通知只验证这台设备能通过 Push Relay/APNs 收到通知，不代表服务器 Push Agent 已经配对或正在运行。

接收远程下载通知的步骤：

1. 在 QiuyuRemote 开启通知。
2. 在 QiuyuRemote 生成 Agent 配对码。
3. 打开服务器上的 PushAgent 网页。
4. 输入配对码并完成 Agent 配对。
5. 保持 PushAgent 在服务器上运行。

## <del>yt-dlp 和 Cookie</del>

~~yt-dlp~~ 下载在 PushAgent 上执行。QiuyuRemote 只提交链接，并显示 Agent 返回的任务状态。

Cookie 管理按每个 ~~yt-dlp~~ PushAgent 服务隔离。Cookie 会直接上传到选中的 PushAgent 并保存在服务器上，不会发送到 Push Relay，不会通过 iCloud 同步，也不会写入日志。

请使用浏览器导出的 Netscape 格式 `cookies.txt` 文件。Cookie 相当于网站登录凭据，请不要分享给他人。

桌面浏览器可以使用 `Get cookies.txt LOCALLY` 插件；如果浏览器支持，它可以导出标准 Netscape 格式的 Cookie 文件。iOS 上可以使用 Microsoft Edge 浏览器配合 `Cookie-Editor` 插件，在插件设置里把 Export Format 设置为 `Netscape`，将当前网站 Cookie 复制到剪贴板，然后运行 `Create a new cookie file` 捷径：`https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`。这个捷径会在 `On My iPhone/Downloads` 目录生成 Cookie 文件，之后可以直接在 QiuyuRemote 里导入。

每个 ~~yt-dlp~~ 任务使用 Cookie 的优先级是：任务单独指定的 cookies path、QiuyuRemote 中导入的对应站点 Cookie、PushAgent `config.json` 里的备用 `cookiesPath`。因此，App 里导入的站点 Cookie 优先级高于配置文件。

QiuyuRemote 中显示的 Cookie 有效期只是根据 Cookie 文件估算。实际能否继续使用还会受到退出登录、修改密码、账号安全检查、服务器 IP/地区变化、网站主动失效、限流，以及 ~~yt-dlp~~ 解析器变化等因素影响。

如果 YouTube 或其它网站提示需要登录或 Cookie，请在 Cookie 管理中导入或更新对应站点 Cookie。YouTube 还可能需要更新 ~~yt-dlp~~、安装 ffmpeg，以及配置 Deno 等 JavaScript 运行时来处理当前的签名挑战。

## 同步和隐私

服务器配置和 App 偏好可以通过 iCloud 同步。密码和 token 使用 iCloud 钥匙串。已下载文件和离线库内容不会同步。

如果开启隐私保护，Face ID、Touch ID 或设备密码由 Apple 系统认证界面处理。

## 排查

- 直连下载服务失败时，检查地址、端口、路径、SSL、用户名、密码、token，以及当前网络是否能访问该服务。
- qBittorrent 使用 Web UI 根地址，不要手动追加 `/api/v2`。
- Transmission 使用 RPC 地址，通常是 `/transmission/rpc`。
- aria2 使用 JSON-RPC 地址，如果配置了 secret，需要填写 token。
- ~~yt-dlp~~ 连接 PushAgent 的 `v1/ytdlp` 端点；如果 Agent 配置了 `apiKey`，App 里也要填写同一个 API Key。
- 远程通知收不到时，检查系统通知权限、勿扰/专注模式、Push Relay 注册状态、Agent 配对状态，以及 PushAgent 是否正在运行。
- WebDAV 不能播放或找不到文件时，确认 WebDAV 路径是否对应真实下载目录，并刷新 WebDAV 服务。
