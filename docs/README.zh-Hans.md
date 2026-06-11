# QiuyuRemote Push Agent

语言：[English](../README.md) | 简体中文 | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Русский](README.ru.md)

公开仓库：<https://github.com/iansiu/PushAgent>

Push Agent 运行在你的下载服务器上，用来监控 qBittorrent、Transmission、aria2 和可选的 yt-dlp 任务，并把下载完成、下载失败、任务长时间无数据、服务器离线/恢复等事件发送到 Qiuyu's Push Relay。QiuyuRemote 收到这些事件后会显示系统通知。

Push Agent 很轻量：

- 不包含 APNs `.p8` 私钥。
- 不保存 APNs 设备 token。
- 不需要 PHP、MySQL、Nginx 或前端构建步骤。
- 默认使用 QiuyuRemote 内置的 Relay 地址：

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org` 只作为主 Relay 不可用时的备用地址。普通用户不需要自己填写 Relay 地址。

## 快速开始

### 1. 安装 Agent

在运行下载服务的服务器上安装 Node.js 18 或更新版本，然后克隆公开仓库：

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. 创建 `config.json`

```sh
cp config.example.json config.json
```

普通用户的配置顶部通常类似这样：

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

只把你真正使用的下载服务加入 `servers`。`config.example.json` 里已经提供 qBittorrent、Transmission、aria2、yt-dlp 模板，并且默认都是 `"enabled": false`。没有运行的服务保持禁用即可。

### 3. 配置下载服务

qBittorrent 示例：

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

Transmission 示例：

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

aria2 示例：

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

如果 aria2 使用 HTTPS 且证书是自签名或主机名不匹配，可以把该服务的 `allowInvalidTLS` 改成 `true`。建议保持 `liveEvents` 为 `true`，这样 aria2 很快完成的任务也更容易被实时捕获。

yt-dlp 示例：

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

先在服务器安装 yt-dlp。如果保留默认 `format` 为 `bv*+ba/b`，也建议安装 ffmpeg，因为很多网站会把视频和音频分开下载后再合并。诊断接口会显示 `ytDlpVersion`、`ffmpegAvailable`、`ffmpegVersion`。

一些网站，尤其是 YouTube，可能需要登录 Cookie。这不是 Push Agent 故障，而是 yt-dlp 需要认证。你可以从已登录的浏览器导出 Netscape 格式的 `cookies.txt`，上传到服务器，然后把 `cookiesPath` 设置为服务器上的绝对路径，例如：

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

一个 Netscape 格式 Cookie 文件可以包含多个域名的 Cookie，yt-dlp 会按 URL 自动使用对应域名的 Cookie。Cookie 文件请妥善保管，不要公开。

YouTube 还可能需要 yt-dlp 的外部 JavaScript 支持，用来解析签名和 `n` challenge。先安装 Deno，并确保当前 shell 和 systemd 都能找到它：

```bash
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
/usr/local/bin/deno --version
python3 -m pip install -U "yt-dlp[default]"
apt install -y ffmpeg
```

把 YouTube Cookie 上传到服务器，例如 `/root/PushAgent/cookies/youtube.txt`，然后先在服务器上测试单个视频链接。注意加上 `--no-playlist`，否则带 `list=` 的链接会展开整个播放列表：

```bash
chmod 600 /root/PushAgent/cookies/youtube.txt
yt-dlp -F \
  --no-playlist \
  --cookies /root/PushAgent/cookies/youtube.txt \
  --remote-components ejs:github \
  --js-runtimes deno:/usr/local/bin/deno \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

正常情况下输出里会出现 `[jsc:deno] Solving JS challenges using deno`，并列出 720p、1080p 等真实音视频格式。如果只看到 storyboard 图片格式，说明 yt-dlp、Deno 或 EJS 组件还没有正常工作。如果出现 `HTTP Error 429: Too Many Requests`，表示服务器 IP 被 YouTube 临时限流，需要稍后再试或配置 `proxy`。

测试成功后，把同样的参数写入 yt-dlp 服务配置：

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

修改配置后重启 Agent：

```bash
systemctl restart pushagent
```

### 4. 生成 Agent 配对码

在 QiuyuRemote 中：

1. 打开设置。
2. 打开下载完成通知。
3. 启用通知并允许系统通知权限。
4. 生成 Agent 配对码。

你会得到一个短的一次性代码，例如：

```text
MBGT-TB7S
```

### 5. 配对 Agent

第一次配置时，把配对码写入 `config.json`：

```json
"pairingCode": "MBGT-TB7S"
```

然后启动 Agent：

```sh
npm start
```

配对成功后，Agent 会把 Relay 身份保存到：

```text
data/relay-identity.json
```

配对成功后请清空旧配对码：

```json
"pairingCode": ""
```

配对码是一次性且有有效期的。如果旧配对码留在配置里，Agent 下次启动会再次尝试兑换，并显示已经使用过的提示。

### 6. 保持 Agent 运行

```sh
npm start
```

正式使用时建议使用 systemd 或其它进程管理器。下面有完整 systemd 示例。

## Web 控制台

Push Agent 自带一个简单的 Web 控制台：

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

它可以查看 Agent 状态、Relay 身份、下载服务诊断、配对设备、配对码记录、最近事件、测试通知和版本更新提示。全局设备、应用、中继节点等管理功能属于 Push Relay 后台。

## 添加更多设备

一个 Agent 可以同时通知多台 QiuyuRemote 设备。你不需要为每台 iPhone、iPad 或 Mac 分别运行一个 Agent。

最简单的方法：

1. 在新的 QiuyuRemote 设备上生成新的配对码。
2. 打开 Agent Web 控制台。
3. 在配对设备区域输入配对码。
4. 把新设备配对到已有 Agent。

也可以通过 API 配对：

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

也可以在启动前把多个新鲜配对码写进 `config.json`：

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

更清晰的数组写法也支持：

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

同一个配置里重复的配对码会被跳过。已使用、已过期或已撤销的配对码会在终端和 Web 控制台事件列表中显示清楚。

## API Key

`apiKey` 用来保护 Agent 的本地管理 API 和 Web 控制台操作。

如果 `apiKey` 为空：

- 来自 `127.0.0.1` 的请求会被允许。
- 远程浏览器或远程 API 请求会被拒绝。

如果其它设备需要访问 Agent 端口，建议生成随机 key：

```sh
openssl rand -hex 32
```

然后写入 `config.json`：

```json
"apiKey": "paste-the-random-key-here"
```

API 请求需要加：

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

在 Web 控制台里，在访问区域输入同一个 key。如果页面显示需要 API Key，说明当前浏览器不是从 Agent 本机访问，或者输入的 key 和 `config.json` 不一致。

## Relay 凭证

普通用户保持默认 Relay 地址即可：

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

除非你在做特殊部署，否则不要手动填写这些静态凭证字段：

- `relay.agentId`
- `relay.secret`

配对时 Push Relay 会返回 Agent ID 和签名密钥。Agent 会自动保存到 `data/relay-identity.json`。除非你在做特殊静态凭证部署，否则不要把 secret 复制到 `config.json`。

仅在开发或私有 Relay 测试时，才需要自定义 `relay.urls`：

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

特殊部署也可以使用静态 Relay 凭证：

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## 通知规则

Agent 会发送这些事件：

- 下载完成
- 下载失败
- 任务长时间没有接收到数据
- 受监控的下载服务离线
- 受监控的下载服务恢复在线
- 测试推送事件

初始扫描会被当作基线。Agent 第一次启动时已经存在的完成或失败任务不会触发新通知，之后发生的终态变化才会通知。

对于正在下载的任务，Agent 会记录任务最后一次出现下载速度或进度增长的时间。如果一个未完成任务在 `monitor.inactiveDownloadNoticeSeconds` 秒内没有任何数据，Agent 会发送一次 `download_inactive` 通知。只有该任务重新收到数据后，这个提醒状态才会重置，所以它不会每个轮询周期重复通知。

如果 Push Relay 接受了事件但没有任何设备收到通知，Agent 仍会把该任务记录为已经上报。这样当所有设备被禁用或还没有配对设备时，同一个完成/失败任务不会在每个轮询周期反复发送。

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `host` | Agent 监听地址。默认 `127.0.0.1`，只允许本机访问。只有在其它机器需要打开 Agent Web 控制台时才改成 `0.0.0.0`，并且应先设置 `apiKey`。 |
| `port` | Agent 端口，默认 `8765`。 |
| `apiKey` | 本地 API Key。只有本机访问可以留空；远程访问建议设置随机值。 |
| `pairingCode` | 单个配对码，或用逗号、空格、分号分隔多个配对码。配对成功后请清空。 |
| `pairingCodes` | 可选的多个配对码数组。 |
| `agentName` | Relay 上显示的 Agent 名称，例如 `Home Agent`。 |
| `dataDir` | Agent 存放 `relay-identity.json`、任务状态和服务状态的位置。 |
| `relay.urls` | Push Relay 地址。示例已经包含 Qiuyu 的主 Relay 和备用 Relay。 |
| `monitor.pollIntervalSeconds` | 下载服务轮询间隔，默认 `30` 秒，运行时最小值为 `10` 秒。 |
| `monitor.inactiveDownloadNoticeEnabled` | 是否在运行中的未完成任务长时间无数据时通知。默认 `true`。 |
| `monitor.inactiveDownloadNoticeSeconds` | 无数据阈值，默认 `1800` 秒，也就是 30 分钟。 |
| `updateCheck.enabled` | Agent Web 页面是否检查公开 PushAgent 新版本。默认 `true`。 |
| `updateCheck.repositoryURL` | Agent Web 页面打开的 GitHub 页面。 |
| `updateCheck.url` | 更新元数据地址，默认读取 GitHub 上公开 `package.json` 的版本号。 |
| `updateCheck.intervalSeconds` | 更新检查缓存间隔，默认 `3600` 秒。 |
| `updateCheck.timeoutSeconds` | 更新检查网络超时，默认 `4` 秒。 |
| `servers` | qBittorrent、Transmission、aria2、可选 yt-dlp 的连接配置。 |
| `servers[].name` | 显示名称，可随时修改。 |
| `servers[].type` | 下载服务类型。支持 `qbit`、`transmission`、`aria2`、`ytdlp`。 |
| `servers[].enabled` | 是否监控该服务。省略或设为 `true` 表示启用，设为 `false` 可保留模板但不监控。 |
| `servers[].username` / `servers[].password` | qBittorrent 和 Transmission 登录字段。不需要认证时留空。 |
| `servers[].token` | aria2 RPC secret token。不需要时留空。 |
| `servers[].allowInvalidTLS` | 是否允许该本地服务使用无效 TLS 证书，主要用于本地 aria2 HTTPS RPC。 |
| `servers[].liveEvents` | 仅 aria2。启用 WebSocket 终端事件通知，默认启用。 |
| `servers[].stoppedTaskLimit` | 仅 aria2。轮询时查询的已停止任务数量。 |
| `servers[].binaryPath` | 仅 yt-dlp。命令名或绝对路径，默认 `yt-dlp`。 |
| `servers[].ffmpegPath` | 仅 yt-dlp。ffmpeg 命令名或绝对路径，默认 `ffmpeg`。 |
| `servers[].downloadDir` | 仅 yt-dlp。默认下载目录。QiuyuRemote 中每个任务填写的目录会覆盖它。 |
| `servers[].format` | 仅 yt-dlp。默认格式选择器。 |
| `servers[].outputTemplate` | 仅 yt-dlp。输出文件名模板。默认使用 `%(title).80B.%(ext)s` 缩短标题。 |
| `servers[].cookiesPath` | 仅 yt-dlp。需要登录 Cookie 的网站可填写 Cookie 文件路径。 |
| `servers[].proxy` | 仅 yt-dlp。传给 yt-dlp 的代理地址。 |
| `servers[].requireCookiesForYoutube` | 仅 yt-dlp。若为 `true`，YouTube URL 在未配置 Cookie 时会提前返回友好错误。 |
| `servers[].cleanHashtags` | 仅 yt-dlp。默认 `true`，生成文件名前移除标题末尾 hashtag 文本。 |
| `servers[].maxConcurrent` | 仅 yt-dlp。最大并发 yt-dlp 进程数，默认 `10`。 |
| `servers[].noPlaylist` | 仅 yt-dlp。默认 `true`，避免单个 URL 自动展开成播放列表下载。 |
| `servers[].restrictFilenames` | 仅 yt-dlp。让 yt-dlp 使用更保守的文件名字符。 |
| `servers[].extraArgs` | 仅 yt-dlp。高级参数数组。Agent 使用 spawn 参数数组传递，不使用 shell 拼接。受 QiuyuRemote 控制的 `--output`、`--format`、`--cookies`、`--proxy`、`--paths` 会在这里被忽略，以保持任务行为可预测。 |

## 常用命令

启动：

```sh
npm start
```

检查健康状态：

```sh
curl http://127.0.0.1:8765/v1/health
```

检查是否有新版本：

```sh
curl http://127.0.0.1:8765/v1/update-check
```

查看 Agent 状态：

```sh
curl http://127.0.0.1:8765/v1/state
```

诊断所有下载服务：

```sh
curl http://127.0.0.1:8765/v1/diagnostics
```

发送测试通知：

```sh
curl -X POST http://127.0.0.1:8765/v1/push/test
```

## systemd 示例

假设 Agent 安装在：

```text
/root/PushAgent
```

先准备配置：

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
```

确认 Node.js 路径：

```sh
which node
```

创建服务文件：

```sh
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

写入：

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

服务文件本身不需要执行权限：

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
```

启动并设置开机自启：

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

常用管理命令：

```sh
sudo systemctl start qiuyuremote-push-agent
sudo systemctl stop qiuyuremote-push-agent
sudo systemctl restart qiuyuremote-push-agent
sudo systemctl status qiuyuremote-push-agent
```

查看日志：

```sh
sudo journalctl -u qiuyuremote-push-agent -f
sudo journalctl -u qiuyuremote-push-agent -n 100
sudo journalctl -u qiuyuremote-push-agent -b
```

## 排错

### 收不到通知

先检查 Agent 是否已配对：

```sh
curl http://127.0.0.1:8765/v1/state
```

再检查下载服务是否能连接：

```sh
curl http://127.0.0.1:8765/v1/diagnostics
```

同时查看终端或 systemd 日志。Agent 会输出 qBittorrent、Transmission、aria2、yt-dlp、配对、Relay 和 APNs 投递摘要。

### 配对码已经使用

说明这个配对码已经完成过配对。如果当前 Agent 已经正常配对，请清空 `pairingCode` 后重启。如果要添加新设备，请在 QiuyuRemote 重新生成一个配对码，并通过 Web 控制台或 `/v1/agent/pair` 配对。

### qBittorrent 返回 403

确认 `baseUrl` 是 qBittorrent Web UI 的基础地址，不要加 `/api/v2`。同时检查账号密码以及反向代理是否正确转发 Cookie。

### aria2 HTTPS 证书错误

如果只是在本地使用自签名证书，可以把该 aria2 服务设置为：

```json
"allowInvalidTLS": true
```

### 很快完成的 aria2 任务漏通知

保持 `liveEvents` 开启，并适当增大 aria2 的 `max-download-result`。

## 环境变量

大多数用户不需要这些。它们主要用于服务管理器或自定义部署：

- `QIUYU_AGENT_CONFIG`：配置文件路径
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`：逗号分隔的配对码
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`：开发用自定义 Relay URL
- `QIUYU_RELAY_URLS`：开发用逗号分隔 Relay URL 列表
- `QIUYU_RELAY_AGENT_ID`：特殊部署使用的静态 Relay Agent ID
- `QIUYU_RELAY_SECRET`：特殊部署使用的静态 Relay Agent secret
- `QIUYU_AGENT_UPDATE_CHECK_ENABLED`
- `QIUYU_AGENT_UPDATE_CHECK_URL`
- `QIUYU_AGENT_REPOSITORY_URL`
- `QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS`
- `QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS`
