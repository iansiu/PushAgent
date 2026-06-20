# QiuyuRemote Push Agent

언어: [English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md) | 한국어 | [Русский](README.ru.md)

공개 저장소: <https://github.com/iansiu/PushAgent>

App 가이드: [QiuyuRemote App 가이드](APP_GUIDE.ko.md)

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

## Push Agent가 꼭 필요한가요?

필수는 아닙니다. QiuyuRemote는 Push Agent 없이도 사용할 수 있습니다. 기존 qBittorrent, Transmission, aria2 서버를 관리하기만 한다면 앱이 각 서비스의 Web API 또는 RPC 엔드포인트에 직접 연결합니다.

Push Agent는 앱만으로 백그라운드에서 안정적으로 처리하기 어려운 기능을 위한 선택적 서버 구성 요소입니다.

| 기능 | Push Agent 필요 여부 |
| --- | --- |
| qBittorrent, Transmission, aria2 작업 관리 | 필요 없음 |
| qBittorrent, Transmission, aria2 작업 추가, 일시 정지, 재개, 삭제, 속도 제한, 상세 보기 | 필요 없음 |
| WebDAV 파일 탐색 및 재생 | 필요 없음. 단, WebDAV는 별도로 설정해야 함 |
| QiuyuRemote 로컬 오프라인 다운로드 | 필요 없음 |
| 로컬 오프라인 다운로드 알림 | 필요 없음. QiuyuRemote가 로컬로 예약함 |
| 원격 다운로드 완료 또는 실패 알림 | 필요 |
| 장시간 데이터가 없는 작업 알림 | 필요 |
| 다운로드 서버 오프라인 또는 복구 알림 | 필요 |
| yt-dlp 다운로드 | 필요 |
| yt-dlp Cookie 관리 | 필요 |
| YouTube, TikTok 등 URL을 QiuyuRemote로 공유해 원격 다운로드 | 필요. yt-dlp Push Agent 설정 필요 |

정리하면 Push Agent는 QiuyuRemote 사용을 시작하기 위한 필수 조건이 아닙니다. 서버 측 모니터링, 푸시 알림, yt-dlp를 위한 확장 기능입니다.

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

먼저 서버에 yt-dlp를 설치하세요. 기본 `format` 값인 `bv*+ba/b`를 유지하면 일부 사이트에서 비디오와 오디오를 병합하기 위해 ffmpeg가 필요할 수 있습니다. 진단 결과에는 `ytDlpVersion`, `ffmpegAvailable`, `ffmpegVersion`이 표시됩니다.

YouTube 같은 일부 사이트는 로그인 Cookie가 필요할 수 있습니다. 이는 Push Agent 문제가 아니라 yt-dlp의 인증 요구입니다. 로그인된 브라우저에서 Netscape 형식 `cookies.txt`를 내보낸 뒤 QiuyuRemote Cookie 관리에서 가져오거나, 서버에 업로드하고 `cookiesPath`에 절대 경로를 입력하세요.

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

하나의 Netscape Cookie 파일에 여러 도메인의 Cookie를 넣을 수 있으며, yt-dlp는 URL에 맞는 Cookie만 사용합니다. Cookie 파일은 공개하지 마세요.

Cookie 선택 순서는 작업에서 명시한 `cookiesPath`, QiuyuRemote에 가져와 `cookiesDir`에 저장된 해당 사이트 Cookie, `config.json`의 fallback `cookiesPath`, Cookie 없음 순서입니다. 즉, 앱에서 가져온 사이트 Cookie가 설정 파일보다 우선합니다. 가져온 파일이 비어 있거나 만료되었거나 잘못된 경우 작업은 Cookie 오류로 실패하며 설정 파일로 조용히 fallback하지 않습니다. fallback `cookiesPath`를 다시 사용하려면 앱의 해당 사이트 Cookie를 업데이트하거나 삭제하세요.

데스크톱 브라우저에서는 `Get cookies.txt LOCALLY` 확장 프로그램으로 표준 Netscape 형식 Cookie 파일을 내보낼 수 있습니다. iOS에서는 Microsoft Edge와 `Cookie-Editor` 확장 프로그램을 사용하고 Export Format을 `Netscape`로 설정해 현재 사이트 Cookie를 복사한 뒤 `Create a new cookie file` 단축어를 실행할 수 있습니다: `https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`. 이 단축어는 `On My iPhone/Downloads`에 Cookie 파일을 만들며 QiuyuRemote에서 바로 가져올 수 있습니다.

QiuyuRemote에 표시되는 Cookie 만료일은 예상값입니다. 실제 사용 가능 여부는 로그아웃, 비밀번호 변경, 계정 보안 검사, 서버 IP/지역 변경, 사이트 측 무효화, 속도 제한, yt-dlp extractor 변경 등의 영향을 받을 수 있습니다.

YouTube는 서명과 `n` challenge를 풀기 위해 yt-dlp의 외부 JavaScript 지원이 필요할 수 있습니다. Deno를 설치하고 현재 shell과 systemd가 모두 찾을 수 있게 만드세요.

```bash
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
/usr/local/bin/deno --version
python3 -m pip install -U "yt-dlp[default]"
apt install -y ffmpeg
```

YouTube Cookie를 `/root/PushAgent/cookies/youtube.txt` 같은 경로에 업로드한 뒤, 먼저 서버에서 단일 영상 URL을 테스트하세요. `list=`가 포함된 URL이 전체 재생목록으로 확장되지 않도록 `--no-playlist`를 붙입니다.

```bash
chmod 600 /root/PushAgent/cookies/youtube.txt
yt-dlp -F \
  --no-playlist \
  --cookies /root/PushAgent/cookies/youtube.txt \
  --remote-components ejs:github \
  --js-runtimes deno:/usr/local/bin/deno \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

정상이라면 `[jsc:deno] Solving JS challenges using deno`가 출력되고 720p, 1080p 같은 실제 오디오/비디오 형식이 표시됩니다. storyboard 이미지만 보이면 yt-dlp, Deno, EJS 구성 요소를 다시 확인하세요. `HTTP Error 429: Too Many Requests`는 YouTube가 서버 IP를 임시 제한한 상태이므로 잠시 기다리거나 `proxy`를 설정하세요.

테스트에 성공하면 같은 옵션을 yt-dlp 서비스 설정에 넣습니다.

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

설정을 바꾼 뒤 Agent를 재시작하세요.

```bash
systemctl restart pushagent
```

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

### 6. Agent 계속 실행하기

```sh
npm start
```

실제 운영에서는 systemd 또는 다른 프로세스 관리자를 사용하는 것이 좋습니다. 아래에 systemd 전체 예시가 있습니다.

## Web 콘솔

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

Web 콘솔에서는 Agent 상태, Relay ID, 서비스 진단, 페어링된 디바이스, 페어링 코드 기록, 최근 이벤트, 테스트 알림, 업데이트 확인을 볼 수 있습니다. 전체 디바이스, 앱, Relay 노드 관리는 Push Relay 관리자 콘솔에서 처리합니다.

## 기기 추가하기

하나의 Agent가 여러 QiuyuRemote 기기에 알림을 보낼 수 있습니다. iPhone, iPad, Mac마다 Agent 프로세스를 따로 실행할 필요는 없습니다.

가장 쉬운 방법:

1. 새 QiuyuRemote 기기에서 새 페어링 코드를 생성합니다.
2. Agent Web 콘솔을 엽니다.
3. Pair Device 영역에 페어링 코드를 입력합니다.
4. 새 기기를 기존 Agent에 페어링합니다.

API로도 페어링할 수 있습니다.

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

시작하기 전에 여러 새 코드를 `config.json`에 넣을 수도 있습니다.

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

배열 형식도 지원됩니다.

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

같은 설정에 중복된 코드는 건너뜁니다. 사용됨, 만료됨, 취소됨 상태의 코드는 터미널과 Web 콘솔 이벤트 목록에 명확히 표시됩니다.

`data/relay-identity.json`에 저장된 Relay identity가 Push Relay에 더 이상 없으면, Agent Web 콘솔의 수동 pairing은 오래된 identity 없이 한 번 다시 시도하고 Relay가 반환한 새 Agent ID를 저장합니다. 일반적인 경우에는 Relay가 저장된 유효 identity와 다른 Agent ID를 반환해도 Agent가 조용히 바꾸지 않습니다.

하나의 Agent에 활성화된 yt-dlp 서비스가 여러 개 있으면 query가 없는 기존 요청은 계속 첫 번째 활성 yt-dlp를 사용합니다. 여러 yt-dlp를 분리하려면 QiuyuRemote 경로를 `v1/ytdlp?server=<id-or-name>`로 설정하세요. selector는 Agent Web 콘솔에 표시되는 서비스 `id`, `name`, `storageKey`, endpoint 또는 base URL일 수 있습니다.

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

Web 콘솔에서는 Access 영역에 같은 key를 입력하세요. 페이지에 `API Key Required`가 표시되면 브라우저가 Agent와 같은 서버에서 접속하지 않았거나 입력한 key가 `config.json`과 일치하지 않는 것입니다.

## Relay 자격 증명

일반 사용자는 기본 Relay 주소를 그대로 유지하면 됩니다.

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

특수 배포가 아니라면 다음 정적 자격 증명 필드를 직접 채우지 마세요.

- `relay.agentId`
- `relay.secret`

페어링 중 Push Relay는 Agent ID와 서명 secret을 반환합니다. Agent는 이를 `data/relay-identity.json`에 자동 저장합니다. 특수한 정적 자격 증명 배포가 아니라면 secret을 `config.json`에 복사하지 마세요.

개발 또는 개인 Relay 테스트에서만 사용자 지정 `relay.urls`를 사용합니다.

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

특수 배포에서는 정적 Relay 자격 증명도 사용할 수 있습니다.

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## 알림

Agent는 다음 이벤트를 보냅니다.

- 다운로드 완료
- 다운로드 실패
- 실행 중인 작업이 오랫동안 데이터를 받지 못함
- 감시 중인 서버가 오프라인이 됨
- 감시 중인 서버가 다시 온라인이 됨
- 테스트 푸시 이벤트

초기 스캔은 기준 상태로 처리됩니다. Agent가 처음 시작될 때 이미 완료되었거나 실패한 기존 작업은 새 알림을 만들지 않습니다. 이후 발생하는 최종 상태 변화만 알림을 보냅니다.

실행 중인 다운로드의 경우 Agent는 마지막으로 다운로드 속도나 진행률 증가가 보고된 시간을 기록합니다. 완료되지 않은 작업이 `monitor.inactiveDownloadNoticeSeconds`초 동안 데이터를 받지 못하면 Agent는 `download_inactive` 알림을 한 번 보냅니다. 해당 작업이 다시 데이터를 받은 뒤에만 상태가 초기화되므로 매 폴링마다 반복 알림을 보내지 않습니다.

Push Relay가 이벤트를 받았지만 알림을 받을 기기가 0대인 경우에도 Agent는 해당 작업을 이미 보고된 것으로 기록합니다. 모든 기기가 비활성화되었거나 아직 페어링된 기기가 없을 때 같은 완료/실패 작업을 계속 보내는 것을 막기 위한 동작입니다.

## 필드 참조

| 필드 | 설명 |
| --- | --- |
| `host` | Agent 수신 주소입니다. 기본값은 로컬 전용 `127.0.0.1`입니다. 다른 기기에서 Agent Web 콘솔을 열어야 할 때만 `0.0.0.0`으로 바꾸고 먼저 `apiKey`를 설정하세요. |
| `port` | Agent 포트입니다. 기본값은 `8765`입니다. |
| `apiKey` | 로컬 API key입니다. 로컬에서만 사용할 경우 비워 둘 수 있고, 원격 접근이 필요하면 랜덤 값을 설정하세요. |
| `pairingCode` | 하나의 코드 또는 쉼표, 공백, 세미콜론으로 구분한 여러 코드입니다. 페어링 성공 후 비워 주세요. |
| `pairingCodes` | 여러 페어링 코드를 배열로 지정할 수 있습니다. |
| `agentName` | Push Relay에 표시되는 Agent 이름입니다. 예: `Home Agent`. |
| `dataDir` | `relay-identity.json`, 작업 상태, 서버 상태를 저장하는 위치입니다. |
| `relay.urls` | Push Relay 주소입니다. 예시는 Qiuyu 기본 Relay와 백업 Relay를 포함합니다. |
| `monitor.pollIntervalSeconds` | 다운로드 서비스 폴링 간격입니다. 기본값은 `30`초이고 런타임 최소값은 `10`초입니다. |
| `monitor.inactiveDownloadNoticeEnabled` | 실행 중인 미완료 작업이 오랫동안 데이터를 받지 못할 때 알림을 보낼지 여부입니다. 기본값은 `true`입니다. |
| `monitor.inactiveDownloadNoticeSeconds` | 데이터 없음으로 판단하는 시간입니다. 기본값은 `1800`초, 즉 30분입니다. |
| `updateCheck.enabled` | Agent Web 페이지가 공개 PushAgent 새 버전을 확인할지 여부입니다. 기본값은 `true`입니다. |
| `updateCheck.repositoryURL` | Agent Web 페이지에서 여는 GitHub 페이지입니다. |
| `updateCheck.url` | 업데이트 메타데이터 URL입니다. 기본값은 GitHub의 공개 `package.json`에서 version을 읽습니다. |
| `updateCheck.intervalSeconds` | 업데이트 확인 캐시 간격입니다. 기본값은 `3600`초입니다. |
| `updateCheck.timeoutSeconds` | 업데이트 확인 네트워크 제한 시간입니다. 기본값은 `4`초입니다. |
| `servers` | qBittorrent, Transmission, aria2, 선택적 yt-dlp 연결 설정입니다. |
| `servers[].name` | 표시 이름입니다. 언제든 바꿀 수 있습니다. |
| `servers[].type` | 서비스 유형입니다. `qbit`, `transmission`, `aria2`, `ytdlp`를 지원합니다. |
| `servers[].enabled` | 이 서비스를 감시할지 여부입니다. 생략하거나 `true`이면 활성화, `false`이면 템플릿만 남기고 감시하지 않습니다. |
| `servers[].username` / `servers[].password` | qBittorrent와 Transmission 로그인 정보입니다. 인증이 필요 없으면 비워 둡니다. |
| `servers[].token` | aria2 RPC secret token입니다. 필요 없으면 비워 둡니다. |
| `servers[].allowInvalidTLS` | 해당 로컬 서버의 유효하지 않은 TLS 인증서를 허용할지 여부입니다. 주로 로컬 aria2 HTTPS RPC에 사용합니다. |
| `servers[].liveEvents` | aria2 전용입니다. WebSocket 완료 이벤트 알림을 켭니다. 기본적으로 켜져 있습니다. |
| `servers[].stoppedTaskLimit` | aria2 전용입니다. 폴링 시 조회할 중지된 작업 수입니다. |
| `servers[].binaryPath` | yt-dlp 전용입니다. 명령 이름 또는 절대 경로입니다. 기본값은 `yt-dlp`입니다. |
| `servers[].ffmpegPath` | yt-dlp 전용입니다. ffmpeg 명령 이름 또는 절대 경로입니다. 기본값은 `ffmpeg`입니다. |
| `servers[].downloadDir` | yt-dlp 전용입니다. 기본 저장 디렉터리입니다. QiuyuRemote에서 작업별로 입력한 디렉터리가 우선합니다. |
| `servers[].storageKey` | yt-dlp 전용입니다. 작업 기록과 사이트 Cookie 저장에 사용하는 안정적인 key입니다. 업그레이드하거나 저장 디렉터리를 바꿔도 변경하지 마세요. |
| `servers[].statePath` | yt-dlp 전용입니다. 작업 기록 JSON 파일 경로입니다. 기본값은 `data/yt-dlp-tasks/<storageKey>.json`입니다. |
| `servers[].historyLimit` | yt-dlp 전용입니다. Push Agent가 보관하는 작업 기록 수입니다. 기본값은 `1000`입니다. |
| `servers[].format` | yt-dlp 전용입니다. 기본 format selector입니다. |
| `servers[].outputTemplate` | yt-dlp 전용입니다. 출력 파일명 템플릿입니다. 기본값은 `%(title).80B.%(ext)s`로 제목을 짧게 유지합니다. |
| `servers[].cookiesPath` | yt-dlp 전용입니다. 작업별 또는 앱에서 가져온 사이트 Cookie가 없을 때 사용하는 fallback Netscape Cookie 파일입니다. |
| `servers[].cookiesDir` | yt-dlp 전용입니다. QiuyuRemote Cookie 관리가 사이트별 Cookie를 저장하는 디렉터리입니다. 기본값은 `data/ytdlp-cookies/<storageKey>`입니다. |
| `servers[].proxy` | yt-dlp 전용입니다. yt-dlp에 전달할 proxy입니다. |
| `servers[].requireCookiesForYoutube` | yt-dlp 전용입니다. `true`이면 작업별, 앱 가져오기, fallback Cookie가 모두 없는 YouTube URL에 대해 일찍 친절한 오류를 반환합니다. |
| `servers[].cleanHashtags` | yt-dlp 전용입니다. 기본값은 `true`이며 파일명 생성 전에 제목 끝의 hashtag 텍스트를 제거합니다. |
| `servers[].maxConcurrent` | yt-dlp 전용입니다. 동시에 실행할 yt-dlp 프로세스 수입니다. 기본값은 `10`입니다. |
| `servers[].noPlaylist` | yt-dlp 전용입니다. 기본값은 `true`이며 하나의 URL이 전체 재생목록 다운로드로 확장되는 것을 막습니다. |
| `servers[].restrictFilenames` | yt-dlp 전용입니다. 더 보수적인 파일명 문자를 사용하게 합니다. |
| `servers[].extraArgs` | yt-dlp 전용 고급 인수 배열입니다. Agent는 shell 문자열이 아니라 spawn 인수 배열로 전달합니다. QiuyuRemote가 제어하는 `--output`, `--format`, `--cookies`, `--proxy`, `--paths`는 여기서 무시됩니다. |

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

매우 빠르게 완료되는 aria2 작업이 누락된다면 `liveEvents`를 켜고 필요하면 aria2의 `max-download-result`를 늘리세요.

## 환경 변수

대부분의 사용자는 필요하지 않습니다. 서비스 관리자나 사용자 지정 배포에서 사용할 수 있습니다.

- `QIUYU_AGENT_CONFIG`: 설정 파일 경로
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`: 쉼표로 구분한 페어링 코드
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`: 개발용 사용자 지정 Relay URL
- `QIUYU_RELAY_URLS`: 쉼표로 구분한 사용자 지정 Relay URL 목록
- `QIUYU_RELAY_AGENT_ID`: 특수 배포용 정적 Relay Agent ID
- `QIUYU_RELAY_SECRET`: 특수 배포용 정적 Relay Agent secret
- `QIUYU_AGENT_UPDATE_CHECK_ENABLED`
- `QIUYU_AGENT_UPDATE_CHECK_URL`
- `QIUYU_AGENT_REPOSITORY_URL`
- `QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS`
- `QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS`
