# How to Auto-Test the App

Эта инструкция нужна для будущих AI-сессий, чтобы они могли самостоятельно запустить приложение, подключиться к реальной Firebase Realtime Database и проверить UI без Telegram.

## Почему не `file://`

Приложение нельзя надежно тестировать простым открытием `index.html` как файла:

- Скрипты подключаются относительными путями (`./js/core.js`, `./css/styles.css`).
- В обычном браузере нет `window.Telegram.WebApp`.
- Нужно заранее выставить `my_id`, иначе будет создан случайный игрок.
- Для проверки Firebase важно запускать страницу как нормальный HTTP origin.

## Рабочий подход

1. Поднять маленький локальный HTTP-сервер из корня проекта.
2. Создать временную debug-версию `index.html`.
3. В этой версии заменить Telegram WebApp script на mock `window.Telegram.WebApp`.
4. Через mock выставить нужный `my_id`, например `8451`.
5. Запустить Microsoft Edge в headless-режиме с DevTools Protocol.
6. Открыть debug-страницу, подождать загрузку Firebase, затем прочитать DOM.

## Минимальный Node.js скрипт

Запускать из корня проекта:

```powershell
@'
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const root = process.cwd();
const port = 8770;
const tmpDir = path.join(root, '.tmp-debug');
fs.mkdirSync(tmpDir, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<head>', `<head><base href="http://127.0.0.1:${port}/">`);

const telegramMock = `<script>
localStorage.setItem('my_id', '8451');
localStorage.removeItem('player_coins');
window.__tgAlerts = [];
window.__pageErrors = [];
window.Telegram = { WebApp: {
  initDataUnsafe: { user: { id: 8451, first_name: 'Debug' } },
  expand() {},
  requestFullscreen() {},
  ready() {},
  showAlert(message) {
    window.__tgAlerts.push(String(message));
    document.body.setAttribute('data-last-alert', String(message));
  },
  CloudStorage: {
    getKeys(cb) { cb(null, ['my_id']); },
    getItems(keys, cb) { cb(null, { my_id: '8451' }); },
    setItem(k, v) { localStorage.setItem(k, String(v)); },
    removeItem(k) { localStorage.removeItem(k); }
  }
}};
window.addEventListener('error', (e) => {
  window.__pageErrors.push({
    message: e.message,
    src: e.target && e.target.src,
    file: e.filename,
    line: e.lineno
  });
}, true);
window.addEventListener('unhandledrejection', (e) => {
  window.__pageErrors.push({
    rejection: String(e.reason && (e.reason.message || e.reason.code || e.reason))
  });
});
</script>`;

html = html.replace(
  /<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/,
  telegramMock
);

const debugHtml = path.join(tmpDir, 'debug.html');
fs.writeFileSync(debugHtml, html, 'utf8');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\//, '');
  const filePath = path.normalize(path.join(root, urlPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream'
    });
    res.end(data);
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function main() {
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

  const edge = 'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe';
  const profile = path.join(tmpDir, 'edge-profile');
  fs.mkdirSync(profile, { recursive: true });

  const child = spawn(edge, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--remote-debugging-port=9227',
    `--user-data-dir=${profile}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await getJson('http://127.0.0.1:9227/json');
      if (targets.length) break;
    } catch (e) {}
    await sleep(100);
  }

  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  const consoleLines = [];

  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLines.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
  };

  const send = (method, params = {}) => new Promise(resolve => {
    const nextId = ++id;
    pending.set(nextId, resolve);
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', {
    url: `http://127.0.0.1:${port}/.tmp-debug/debug.html`
  });

  await sleep(15000);

  const evalRes = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify({
      id: document.getElementById('my-id-display')?.innerText,
      coins: document.getElementById('global-coins-val')?.innerText,
      name: document.getElementById('my-name-display')?.innerText,
      avatar: document.getElementById('my-avatar')?.innerText,
      alert: document.body.getAttribute('data-last-alert') || '',
      errors: window.__pageErrors
    }, null, 2)`
  });

  console.log('EVAL_REPORT');
  console.log(evalRes.result.result.value);
  console.log('CONSOLE_LINES');
  console.log(consoleLines.join('\\n'));

  ws.close();
  child.kill();
  server.close();
}

main().catch(err => {
  console.error('SCRIPT_ERROR', err);
  try { server.close(); } catch (e) {}
  process.exit(1);
});
'@ | node -
```

## Ожидаемый результат для игрока `8451`

При рабочем подключении к Firebase DOM должен показать примерно:

```json
{
  "id": "ID: 8451",
  "coins": "15",
  "name": "X WOMI ✏️",
  "avatar": "😈",
  "alert": "",
  "errors": []
}
```

## Важные замечания

- Если `spawn Edge` падает с `EPERM`, нужно запускать команду с escalated permissions.
- Если `coins`, `name` и `avatar` остаются fallback-значениями, нужно смотреть `CONSOLE_LINES` и `errors`.
- Ошибка `permission_denied` почти всегда означает проблему с правилами Realtime Database.
- Ошибка `auth/internal-error` или `CONFIGURATION_NOT_FOUND` означает, что Firebase Auth не настроен. Текущий клиент может работать без Auth, если правила Realtime Database это разрешают.
- Временную папку `.tmp-debug` после тестов можно удалить.
- Не оставлять временные `firebase.json` / `.firebaserc`, если они были созданы только для проверки.

