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
  "players": {
    "8451": { "name": "Игрок", "avatar": "😎", "eqName": "", "pMedals": [] },
    "ИИ": { "name": "ИИ", "avatar": "🤖" }
  }
}
```

Состояния: `waiting`, `playing`, `playing_ai`.

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
```

Отправка сообщения идет через multi-location update: обновляется thread, само сообщение и превью переписки у обоих игроков. `unread` получателя увеличивается через `transaction()`.

## Главная, друзья и лобби

Стартовая вкладка - `Главная` (`tab-friends`). После загрузки профиля вызывается `ensureHomeLobby()`, поэтому игрок сразу попадает в домашнее лобби.

На главной есть:

- карточка игрока: аватар, имя, ID;
- увеличенный список друзей;
- системный ИИ-друг в списке без записи `users/ИИ` в Firebase;
- кнопка `+ Пригласить` в лобби;
- кнопка `Выйти`, которая вручную останавливает автосоздание лобби;
- статичные CSS-агенты в лобби: один агент на каждого игрока, максимум 5;
- превью игрока при добавлении по ID: широкая строка с аватаром, ником, ID, кнопкой `ДОБАВИТЬ В ДР`, статистикой по клику и действиями `Профиль`, `ПРИГЛАСИТЬ В ЛОББИ`, `СООБЩЕНИЕ`.

## Сообщения

Вкладка `Сообщения` находится между `Инвентарь` и `Настройки`.

UI:

- слева список реальных друзей и последние сообщения;
- справа активный чат;
- чат можно открыть из карточки друга или из превью игрока;
- сообщения синхронизируются через Firebase RTDB;
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
- `br_2d` - 2D survival с Firebase-позициями реальных игроков.
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

## Важные ограничения

- Это не npm/Vite/React-проект. Сборки нет, зависимости подключаются CDN-скриптами.
- JS-файлы работают через глобальные переменные и функции, без `import/export`.
- Порядок подключения скриптов критичен.
- Firebase Auth может быть не настроен. Клиент продолжает работу, если правила RTDB разрешают доступ без auth.
- Правила Firebase должны учитывать новые DM-ветки (`dm_threads`, `dm_messages`, `users/*/message_threads`).
- Сообщения фильтруют ИИ на клиенте; строгая безопасность зависит от правил Firebase.
- 2D survival теперь синхронизирует реальных игроков через RTDB, но это клиентская модель, не авторитарный игровой сервер.
