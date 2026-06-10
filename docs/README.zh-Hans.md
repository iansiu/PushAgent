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

如果你是在 QiuyuRemote 私有工程里开发测试，也可以直接复制 `Services/PushAgent` 文件夹到服务器。

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

## Web 控制台

Push Agent 自带一个简单的 Web 控制台：

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

它可以查看 Agent 状态、Relay 身份、下载服务诊断、配对设备、配对码记录、最近事件、测试通知和版本更新提示。全局设备、应用、中继节点等管理功能属于 Push Relay 后台。

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
