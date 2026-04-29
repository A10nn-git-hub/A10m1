# Игровой Центр

Telegram WebApp с мини-играми, профилем игрока, магазином, инвентарем, друзьями, лобби и простой админ-панелью. Приложение написано как статический фронтенд без сборщика: `index.html` подключает CSS и несколько JS-файлов напрямую.

## Общая Архитектура

`index.html` содержит HTML-разметку всех экранов, модалок и игровых контейнеров. В конце страницы подключаются скрипты в фиксированном порядке:

```html
<script src="./js/core.js"></script>
<script src="./js/admin.js"></script>
<script src="./js/social-lobby.js"></script>
<script src="./js/game_main.js"></script>
<script src="./js/game_coordination.js"></script>
<script src="./js/game_battle_royale.js"></script>
<script src="./js/boot.js"></script>
```

Порядок важен: `core.js` создает общие переменные, Firebase-подключение и базовые функции, а остальные модули используют их как глобальные.

Основные файлы:

- `css/styles.css` - все стили приложения.
- `js/core.js` - Telegram WebApp init, Firebase init, профиль, монеты, магазин, инвентарь, статистика, общие UI helpers.
- `js/admin.js` - админ-панель, промокоды, выдача/изъятие монет и предметов, кастомные предметы.
- `js/social-lobby.js` - друзья, заявки, приглашения, создание/закрытие лобби, синхронизация игроков лобби.
- `js/game_main.js` - основные мини-игры: математика, буквы, поиск, крестики-нолики, кликер, AI-режимы.
- `js/game_coordination.js` - игры на координацию.
- `js/game_battle_royale.js` - 2D battle royale режим.
- `js/boot.js` - финальная точка старта: вызывает `renderAppVersionInfo()` и `initApp()`.
- `HowToAutoTest.md` - инструкция, как автоматически запускать приложение в headless Edge с mock Telegram и реальной Firebase DB.

## Подключение К Telegram

В `index.html` подключается официальный Telegram WebApp SDK:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

В `core.js` приложение берет объект:

```js
const tg = window.Telegram.WebApp;
```

При старте вызываются:

- `tg.expand()` - раскрыть WebApp.
- `tg.requestFullscreen()` - попытаться открыть fullscreen, если метод доступен.
- `tg.ready()` - сообщить Telegram, что приложение готово.

Данные игрока берутся из нескольких источников:

- `tg.initDataUnsafe.user.id` - Telegram ID пользователя, если приложение открыто внутри Telegram.
- `tg.initDataUnsafe.user.first_name` - имя из Telegram как fallback.
- `tg.CloudStorage` - локальное Telegram-хранилище для `my_id`, `player_coins`, `my_name` и старых локальных данных.
- `localStorage` - fallback для браузера и режима разработки.

Если приложение тестируется вне Telegram, нужно замокать `window.Telegram.WebApp`. Рабочий способ описан в `HowToAutoTest.md`.

## Firebase

Используется Firebase JS SDK v8:

```html
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
```

Конфиг находится в `js/core.js`.

Проект:

- `projectId`: `mini-games-b9400`
- `databaseURL`: `https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app`
- Основное хранилище: Firebase Realtime Database.

В коде есть обертки:

- `ensureFirebaseReady()` - пытается подготовить Firebase Auth.
- `ensureFirebaseAccess()` - пытается получить anonymous auth, но если Firebase Auth недоступен, продолжает работу с правилами базы.
- `readDbOnce(path, fallbackValue, context)` - безопасное чтение с fallback.
- `readDbOnceStrict(path, context)` - строгое чтение, ошибка не глушится.
- `writeDb(path, value, context)` - запись по пути.
- `updateDbPaths(updates, context)` - multi-location update.

Важно: на момент последней проверки Firebase Auth в проекте возвращал `CONFIGURATION_NOT_FOUND` / `auth/internal-error`. Поэтому текущая рабочая схема зависит от правил Realtime Database, которые разрешают доступ без `auth`. Если правила снова поставить `auth != null`, клиент перестанет читать профиль и будет показывать fallback-значения.

## Структура Realtime Database

Основные ветки базы:

```text
users/
admins/
lobbies/
custom_items/
promos/
beta_bans/
```

### `users/{userId}`

Профиль игрока. `userId` - внутренний ID приложения. Обычно это Telegram ID или сохраненный `my_id`.

Пример полей:

```json
{
  "name": "Игрок",
  "avatar": "😎",
  "eqName": "",
  "pMedals": [],
  "coins": 15,
  "gamesPlayed": 1,
  "playTimeMs": 90000,
  "inventory": {
    "gif_poop": 1
  },
  "friends": {
    "1234": true
  },
  "friend_reqs": {
    "5678": true
  },
  "invite": {
    "lId": "1234",
    "host": "Игрок"
  },
  "used_promos": {
    "CODE": true
  },
  "flags": {
    "stars_received": true
  },
  "aiStats": {},
  "pvpStats": {}
}
```

Важное правило по монетам: обычный `syncDBProfile()` не должен писать `coins`, потому что старый клиент с неправильным локальным `globalCoins` может случайно перезаписать реальные монеты. Монеты меняются отдельными операциями: `addCoins()`, покупка в магазине, админские операции, промокоды.

### `lobbies/{lobbyId}`

Лобби для совместной игры. Обычно `lobbyId` равен ID хоста.

Пример:

```json
{
  "host": "8451",
  "game": "clicker",
  "status": "waiting",
  "clickTime": 15,
  "players": {
    "8451": {
      "name": "Игрок",
      "avatar": "😎",
      "eqName": "",
      "pMedals": []
    },
    "ИИ": {
      "name": "ИИ",
      "avatar": "🤖"
    }
  }
}
```

Состояния:

- `waiting` - лобби создано, игра не запущена.
- `playing` - обычная мини-игра запущена.
- `playing_ai` - AI-режим запущен.

### `admins/{userId}`

Флаг доступа к админ-панели:

```json
{
  "1512": true
}
```

Также в коде есть hardcoded dev ID: `1512` и `1138240410`.

### `custom_items/{itemId}`

Кастомные предметы, созданные через админку. При загрузке они добавляются в массив `SHOP_ITEMS`.

Пример:

```json
{
  "custom_hat": {
    "id": "custom_hat",
    "name": "Шляпа",
    "type": "avatar",
    "price": 100,
    "icon": "🎩",
    "plainIcon": "🎩",
    "desc": "Кастомный предмет",
    "rarity": "RARE",
    "boxTarget": "no"
  }
}
```

### `promos/{code}`

Промокоды:

```json
{
  "GIFT": {
    "acts": 10,
    "rew": 100,
    "items": ["gif_poop"],
    "exp": 0
  }
}
```

- `acts` - сколько активаций осталось.
- `rew` - награда монетами.
- `items` - список предметов.
- `exp` - timestamp истечения или `0` без срока.

### `beta_bans`

Бета-бан игроков:

```json
{
  "all": true,
  "8451": true
}
```

Если игрок не админ и забанен, показывается `#beta-ban-overlay`.

## Старт Приложения

`js/boot.js` вызывает:

```js
renderAppVersionInfo();
initApp();
```

`initApp()`:

1. Читает `my_id` из `localStorage`, `tg.CloudStorage` или Telegram user ID.
2. Если ID нет, генерирует случайный 4-значный ID.
3. Подключает синхронизацию кастомных предметов и инвентаря.
4. Читает профиль из `/users/{myId}`.
5. Обновляет UI профиля, монет и статистики.
6. Подписывается на монеты, друзей, заявки, приглашения, beta bans.
7. Регистрирует keyboard/mouse handlers для игр.

## Магазин И Инвентарь

Базовые предметы описаны в `SHOP_ITEMS` внутри `js/core.js`.

Типы предметов:

- `avatar` - аватар.
- `name` - визуальный стиль имени.
- `medal` - медаль в профиле.
- `bg` - фон.
- `box` - открываемый бокс.
- `case` - пока закрытые кейсы.

Инвентарь хранится в:

```text
users/{myId}/inventory/{itemId}
```

Значение может быть:

- `true` - старый формат, считается как 1 штука.
- число - количество предметов.

Покупка делает multi-location update:

- увеличивает `users/{myId}/inventory/{itemId}`
- уменьшает `users/{myId}/coins`

## Статистика

Основные поля:

- `gamesPlayed` - количество сыгранных игр.
- `playTimeMs` - время в приложении в миллисекундах.
- `aiStats` - статистика против ИИ.
- `pvpStats` - статистика против других игроков.

Формат категорий:

```json
{
  "math": { "w": 0, "l": 0, "d": 0 },
  "letters": { "w": 0, "l": 0, "d": 0 },
  "acc": { "w": 0, "l": 0, "d": 0 },
  "ttt": { "w": 0, "l": 0, "d": 0 },
  "hidden": { "w": 0, "l": 0, "d": 0 },
  "clk": { "w": 0, "l": 0, "d": 0 },
  "react": { "w": 0, "l": 0, "d": 0 }
}
```

## Друзья И Лобби

Друзья хранятся двусторонне:

```text
users/{myId}/friends/{friendId} = true
users/{friendId}/friends/{myId} = true
```

Заявки:

```text
users/{targetId}/friend_reqs/{myId} = true
```

Приглашение в лобби:

```text
users/{friendId}/invite = {
  lId: lobbyId,
  host: hostName
}
```

Для ботов используются ID `ИИ`, `ИИ2`, `ИИ3`, `ИИ4`, `ИИ5`.

## Мини-Игры

Список игровых ID и названий лежит в `GAME_NAMES` в `js/core.js`.

Основные группы:

- `math1`, `math2`, `math3` - математика.
- `let1`, `let3`, `let4`, `let5` - буквы и слова.
- `coord1` ... `coord5` - координация.
- `hidden` - поиск предметов.
- `tictactoe` - крестики-нолики.
- `clicker` - кликер.
- `br_2d` - 2D battle royale.
- `br_3d` - внешний 3D parkour через `window.location.href`.
- `ai1`, `ai2` - AI-режимы.

Запуск игры идет через лобби:

1. Хост выбирает режим.
2. В `lobbies/{lobbyId}/game` записывается ID режима.
3. При старте меняется `status` на `playing` или `playing_ai`.
4. Слушатель лобби у каждого игрока вызывает локальный старт нужного UI.

## AI-Режимы

В коде есть функции `fetchGeminiAPI()` и `fetchAndPlayTTS()`, которые обращаются к Google Gemini API.

Важно: сейчас `apiKey` в `core.js` пустой:

```js
const apiKey = "";
```

Комментарий в коде говорит, что ключ должен прокидываться на сервере. Если AI-режимы не работают, сначала проверить способ выдачи ключа.

## Тестирование

Для автотестов без Telegram см. `HowToAutoTest.md`.

Быстрая ручная проверка синтаксиса JS:

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

## Важные Ограничения

- Это не npm/Vite/React-проект. Сборки нет, зависимости подключаются CDN-скриптами.
- Модули JS не используют `import/export`, а работают через глобальные переменные и функции.
- Порядок подключения скриптов критичен.
- Firebase Auth может быть не настроен. При правилах `auth != null` приложение не сможет читать базу.
- Правила Realtime Database сейчас должны соответствовать текущей клиентской архитектуре.
- Не стоит писать `coins` из общего sync профиля. Монеты должны меняться только отдельными денежными операциями.
- При тестах вне Telegram обязательно нужен mock `window.Telegram.WebApp`.
