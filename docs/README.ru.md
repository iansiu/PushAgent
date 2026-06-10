# QiuyuRemote Push Agent

Языки: [English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Русский

Публичный репозиторий: <https://github.com/iansiu/PushAgent>

Push Agent запускается на вашем сервере загрузок и отслеживает задачи qBittorrent, Transmission, aria2 и, при необходимости, yt-dlp. Он отправляет события о завершении загрузки, ошибке, долгом отсутствии данных, отключении и восстановлении сервера в Qiuyu's Push Relay, после чего QiuyuRemote показывает системные уведомления.

Push Agent легкий:

- Не содержит приватных ключей APNs `.p8`.
- Не хранит APNs device tokens.
- Не требует PHP, MySQL, Nginx или сборки frontend.
- По умолчанию использует встроенные адреса Relay:

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

`push1.qiuyu.org` используется только как резервный Relay, если основной недоступен.

## Быстрый старт

### 1. Установка Agent

Установите Node.js 18 или новее на сервере, где работают службы загрузки, затем клонируйте публичный репозиторий:

```sh
git clone https://github.com/iansiu/PushAgent.git /root/PushAgent
cd /root/PushAgent
npm install
```

### 2. Создание `config.json`

```sh
cp config.example.json config.json
```

Обычно верхняя часть конфигурации выглядит так:

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

Добавляйте в `servers` только те службы загрузки, которыми вы действительно пользуетесь. В `config.example.json` есть шаблоны qBittorrent, Transmission, aria2 и yt-dlp, но по умолчанию они имеют `"enabled": false`.

### 3. Настройка служб загрузки

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

Если aria2 использует HTTPS с самоподписанным сертификатом, можно установить `allowInvalidTLS` в `true`. Обычно лучше оставить `liveEvents` включенным, чтобы Agent не пропускал очень быстро завершившиеся задачи aria2.

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

Сначала установите yt-dlp на сервере. Если вы оставляете формат `bv*+ba/b`, также рекомендуется установить ffmpeg, потому что некоторые сайты скачивают видео и аудио отдельными потоками, а затем объединяют их. В диагностике отображаются `ytDlpVersion`, `ffmpegAvailable` и `ffmpegVersion`.

Некоторые сайты, особенно YouTube, могут требовать login cookies. Это не ошибка Push Agent; это требование yt-dlp. Экспортируйте `cookies.txt` в формате Netscape из браузера, где вы уже вошли в аккаунт, загрузите файл на сервер и укажите абсолютный путь в `cookiesPath`.

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

Один файл cookies может содержать cookies для нескольких доменов. yt-dlp использует только cookies, подходящие к URL. Не публикуйте этот файл.

### 4. Создание кода привязки Agent

В QiuyuRemote:

1. Откройте Settings.
2. Откройте Download Completion Notifications.
3. Включите уведомления и разрешите системные уведомления.
4. Создайте код привязки Agent.

Пример:

```text
MBGT-TB7S
```

### 5. Привязка Agent

При первой настройке добавьте код в `config.json`:

```json
"pairingCode": "MBGT-TB7S"
```

Запустите Agent:

```sh
npm start
```

После успешной привязки Relay identity сохраняется здесь:

```text
data/relay-identity.json
```

После успешной привязки очистите старый код:

```json
"pairingCode": ""
```

Код привязки одноразовый и действует ограниченное время.

## Web Console

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

В Web Console можно смотреть состояние Agent, Relay identity, диагностику служб, привязанные устройства, коды привязки, последние события, тестовые уведомления и проверку обновлений. Глобальное управление устройствами, приложениями и Relay nodes находится в админ-панели Push Relay.

## API Key

`apiKey` защищает локальный API управления Agent и действия Web Console.

Если `apiKey` пустой:

- запросы с `127.0.0.1` разрешены;
- удаленные браузеры и API-запросы отклоняются.

Если к порту Agent должны подключаться другие устройства, задайте случайный key:

```sh
openssl rand -hex 32
```

```json
"apiKey": "paste-the-random-key-here"
```

Для API-запросов нужен заголовок:

```sh
-H 'Authorization: Bearer paste-the-random-key-here'
```

## Частые команды

```sh
npm start
curl http://127.0.0.1:8765/v1/health
curl http://127.0.0.1:8765/v1/update-check
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
curl -X POST http://127.0.0.1:8765/v1/push/test
```

## Пример systemd

Предположим, Agent установлен в `/root/PushAgent`:

```sh
cd /root/PushAgent
cp config.example.json config.json
npm install
which node
sudo nano /etc/systemd/system/qiuyuremote-push-agent.service
```

Содержимое сервиса:

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

Файлу сервиса не нужны права на выполнение:

```sh
sudo chown root:root /etc/systemd/system/qiuyuremote-push-agent.service
sudo chmod 644 /etc/systemd/system/qiuyuremote-push-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now qiuyuremote-push-agent
```

Управление и логи:

```sh
sudo systemctl start qiuyuremote-push-agent
sudo systemctl stop qiuyuremote-push-agent
sudo systemctl restart qiuyuremote-push-agent
sudo systemctl status qiuyuremote-push-agent
sudo journalctl -u qiuyuremote-push-agent -f
sudo journalctl -u qiuyuremote-push-agent -n 100
sudo journalctl -u qiuyuremote-push-agent -b
```

## Диагностика

Если уведомления не приходят, сначала проверьте привязку Agent и диагностику служб:

```sh
curl http://127.0.0.1:8765/v1/state
curl http://127.0.0.1:8765/v1/diagnostics
```

Если код привязки уже использован, значит он уже выполнил привязку. Очистите `pairingCode` и перезапустите Agent либо создайте новый код в QiuyuRemote.

Если qBittorrent возвращает 403, убедитесь, что `baseUrl` указывает на базовый адрес Web UI без `/api/v2`, а логин, пароль и прокси Cookie настроены верно.

Для локальной ошибки HTTPS-сертификата aria2 можно установить:

```json
"allowInvalidTLS": true
```
