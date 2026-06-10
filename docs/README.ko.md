# QiuyuRemote Push Agent

언어: [English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md) | 한국어 | [Русский](README.ru.md)

공개 저장소: <https://github.com/iansiu/PushAgent>

Push Agent는 다운로드 서버에서 실행되며 qBittorrent, Transmission, aria2, 선택적으로 yt-dlp 작업을 감시합니다. 다운로드 완료, 실패, 장시간 데이터 없음, 서버 오프라인/복구 이벤트를 Qiuyu's Push Relay로 보내고 QiuyuRemote는 이를 시스템 알림으로 표시합니다.

Push Agent는 가볍게 설계되어 있습니다.

- APNs `.p8` 개인 키를 포함하지 않습니다.
- APNs 디바이스 토큰을 저장하지 않습니다.
- PHP, MySQL, Nginx, 프런트엔드 빌드가 필요하지 않습니다.
- 기본 Relay 주소를 그대로 사용할 수 있습니다.

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org`는 기본 Relay를 사용할 수 없을 때만 사용하는 백업 주소입니다.

## 빠른 시작

### 1. Agent 설치

다운로드 서비스가 실행되는 서버에 Node.js 18 이상을 설치한 뒤 공개 저장소를 clone 합니다.

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. `config.json` 만들기

```sh
cp config.example.json config.json
```

일반적인 상단 설정은 다음과 같습니다.

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

실제로 사용하는 다운로드 서비스만 `servers`에 추가하세요. `config.example.json`에는 qBittorrent, Transmission, aria2, yt-dlp 템플릿이 있고 기본값은 `"enabled": false`입니다.

### 3. 다운로드 서비스 설정

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

aria2가 자체 서명 HTTPS 인증서를 사용한다면 `allowInvalidTLS`를 `true`로 설정할 수 있습니다. 빠르게 완료되는 aria2 작업을 놓치지 않으려면 `liveEvents`를 켜 두는 것이 좋습니다.

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

먼저 서버에 yt-dlp를 설치하세요. 기본 `format` 값인 `bv*+ba/b`를 유지하면 일부 사이트에서 비디오와 오디오를 병합하기 위해 ffmpeg가 필요할 수 있습니다. 진단 결과에는 `ytDlpVersion`, `ffmpegAvailable`, `ffmpegVersion`이 표시됩니다.

YouTube 같은 일부 사이트는 로그인 Cookie가 필요할 수 있습니다. 이는 Push Agent 문제가 아니라 yt-dlp의 인증 요구입니다. 로그인된 브라우저에서 Netscape 형식 `cookies.txt`를 내보내고 서버에 업로드한 뒤 `cookiesPath`에 절대 경로를 입력하세요.

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

하나의 Netscape Cookie 파일에 여러 도메인의 Cookie를 넣을 수 있으며, yt-dlp는 URL에 맞는 Cookie만 사용합니다. Cookie 파일은 공개하지 마세요.

### 4. Agent 페어링 코드 생성

QiuyuRemote에서:

1. 설정을 엽니다.
2. 다운로드 완료 알림을 엽니다.
3. 알림을 켜고 시스템 알림 권한을 허용합니다.
4. Agent 페어링 코드를 생성합니다.

예:

```text
MBGT-TB7S
```

### 5. Agent 페어링

처음 설정할 때 코드를 `config.json`에 넣습니다.

```json
"pairingCode": "MBGT-TB7S"
```

Agent를 시작합니다.

```sh
npm start
```

성공하면 Relay ID가 다음 위치에 저장됩니다.

```text
data/relay-identity.json
```

성공 후에는 기존 코드를 비워 주세요.

```json
"pairingCode": ""
```

페어링 코드는 일회성이며 짧은 시간 동안만 유효합니다.

## Web 콘솔

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

Web 콘솔에서는 Agent 상태, Relay ID, 서비스 진단, 페어링된 디바이스, 페어링 코드 기록, 최근 이벤트, 테스트 알림, 업데이트 확인을 볼 수 있습니다. 전체 디바이스, 앱, Relay 노드 관리는 Push Relay 관리자 콘솔에서 처리합니다.

## API Key

`apiKey`는 Agent의 로컬 관리 API와 Web 콘솔 작업을 보호합니다.

`apiKey`가 비어 있으면:

- `127.0.0.1` 요청은 허용됩니다.
- 원격 브라우저/API 요청은 거부됩니다.

다른 기기에서 Agent 포트에 접근해야 한다면 랜덤 key를 설정하세요.

```sh
openssl rand -hex 32
```

```json
"apiKey": "paste-the-random-key-here"
```

API 요청에는 다음 헤더가 필요합니다.

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

## 자주 쓰는 명령

```sh
npm start
curl http://127.0.0.1:8765/v1/health
curl http://127.0.0.1:8765/v1/update-check
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
curl -X POST http://127.0.0.1:8765/v1/push/test
```

## systemd 예시

Agent가 `/root/PushAgent`에 있다고 가정합니다.

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
which node
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

서비스 내용:

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

서비스 파일에는 실행 권한이 필요하지 않습니다.

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

관리와 로그:

```sh
sudo systemctl start qiuyuremote-push-agent
sudo systemctl stop qiuyuremote-push-agent
sudo systemctl restart qiuyuremote-push-agent
sudo systemctl status qiuyuremote-push-agent
sudo journalctl -u qiuyuremote-push-agent -f
sudo journalctl -u qiuyuremote-push-agent -n 100
sudo journalctl -u qiuyuremote-push-agent -b
```

## 문제 해결

알림이 오지 않으면 페어링 상태와 서비스 진단을 먼저 확인하세요.

```sh
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
```

페어링 코드가 이미 사용되었다고 나오면 해당 코드는 이미 페어링에 사용된 것입니다. `pairingCode`를 비우고 재시작하거나 QiuyuRemote에서 새 코드를 생성하세요.

qBittorrent가 403을 반환하면 `baseUrl`이 Web UI 기본 주소인지 확인하고 `/api/v2`를 붙이지 마세요. 사용자 이름, 비밀번호, 프록시 Cookie 전달도 확인하세요.

aria2 HTTPS 인증서 오류가 로컬 서비스에서 발생한다면 다음을 설정할 수 있습니다.

```json
"allowInvalidTLS": true
```
