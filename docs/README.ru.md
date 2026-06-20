# QiuyuRemote Push Agent

Языки: [English](../README.md) | [简体中文](README.zh-Hans.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Русский

Публичный репозиторий: <https://github.com/iansiu/PushAgent>

Руководство по приложению: [QiuyuRemote App Guide](APP_GUIDE.ru.md)

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

## Нужен ли Push Agent?

Нет, не обязательно. QiuyuRemote можно использовать без Push Agent. Если вам нужно только управлять существующим qBittorrent, Transmission или aria2, приложение подключается напрямую к Web API или RPC endpoint этих сервисов.

Push Agent — это необязательный серверный компонент для функций, которые приложение не может надежно выполнять в фоне самостоятельно.

| Функция | Требуется Push Agent |
| --- | --- |
| Управление задачами qBittorrent, Transmission или aria2 | Нет |
| Добавление, пауза, продолжение, удаление, лимиты и просмотр деталей qBittorrent, Transmission или aria2 | Нет |
| Просмотр и воспроизведение файлов через WebDAV | Нет, но WebDAV нужно настроить отдельно |
| Локальные офлайн-загрузки QiuyuRemote | Нет |
| Уведомления о локальных офлайн-загрузках | Нет, QiuyuRemote планирует их локально |
| Уведомления о завершении или ошибке удаленной загрузки | Да |
| Уведомления о задаче без данных длительное время | Да |
| Уведомления об отключении или восстановлении сервера загрузок | Да |
| Загрузки yt-dlp | Да |
| Управление Cookie для yt-dlp | Да |
| Отправка URL из YouTube, TikTok и других приложений в QiuyuRemote для удаленной загрузки | Да, нужен настроенный yt-dlp Push Agent |

Иными словами, Push Agent не является обязательным условием для базового использования QiuyuRemote. Он нужен для серверного мониторинга, push-уведомлений и yt-dlp.

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

Сначала установите yt-dlp на сервере. Если вы оставляете формат `bv*+ba/b`, также рекомендуется установить ffmpeg, потому что некоторые сайты скачивают видео и аудио отдельными потоками, а затем объединяют их. В диагностике отображаются `ytDlpVersion`, `ffmpegAvailable` и `ffmpegVersion`.

Некоторые сайты, особенно YouTube, могут требовать login cookies. Это не ошибка Push Agent; это требование yt-dlp. Экспортируйте `cookies.txt` в формате Netscape из браузера, где вы уже вошли в аккаунт, затем импортируйте его в Cookie Management QiuyuRemote или загрузите файл на сервер и укажите абсолютный путь в `cookiesPath`.

```json
"cookiesPath": "/root/PushAgent/cookies/all-cookies.txt"
```

Один файл cookies может содержать cookies для нескольких доменов. yt-dlp использует только cookies, подходящие к URL. Не публикуйте этот файл.

Порядок выбора Cookie: `cookiesPath`, явно заданный для задачи; Cookie соответствующего сайта, импортированный в QiuyuRemote и сохраненный в `cookiesDir`; fallback `cookiesPath` из `config.json`; без Cookie. Поэтому сайтный Cookie, импортированный в приложении, имеет приоритет над файлом из конфига. Если импортированный файл пустой, истекший или некорректный, задача завершится Cookie-ошибкой и не будет тихо переключаться на конфиг. Чтобы снова использовать fallback `cookiesPath`, обновите или удалите импортированный Cookie этого сайта в приложении.

В настольных браузерах расширение `Get cookies.txt LOCALLY` может экспортировать стандартный файл Cookie в формате Netscape. На iOS можно использовать Microsoft Edge с расширением `Cookie-Editor`: задайте Export Format `Netscape`, скопируйте Cookie текущего сайта и запустите Shortcut `Create a new cookie file`: `https://www.icloud.com/shortcuts/21cc1f1ace944cb6aec28c25e833510f`. Shortcut создаст Cookie-файл в `On My iPhone/Downloads`, после чего его можно напрямую импортировать в QiuyuRemote.

Срок действия Cookie, показанный в QiuyuRemote, является оценкой. Реальная доступность может измениться из-за выхода из аккаунта, смены пароля, проверок безопасности аккаунта, изменения IP/региона сервера, принудительной инвалидизации сайтом, rate limit или изменений extractor в yt-dlp.

YouTube также может требовать внешнюю JavaScript-поддержку yt-dlp для решения signature и `n` challenge. Установите Deno и сделайте его доступным и для текущего shell, и для systemd:

```bash
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
/usr/local/bin/deno --version
python3 -m pip install -U "yt-dlp[default]"
apt install -y ffmpeg
```

Загрузите YouTube cookies, например в `/root/PushAgent/cookies/youtube.txt`, и сначала проверьте один видео-URL прямо на сервере. Добавляйте `--no-playlist`, чтобы URL с `list=` не разворачивался в загрузку всего плейлиста.

```bash
chmod 600 /root/PushAgent/cookies/youtube.txt
yt-dlp -F \
  --no-playlist \
  --cookies /root/PushAgent/cookies/youtube.txt \
  --remote-components ejs:github \
  --js-runtimes deno:/usr/local/bin/deno \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

В норме вывод содержит `[jsc:deno] Solving JS challenges using deno` и реальные audio/video formats, например 720p или 1080p. Если видны только storyboard images, проверьте yt-dlp, Deno и EJS-компоненты. `HTTP Error 429: Too Many Requests` означает временный rate limit для IP сервера; подождите или настройте `proxy`.

После успешного теста добавьте те же параметры в конфиг сервиса yt-dlp:

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

После изменения конфига перезапустите Agent:

```bash
systemctl restart pushagent
```

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

### 6. Постоянный запуск Agent

```sh
npm start
```

Для рабочего сервера рекомендуется использовать systemd или другой менеджер процессов. Полный пример systemd приведен ниже.

## Web Console

```text
http://YOUR_DOWNLOAD_SERVER_IP:8765
```

В Web Console можно смотреть состояние Agent, Relay identity, диагностику служб, привязанные устройства, коды привязки, последние события, тестовые уведомления и проверку обновлений. Глобальное управление устройствами, приложениями и Relay nodes находится в админ-панели Push Relay.

## Добавление устройств

Один Agent может отправлять уведомления на несколько устройств QiuyuRemote. Не нужно запускать отдельный Agent для каждого iPhone, iPad или Mac.

Самый простой способ:

1. Создайте новый код привязки на новом устройстве QiuyuRemote.
2. Откройте Web Console Agent.
3. Введите код в разделе Pair Device.
4. Привяжите новое устройство к существующему Agent.

Также можно привязать устройство через API:

```sh
curl -X POST http://127.0.0.1:8765/v1/agent/pair \
  -H 'Content-Type: application/json' \
  -d '{"pairingCode":"NEW-CODE","agentName":"Home Agent"}'
```

Можно добавить несколько свежих кодов в `config.json` перед запуском:

```json
"pairingCode": "AAAA-BBBB, CCCC-DDDD"
```

Поддерживается и более явный формат массива:

```json
"pairingCodes": ["AAAA-BBBB", "CCCC-DDDD"]
```

Повторяющиеся коды в одном конфиге пропускаются. Использованные, истекшие или отозванные коды отображаются в терминале и в списке событий Web Console.

Если Relay identity, сохраненная в `data/relay-identity.json`, больше не существует на Push Relay, ручное pairing из Web Console один раз повторит запрос без старой identity и сохранит новый Agent ID, возвращенный Relay. В обычной ситуации Agent по-прежнему не заменяет сохраненную действующую identity другим Agent ID молча.

Если в одном Agent включено несколько yt-dlp сервисов, старые запросы без query продолжают использовать первый включенный yt-dlp. Для изоляции нескольких yt-dlp укажите в QiuyuRemote путь `v1/ytdlp?server=<id-or-name>`. Selector может быть `id`, `name`, `storageKey`, endpoint или base URL сервиса из Web Console Agent.

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

В Web Console введите тот же key в разделе Access. Если страница показывает `API Key Required`, значит браузер не открывает Agent с той же машины или введенный key не совпадает с `config.json`.

## Relay credentials

Обычным пользователям достаточно оставить стандартные адреса Relay:

```text
https://push.qiuyu.org
https://push1.qiuyu.org
```

Не заполняйте эти статические поля вручную, если вы не делаете специальное развертывание:

- `relay.agentId`
- `relay.secret`

Во время привязки Push Relay возвращает Agent ID и signing secret. Agent автоматически сохраняет их в `data/relay-identity.json`. Не копируйте secret в `config.json`, если это не специальное статическое развертывание.

Для разработки или тестирования приватного Relay можно задать свои `relay.urls`:

```json
"relay": {
  "urls": [
    "https://push.example.com",
    "https://push-backup.example.com"
  ]
}
```

Статические Relay credentials также поддерживаются только для специальных развертываний:

```json
"relay": {
  "agentId": "agent_xxx",
  "secret": "relay-signing-secret"
}
```

## Уведомления

Agent отправляет события для:

- завершения загрузки;
- ошибки загрузки;
- долгого отсутствия данных у активной задачи;
- отключения отслеживаемого сервера;
- восстановления отслеживаемого сервера;
- тестовых push-событий.

Первичное сканирование считается базовой линией. Уже завершенные или ошибочные задачи, найденные при первом запуске Agent, не создают новых уведомлений. Уведомления отправляются только для последующих изменений конечного состояния.

Для активных загрузок Agent записывает последнее время, когда задача сообщала скорость загрузки или рост прогресса. Если незавершенная задача не получает данных в течение `monitor.inactiveDownloadNoticeSeconds` секунд, Agent отправляет одно уведомление `download_inactive`. Состояние сбрасывается только после того, как задача снова получит данные, поэтому уведомление не повторяется на каждом цикле опроса.

Если Push Relay принимает событие, но ни одно устройство не получает его, Agent все равно записывает задачу как уже отправленную. Это предотвращает повторную отправку одной и той же завершенной или ошибочной задачи на каждом цикле, когда все устройства отключены или еще нет привязанных устройств.

## Справочник полей

| Поле | Описание |
| --- | --- |
| `host` | Адрес прослушивания Agent. По умолчанию `127.0.0.1`, только локальный доступ. Используйте `0.0.0.0` только если Web Console должен открываться с других машин, и сначала задайте `apiKey`. |
| `port` | Порт Agent. По умолчанию `8765`. |
| `apiKey` | Локальный API key. Можно оставить пустым только для локального доступа; для удаленного доступа задайте случайное значение. |
| `pairingCode` | Один код или несколько кодов, разделенных запятыми, пробелами или точками с запятой. После успешной привязки очистите поле. |
| `pairingCodes` | Необязательный массив кодов привязки. |
| `agentName` | Имя Agent, отображаемое в Push Relay, например `Home Agent`. |
| `dataDir` | Каталог для `relay-identity.json`, состояния задач и состояния серверов. |
| `relay.urls` | Адреса Push Relay. Пример уже содержит основной и резервный Relay Qiuyu. |
| `monitor.pollIntervalSeconds` | Интервал опроса служб загрузки. По умолчанию `30`, минимальный runtime-интервал `10`. |
| `monitor.inactiveDownloadNoticeEnabled` | Отправлять ли уведомление, когда активная незавершенная задача долго не получает данные. По умолчанию `true`. |
| `monitor.inactiveDownloadNoticeSeconds` | Порог отсутствия данных в секундах. По умолчанию `1800`, то есть 30 минут. |
| `updateCheck.enabled` | Проверять ли новую публичную версию PushAgent на Web странице Agent. По умолчанию `true`. |
| `updateCheck.repositoryURL` | GitHub-страница, открываемая из Web страницы Agent. |
| `updateCheck.url` | URL метаданных обновления. По умолчанию читает version из публичного `package.json` на GitHub. |
| `updateCheck.intervalSeconds` | Минимальный интервал кеширования проверки обновлений. По умолчанию `3600`. |
| `updateCheck.timeoutSeconds` | Таймаут сети для проверки обновлений. По умолчанию `4`. |
| `servers` | Конфиги подключений qBittorrent, Transmission, aria2 и опционально yt-dlp. |
| `servers[].name` | Отображаемое имя. Можно менять в любое время. |
| `servers[].type` | Тип службы загрузки. Поддерживаются `qbit`, `transmission`, `aria2`, `ytdlp`. |
| `servers[].enabled` | Отслеживать ли эту службу. Если отсутствует или `true`, служба включена; `false` оставляет шаблон без мониторинга. |
| `servers[].username` / `servers[].password` | Данные входа для qBittorrent и Transmission. Оставьте пустыми, если авторизация не нужна. |
| `servers[].token` | aria2 RPC secret token. Оставьте пустым, если не нужен. |
| `servers[].allowInvalidTLS` | Разрешить недействительные TLS-сертификаты для локального сервера, в основном для локального aria2 HTTPS RPC. |
| `servers[].liveEvents` | Только aria2. Включает WebSocket-события завершения. По умолчанию включено. |
| `servers[].stoppedTaskLimit` | Только aria2. Количество остановленных задач, запрашиваемых при опросе. |
| `servers[].binaryPath` | Только yt-dlp. Имя команды или абсолютный путь, по умолчанию `yt-dlp`. |
| `servers[].ffmpegPath` | Только yt-dlp. Имя команды ffmpeg или абсолютный путь, по умолчанию `ffmpeg`. |
| `servers[].downloadDir` | Только yt-dlp. Каталог загрузки по умолчанию. Каталог, указанный для задачи в QiuyuRemote, имеет приоритет. |
| `servers[].storageKey` | Только yt-dlp. Стабильный key для хранения истории задач и cookies сайтов. Не меняйте его при обновлении или смене каталога загрузки. |
| `servers[].statePath` | Только yt-dlp. Путь к JSON-файлу истории задач. По умолчанию `data/yt-dlp-tasks/<storageKey>.json`. |
| `servers[].historyLimit` | Только yt-dlp. Количество записей истории задач, сохраняемых Push Agent. По умолчанию `1000`. |
| `servers[].format` | Только yt-dlp. Формат selector по умолчанию. |
| `servers[].outputTemplate` | Только yt-dlp. Шаблон имени выходного файла. По умолчанию используется `%(title).80B.%(ext)s`, чтобы заголовки были короче. |
| `servers[].cookiesPath` | Только yt-dlp. Fallback-файл Cookie в формате Netscape, используемый когда нет Cookie, заданного задачей или импортированного из приложения для сайта. |
| `servers[].cookiesDir` | Только yt-dlp. Каталог, где Cookie Management QiuyuRemote хранит сайтные Cookie. По умолчанию `data/ytdlp-cookies/<storageKey>`. |
| `servers[].proxy` | Только yt-dlp. Proxy, передаваемый в yt-dlp. |
| `servers[].requireCookiesForYoutube` | Только yt-dlp. Если `true`, YouTube URL заранее возвращает понятную ошибку, когда нет Cookie в задаче, приложении или fallback-конфиге. |
| `servers[].cleanHashtags` | Только yt-dlp. По умолчанию `true`; удаляет trailing hashtag-текст из заголовков перед созданием имени файла. |
| `servers[].maxConcurrent` | Только yt-dlp. Максимальное число активных процессов yt-dlp. По умолчанию `10`. |
| `servers[].noPlaylist` | Только yt-dlp. По умолчанию `true`; не дает одному URL раскрыться в загрузку всего плейлиста. |
| `servers[].restrictFilenames` | Только yt-dlp. Использует более безопасные символы в именах файлов. |
| `servers[].extraArgs` | Только yt-dlp. Массив дополнительных аргументов для продвинутой настройки. Agent передает их как массив аргументов spawn, а не shell-строку. Аргументы, управляемые QiuyuRemote, например `--output`, `--format`, `--cookies`, `--proxy`, `--paths`, здесь игнорируются для предсказуемого поведения. |

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

Если очень быстрые задачи aria2 пропускаются, держите `liveEvents` включенным и при необходимости увеличьте `max-download-result` в aria2.

## Переменные окружения

Большинству пользователей они не нужны. Они полезны для менеджеров сервисов или кастомных развертываний:

- `QIUYU_AGENT_CONFIG`: путь к конфигурационному файлу
- `QIUYU_AGENT_HOST`
- `QIUYU_AGENT_PORT`
- `QIUYU_AGENT_API_KEY`
- `QIUYU_AGENT_PAIRING_CODE`
- `QIUYU_AGENT_PAIRING_CODES`: коды привязки через запятую
- `QIUYU_AGENT_NAME`
- `QIUYU_AGENT_DATA_DIR`
- `QIUYU_AGENT_POLL_INTERVAL_SECONDS`
- `QIUYU_RELAY_URL`: кастомный Relay URL для разработки
- `QIUYU_RELAY_URLS`: список кастомных Relay URL через запятую
- `QIUYU_RELAY_AGENT_ID`: статический Relay Agent ID для специальных развертываний
- `QIUYU_RELAY_SECRET`: статический Relay Agent secret для специальных развертываний
- `QIUYU_AGENT_UPDATE_CHECK_ENABLED`
- `QIUYU_AGENT_UPDATE_CHECK_URL`
- `QIUYU_AGENT_REPOSITORY_URL`
- `QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS`
- `QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS`
