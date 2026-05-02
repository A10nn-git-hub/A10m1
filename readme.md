# Игровой Центр

Telegram WebApp с мини-играми, профилем игрока, магазином, инвентарем, друзьями, личными сообщениями, домашним лобби и простой админ-панелью. Проект написан как статический фронтенд без сборщика: `index.html` напрямую подключает CSS и JS-файлы.

## Общая архитектура

`index.html` содержит разметку всех вкладок, игровых экранов и модалок. Скрипты подключаются в фиксированном порядке:

```html
<script src="./js/core.js"></script>
<script src="./js/admin.js"></script>
<script src="./js/social-lobby.js"></script>
<script src="./js/game_main.js"></script>
<script src="./js/game_coordination.js"></script>
<script src="./js/game_battle_royale.js"></script>
<script src="./js/boot.js"></script>
```

Основные файлы:

- `css/styles.css` - общий дизайн приложения, главного экрана, лобби, сообщений, модалок и игр.
- `js/core.js` - Telegram WebApp init, Firebase init, профиль, монеты, магазин, инвентарь, статистика, версии, общие UI helpers.
- `js/admin.js` - админ-панель, промокоды, выдача/изъятие монет и предметов, кастомные предметы.
- `js/social-lobby.js` - друзья, заявки, превью игроков, сообщения, лобби, приглашения, системный ИИ-друг, статичные агенты в лобби.
- `js/game_main.js` - основные мини-игры: математика, буквы, поиск, крестики-нолики, кликер, AI-режимы.
- `js/game_coordination.js` - игры на координацию.
- `js/game_battle_royale.js` - 2D survival/battle royale с Firebase-синхронизацией реальных игроков.
- `js/boot.js` - финальная точка старта: вызывает `renderAppVersionInfo()` и `initApp()`.
- `HowToAutoTest.md` - инструкция для headless Edge + mock Telegram + реальная Firebase RTDB.

## Telegram

В `index.html` подключается официальный SDK:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

В `core.js` используется `window.Telegram.WebApp`. При старте вызываются `expand()`, `requestFullscreen()` при наличии и `ready()`.

ID игрока берется из Telegram, `tg.CloudStorage`, `localStorage` или генерируется как 4-значный fallback. Для тестов вне Telegram нужен mock, см. `HowToAutoTest.md`.

## Firebase

Используется Firebase JS SDK v8:

```html
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
```

Основной проект:

- `projectId`: `mini-games-b9400`
- `databaseURL`: `https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app`
- хранилище: Firebase Realtime Database.

Важные helper-функции:

- `ensureFirebaseReady()` - готовит Firebase Auth, но не ломает приложение при отключенном anonymous auth.
- `ensureFirebaseAccess()` - пытается войти анонимно и продолжает работу по правилам RTDB, если Auth недоступен.
- `readDbOnce(path, fallbackValue, context)` - безопасное чтение.
- `readDbOnceStrict(path, context)` - строгое чтение.
- `writeDb(path, value, context)` - запись.
- `updateDbPaths(updates, context)` - multi-location update.

## Структура Realtime Database

Основные ветки:

```text
users/
admins/
lobbies/
custom_items/
promos/
beta_bans/
dm_threads/
dm_messages/
```

### `users/{userId}`

Профиль игрока:

```json
{
  "name": "Игрок",
  "avatar": "😎",
  "eqName": "",
  "pMedals": [],
  "coins": 15,
  "gamesPlayed": 1,
  "playTimeMs": 90000,
  "inventory": {},
  "friends": { "1234": true },
  "friend_reqs": { "5678": true },
  "invite": { "lId": "1234", "host": "Игрок" },
  "message_threads": {
    "1234": {
      "chatId": "1234_8451",
      "friendId": "1234",
      "lastText": "Привет",
      "lastFrom": "8451",
      "updatedAt": 1710000005000,
      "unread": 0
    }
  },
  "aiStats": {},
  "pvpStats": {}
}
```

Монеты нельзя писать из обычного `syncDBProfile()`: они меняются отдельными операциями (`addCoins()`, покупки, промокоды, админка).

### `lobbies/{lobbyId}`

Домашнее лобби обычно имеет `lobbyId = hostId`:

```json
{
  "host": "8451",
  "game": "clicker",
  "status": "waiting",
  "clickTime": 15,
  "invites": {
    "9123": { "from": "8451", "createdAt": 1710000000000 }
  },
  "players": {
    "8451": { "name": "Игрок", "avatar": "😎", "eqName": "", "pMedals": [], "joinedAt": 1710000000000 },
    "ИИ": { "name": "ИИ", "avatar": "🤖", "joinedAt": 1710000001000 }
  }
}
```

Состояния: `waiting`, `playing`, `playing_ai`.

В коде есть важное разделение:

- `Главный экран` - это домашнее состояние игрока, где в `players` есть только он сам и нет активных приглашений. Технически запись `lobbies/{myId}` может существовать, но для пользователя это не считается лобби. С главного экрана можно запускать игру одному.
- `Лобби` начинается, когда в домашнюю запись добавился другой участник, ИИ или хотя бы одно активное приглашение в `invites`. В таком состоянии появляется кнопка `ВЫЙТИ`; при выходе игрок возвращается на главный экран.
- Приглашать в текущее лобби может любой участник. Кикать участников может только текущий хост.
- Если хост вышел явно, хостом становится следующий реальный игрок по порядку `joinedAt`; если таких нет, лобби закрывается. Если хост выключил телефон, его запись удаляется через `onDisconnect()`, а оставшиеся клиенты выбирают нового хоста по тому же порядку.
- Если игрока кикнули, его клиент закрывает чужое лобби локально и автоматически создает свой домашний главный экран.

Для 2D survival добавляется подветка:

```text
lobbies/{lobbyId}/br/players/{playerId}
lobbies/{lobbyId}/br/bots
lobbies/{lobbyId}/br/zone
```

Реальные игроки публикуют `x`, `y`, `hp`, `a`, `kills`, `alive`, а другие клиенты читают их как удаленных игроков. Это убирает старое поведение, где друг на экране был локальным ботом с его именем.

### Сообщения

Личные сообщения нельзя отправлять ИИ (`ИИ`, `ИИ2`, `БОТ` и т.п.).

`chatId` строится как отсортированная пара ID:

```js
function getDmChatId(a, b) {
  return [String(a), String(b)].sort().join('_');
}
```

Ветки:

```text
dm_threads/{chatId}
dm_messages/{chatId}/{messageId}
users/{userId}/message_threads/{friendId}
users/{userId}/lobby_invites/{inviteKey}
```

Отправка сообщения идет через multi-location update: обновляется thread, само сообщение и превью переписки у обоих игроков. Поля превью получателя обновляются точечными путями, чтобы не сбросить старый `unread`; `unread` получателя увеличивается через `transaction()`.

Приглашение в лобби хранится как специальное сообщение `type: "lobby_invite"` в обычном чате с пригласившим игроком. Дополнительно создается `users/{recipientId}/lobby_invites/{inviteKey}`, чтобы приглашение можно было принять после того, как верхнее уведомление исчезло.

## Главная, друзья и лобби

Стартовая вкладка - `Главная` (`tab-friends`). После загрузки профиля вызывается `ensureHomeLobby()`, поэтому игрок сразу попадает в домашнее лобби.

На главной есть:

- карточка игрока: аватар, имя, ID;
- увеличенный список друзей;
- системный ИИ-друг в списке без записи `users/ИИ` в Firebase;
- кнопка `ВЫЙТИ` появляется только в настоящем лобби: когда есть другой игрок, ИИ или активное приглашение;
- статичные CSS-агенты в лобби: один агент на каждого игрока, максимум 5, расставлены веером с перекрытием вместо старых плюсовых слотов;
- превью игрока при добавлении по ID: широкая строка с аватаром, ником, ID и кнопкой `ДОБАВИТЬ В ДР`; после отправки заявки появляются действия столбиком `ПРОФИЛЬ`, `ПРИГЛАСИТЬ В ЛОББИ`, `СООБЩЕНИЕ`, `ЗАКРЫТЬ`; статистика по клику на строку не открывается.

## Сообщения

Вкладка `Сообщения` находится между `Инвентарь` и `Настройки`.

UI:

- слева список всех переписок, где друзья идут выше остальных игроков;
- справа активный чат;
- чат можно открыть из карточки друга, из превью игрока или из списка переписок с любым игроком;
- сообщения синхронизируются через Firebase RTDB;
- рядом с вкладкой `Сообщения` показывается красный счетчик суммы непрочитанных сообщений;
- поле сообщения ограничено `maxlength=300`;
- ИИ не отображается как адресат сообщений.

## Магазин, инвентарь и боксы

Предметы описаны в `SHOP_ITEMS` в `js/core.js`. Основные типы:

- `avatar`
- `name`
- `medal`
- `bg`
- `box`
- `case`

Дропы боксов определяются только через `boxTarget`. Предпросмотр и реальная рулетка используют одну функцию `getBoxPrizeItems(boxId)`, поэтому список "ВОЗМОЖНЫЕ ПРЕДМЕТЫ" совпадает с тем, что реально может выпасть.

Глобальный счетчик монет скрыт по умолчанию и показывается только там, где монеты нужны для действия: в магазине и админ-панели. Купленные боксы в магазине не получают серый класс `bought`, потому что боксы можно покупать повторно; количество уже купленных боксов отображается кнопкой открытия.

Кастомные предметы из `custom_items/{itemId}` добавляются в `SHOP_ITEMS` через `applyCustomItems()`.

## Мини-игры

Список игровых ID лежит в `GAME_NAMES` в `core.js`.

Основные группы:

- `math1`, `math2`, `math3` - математика.
- `let1`, `let3`, `let4`, `let5` - буквы и слова.
- `coord1` ... `coord5` - координация.
- `hidden` - поиск предметов.
- `tictactoe` - крестики-нолики.
- `clicker` - кликер.
- `br_2d` - 2D survival с Firebase-позициями реальных игроков, сглаженной отрисовкой удаленных игроков и ботами только при наличии ИИ-участника в лобби.
- `br_3d` - внешний 3D parkour через `window.location.href`.
- `ai1`, `ai2` - AI-режимы.

Запуск идет через лобби: хост выбирает режим, пишет `lobbies/{lobbyId}/game`, меняет `status` на `playing`, а слушатели у всех игроков вызывают `startLocalGameUI()`.

## AI-режимы

В коде есть `fetchGeminiAPI()` и `fetchAndPlayTTS()` для Google Gemini API. Сейчас `apiKey` пустой:

```js
const apiKey = "";
```

Ключ должен прокидываться серверной стороной или другим безопасным способом.

## Тестирование

Быстрая проверка синтаксиса:

```powershell
node --check js/core.js
node --check js/admin.js
node --check js/social-lobby.js
node --check js/game_main.js
node --check js/game_coordination.js
node --check js/game_battle_royale.js
node --check js/boot.js
```

Проверка whitespace:

```powershell
git diff --check
```

Для UI/Firebase-проверки вне Telegram использовать `HowToAutoTest.md`: локальный HTTP origin, mock `window.Telegram.WebApp`, headless Edge и реальная Firebase RTDB.

Сообщения проверять двумя debug-игроками: создать дружбу в Firebase, открыть вкладку `Сообщения`, отправить текст с одного ID и убедиться, что он появился у второго в `dm_messages/{chatId}` и DOM.

Для счетчика сообщений дополнительно проверить, что `users/{userId}/message_threads/*/unread` суммируется в красный badge вкладки `Сообщения`, а при открытии чата соответствующий `unread` сбрасывается в `0`.

## Важные ограничения

- Это не npm/Vite/React-проект. Сборки нет, зависимости подключаются CDN-скриптами.
- JS-файлы работают через глобальные переменные и функции, без `import/export`.
- Порядок подключения скриптов критичен.
- Firebase Auth может быть не настроен. Клиент продолжает работу, если правила RTDB разрешают доступ без auth.
- Правила Firebase должны учитывать новые DM-ветки (`dm_threads`, `dm_messages`, `users/*/message_threads`).
- Сообщения фильтруют ИИ на клиенте; строгая безопасность зависит от правил Firebase.
- 2D survival теперь синхронизирует реальных игроков через RTDB и сглаживает чужие координаты только на рендере; попадания продолжают использовать авторитетные RTDB-координаты. Это клиентская модель, не авторитарный игровой сервер.
