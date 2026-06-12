# QiuyuRemote App 가이드

언어: [English](../APP_GUIDE.md) | [简体中文](APP_GUIDE.zh-Hans.md) | [繁體中文](APP_GUIDE.zh-Hant.md) | [日本語](APP_GUIDE.ja.md) | 한국어 | [Русский](APP_GUIDE.ru.md)

QiuyuRemote는 다운로드 클라이언트에 직접 연결하는 관리 앱으로도 사용할 수 있고, Push Agent와 함께 서버 알림 및 yt-dlp 기능을 사용하는 앱으로도 사용할 수 있습니다.

## 기본 모드와 Agent 모드

Push Agent를 설정하지 않아도 QiuyuRemote는 기존 qBittorrent, Transmission, aria2를 직접 관리할 수 있습니다. 앱은 각 서비스의 Web API 또는 RPC 엔드포인트에 직접 연결합니다.

Push Agent는 서버에서 계속 실행되어야 하는 백그라운드 기능에만 필요합니다.

| 기능 | Push Agent 필요 여부 |
| --- | --- |
| qBittorrent, Transmission, aria2 작업 관리 | 필요 없음 |
| qBittorrent, Transmission, aria2 작업 추가, 일시 정지, 재개, 삭제, 속도 제한, 상세 보기 | 필요 없음 |
| WebDAV 파일 탐색 및 재생 | 필요 없음. 단, WebDAV는 별도로 설정해야 함 |
| 로컬 오프라인 다운로드 | 필요 없음 |
| 로컬 오프라인 다운로드 알림 | 필요 없음 |
| 원격 다운로드 완료 또는 실패 알림 | 필요 |
| 장시간 데이터가 없는 작업 알림 | 필요 |
| 다운로드 서버 오프라인 또는 복구 알림 | 필요 |
| yt-dlp 다운로드 | 필요 |
| yt-dlp Cookie 관리 | 필요 |
| 다른 앱에서 미디어 URL을 QiuyuRemote로 공유해 원격 yt-dlp 다운로드 | 필요 |

## 무료 플랜과 Pro

QiuyuRemote는 무료 앱에 선택적 앱 내 구입을 더하는 방식으로 설계됩니다. 무료 플랜은 핵심적인 직접 연결 다운로드 관리를 계속 사용할 수 있어야 하며, Pro는 고급 기능을 여는 용도입니다. 앱 시작 시 전체 앱을 막는 방식이 아닙니다.

구입 상태는 StoreKit 2로 검증합니다. QiuyuRemote는 앱 시작 시 현재 App Store 권한을 확인하고 거래 업데이트를 감시합니다. 설정의 Subscription 섹션에서 구입을 복원할 수도 있습니다.

QiuyuRemote는 로컬 Keychain에 임의의 구입 디바이스 ID를 생성합니다. 이것은 Apple ID, APNs token, PushAgent ID 또는 다운로드 서버 자격 증명이 아닙니다. 나중에 서버 측 활성화 기기 제한을 추가한다면 서버는 수정 가능한 "Home Agent" 같은 이름 대신 검증된 App Store 구입 거래와 이 디바이스 ID를 연결해야 합니다.

Pro 상태와 Push Agent 페어링은 별개입니다. Pro를 구입해도 Agent가 자동으로 페어링되지 않으며, Agent를 페어링했다고 해서 Pro 구입이 있다는 뜻도 아닙니다.

## 서버

서버가 하나도 없으면 첫 화면에 서버 추가 항목이 표시됩니다.

이미 서버가 하나 이상 있으면 새 서버 추가는 서버 메뉴 안에 있습니다.

- iPhone에서는 상단 서버 이름을 탭해 서버를 전환합니다. 서버 이름을 길게 누르면 New, Edit, Delete가 있는 서버 메뉴가 열립니다.
- iPhone의 가로 서버 카드로도 서버를 전환할 수 있습니다. 서버 카드를 길게 누르면 편집하거나 삭제할 수 있습니다.
- iPad 또는 Mac에서는 서버 이름을 탭해 서버를 전환합니다. iPad에서는 서버 이름을 길게 누르고, Mac에서는 서버 이름을 우클릭하면 New, Edit, Delete가 열립니다.
- 접힌 사이드바에서는 설정 버튼 아래의 플러스 버튼을 사용합니다.
- 서버 행이나 아이콘을 우클릭 또는 길게 눌러 해당 서버를 편집하거나 삭제할 수 있습니다.

QiuyuRemote에서 서버를 삭제해도 앱에 저장된 연결 프로필만 삭제됩니다. 다운로드 서버의 작업이나 파일은 삭제되지 않습니다.

지원되는 서버 유형:

- Transmission: Transmission RPC에 연결합니다.
- aria2: aria2 JSON-RPC에 연결합니다.
- qBittorrent: qBittorrent Web UI API에 연결합니다.
- yt-dlp: PushAgent의 `v1/ytdlp` API에 연결합니다. yt-dlp는 서버에서 실행되며 iPhone이나 Mac에서 실행되지 않습니다.

## 다운로드 추가

홈 화면의 추가 버튼으로 작업을 추가합니다.

- qBittorrent와 Transmission은 magnet 링크와 `.torrent` 파일에 적합합니다.
- aria2는 일반 HTTP/HTTPS 파일 URL, metalink, magnet, torrent를 처리할 수 있으며 실제 동작은 aria2 설정에 따라 달라집니다.
- yt-dlp는 YouTube, TikTok, Bilibili, Instagram, X, Threads 등 yt-dlp가 지원하는 사이트의 HTTP/HTTPS 미디어 페이지 URL을 받습니다.

iPhone과 iPad에서는 다른 앱에서 URL을 QiuyuRemote로 공유할 수 있습니다. yt-dlp 공유를 사용하려면 먼저 yt-dlp PushAgent 서버를 추가하고 연결하세요. iOS 제한 때문에 QiuyuRemote를 연 뒤 제출이 완료될 수 있습니다.

## URL Scheme 및 단축어

QiuyuRemote는 `qiuyuremote://` URL Scheme을 등록합니다. 단축어 또는 다른 앱에서 다운로드 링크를 제출할 수 있습니다.

기본 예시:

```text
qiuyuremote://addTask?url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip
qiuyuremote://addTask?type=ytdlp&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID
```

`addTask`는 기본적으로 현재 선택한 서버를 사용합니다. `type=aria2`, `type=qbit`, `type=transmission`, `type=ytdlp`를 추가하면 해당 유형과 처음 일치하는 서버를 사용합니다. `server=<서버 이름 또는 UUID>`를 추가하면 저장된 특정 서버를 지정할 수 있습니다.

`autoAdd=true`가 기본값입니다. `autoAdd=false`를 설정하면 QiuyuRemote가 URL이 채워진 Add Download 시트를 열고, 제출 전에 옵션을 조정할 수 있습니다.

호환성 규칙은 일반 추가 화면과 같습니다.

- qBittorrent와 Transmission은 magnet 링크 또는 `.torrent` URL을 받습니다.
- aria2는 일반 파일 URL, magnet, torrent를 받을 수 있으며 실제 동작은 aria2 설정에 따라 달라집니다.
- yt-dlp는 HTTP/HTTPS 미디어 페이지 URL을 받으며, 설정된 yt-dlp PushAgent 서버가 필요합니다.

단축어에서는 `x-callback-url`도 사용할 수 있습니다.

```text
qiuyuremote://x-callback-url/addTask?type=aria2&url=https%3A%2F%2Fexample.com%2Ffile.zip&x-success=shortcuts%3A%2F%2F&x-error=shortcuts%3A%2F%2F
```

성공하면 `x-success`는 `count`, `gid`, `gids`를 받습니다. 제출된 작업 1개에 대해 `count`는 `1`입니다. 다운로드 서비스마다 작업 ID 반환 방식이 달라서 현재 `gid`와 `gids`는 비어 있습니다. 향후 특정 서비스에서 안정적으로 작업 ID를 반환할 수 있으면 정확한 값을 추가합니다. 실패하면 `x-error`는 `errorCode`와 `errorMessage`를 받습니다.

`url`, `x-success`, `x-error` 값은 항상 URL 인코딩하세요. 특히 다운로드 URL 자체에 `?`, `&`, 비 ASCII 문자가 포함된 경우 중요합니다.

## 작업 목록

기본 정렬은 일상 사용에 맞춰져 있습니다.

- 활성 또는 다운로드 중인 작업이 위쪽에 표시됩니다.
- 완료된 작업은 활성 작업 뒤에 표시됩니다.
- 최근 완료된 작업이 오래된 완료 작업보다 위에 표시됩니다.
- 열 머리글을 눌러 수동 정렬하면 해당 열 정렬이 우선합니다.

iPad와 Mac에서는 표 머리글의 경계를 드래그해 열 너비를 조절할 수 있습니다. Name 열은 긴 작업 이름을 보기 위해 더 넓게 조절할 수 있습니다.

yt-dlp 작업은 업로드 속도, 업로드 크기, Seeds, Leeches, Ratio 같은 torrent 전용 필드를 숨깁니다.

## 작업 상태 매핑

QiuyuRemote의 작업 목록은 각 다운로드 서비스의 상태를 앱 표시용으로 정규화합니다. 다운로드 서비스가 원본 상태를 제공하면 앱은 가능한 한 그 값도 보존합니다. 앱은 정규화된 상태, 원본 상태, 진행률, 전송 속도, 자동 규칙 알림을 함께 판단합니다. 예를 들어 공유 비율이나 유휴 중지 규칙으로 멈춘 완료된 torrent는 단순 Complete 대신 알림이 있는 Stopped로 표시될 수 있습니다.

| 서비스 | 서비스 상태 또는 조건 | 앱 표시 상태 |
| --- | --- | --- |
| qBittorrent | `error`, `missingFiles` | Error |
| qBittorrent | `pausedUP`, `stoppedUP`, `stalledUP`, `queuedUP` | Complete. 자동 규칙 알림이 있으면 Stopped로 표시될 수 있음 |
| qBittorrent | `paused`가 포함된 값 또는 `stoppedDL` | Paused |
| qBittorrent | `queued`가 포함된 값 | Waiting |
| qBittorrent | `checking`, `metadata`, `allocating`이 포함된 값, 또는 `filesChecked`, `metadataReceived` | Checking 또는 Processing |
| qBittorrent | `uploading` 또는 `forcedUP`가 포함된 값 | Seeding |
| qBittorrent | `stalled`가 포함된 값 | Stalled |
| qBittorrent | `downloading` 또는 `forcedDL`이 포함된 값 | Downloading |
| qBittorrent | `moving` | Moving |
| Transmission | `error > 0` | Error |
| Transmission | `0` | Stopped. 진행률이 완료된 경우 자동 규칙 알림이 없으면 Complete로 처리됨 |
| Transmission | `1`, `2` | Checking |
| Transmission | `3`, `4` | Downloading |
| Transmission | `5`, `6` | Seeding |
| aria2 | `active` | Downloading |
| aria2 | `waiting` | Waiting |
| aria2 | `paused` | Paused |
| aria2 | `error` | Error |
| aria2 | `complete` | Complete. 자동 규칙 알림이 있으면 Stopped로 표시될 수 있음 |
| aria2 | `removed` | Removed |
| yt-dlp | `downloading`, `running` | Downloading |
| yt-dlp | `postprocessing`, `processing`, `merge`, `fixup`, `metadata`, `extract`, `remux`, `convert` | Processing |
| yt-dlp | `moving` | Moving |
| yt-dlp | `completed` | Complete |
| yt-dlp | `failed`, `error`, `lost` | Error |
| yt-dlp | `paused` | Paused |
| yt-dlp | `queued` | Waiting |

인식할 수 없는 값은 서비스가 반환한 원본 상태로 표시됩니다. 상태가 비어 있으면 Unknown으로 표시됩니다.

## 작업 조작

작업을 선택하면 상세 정보를 볼 수 있습니다. 작업을 길게 누르거나 우클릭하면 작업 메뉴가 열립니다.

- 재개 또는 일시 정지
- 삭제
- 이름, 원본 링크, 경로 복사
- 지원되는 서비스에서 다운로드 또는 업로드 속도 제한
- 지원되는 서비스에서 공유 비율 제한
- 지원되는 서비스에서 강제 재검사

qBittorrent와 Transmission 작업이 자동 규칙으로 중지된 경우 재개할 때 선택지가 표시됩니다.

- Continue: 현재 규칙을 유지합니다. 나중에 다시 자동으로 중지될 수 있습니다.
- Disable Rules and Continue: 이 작업을 중지시킨 규칙만 해제하고 계속합니다.
- Not Now: 현재 상태를 유지합니다.

aria2 재개는 더 단순합니다. aria2에 충분한 작업 정보가 남아 있으면 QiuyuRemote가 aria2에 재개 또는 다시 추가를 요청합니다. 완료된 작업의 Resume은 비활성화되어 표시됩니다.

삭제할 때 Remove Task Only는 다운로드된 파일을 유지합니다. Remove Task And Downloaded Files는 지원되는 서비스에 로컬 데이터 삭제도 요청합니다. aria2 RPC는 작업과 기록을 삭제할 수 있지만 완료된 파일을 디스크에서 안정적으로 삭제할 수는 없습니다.

## 파일, WebDAV, 오프라인 라이브러리

다운로드 서비스가 파일 정보를 반환하면 작업 상세 화면에 파일 목록이 표시됩니다.

WebDAV는 선택 기능입니다. 다운로드 디렉터리가 WebDAV로 노출되어 있다면 전역 또는 서버별로 WebDAV를 설정할 수 있습니다. QiuyuRemote는 파일을 탐색하고 외부 플레이어에 재생 URL을 전달할 수 있습니다.

오프라인 라이브러리는 현재 디바이스에만 저장됩니다. 오프라인 파일은 iCloud로 동기화되지 않습니다. 로컬 오프라인 다운로드 알림은 QiuyuRemote가 직접 보내며 Push Agent가 필요하지 않습니다.

디스크에는 파일이 있는데 WebDAV에 아직 보이지 않는다면 OpenList 같은 WebDAV 제공자를 새로고침하거나 인덱스/캐시 업데이트를 기다리세요.

## 알림

시스템 알림 권한은 iOS, iPadOS 또는 macOS가 제어합니다.

- 로컬 오프라인 다운로드 알림은 QiuyuRemote가 직접 보냅니다.
- 원격 qBittorrent, Transmission, aria2 작업 알림은 다운로드 서버에서 실행 중이고 페어링된 Push Agent가 필요합니다.
- yt-dlp 작업 알림도 Push Agent에서 옵니다.
- Push Relay 테스트 알림은 이 디바이스가 Push Relay/APNs를 통해 알림을 받을 수 있는지만 확인합니다. 서버 Push Agent가 페어링되었거나 실행 중임을 증명하지는 않습니다.

원격 다운로드 알림을 받는 절차:

1. QiuyuRemote에서 알림을 켭니다.
2. QiuyuRemote에서 Agent 페어링 코드를 생성합니다.
3. 서버의 PushAgent 웹 페이지를 엽니다.
4. 페어링 코드를 입력하고 Agent를 페어링합니다.
5. 서버에서 PushAgent를 계속 실행합니다.

## yt-dlp와 Cookie

yt-dlp 다운로드는 PushAgent에서 실행됩니다. QiuyuRemote는 URL을 제출하고 Agent가 반환한 작업 상태를 보여줍니다.

Cookie 관리는 yt-dlp PushAgent 서버별로 분리됩니다. Cookie는 선택한 PushAgent로 직접 업로드되어 해당 서버에 저장됩니다. Push Relay로 전송되지 않고, iCloud와 동기화되지 않으며, 로그에 기록되지 않습니다.

브라우저에서 내보낸 Netscape 형식 `cookies.txt` 파일을 사용하세요. Cookie는 웹사이트 로그인 자격 증명과 같으므로 다른 사람과 공유하지 마세요.

YouTube 또는 다른 사이트에서 로그인이나 Cookie가 필요하다고 표시되면 Cookie 관리에서 해당 사이트 Cookie를 가져오거나 업데이트하세요. YouTube는 현재 서명 challenge 처리를 위해 yt-dlp 업데이트, ffmpeg, Deno 같은 JavaScript 런타임이 필요할 수도 있습니다.

## 동기화와 개인정보

서버 프로필과 앱 설정은 iCloud로 동기화될 수 있습니다. 비밀번호와 token은 iCloud Keychain을 사용합니다. 다운로드된 파일과 오프라인 라이브러리 항목은 동기화되지 않습니다.

개인정보 보호를 켜면 Face ID, Touch ID 또는 디바이스 암호는 Apple 시스템 인증 UI가 처리합니다.

## 문제 해결

- 직접 연결 다운로드 서비스에 연결할 수 없다면 주소, 포트, 경로, SSL, 사용자 이름, 비밀번호, token, 현재 네트워크에서 접근 가능한지 확인하세요.
- qBittorrent는 Web UI 기본 URL을 사용합니다. `/api/v2`를 직접 붙이지 마세요.
- Transmission은 보통 `/transmission/rpc` RPC 엔드포인트를 사용합니다.
- aria2는 JSON-RPC 엔드포인트를 사용합니다. secret을 설정했다면 token도 입력하세요.
- yt-dlp는 PushAgent의 `v1/ytdlp` 엔드포인트에 연결합니다. Agent에 `apiKey`가 설정되어 있으면 앱에도 같은 API Key를 입력하세요.
- 원격 알림이 오지 않으면 알림 권한, 집중 모드, Push Relay 등록, Agent 페어링, PushAgent 실행 상태를 확인하세요.
- WebDAV에서 재생할 수 없거나 파일을 찾을 수 없다면 WebDAV 경로가 실제 다운로드 디렉터리와 매핑되는지 확인하고 WebDAV 서비스를 새로고침하세요.
