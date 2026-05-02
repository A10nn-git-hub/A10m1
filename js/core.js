            const tg = window.Telegram.WebApp; try { tg.expand(); if(tg.requestFullscreen) tg.requestFullscreen(); } catch(e){} tg.ready();
            const APP_VERSION_INFO = {
                label: 'локальная сборка',
                note: 'версия берется из index.html'
            };
            const firebaseConfig = JSON.parse('{"apiKey":"AIzaSyBc2Q4dAM5fo4SD0sbqwDIy_B9Z5xiM4tg","authDomain":"mini-games-b9400.firebaseapp.com","databaseURL":"https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app","projectId":"mini-games-b9400","storageBucket":"mini-games-b9400.firebasestorage.app","messagingSenderId":"523964322575","appId":"1:523964322575:web:a5502d0bf28f17b10f247a"}'); 
            firebase.initializeApp(firebaseConfig); const db = firebase.database();
            let firebaseReadyPromise = null;
            let firebaseStatusMessage = '';
            let firebaseAuthUnavailable = false;

            function renderAppVersionInfo() {
                const versionTargets = [
                    [document.getElementById('app-version-main-settings'), document.getElementById('app-version-sub-settings')]
                ];
                const modifiedAt = document.lastModified ? new Date(document.lastModified).toLocaleString('ru-RU') : 'неизвестно';
                versionTargets.forEach(([mainEl, subEl]) => {
                    if (!mainEl || !subEl) return;
                    mainEl.innerText = APP_VERSION_INFO.label;
                    subEl.innerText = `Файл обновлен: ${modifiedAt}`;
                    mainEl.title = APP_VERSION_INFO.note;
                    subEl.title = APP_VERSION_INFO.note;
                });
            }

            function escapeHTML(value) {
                return String(value ?? '').replace(/[&<>"']/g, ch => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[ch]));
            }

            function setFirebaseStatus(message, color = '#ff453a') {
                firebaseStatusMessage = message || '';
                if (!message) return;
                console.warn('Firebase status:', message);
                try { setIsland(message, color); } catch (e) {}
            }

            function handleFirebaseError(err, context, fallbackValue) {
                const code = err && err.code ? err.code : 'unknown';
                console.error(`Firebase error in ${context}:`, err);
                if (code === 'PERMISSION_DENIED' || code === 'permission-denied') {
                    setFirebaseStatus('Firebase: нет доступа к базе');
                } else if (code === 'auth/admin-restricted-operation') {
                    setFirebaseStatus('Firebase: anonymous auth выключен');
                } else {
                    setFirebaseStatus(`Firebase: ${code}`);
                }
                return fallbackValue;
            }

            function getFirebaseFriendlyMessage(defaultMessage) {
                return firebaseStatusMessage || defaultMessage;
            }

            function isOptionalAuthError(err) {
                const code = err && err.code ? err.code : '';
                return code === 'auth/internal-error' || code === 'auth/admin-restricted-operation';
            }

            function ensureFirebaseAccess() {
                return ensureFirebaseReady().then(() => {
                    if (!firebase.auth || firebaseAuthUnavailable) return null;
                    const auth = firebase.auth();
                    if (auth.currentUser) return auth.currentUser;
                    return auth.signInAnonymously()
                        .then(() => auth.currentUser)
                        .catch((err) => {
                            if (isOptionalAuthError(err)) {
                                firebaseAuthUnavailable = true;
                                console.warn('Firebase Auth is unavailable; continuing with database rules.');
                                return null;
                            }
                            handleFirebaseError(err, 'auth.ensureSession', null);
                            return null;
                        });
                });
            }

            function readDbOnce(path, fallbackValue = null, context = path) {
                return ensureFirebaseAccess()
                    .then(() => db.ref(path).once('value'))
                    .then((snap) => snap.exists() ? snap.val() : fallbackValue)
                    .catch((err) => handleFirebaseError(err, context, fallbackValue));
            }

            function readDbOnceStrict(path, context = path) {
                return ensureFirebaseAccess()
                    .then(() => db.ref(path).once('value'))
                    .catch((err) => {
                        handleFirebaseError(err, context, null);
                        throw err;
                    });
            }

            function writeDb(path, value, context = path) {
                return ensureFirebaseAccess()
                    .then(() => db.ref(path).set(value))
                    .catch((err) => {
                        handleFirebaseError(err, context, null);
                        throw err;
                    });
            }

            function updateDbPaths(updates, context = 'database update') {
                return ensureFirebaseAccess()
                    .then(() => db.ref().update(updates))
                    .catch((err) => {
                        handleFirebaseError(err, context, null);
                        throw err;
                    });
            }

            function ensureFirebaseReady() {
                if (firebaseReadyPromise) return firebaseReadyPromise;
                firebaseReadyPromise = new Promise((resolve) => {
                    if (!firebase.auth) {
                        resolve();
                        return;
                    }

                    const auth = firebase.auth();
                    const finish = () => resolve();
                    let isDone = false;
                    const safeFinish = () => {
                        if (isDone) return;
                        isDone = true;
                        finish();
                    };

                    auth.onAuthStateChanged((user) => {
                        if (user) safeFinish();
                    });

                    if (auth.currentUser) {
                        safeFinish();
                        return;
                    }

                    auth.signInAnonymously().then(safeFinish).catch((err) => {
                        if (isOptionalAuthError(err)) {
                            firebaseAuthUnavailable = true;
                            console.warn('Firebase Auth is unavailable; continuing with database rules.');
                            safeFinish();
                            return;
                        }
                        handleFirebaseError(err, 'auth.signInAnonymously', null);
                        safeFinish();
                    });

                    setTimeout(safeFinish, 4000);
                });
                return firebaseReadyPromise;
            }

            // ИСПРАВЛЕНИЕ ИИ: Полноценное API и TTS (озвучка) без заглушек
            const apiKey = ""; // Ключ прокидывается на сервере
            
            // Конвертация PCM16 в WAV для воспроизведения браузером
            function pcmToWav(base64, sampleRate) {
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const buffer = new ArrayBuffer(44 + len);
                const view = new DataView(buffer);
                
                const writeString = (offset, string) => {
                    for (let i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                };
                
                writeString(0, 'RIFF');
                view.setUint32(4, 36 + len, true);
                writeString(8, 'WAVE');
                writeString(12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true); 
                view.setUint16(22, 1, true); 
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true); 
                view.setUint16(32, 2, true); 
                view.setUint16(34, 16, true); 
                writeString(36, 'data');
                view.setUint32(40, len, true);
                
                const dataOffset = 44;
                for (let i = 0; i < len; i++) {
                    view.setUint8(dataOffset + i, bytes[i]);
                }
                
                const blob = new Blob([view], { type: 'audio/wav' });
                return URL.createObjectURL(blob);
            }

            async function fetchGeminiAPI(promptStr) {
                let retries = 5, delay = 1000;
                while(retries > 0) {
                    try {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ contents: [{parts: [{text: promptStr}]}] })
                        });
                        if (!res.ok) throw new Error("API Error");
                        const data = await res.json();
                        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Ошибка генерации текста";
                    } catch(e) {
                        retries--;
                        if(retries === 0) return "Извините, произошла ошибка соединения с сервером ИИ.";
                        await new Promise(r => setTimeout(r, delay));
                        delay *= 2;
                    }
                }
            }
            
            let currentAiAudio = null;

            async function fetchAndPlayTTS(text, voiceName, onComplete, onReadyToSync) {
                let retries = 5, delay = 1000;
                while(retries > 0) {
                    try {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: text }] }],
                                generationConfig: {
                                    responseModalities: ["AUDIO"],
                                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
                                },
                                model: "gemini-2.5-flash-preview-tts"
                            })
                        });
                        if (!res.ok) throw new Error("API Error");
                        const data = await res.json();
                        const mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
                        const pcmBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                        
                        if (!pcmBase64) throw new Error("No audio data");
                        
                        let sampleRate = 24000;
                        if(mimeType && mimeType.includes('rate=')) {
                            sampleRate = parseInt(mimeType.split('rate=')[1]) || 24000;
                        }

                        const wavUrl = pcmToWav(pcmBase64, sampleRate);
                        const durationMs = ((pcmBase64.length * 0.75) / 2 / sampleRate) * 1000; // Точный подсчет времени аудио
                        
                        if(currentAiAudio) { currentAiAudio.pause(); }
                        currentAiAudio = new Audio(wavUrl);
                        currentAiAudio.onended = () => { if(onComplete) onComplete(); };
                        currentAiAudio.play();
                        
                        if(onReadyToSync) onReadyToSync(durationMs);
                        return;
                    } catch(e) {
                        retries--;
                        if(retries === 0) { if(onComplete) onComplete(); return; }
                        await new Promise(r => setTimeout(r, delay));
                        delay *= 2;
                    }
                }
            }

            function generateKDHTML(stats) {
                if(!stats) return '<p style="color:gray;">Нет данных</p>';
                let w=0, l=0, d=0;
                const c = {math:'🧮 МАтем', letters:'🅰️ Буквы', acc:'🎯 Коорд', ttt:'❌⭕ Крестики', hidden:'🔎 Поиск', clk:'⏱️ Кликер', react:'Реакция'};
                
                let details = '';
                Object.keys(c).forEach(k => {
                    if(stats[k] && (stats[k].w>0 || stats[k].l>0 || stats[k].d>0)) {
                        w+=stats[k].w||0; l+=stats[k].l||0; d+=stats[k].d||0;
                        details += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:5px 0;"><span>${c[k]}</span> <span><span style="color:#3390ec">${stats[k].w||0}W</span> - <span style="color:#ff9f0a">${stats[k].l||0}L</span> - <span style="color:#888">${stats[k].d||0}D</span></span></div>`;
                    }
                });

                if(w===0 && l===0) return '<p style="color:gray;text-align:center;">Нет сыгранных игр</p>';

                let total = w + l;
                let winPct = total > 0 ? (w / total) * 100 : 50;
                let kdRatio = l === 0 ? w : (w/l).toFixed(2);

                let h = `
                    <div class="stat-donut-wrap">
                        <div class="stat-donut" style="background: conic-gradient(#3390ec calc(${winPct} * 1%), #ff9f0a 0);">
                            <div class="stat-donut-inner">
                                <span style="font-size:24px;">${kdRatio}</span>
                                <span style="font-size:10px;color:gray;">K/D</span>
                            </div>
                        </div>
                        <div class="stat-labels">
                            <div style="color:#3390ec;">${w} ПОБЕД</div>
                            <div style="color:#ff9f0a;">${l} ПОРАЖ.</div>
                            <div style="color:gray;font-size:12px;">${d} НИЧЬИХ</div>
                        </div>
                    </div>
                    <div style="width:100%; margin-top:20px; font-size:14px; max-height:150px; overflow-y:auto; padding-right:10px;">
                        <h4 style="margin:0 0 10px 0; color:gray;">Детали:</h4>
                        ${details}
                    </div>
                `;
                return h;
            }

            let purchaseInProgress = false;

            function getInventoryQty(value) {
                return typeof value === 'boolean' ? 1 : (parseInt(value) || 0);
            }

            async function buyItem(id, price) {
                if(purchaseInProgress) return;
                if(globalCoins < price) return tg.showAlert("Не хватает монет!");

                purchaseInProgress = true;
                try {
                    const currentValue = inventoryLoaded && Object.prototype.hasOwnProperty.call(liveInventory, id)
                        ? liveInventory[id]
                        : await readDbOnce(`users/${myId}/inventory/${id}`, 0, 'buy item inventory read');
                    const nextQty = getInventoryQty(currentValue) + 1;
                    const nextCoins = Math.max(0, globalCoins - price);

                    await updateDbPaths({
                        [`users/${myId}/inventory/${id}`]: nextQty,
                        [`users/${myId}/coins`]: nextCoins
                    }, 'buy item');

                    globalCoins = nextCoins;
                    liveInventory = { ...liveInventory, [id]: nextQty };
                    inventoryLoaded = true;
                    updateCoinsUI();
                    try { tg.CloudStorage.setItem('player_coins', globalCoins.toString()); } catch(e) {}

                    renderInventory();
                    renderShop();
                    tg.showAlert("Куплено!");
                } catch (err) {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось купить предмет."));
                } finally {
                    purchaseInProgress = false;
                }
            }

            function inspectItem(id, type) {
                let it = SHOP_ITEMS.find(i => i.id === id);
                if(!it) return;
                document.getElementById('inspect-avatar').innerHTML = it.type==='avatar'?it.icon:'👤';
                document.getElementById('inspect-name').innerHTML = it.type==='name'?it.icon:'Игрок';
                document.getElementById('inspect-medals').innerHTML = it.type==='medal'?it.icon:'';
                document.getElementById('inspect-modal').classList.remove('hidden');
            }
            function closeInspectModal(e) {
                if(e) e.stopPropagation();
                document.getElementById('inspect-modal').classList.add('hidden');
                if (boxAwaitingPrizeInspect) {
                    boxAwaitingPrizeInspect = false;
                    const closeBtn = document.getElementById('btn-close-box');
                    if (closeBtn && !document.getElementById('box-roulette-modal').classList.contains('hidden')) {
                        closeBtn.style.display = 'block';
                    }
                }
            }

            function getBoxPrizeItems(id) {
                const box = SHOP_ITEMS.find(i => i.id === id && i.type === 'box');
                if (!box) return [];
                return SHOP_ITEMS.filter(i => i.type !== 'box' && i.type !== 'case' && i.boxTarget === id);
            }

            function openBoxPre(id) {
                currentOpenedBoxId = id;
                document.getElementById('box-roulette-modal').classList.remove('hidden');
                document.getElementById('btn-start-roulette').style.display = 'block';
                document.getElementById('btn-close-box').style.display = 'block';
                document.getElementById('roulette-track').style.transform = 'translateX(0px)';
                
                let boxItems = getBoxPrizeItems(id);

                let p = document.getElementById('box-contents-preview'); p.innerHTML = '';
                boxItems.forEach(it => {
                    p.innerHTML += `<div style="padding:5px;background:#111;border-radius:5px;">${it.plainIcon||it.icon}</div>`;
                });
            }

            function startBoxRoulette() {
                if (boxRouletteActive) return;
                boxRouletteActive = true;
                boxAwaitingPrizeInspect = false;
                document.getElementById('btn-start-roulette').style.display = 'none';
                document.getElementById('btn-close-box').style.display = 'none';
                
                let boxItems = getBoxPrizeItems(currentOpenedBoxId);
                if (boxItems.length === 0) {
                    boxRouletteActive = false;
                    document.getElementById('btn-start-roulette').style.display = 'block';
                    document.getElementById('btn-close-box').style.display = 'block';
                    return tg.showAlert("В этом боксе нет предметов.");
                }
                
                let win = boxItems[Math.floor(Math.random()*boxItems.length)];
                let tr = document.getElementById('roulette-track'); tr.innerHTML = '';
                for(let i=0;i<40;i++){
                    let ri = i===35 ? win : boxItems[Math.floor(Math.random()*boxItems.length)];
                    tr.innerHTML += `<div class="roulette-item"><div style="font-size:40px;">${ri.plainIcon||ri.icon}</div><b style="font-size:10px;text-align:center;">${ri.name}</b></div>`;
                }
                tr.style.transition = 'transform 8s cubic-bezier(0.1, 0.8, 0.1, 1)';
                tr.style.transform = `translateX(${-(35*120) + (document.querySelector('.roulette-wrapper').offsetWidth/2) - 60}px)`;
                
                setTimeout(() => {
                    db.ref(`users/${myId}/inventory/${currentOpenedBoxId}`).once('value').then(s => {
                        let q = parseInt(s.val())||0;
                        if(q>1) db.ref(`users/${myId}/inventory/${currentOpenedBoxId}`).set(q-1);
                        else db.ref(`users/${myId}/inventory/${currentOpenedBoxId}`).remove();
                        db.ref(`users/${myId}/inventory/${win.id}`).once('value').then(ss => {
                            db.ref(`users/${myId}/inventory/${win.id}`).set((parseInt(ss.val())||0)+1);
                            boxRouletteActive = false;
                            boxAwaitingPrizeInspect = true;
                            tg.showAlert(`Выпало: ${win.name}!`);
                            inspectItem(win.id, win.type);
                            renderInventory(); renderShop();
                        });
                    });
                }, 8500);
            }
            function closeBoxModal() {
                if (boxRouletteActive || boxAwaitingPrizeInspect) return;
                document.getElementById('box-roulette-modal').classList.add('hidden');
            }

            function openSO2ModeSelect() {
                if(!isHost) return tg.showAlert("Только Хост может выбирать!");
                document.getElementById('so2-mode-modal').classList.remove('hidden');
                document.getElementById('so2-submodes').innerHTML = '<h2 style="color:gray;width:100%;text-align:center;margin-top:40%;">ВЫБЕРИТЕ КАТЕГОРИЮ СЛЕВА</h2>';
                document.querySelectorAll('.so2-card').forEach(c=>c.classList.remove('active'));
                document.getElementById('ttt-bot-diff').style.display='none';
            }
            
            function selectSO2Category(cat, el) {
                document.querySelectorAll('.so2-card').forEach(c=>c.classList.remove('active')); el.classList.add('active');
                let sm = document.getElementById('so2-submodes'); sm.innerHTML = '';
                let b = (id,ic,t)=>`<div class="so2-subcard" onclick="setPendingSO2Game('${id}','${ic} ${t}', this)"><div class="so2-subcard-icon">${ic}</div><div class="so2-subcard-title">${t}</div></div>`;
                
                if(cat==='math') sm.innerHTML = b('math1','📝','Ответ')+b('math2','🎴','Карточки')+b('math3','🔢','Порядок');
                if(cat==='letters') sm.innerHTML = b('let1','🔤','АБВ')+b('let3','⌨️','Слово')+b('let4','🔗','Соедини')+b('let5','🟩','5 Букв');
                if(cat==='coord') sm.innerHTML = b('coord1','🗡️','Ножи')+b('coord2','🐸','Лягушка')+b('coord3','🎈','Скорость')+b('coord4','⚡','Кнопка')+b('coord5','🦆','Утки');
                if(cat==='ttt') sm.innerHTML = `
                    <div class="so2-subcard" onclick="setPendingTttLevel('easy', this)"><div class="so2-subcard-icon">⭐</div><div class="so2-subcard-title">Уровень 1</div></div>
                    <div class="so2-subcard" onclick="setPendingTttLevel('medium', this)"><div class="so2-subcard-icon">⭐⭐</div><div class="so2-subcard-title">Уровень 2</div></div>
                    <div class="so2-subcard" onclick="setPendingTttLevel('hard', this)"><div class="so2-subcard-icon">⭐⭐⭐</div><div class="so2-subcard-title">Уровень 3</div></div>`;
                if(cat==='br') sm.innerHTML = b('br_2d','🔫','2D Арена') + b('br_3d','🏃‍♂️','3D Паркур');

                document.getElementById('ttt-bot-diff').style.display='none';
            }

            function setPendingTttLevel(level, el) {
                aiDifficulty = level;
                pendingModeId = 'tictactoe';
                document.querySelectorAll('.so2-subcard').forEach(c=>c.classList.remove('active'));
                if(el) el.classList.add('active');
                document.getElementById('ttt-bot-diff').style.display='none';
            }
            
            function setPendingSO2Game(id, name, el) {
                pendingModeId = id;
                document.querySelectorAll('.so2-subcard, .so2-card').forEach(c=>{ if(c.classList.contains('so2-subcard')||c.innerHTML.includes(name.split(' ')[1])) c.classList.remove('active'); });
                if(el) el.classList.add('active');
                document.getElementById('ttt-bot-diff').style.display = id==='tictactoe' ? 'block' : 'none';
            }
            
            async function confirmSO2Mode() {
                if(!pendingModeId) return tg.showAlert("Выберите режим!");
                if(!lobbyId) return tg.showAlert("Лобби не найдено.");
                if(pendingModeId==='tictactoe' && document.getElementById('ttt-bot-diff').style.display !== 'none') aiDifficulty = document.getElementById('ttt-bot-select').value;

                try {
                    await writeDb(`lobbies/${lobbyId}/game`, pendingModeId, 'set lobby game');
                    setSelectedModeUI(pendingModeId);
                    closeSO2ModeSelect();
                } catch (err) {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось сохранить выбранный режим."));
                }
            }
            function closeSO2ModeSelect() { document.getElementById('so2-mode-modal').classList.add('hidden'); }

            async function startLobbyGame() {
                if(!isHost) return tg.showAlert("Только Хост может запустить!");
                if(!lobbyId) return tg.showAlert("Лобби не найдено.");

                const selectedGameId = appState.selectedGameId || pendingModeId;
                if(!selectedGameId) return tg.showAlert("Выберите режим!");

                try {
                    const lobbyData = await readDbOnce(`lobbies/${lobbyId}`, null, 'read lobby before start');
                    if(!lobbyData || !lobbyData.players || !lobbyData.players[myId]) {
                        return tg.showAlert("Лобби больше не активно.");
                    }

                    if(!lobbyData.game && selectedGameId) {
                        await writeDb(`lobbies/${lobbyId}/game`, selectedGameId, 'restore lobby game before start');
                        setSelectedModeUI(selectedGameId);
                    }

                    await writeDb(`lobbies/${lobbyId}/status`, 'playing', 'start lobby game');
                    setIsland("Запуск игры...", "#34c759");
                } catch (err) {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось запустить игру. Проверь доступ к Firebase."));
                }
            }

            function startLocalGameUI() {
                togglePause(false);
                document.getElementById('result-overlay').classList.add('hidden');
                document.getElementById('br-death-screen').style.display = 'none';
                document.getElementById('view-lobby').style.display = 'none';
                document.getElementById('game-container').style.display = 'block';
                document.querySelectorAll('.game-screen').forEach(s=>s.classList.remove('active'));
                let id = appState.selectedGameId; appState.game = id;
                
                if(id.startsWith('math')) { document.getElementById(`screen-game-math-${id.replace('math','')}`).classList.add('active'); startMathMode(parseInt(id.replace('math',''))); }
                else if(id.startsWith('let')) { document.getElementById(`screen-game-letters-${id.replace('let','')}`).classList.add('active'); if(id==='let5') document.body.classList.add('let5-active'); startLettersMode(parseInt(id.replace('let',''))); }
                else if(id.startsWith('coord')) initCoord(parseInt(id.replace('coord','')));
                else if(id==='hidden') { document.getElementById('screen-game-hidden').classList.add('active'); initHiddenGame(); }
                else if(id==='tictactoe') { document.getElementById('screen-game-tictactoe').classList.add('active'); initTicTacToe(); }
                else if(id==='clicker') { document.getElementById('screen-game-clicker').classList.add('active'); initClickerUI(); }
                else if(id==='br_2d') { document.getElementById('screen-game-br').classList.add('active'); initBR(); }
                else if(id==='br_3d') { setIsland("Загрузка 3D...", "#3390ec"); window.location.href = "https://playcanv.as/b/4a505698"; }
                
                document.getElementById('pause-btn').style.display = 'flex';
                setIsland("ИГРА НАЧАЛАСЬ!", "#34c759");
            }

            function togglePause(p) {
                appState.isPaused = p;
                document.getElementById('pause-overlay').classList.toggle('hidden', !p);
            }

            function exitToLobby() {
                togglePause(false);
                document.getElementById('game-container').style.display = 'none';
                document.getElementById('view-lobby').style.display = 'flex';
                document.getElementById('pause-btn').style.display = 'none';
                document.getElementById('dynamic-island').style.display = 'none';
                document.getElementById('ai-game-overlay').style.display = 'none';
                document.body.classList.remove('let5-active');
                if(appState.game==='br_2d') stopBR();
                if(appState.game==='tictactoe' && typeof stopTicTacToeSync === 'function') stopTicTacToeSync();
                if(isHost) db.ref(`lobbies/${lobbyId}/status`).set('waiting');
                appState.game = null;
            }

            function showResult(title, color, emoji, subtext = '') {
                document.getElementById('result-text').innerText = title;
                document.getElementById('result-text').style.color = color;
                document.getElementById('result-emoji').innerText = emoji;
                document.getElementById('result-subtext').innerHTML = subtext;
                document.getElementById('result-overlay').classList.remove('hidden');
                addGamePlayed();
            }
            function closeResult() { document.getElementById('result-overlay').classList.add('hidden'); exitToLobby(); }

            function openProfileStatsModal(id) {
                db.ref(`users/${id}`).once('value').then(s => {
                    if(!s.exists()) {
                        if (id === 'ИИ') {
                            tg.showAlert("Профиль ИИ недоступен.");
                        }
                        return;
                    }
                    let d = s.val();
                    document.getElementById('ps-avatar').innerHTML = getAvatarHTML(d.avatar);
                    document.getElementById('ps-name').innerHTML = getNameHTML(d.name, d.eqName);
                    document.getElementById('ps-id').innerText = `ID: ${id}`;
                    document.getElementById('ps-tab-you').innerHTML = generateKDHTML(getInvertedStats(pvpStats[id]));
                    document.getElementById('ps-tab-all').innerHTML = generateKDHTML(buildTotalStats(d.pvpStats));
                    document.getElementById('ps-tab-ai').innerHTML = generateKDHTML(d.aiStats);
                    switchMiniTab('ps-tab-you', document.getElementById('ps-tab-btn-you'));
                    document.getElementById('profile-stats-modal').classList.remove('hidden');
                });
            }
            function closeProfileStatsModal(e) { if(e) e.stopPropagation(); document.getElementById('profile-stats-modal').classList.add('hidden'); }

            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            let currentAiTask = '';

            function voiceAnalyzeProfile() {
                let name = document.getElementById('ps-name').innerText;
                let text = `Профиль игрока ${name}. Отличный игрок, старается побеждать в каждой мини-игре. Больше всего любит играть с друзьями. Так держать!`;
                fetchAndPlayTTS(text, "Puck");
            }

            function startAiGameLogic() {
                document.getElementById('view-lobby').style.display = 'none';
                let ov = document.getElementById('ai-game-overlay');
                ov.style.display = 'flex';
                let t = appState.selectedGameId;
                
                document.getElementById('ai-game-title').innerText = t === 'ai1' ? 'ЗАГАДКИ ИИ' : 'СКАЗКИ ИИ';
                document.getElementById('ai-game-text').innerHTML = '';
                document.getElementById('ai-game-status').innerText = 'Нажми микрофон чтобы сказать тему!';
                document.getElementById('ai-mic-btn').style.display = 'inline-block';
                currentAiTask = t;
            }

            function startAiMic() {
                if(!SpeechRec) return tg.showAlert("Микрофон не поддерживается браузером!");
                let rec = new SpeechRec();
                rec.lang = 'ru-RU';
                rec.interimResults = false;
                
                document.getElementById('ai-game-status').innerText = 'Слушаю...';
                document.getElementById('ai-mic-btn').style.background = '#ff453a';
                
                rec.onresult = async (e) => {
                    let topic = e.results[0][0].transcript;
                    document.getElementById('ai-mic-btn').style.display = 'none';
                    document.getElementById('ai-game-status').innerText = `Тема: "${topic}". ИИ думает...`;
                    
                    if (currentAiTask === 'ai1') {
                        let prompt = `Загадай ОДНУ короткую детскую загадку на тему "${topic}". НЕ ПИШИ ОТВЕТ. Только текст загадки.`;
                        let riddle = await fetchGeminiAPI(prompt);
                        document.getElementById('ai-game-text').innerHTML = riddle;
                        document.getElementById('ai-game-status').innerText = `Озвучиваю загадку...`;
                        
                        fetchAndPlayTTS(riddle, "Puck", () => {
                            document.getElementById('ai-game-status').innerText = `Готов ответить? Жми микрофон!`;
                            let btn = document.getElementById('ai-mic-btn');
                            btn.style.display = 'inline-block';
                            btn.style.background = 'var(--coin-col)';
                            btn.onclick = () => answerAiRiddle(topic, riddle);
                        });

                    } else if (currentAiTask === 'ai2') {
                        let prompt = `Напиши короткую добрую сказку для 5-летнего мальчика на тему "${topic}". Время чтения примерно 1 минута. Текст должен быть очень простым. Не пиши вступлений.`;
                        let tale = await fetchGeminiAPI(prompt);
                        
                        document.getElementById('ai-game-status').innerText = `Сказка готова. Читаю...`;
                        
                        let words = tale.split(' ');
                        let txtDiv = document.getElementById('ai-game-text');
                        txtDiv.innerHTML = '';
                        
                        fetchAndPlayTTS(tale, "Puck", () => {
                            document.getElementById('ai-game-status').innerText = `Сказка окончена!`;
                        }, (durationMs) => {
                             let interval = durationMs / words.length;
                             let i = 0;
                             let inter = setInterval(() => {
                                 if(appState.game !== 'ai2' && document.getElementById('ai-game-overlay').style.display === 'none') {
                                     clearInterval(inter); if(currentAiAudio) currentAiAudio.pause(); return;
                                 }
                                 if(i >= words.length) {
                                     clearInterval(inter);
                                 } else {
                                     txtDiv.innerHTML += `<span class="word-highlight">${words[i]}</span> `;
                                     setTimeout(()=>{ 
                                         let spans = txtDiv.querySelectorAll('span');
                                         if(spans[spans.length-1]) spans[spans.length-1].classList.remove('word-highlight');
                                     }, interval);
                                     i++;
                                 }
                             }, interval);
                        });
                    }
                };
                
                rec.onerror = () => {
                    document.getElementById('ai-game-status').innerText = 'Ошибка микрофона. Попробуй еще.';
                    document.getElementById('ai-mic-btn').style.background = 'var(--coin-col)';
                };
                
                rec.start();
            }

            function answerAiRiddle(topic, riddle) {
                let rec = new SpeechRec();
                rec.lang = 'ru-RU';
                rec.interimResults = false;
                
                document.getElementById('ai-game-status').innerText = 'Слушаю ответ...';
                document.getElementById('ai-mic-btn').style.background = '#ff453a';
                
                rec.onresult = async (e) => {
                    let ans = e.results[0][0].transcript;
                    document.getElementById('ai-mic-btn').style.display = 'none';
                    document.getElementById('ai-game-status').innerText = `Твой ответ: "${ans}". ИИ проверяет...`;
                    
                    let prompt = `Вот загадка: "${riddle}". Ответ ребенка: "${ans}". Это правильный ответ или близкий по смыслу? Ответь коротко: ПРАВИЛЬНО или НЕПРАВИЛЬНО, и объясни почему одним предложением.`;
                    let res = await fetchGeminiAPI(prompt);
                    
                    document.getElementById('ai-game-text').innerHTML = res;
                    let isCorrect = res.toLowerCase().includes('правильно') && !res.toLowerCase().includes('неправильно');
                    
                    document.getElementById('ai-game-status').innerText = isCorrect ? "МОЛОДЕЦ!" : "ОЙ!";
                    document.getElementById('ai-game-status').style.color = isCorrect ? '#34c759' : '#ff453a';
                    
                    fetchAndPlayTTS(res, "Puck", () => {
                        setTimeout(() => {
                            closeAiGame();
                            if(isCorrect) {
                                addCoins(10);
                                showResult("УМНИЦА!", '#34c759', '🤖', "+10 🪙");
                            }
                        }, 1500);
                    });
                };
                rec.start();
            }

            function closeAiGame() {
                if(currentAiAudio) { currentAiAudio.pause(); currentAiAudio = null; }
                document.getElementById('ai-game-overlay').style.display = 'none';
                if(isHost) db.ref(`lobbies/${lobbyId}/status`).set('waiting');
                exitToLobby();
            }

            function banPlayer() { let id=document.getElementById('ban-id-input').value; if(id){db.ref(`beta_bans/${id}`).set(true); tg.showAlert("Забанен!");} }
            function unbanPlayer() { let id=document.getElementById('unban-id-input').value; if(id){db.ref(`beta_bans/${id}`).remove(); tg.showAlert("Разбанен!");} }
            function unbanPlayerSpecific(id) { db.ref(`beta_bans/${id}`).remove(); tg.showAlert("Разбанен!"); }
            function banAllPlayers() { if(confirm("ЗАБАНИТЬ ВСЕХ?")) db.ref(`beta_bans/all`).set(true); }
            function unbanAllPlayers() { if(confirm("РАЗБАНИТЬ ВСЕХ?")) db.ref('beta_bans').remove(); }

            function renderBanLists(bans) {
                let banList = document.getElementById('ban-list');
                let unbanList = document.getElementById('unban-list');
                if(!banList || !unbanList) return;
                banList.innerHTML = ''; unbanList.innerHTML = '';
                if(bans) {
                    Object.keys(bans).forEach(k => {
                        if(k === 'all') return;
                        db.ref('users/'+k).once('value').then(s => {
                            let name = s.exists() ? (s.val().name || 'Игрок') : 'Неизвестно';
                            let html = `<div class="list-item"><div><b>ID: ${k}</b><br><span style="font-size:12px;color:gray;">${name}</span></div></div>`;
                            banList.innerHTML += html;
                            unbanList.innerHTML += `<div class="list-item"><div><b>ID: ${k}</b><br><span style="font-size:12px;color:gray;">${name}</span></div><button class="btn btn-green" onclick="unbanPlayerSpecific('${k}')">Разбан</button></div>`;
                        });
                    });
                } else {
                    banList.innerHTML = '<p style="color:gray;">Нет забаненных</p>';
                    unbanList.innerHTML = '<p style="color:gray;">Нет забаненных</p>';
                }
            }

            function formatPlayTime(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                if (totalSeconds < 60) return totalSeconds + " СЕК";

                const totalMinutes = Math.floor(totalSeconds / 60);
                if (totalMinutes < 60) return totalMinutes + " МИН";

                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return minutes > 0 ? `${hours} Ч ${minutes} МИН` : `${hours} Ч`;
            }
            
            function buildTotalStats(uPvp, uAi) {
                let t = {math:{w:0,l:0,d:0}, letters:{w:0,l:0,d:0}, acc:{w:0,l:0,d:0}, ttt:{w:0,l:0,d:0}, hidden:{w:0,l:0,d:0}, clk:{w:0,l:0,d:0}, react:{w:0,l:0,d:0}};
                let cats = ['math','letters','acc','ttt','hidden','clk','react'];
                if(uPvp) {
                    Object.keys(uPvp).forEach(opp => {
                        if(opp.startsWith('ИИ')) return;
                        cats.forEach(c => { if(uPvp[opp][c]) { t[c].w += uPvp[opp][c].w; t[c].l += uPvp[opp][c].l; t[c].d += uPvp[opp][c].d; } });
                    });
                }
                return t;
            }
            
            function getInvertedStats(st) {
                let inv = {math:{w:0,l:0,d:0}, letters:{w:0,l:0,d:0}, acc:{w:0,l:0,d:0}, ttt:{w:0,l:0,d:0}, hidden:{w:0,l:0,d:0}, clk:{w:0,l:0,d:0}, react:{w:0,l:0,d:0}};
                let cats = ['math','letters','acc','ttt','hidden','clk','react'];
                cats.forEach(c => { if(st && st[c]) { inv[c].w = st[c].l; inv[c].l = st[c].w; inv[c].d = st[c].d; } });
                return inv;
            }

            let EMOJIS = ['😎','🤓','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','🤗','🤔','🫣','🤭','🤫','🤥','😶','😶‍🌫️','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊','🐵','🐒','🦍','🦧','🐶','🐕','🦮','🐕‍🦺','🐩','🐺','🦊','🦝','🐱','🐈','🐈‍⬛','🦁'];

            const SYSTEM_BOT = { id: 'ИИ', name: 'ИИ', avatar: '🤖', eqName: '', pMedals: [] }; 

            function isAiFriendId(id) {
                const value = String(id || '');
                return value === 'ИИ' || value === 'БОТ' || value.startsWith('ИИ');
            }
            
            let globalCoins = 0; let myName = "Игрок"; let myAvatar = "😎"; let myId = "0000"; let myEqName = ''; let myPinnedMedals = []; let gamesPlayed = 0; let playTimeMs = 0; let aiStats = {}; let pvpStats = {}; let profileLoaded = false;
            
            let friendsIds = []; let appState = { game: null, isPaused: false, inLobby: false, selectedGameId: null, autoLobbyPaused: false, prevViewLobbyDisplay: '', prevMainButtonsDisplay: '', promosListener: null, adminListener: null };
            let lobbyId = null, lobbyPlayers = [], lobbyRef = null, isHost = false, pendingInvite = null;
            let currentLobbySettings = {};
            let inventoryListener = null, customItemsListener = null, liveInventory = {}, inventoryLoaded = false;
            let aiDifficulty = 'medium'; let currentOpenedBoxId = null; let activeFriend = null;
            let boxRouletteActive = false, boxAwaitingPrizeInspect = false;

            const GAME_NAMES = {
                'math1': 'МАТЕМАТИКА [ОТВЕТ]', 'math2': 'МАТЕМАТИКА [КАРТОЧКИ]', 'math3': 'МАТЕМАТИКА [ПОРЯДОК]',
                'let1': 'БУКВЫ [АБВ]', 'let3': 'БУКВЫ [СЛОВО]', 'let4': 'БУКВЫ [СОЕДИНИ]', 'let5': 'БУКВЫ [5 БУКВ]',
                'coord1': 'КООРДИНАЦИЯ [НОЖИ]', 'coord2': 'КООРДИНАЦИЯ [ЛЯГУШКА]', 'coord3': 'КООРДИНАЦИЯ [СКОРОСТЬ]', 'coord4': 'КООРДИНАЦИЯ [КНОПКА]', 'coord5': 'КООРДИНАЦИЯ [УТКИ]',
                'hidden': '🔎 ПОИСК', 'tictactoe': '❌⭕ КРЕСТИКИ', 'clicker': '⏱️ КЛИКЕР', 'br_2d': '⚔️ ВЫЖИВАНИЕ [2D]', 'br_3d': '🏃‍♂️ 3D ПАРКУР'
            };
            const TTT_SETTING_SYMBOLS = ['x', 'o', 'square', 'triangle', 'circle_solid'];
            const TTT_SETTING_SYMBOL_LABELS = { x: 'Крестик', o: 'Нолик', square: 'Квадрат', triangle: 'Треугольник', circle_solid: 'Круг' };
            const TTT_SETTING_SYMBOL_CHARS = { x: '❌', o: '⭕', square: '🔲', triangle: '🔺', circle_solid: '🔴' };
            const TTT_SETTING_COLORS = [
                { id: 'green', name: 'Зеленый', value: '#34c759' },
                { id: 'red', name: 'Красный', value: '#ff453a' },
                { id: 'blue', name: 'Синий', value: '#32ade6' },
                { id: 'purple', name: 'Фиолетовый', value: '#af52de' },
                { id: 'yellow', name: 'Желтый', value: '#ffd60a' }
            ];

            const RARITIES = { 'UNCOMMON': '#32ade6', 'RARE': '#007aff', 'EPIC': '#af52de', 'LEGENDARY': '#ff1493', 'ARCANE': '#ff3b30', 'NAMELESS': '#ffcc00' };

            let SHOP_ITEMS = [ 
                {id: 'case_upgrade', type:'case', name: 'UPGRADE CASE', desc: 'Пока нельзя открыть', price: 10000, plainIcon: '📦', icon: '📦', rarity: 'LEGENDARY'},
                {id: 'case_chameleon', type:'case', name: 'CHAMELEON CASE', desc: 'Пока нельзя открыть', price: 10000, plainIcon: '🎁', icon: '🎁', rarity: 'LEGENDARY'},
                {id: 'box_chameleon', type:'box', name: 'Chameleon Box', desc: 'Только имена и медали', price: 1000, plainIcon: '🎁', icon: '🎁', rarity: 'LEGENDARY'},
                {id: 'box_upgrade', type:'box', name: 'Upgrade Box', desc: 'Только аватары и фоны', price: 1000, plainIcon: '📦', icon: '📦', rarity: 'LEGENDARY'},
                {id: 'gif_poop', type:'avatar', name: 'Живая какашка', desc: 'GIF аватарка', price: 500, plainIcon: '💩', icon: '<span class="anim-poop">💩</span>', rarity: 'EPIC', boxTarget: 'box_upgrade'}, 
                {id: 'anim_clown', type:'avatar', name: 'Бешеный Клоун', desc: 'GIF аватарка', price: 1500, plainIcon: '🤡', icon: '<span class="anim-clown">🤡</span>', rarity: 'EPIC', boxTarget: 'box_upgrade'},
                {id: 'avatar_cross', type:'avatar', name: 'Красный крест', desc: 'Аватарка', price: 1000, plainIcon: '<span style="color:#ff453a;font-weight:900;">❌</span>', icon: '<span style="color:#ff453a;font-weight:900;">❌</span>', rarity: 'UNCOMMON', boxTarget: 'box_upgrade'},
                {id: 'name_miron', type:'name', name: 'МИРОН', desc: 'GIF имя', price: 800, plainIcon: '<span style="color:#ff453a;">МИРОН</span>', icon: '<span class="anim-miron"><span class="anim-miron-text">МИРОН</span></span>', rarity: 'EPIC', boxTarget: 'box_chameleon'}, 
                {id: 'name_haha', type:'name', name: 'ХАХАХА', desc: 'GIF имя', price: 800, plainIcon: '<span style="color:#ffcc00;">ХАХАХА</span>', icon: '<span class="anim-haha">ХАХАХА 😂</span>', rarity: 'EPIC', boxTarget: 'box_chameleon'},
                {id: 'name_mama', type:'name', name: 'МАМА', desc: 'Имя', price: 800, plainIcon: '<span style="color:#ff69b4;">МАМА</span>', icon: '<span class="name-mama">МАМА</span>', rarity: 'RARE', boxTarget: 'box_chameleon'},
                {id: 'name_masha', type:'name', name: 'МАША', desc: 'Имя', price: 800, plainIcon: '<span style="color:#b026ff;">МАША</span>', icon: '<span class="name-masha">МАША</span>', rarity: 'RARE', boxTarget: 'box_chameleon'},
                {id: 'name_papa', type:'name', name: 'ПАПА', desc: 'Имя', price: 800, plainIcon: '<span style="color:#b0c4de;">ПАПА</span>', icon: '<span class="name-papa">ПАПА</span>', rarity: 'RARE', boxTarget: 'box_chameleon'},
                {id: 'name_tema', type:'name', name: 'ТЁМА', desc: 'Имя', price: 800, plainIcon: '<span style="color:#ff4500;">ТЁМА</span>', icon: '<span class="name-tema">ТЁМА</span>', rarity: 'RARE', boxTarget: 'box_chameleon'},
                {id: 'medal_top', type:'medal', name: 'TOP', desc: 'МЕДАЛЬ', price: 1500, plainIcon: '🏅', icon: '<span class="medal-badge medal-badge-large">TOP</span>', rarity: 'UNCOMMON', boxTarget: 'box_chameleon'},
                {id: 'medal_pro', type:'medal', name: 'PRO', desc: 'МЕДАЛЬ', price: 1500, plainIcon: '🛡️', icon: '<span class="medal-badge medal-badge-large" style="border-color:#ff453a; background:linear-gradient(45deg, #8a0303, #ff453a);">PRO</span>', rarity: 'LEGENDARY', boxTarget: 'box_chameleon'},
                {id: 'bg_stars', type:'bg', name: 'Звездное Небо', desc: 'ФОН', price: 1000, plainIcon: '🌌', icon: '🌌', rarity: 'RARE', boxTarget: 'box_upgrade'},
                {id: 'bg_balloons', type:'bg', name: 'Шарики', desc: 'GIF ФОН', price: 1500, plainIcon: '🎈', icon: '🎈', rarity: 'LEGENDARY', boxTarget: 'box_upgrade'}
            ];

            function getAvatarHTML(av) { 
                if(av === 'gif_poop') return '<span class="anim-poop">💩</span>';
                if(av === 'anim_clown') return '<span class="anim-clown">🤡</span>';
                if(av === 'avatar_cross') return '<span style="color:#ff453a;font-weight:900; filter: drop-shadow(0 2px 6px rgba(255,69,58,0.45));">❌</span>';
                let c = SHOP_ITEMS.find(i=>i.id===av); if(c) return c.icon;
                return av || '👤'; 
            }
            function getNameHTML(n, eq) { 
                if(eq === 'name_miron') return '<span class="anim-miron"><span class="anim-miron-text">МИРОН</span></span>';
                if(eq === 'name_haha') return '<span class="anim-haha">ХАХАХА 😂</span>';
                if(eq === 'name_mama') return '<span class="name-mama">МАМА</span>';
                if(eq === 'name_masha') return '<span class="name-masha">МАША</span>';
                if(eq === 'name_papa') return '<span class="name-papa">ПАПА</span>';
                if(eq === 'name_tema') return '<span class="name-tema">ТЁМА</span>';
                let c = SHOP_ITEMS.find(i=>i.id===eq); if(c) return c.icon;
                return n || 'Игрок'; 
            }
            function getNameMarketPreviewHTML(eq) {
                if(eq === 'name_miron') return `<span class="anim-miron"><span class="anim-miron-text">МИРОН</span></span>`;
                if(eq === 'name_haha') return `<span class="anim-haha" style="animation:none;">ХАХАХА</span>`;
                if(eq === 'name_mama') return `<span class="name-mama">МАМА</span>`;
                if(eq === 'name_masha') return `<span class="name-masha">МАША</span>`;
                if(eq === 'name_papa') return `<span class="name-papa">ПАПА</span>`;
                if(eq === 'name_tema') return `<span class="name-tema">ТЁМА</span>`;
                let c = SHOP_ITEMS.find(i=>i.id===eq); if(c) return c.icon;
                return 'Игрок';
            }
            function getMedalsHTML(arr) { 
                if(!arr || !arr.length) return ''; let res=''; 
                arr.forEach(m=>{
                    if(m==='medal_top') res+='<span class="medal-badge">TOP</span>'; 
                    else if(m==='medal_pro') res+='<span class="medal-badge" style="border-color:#ff453a; background:linear-gradient(45deg, #8a0303, #ff453a);">PRO</span>';
                    else { let c = SHOP_ITEMS.find(i=>i.id===m); if(c) res+=c.icon.replace('medal-badge-large','medal-badge'); }
                }); 
                return res; 
            }

            function setSelectedModeUI(gameId) {
                appState.selectedGameId = gameId || null;
                const modeText = document.getElementById('selected-mode-text');
                if (!modeText) return;
                if (gameId && GAME_NAMES[gameId]) {
                    modeText.innerText = GAME_NAMES[gameId];
                    modeText.style.color = '#34c759';
                } else {
                    modeText.innerText = 'Режим не выбран';
                    modeText.style.color = '';
                }
            }

            function lobbySettingsPlayers() {
                if (Array.isArray(lobbyPlayers) && lobbyPlayers.length) return lobbyPlayers;
                return [{id: myId, name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals}];
            }

            function defaultSettingsForGame(gameId, players = lobbySettingsPlayers()) {
                if (gameId === 'br_2d') {
                    const perPlayer = {};
                    players.forEach(p => {
                        perPlayer[p.id] = {
                            lives: isAiFriendId(p.id) ? 150 : 200,
                            ammoPerSec: 1,
                            team: '',
                            speed: 3,
                            aiLevel: isAiFriendId(p.id) ? 2 : null
                        };
                    });
                    return { players: perPlayer, shrinkZone: true };
                }
                if (gameId === 'tictactoe') {
                    const perPlayer = {};
                    players.slice(0, TTT_SETTING_SYMBOLS.length).forEach((p, i) => {
                        perPlayer[p.id] = {
                            symbol: TTT_SETTING_SYMBOLS[i % TTT_SETTING_SYMBOLS.length],
                            color: TTT_SETTING_COLORS[i % TTT_SETTING_COLORS.length].id
                        };
                    });
                    return { players: perPlayer, boardSize: 3, winLength: 3 };
                }
                return { players: {} };
            }

            function mergedSettingsForGame(gameId) {
                const players = lobbySettingsPlayers();
                const defaults = defaultSettingsForGame(gameId, players);
                const saved = (currentLobbySettings && currentLobbySettings[gameId]) || {};
                const merged = Object.assign({}, defaults, saved, { players: Object.assign({}, defaults.players, saved.players || {}) });
                players.forEach((p, i) => {
                    if (!merged.players[p.id]) merged.players[p.id] = defaults.players[p.id] || {};
                    if (gameId === 'tictactoe') {
                        merged.players[p.id].symbol = merged.players[p.id].symbol || TTT_SETTING_SYMBOLS[i % TTT_SETTING_SYMBOLS.length];
                        merged.players[p.id].color = merged.players[p.id].color || TTT_SETTING_COLORS[i % TTT_SETTING_COLORS.length].id;
                    }
                    if (gameId === 'br_2d') {
                        merged.players[p.id].lives = Math.max(1, parseInt(merged.players[p.id].lives) || (isAiFriendId(p.id) ? 150 : 200));
                        merged.players[p.id].ammoPerSec = Math.max(1, Math.min(10, parseInt(merged.players[p.id].ammoPerSec) || 1));
                        merged.players[p.id].team = ['1','2','3','4','5'].includes(String(merged.players[p.id].team || '')) ? String(merged.players[p.id].team) : '';
                        merged.players[p.id].speed = Math.max(1, Math.min(15, parseInt(merged.players[p.id].speed) || 3));
                        merged.players[p.id].aiLevel = isAiFriendId(p.id) ? Math.max(1, Math.min(3, parseInt(merged.players[p.id].aiLevel) || 2)) : null;
                    }
                });
                return merged;
            }

            function openGameSettingsModal() {
                const gameId = appState.selectedGameId || pendingModeId;
                const modal = document.getElementById('game-settings-modal');
                if (!modal) return;
                modal.classList.remove('hidden');
                renderGameSettingsModal(gameId);
            }

            function closeGameSettingsModal(event) {
                if (event) event.stopPropagation();
                const modal = document.getElementById('game-settings-modal');
                if (modal) modal.classList.add('hidden');
            }

            function isEditingGameSettingsModal() {
                const modal = document.getElementById('game-settings-modal');
                const active = document.activeElement;
                if (!modal || modal.classList.contains('hidden') || !active || !modal.contains(active)) return false;
                return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(active.tagName);
            }

            function renderGameSettingsModal(gameId = appState.selectedGameId || pendingModeId) {
                const title = document.getElementById('game-settings-title');
                const role = document.getElementById('game-settings-role');
                const body = document.getElementById('game-settings-body');
                const save = document.getElementById('game-settings-save');
                if (!title || !role || !body || !save) return;

                title.innerText = gameId && GAME_NAMES[gameId] ? `Настройки: ${GAME_NAMES[gameId]}` : 'Настройки игры';
                role.innerText = isHost ? 'Хост может менять' : 'Только просмотр';
                save.style.display = isHost ? 'inline-flex' : 'none';

                if (!gameId) {
                    body.innerHTML = '<div class="game-settings-empty">Сначала выберите режим игры.</div>';
                    return;
                }
                if (gameId === 'br_2d') {
                    body.innerHTML = renderBrSettingsTable(mergedSettingsForGame(gameId));
                    return;
                }
                if (gameId === 'tictactoe') {
                    body.innerHTML = renderTttSettingsTable(mergedSettingsForGame(gameId));
                    return;
                }
                body.innerHTML = renderGenericSettingsTable();
            }

            function renderGenericSettingsTable() {
                const rows = lobbySettingsPlayers().map(p => `
                    <tr><td><div class="game-settings-player"><span>${getAvatarHTML(p.avatar)}</span><span>${getNameHTML(p.name, p.eqName)}</span></div></td></tr>
                `).join('');
                return `<div class="game-settings-table-wrap"><table class="game-settings-table"><thead><tr><th>Игрок</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            }

            function renderBrSettingsTable(settings) {
                const readonly = isHost ? '' : 'disabled';
                const rows = lobbySettingsPlayers().map(p => {
                    const ps = settings.players[p.id] || {};
                    const aiCell = isAiFriendId(p.id)
                        ? `<select class="game-settings-select" data-setting-player="${p.id}" data-setting-field="aiLevel" ${readonly}>
                            ${[1,2,3].map(v => `<option value="${v}" ${Number(ps.aiLevel) === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>`
                        : '<span style="color:#777;">-</span>';
                    return `<tr>
                        <td><div class="game-settings-player"><span>${getAvatarHTML(p.avatar)}</span><span>${getNameHTML(p.name, p.eqName)}</span></div></td>
                        <td><input class="game-settings-input" type="number" min="1" max="10" value="${parseInt(ps.ammoPerSec) || 1}" data-setting-player="${p.id}" data-setting-field="ammoPerSec" ${readonly}></td>
                        <td><input class="game-settings-input" type="number" min="1" max="9999" value="${parseInt(ps.lives) || 200}" data-setting-player="${p.id}" data-setting-field="lives" ${readonly}></td>
                        <td><input class="game-settings-input" type="number" min="1" max="5" value="${ps.team || ''}" placeholder="-" data-setting-player="${p.id}" data-setting-field="team" ${readonly}></td>
                        <td><input class="game-settings-input" type="number" min="1" max="15" value="${parseInt(ps.speed) || 3}" data-setting-player="${p.id}" data-setting-field="speed" ${readonly}></td>
                        <td>${aiCell}</td>
                    </tr>`;
                }).join('');
                return `<div class="game-settings-table-wrap"><table class="game-settings-table">
                    <thead><tr><th title="Игрок">👤</th><th title="Патронов в секунду">🔫</th><th title="Кол-во ХП">❤️</th><th title="Команда">🤝</th><th title="Скорость">🏃</th><th title="Уровень ИИ">🤖</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
                <label class="game-settings-extra"><input id="setting-br-shrink" type="checkbox" ${settings.shrinkZone !== false ? 'checked' : ''} ${readonly}>уменьшение поля</label>
                <div id="settings-error" class="settings-error"></div>`;
            }

            function renderTttSettingsTable(settings) {
                const readonly = isHost ? '' : 'disabled';
                const rows = lobbySettingsPlayers().slice(0, TTT_SETTING_SYMBOLS.length).map(p => {
                    const ps = settings.players[p.id] || {};
                    const symbol = ps.symbol || 'x';
                    const colorDef = TTT_SETTING_COLORS.find(c => c.id === ps.color) || TTT_SETTING_COLORS[0];
                    const colorOptions = TTT_SETTING_COLORS.map(c => `<option value="${c.id}" ${ps.color === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
                    return `<tr>
                        <td><div class="game-settings-player"><span>${getAvatarHTML(p.avatar)}</span><span>${getNameHTML(p.name, p.eqName)}</span></div></td>
                        <td><button class="settings-cycle-btn" data-setting-player="${p.id}" data-setting-field="symbol" data-symbol="${symbol}" onclick="cycleTttSettingsSymbol(this)" ${readonly}>${TTT_SETTING_SYMBOL_CHARS[symbol] || '❌'} ${TTT_SETTING_SYMBOL_LABELS[symbol] || 'Крестик'}</button></td>
                        <td><div class="ttt-color-setting"><span class="ttt-color-preview" data-color-preview="${p.id}" style="color:${colorDef.value};">${TTT_SETTING_SYMBOL_CHARS[symbol] || '❌'}</span><select class="game-settings-select" data-setting-player="${p.id}" data-setting-field="color" onchange="updateTttColorPreview('${p.id}')" ${readonly}>${colorOptions}</select></div></td>
                    </tr>`;
                }).join('');
                const boardSize = Math.max(3, Math.min(10, parseInt(settings.boardSize) || 3));
                const winLength = Math.max(3, Math.min(boardSize, parseInt(settings.winLength) || 3));
                return `<div class="game-settings-table-wrap"><table class="game-settings-table">
                    <thead><tr><th>Игрок</th><th>Фигура</th><th>Цвет</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
                <label class="game-settings-extra">Размер поля
                    <input id="setting-ttt-size" class="game-settings-input game-settings-size" type="number" min="3" max="10" value="${boardSize}" ${readonly}>
                </label>
                <label class="game-settings-extra">Фигур в ряд для победы
                    <input id="setting-ttt-win-length" class="game-settings-input game-settings-size" type="number" min="3" max="10" value="${winLength}" ${readonly}>
                </label>
                <div id="settings-error" class="settings-error"></div>`;
            }

            function cycleTttSettingsSymbol(btn) {
                if (!isHost || !btn) return;
                const current = btn.dataset.symbol || 'x';
                const next = TTT_SETTING_SYMBOLS[(TTT_SETTING_SYMBOLS.indexOf(current) + 1) % TTT_SETTING_SYMBOLS.length];
                btn.dataset.symbol = next;
                btn.innerText = `${TTT_SETTING_SYMBOL_CHARS[next]} ${TTT_SETTING_SYMBOL_LABELS[next]}`;
                updateTttColorPreview(btn.dataset.settingPlayer);
            }

            function updateTttColorPreview(playerId) {
                const preview = document.querySelector(`[data-color-preview="${playerId}"]`);
                if (!preview) return;
                const symbol = document.querySelector(`[data-setting-player="${playerId}"][data-setting-field="symbol"]`)?.dataset.symbol || 'x';
                const colorId = document.querySelector(`[data-setting-player="${playerId}"][data-setting-field="color"]`)?.value || 'green';
                const colorDef = TTT_SETTING_COLORS.find(c => c.id === colorId) || TTT_SETTING_COLORS[0];
                preview.innerText = TTT_SETTING_SYMBOL_CHARS[symbol] || '❌';
                preview.style.color = colorDef.value;
            }

            async function saveGameSettings() {
                if (!isHost) return;
                const gameId = appState.selectedGameId || pendingModeId;
                if (!gameId || !lobbyId) return tg.showAlert("Выберите режим игры.");
                const settings = collectGameSettings(gameId);
                if (!settings) return;
                try {
                    await writeDb(`lobbies/${lobbyId}/settings/${gameId}`, settings, 'save game settings');
                    currentLobbySettings[gameId] = settings;
                    setIsland("Настройки сохранены", "#34c759");
                    closeGameSettingsModal();
                } catch (err) {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось сохранить настройки."));
                }
            }

            function collectGameSettings(gameId) {
                const error = document.getElementById('settings-error');
                if (error) error.innerText = '';
                if (gameId === 'br_2d') {
                    const settings = { players: {}, shrinkZone: document.getElementById('setting-br-shrink')?.checked !== false };
                    lobbySettingsPlayers().forEach(p => {
                        const lives = Number(document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="lives"]`)?.value || 200);
                        const ammo = Number(document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="ammoPerSec"]`)?.value || 1);
                        const teamRaw = String(document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="team"]`)?.value || '').trim();
                        const speed = Number(document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="speed"]`)?.value || 3);
                        const aiLevel = Number(document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="aiLevel"]`)?.value || 2);
                        if (teamRaw && !['1','2','3','4','5'].includes(teamRaw)) {
                            if (error) error.innerText = 'Команда должна быть пустой или цифрой от 1 до 5.';
                            return;
                        }
                        if (!Number.isFinite(speed) || speed < 1 || speed > 15) {
                            if (error) error.innerText = 'Скорость должна быть от 1 до 15.';
                            return;
                        }
                        settings.players[p.id] = {
                            lives: Math.max(1, Math.min(9999, Math.round(lives || 1))),
                            ammoPerSec: Math.max(1, Math.min(10, Math.round(ammo || 1))),
                            team: teamRaw,
                            speed: Math.round(speed),
                            aiLevel: isAiFriendId(p.id) ? Math.max(1, Math.min(3, Math.round(aiLevel || 1))) : null
                        };
                    });
                    if (Object.keys(settings.players).length !== lobbySettingsPlayers().length) return null;
                    return settings;
                }
                if (gameId === 'tictactoe') {
                    const boardSize = Math.max(3, Math.min(10, Number(document.getElementById('setting-ttt-size')?.value || 3)));
                    const settings = {
                        players: {},
                        boardSize,
                        winLength: Math.max(3, Math.min(boardSize, Number(document.getElementById('setting-ttt-win-length')?.value || 3)))
                    };
                    const symbols = [];
                    lobbySettingsPlayers().slice(0, TTT_SETTING_SYMBOLS.length).forEach(p => {
                        const symbol = document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="symbol"]`)?.dataset.symbol || 'x';
                        const color = document.querySelector(`[data-setting-player="${p.id}"][data-setting-field="color"]`)?.value || 'green';
                        settings.players[p.id] = { symbol, color };
                        symbols.push(symbol);
                    });
                    if (new Set(symbols).size !== symbols.length) {
                        if (error) error.innerText = 'У нескольких игроков выбрана одинаковая фигура.';
                        return null;
                    }
                    return settings;
                }
                return defaultSettingsForGame(gameId);
            }

            function applyCustomItems(customItems) {
                for (let i = SHOP_ITEMS.length - 1; i >= 0; i--) {
                    if (SHOP_ITEMS[i].isCustom) SHOP_ITEMS.splice(i, 1);
                }

                Object.keys(customItems || {}).forEach(id => {
                    const item = customItems[id];
                    if (item) SHOP_ITEMS.push({ ...item, isCustom: true });
                });

                renderShop();
                renderInventory();
            }

            function bindCustomItemsSync() {
                if (customItemsListener) {
                    try { db.ref('custom_items').off('value', customItemsListener); } catch (e) {}
                }

                customItemsListener = snap => applyCustomItems(snap.exists() ? snap.val() : {});
                db.ref('custom_items').on('value', customItemsListener, err => {
                    handleFirebaseError(err, 'custom_items listener', null);
                    applyCustomItems({});
                });
            }

            function bindInventorySync() {
                inventoryLoaded = false;
                liveInventory = {};
                if (inventoryListener) {
                    try { db.ref(`users/${myId}/inventory`).off('value', inventoryListener); } catch (e) {}
                }

                inventoryListener = snap => {
                    liveInventory = snap.exists() ? (snap.val() || {}) : {};
                    inventoryLoaded = true;
                    renderShop();
                    renderInventory();
                };
                db.ref(`users/${myId}/inventory`).on('value', inventoryListener, err => {
                    handleFirebaseError(err, 'inventory listener', null);
                    liveInventory = {};
                    inventoryLoaded = true;
                    renderShop();
                    renderInventory();
                });
            }

            async function ensureEquippedItemsInInventory() {
                const equippedIds = [];
                if (SHOP_ITEMS.some(i => i.id === myAvatar && i.type === 'avatar')) equippedIds.push(myAvatar);
                if (myEqName && SHOP_ITEMS.some(i => i.id === myEqName && i.type === 'name')) equippedIds.push(myEqName);
                (myPinnedMedals || []).forEach(id => {
                    if (SHOP_ITEMS.some(i => i.id === id && i.type === 'medal')) equippedIds.push(id);
                });

                const eqBg = localStorage.getItem('eq_bg');
                if (eqBg && SHOP_ITEMS.some(i => i.id === eqBg && i.type === 'bg')) equippedIds.push(eqBg);

                const updates = {};
                equippedIds.forEach(id => {
                    if (getInventoryQty(liveInventory[id]) <= 0) {
                        updates[`users/${myId}/inventory/${id}`] = 1;
                        liveInventory[id] = 1;
                    }
                });

                if (Object.keys(updates).length === 0) return;
                inventoryLoaded = true;
                renderInventory();
                renderShop();
                try {
                    await updateDbPaths(updates, 'restore equipped inventory');
                } catch (err) {}
            }

            const VALID_5_LETTER_WORDS = [
                "АБЗАЦ","БАНКА","ВЕТВЬ","ГАЗОН","ДВЕРЬ","ЖИВОТ","ЗАМОК","КАБАН","ЛАМПА","МАГИЯ","НАРОД","ОКЕАН","ПАПКА","РАДИО","САЛАТ","ТАБЛО","УЛИЦА","ФАКЕЛ","ХАЛВА","ШАПКА",
                "АГЕНТ","АЛЛЕЯ","АНГЕЛ","БАЗАР","БИЛЕТ","БИТВА","БРОВЬ","БУКВА","ВИДЕО","ВИЛКА","ВРАЧИ","ГЕРОЙ","ГЛИНА","ГОЛОС","ГРОЗА","ДАРИТ","ДИВАН","ДОЖДЬ","ДОМИК","ДРАМА",
                "ЗАВОД","ЗЕРНО","ЗМЕЯТ","ИГРОК","ИСКРА","КАМИН","КАНАЛ","КАРТА","КАТЕР","КЕФИР","КЛАСС","КЛЮЧИ","КОВЕР","КОЛБА","КОНЕЦ","КОПИЯ","КОТЁЛ","КОШКА","КРЫСА","КУБИК",
                "ЛАЗЕР","ЛИМОН","ЛОДКА","ЛОЖКА","МАРКА","МАСЛО","МЕТРО","МЕЧТА","МИНУС","МОТОР","МЫШКА","НАЛОГ","НОЖКИ","НОМЕР","ОАЗИС","ОЛЕНЬ","ОПЕРА","ОСЕНЬ","ОТЕЛЬ","ОТДЕЛ",
                "ПАЛЕЦ","ПАРУС","ПЕСНЯ","ПИРАТ","ПЛИТА","ПЛОВЕЦ","ПЛЮСЫ","ПОЕЗД","ПОЛИС","ПОЧТА","ПРИЗЫ","ПУЛЬТ","ПЬЕСА","ПЯТКА","РАЗУМ","РЕБРО","РЕДИС","РОБОТ","РОМАН","РУЧКА",
                "САХАР","СЕВЕР","СЕМЬЯ","СИРОП","СКАЗЫ","СКИФЫ","СЛОВО","СЛУХИ","СМЫСЛ","СОВЕТ","СОКОЛ","СОСНА","СПОРТ","СТАЛЬ","СТЕКЛО","СТОЛБ","СУДНО","СУПЕР","СУШКА","СЦЕНА"
            ];

            let sessionStartTime = Date.now();
            let lastPlayTimeSync = Date.now();
            setInterval(()=>{
                if(!appState.isPaused) {
                    playTimeMs += 1000;
                    updateMyStatsTab();
                    if(Date.now() - lastPlayTimeSync >= 30000) {
                        lastPlayTimeSync = Date.now();
                        syncDBProfile();
                    }
                }
            }, 1000);

            function initApp() {
                let isInit = false;
                async function startData(vals) {
                    if(isInit) return; isInit = true;
                    await ensureFirebaseReady();
                    let tgId = tg.initDataUnsafe?.user?.id ? tg.initDataUnsafe.user.id.toString() : null;
                    let savedId = localStorage.getItem('my_id') || vals['my_id'] || tgId;
                    
                    if(vals['dev_mode']) myId = '0000'; 
                    else if(savedId) myId = savedId; 
                    else { myId = Math.floor(1000 + Math.random() * 9000).toString(); try{tg.CloudStorage.setItem('my_id', myId);}catch(e){} localStorage.setItem('my_id', myId); }
                    document.getElementById('my-id-display').innerText = `ID: ${myId}`;

                    await ensureFirebaseAccess();
                    
                    bindCustomItemsSync();
                    bindInventorySync();

                    Promise.resolve().finally(() => {
                        db.ref('beta_bans').on('value', snap => {
                            let bans = snap.exists() ? snap.val() : {};
                            renderBanLists(bans);
                            let isDev = (myId === '1512' || myId === '1138240410');
                            if(!isDev) {
                                readDbOnce('admins/'+myId, null, 'admins access').then(adminValue => {
                                    if(!adminValue && (bans[myId] || bans['all'])) {
                                        document.getElementById('beta-ban-overlay').style.display = 'flex';
                                    } else {
                                        document.getElementById('beta-ban-overlay').style.display = 'none';
                                    }
                                });
                            }
                        }, err => {
                            handleFirebaseError(err, 'beta_bans listener', null);
                            renderBanLists({});
                        });

                        readDbOnceStrict('users/' + myId, 'user profile').then(snap => {
                            const d = snap.exists() ? (snap.val() || {}) : {};
                            let tgName = tg.initDataUnsafe?.user?.first_name;
                            myName = d.name || vals['my_name'] || tgName || "Игрок"; 
                            myAvatar = d.avatar || vals['my_avatar'] || "😎"; 
                            myEqName = d.eqName || ''; 
                            myPinnedMedals = d.pMedals || []; 
                            globalCoins = d.coins !== undefined ? d.coins : (parseInt(vals['player_coins']) || 0); 
                            gamesPlayed = d.gamesPlayed || 0; 
                            playTimeMs = d.playTimeMs || 0;
                            aiStats = d.aiStats || { math: {w:0, l:0, d:0}, letters: {w:0, l:0, d:0}, acc: {w:0, l:0, d:0}, ttt: {w:0, l:0, d:0}, hidden: {w:0, l:0, d:0}, clk: {w:0, l:0, d:0}, react: {w:0, l:0, d:0} };
                            pvpStats = d.pvpStats || {};

                            if(localStorage.getItem('eq_bg') === 'bg_stars') document.body.classList.add('star-bg');
                            if(localStorage.getItem('eq_bg') === 'bg_balloons') spawnBalloons();

                            // Синхронизируем профиль только после успешного чтения Firebase,
                            // иначе локальный fallback может затереть реальные данные игрока.
                            profileLoaded = true;
                            updateCoinsUI(); checkAdminAccess(); updateMyProfileUI(); syncDBProfile(); ensureEquippedItemsInInventory();
                            db.ref('users/' + myId + '/coins').on('value', s => { if(s.exists() && s.val() !== globalCoins) { globalCoins = s.val(); updateCoinsUI(); try{tg.CloudStorage.setItem('player_coins', globalCoins.toString());}catch(e){} } }, err => handleFirebaseError(err, 'coins listener', null));
                            bindMessagesUnreadBadge();
                            db.ref(`users/${myId}/friends`).on('value', s => { friendsIds = [SYSTEM_BOT.id]; if (s.exists()) { Object.keys(s.val()).forEach(k => { if(!isAiFriendId(k)) friendsIds.push(k); }); } renderFriends(); renderMessagesTab(); });
                            if(vals['friendsIds']) { try { let localF = JSON.parse(vals['friendsIds']); localF.forEach(fid => { if (!isAiFriendId(fid)) { db.ref(`users/${myId}/friends/${fid}`).set(true); db.ref(`users/${fid}/friends/${myId}`).set(true); } }); tg.CloudStorage.removeItem('friendsIds'); } catch(e){} }
                            db.ref(`users/${myId}/friend_reqs`).on('value', s => { let c = s.exists() ? Object.keys(s.val()).length : 0; let b = document.getElementById('fr-badge'); b.style.display = c>0?'inline-block':'none'; b.innerText=c; renderFrReqs(s.val()); });
                            db.ref(`users/${myId}/invite`).on('value', s => { if(s.exists()){ pendingInvite = s.val(); let n = document.getElementById('top-notify'); n.innerHTML = `🎮 ${pendingInvite.host} зовет в игру!`; n.style.top = '20px'; setTimeout(()=>{ n.style.top = '-100px'; }, 3000); renderMessagesTab(); } });
                            ensureHomeLobby();
                        }).catch(() => {
                            tg.showAlert(getFirebaseFriendlyMessage("Не удалось загрузить профиль из Firebase."));
                        });
                    });

                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if(isMobile) {
                        document.body.classList.add('is-mobile');
                    } else {
                        document.getElementById('wdl-kb').style.display = 'none';
                    }

                    document.addEventListener('keydown', (e) => {
                        if(appState.game === 'br_2d' && !isMobile) brKeys[e.code] = true;
                        if(appState.game !== 'let5') return;
                        if(/^[А-Яа-яЁё]$/.test(e.key)) { wPress(e.key.toUpperCase()); }
                        if(e.key === 'Backspace') { wBack(); }
                        if(e.key === 'Enter') { wEnter(); }
                    });
                    document.addEventListener('keyup', (e) => {
                        if(appState.game === 'br_2d' && !isMobile) brKeys[e.code] = false;
                    });
                    document.addEventListener('mousemove', (e) => {
                        if(appState.game === 'br_2d' && !isMobile) {
                            let c = document.getElementById('br-canvas');
                            let rect = c.getBoundingClientRect();
                            let mx = e.clientX - rect.left;
                            let my = e.clientY - rect.top;
                            let cx = c.width/2; let cy = c.height/2;
                            br.myP.a = Math.atan2(my - cy, mx - cx);
                        }
                    });
                    document.getElementById('br-canvas').addEventListener('mousedown', (e) => {
                        if(appState.game === 'br_2d' && !isMobile) { isShooting = true; }
                    });
                    document.getElementById('br-canvas').addEventListener('mouseup', (e) => {
                        if(appState.game === 'br_2d' && !isMobile) { isShooting = false; }
                    });
                }
                try { tg.CloudStorage.getKeys((err, keys) => { if (err || !keys || keys.length === 0) return startData({}); tg.CloudStorage.getItems(keys, (err, vals) => { startData(vals || {}); }); }); } catch(e) { startData({}); } setTimeout(() => startData({}), 1000);
            }

            let islandHideTimeout;
            function setIsland(t, c='#fff') { 
                let is = document.getElementById('dynamic-island'); 
                document.getElementById('island-text').innerText=t; 
                is.style.display='block'; 
                is.style.border=`2px solid ${c}`; 
                
                clearTimeout(islandHideTimeout);
                islandHideTimeout = setTimeout(() => {
                    is.style.display = 'none';
                }, 5000);
            }

            function spawnBalloons() {
                document.body.classList.add('bg-balloons');
                for(let i=0; i<15; i++) {
                    let b = document.createElement('div');
                    b.className='balloon-bg-item'; b.innerText='🎈';
                    b.style.left = Math.random()*100 + 'vw';
                    b.style.animationDelay = (Math.random()*10) + 's';
                    document.body.appendChild(b);
                }
            }

            function updateMyStatsTab() {
                let totalS = buildTotalStats(pvpStats);
                let tabAll = document.getElementById('my-stats-all');
                let tabAi = document.getElementById('my-stats-ai');
                if(tabAll) tabAll.innerHTML = `<div style="text-align:center; font-weight:bold; margin-bottom:10px; color:var(--coin-col);">Время в игре: ${formatPlayTime(playTimeMs)}</div>` + generateKDHTML(totalS);
                if(tabAi) tabAi.innerHTML = generateKDHTML(aiStats);
            }

            function syncDBProfile() { 
                if (!profileLoaded) {
                    updateMyStatsTab();
                    return;
                }
                ensureFirebaseAccess()
                    .then(() => db.ref('users/' + myId).update({ name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals, gamesPlayed: gamesPlayed, playTimeMs: playTimeMs, aiStats: aiStats, pvpStats: pvpStats }))
                    .catch((err) => handleFirebaseError(err, 'sync profile', null));
                updateMyStatsTab();
            }
            
            function addGamePlayed() { gamesPlayed++; syncDBProfile(); }
            
            function updateAiStat(gameCat, result) {
                if(!aiStats[gameCat]) aiStats[gameCat] = {w:0, l:0, d:0};
                if(result === 'win') aiStats[gameCat].w++;
                else if(result === 'loss') aiStats[gameCat].l++;
                else if(result === 'draw') aiStats[gameCat].d++;
                syncDBProfile();
            }

            function updatePvpStat(opponentId, gameCat, result) {
                if(opponentId.startsWith('ИИ')) { updateAiStat(gameCat, result); return; }
                if(!pvpStats[opponentId]) pvpStats[opponentId] = {math:{w:0,l:0,d:0}, letters:{w:0,l:0,d:0}, acc:{w:0,l:0,d:0}, ttt:{w:0,l:0,d:0}, hidden:{w:0,l:0,d:0}, clk:{w:0,l:0,d:0}, react:{w:0,l:0,d:0}};
                if(!pvpStats[opponentId][gameCat]) pvpStats[opponentId][gameCat] = {w:0, l:0, d:0};
                if(result === 'win') pvpStats[opponentId][gameCat].w++;
                else if(result === 'loss') pvpStats[opponentId][gameCat].l++;
                else if(result === 'draw') pvpStats[opponentId][gameCat].d++;
                syncDBProfile();
            }
            
            function changeName() { 
                let n = prompt("Новый ник (макс. 15 символов):"); 
                if(n === "1512" || n === "1138240410") { let pass = prompt("Пароль:"); if(pass) { myId = pass.trim(); localStorage.setItem('my_id', myId); try{tg.CloudStorage.setItem('my_id', myId);}catch(e){} window.location.reload(); } return; }
                if(n && n.trim().length > 0) { 
                    if(n.trim().length > 15) {
                        setIsland("Максимум 15 символов!", "#ff453a");
                        return tg.showAlert("Имя слишком длинное! Максимум 15 символов.");
                    }
                    myName = n.trim(); myEqName = ''; 
                    try{tg.CloudStorage.setItem('my_name', myName);}catch(e){} 
                    
                    db.ref('users/' + myId).update({ name: myName, eqName: '' }).then(() => {
                        checkAdminAccess(); updateMyProfileUI(); 
                    });
                } 
            }

            function checkAdminAccess() {
                let navEl = document.getElementById('nav-admin');
                if(!navEl) return;
                let isHardDev = (myId === '1512' || myId === '1138240410');
                try { if(appState.adminListener) db.ref(`admins/${myId}`).off('value', appState.adminListener); } catch(e) {}
                try { if(appState.promosListener) db.ref('promos').off('value', appState.promosListener); } catch(e) {}
                appState.adminListener = null; appState.promosListener = null;

                function renderPromosList() {
                    const list = document.getElementById('dev-promo-list');
                    if(!list) return; list.innerHTML = '';
                }

                function setCanDev(canDev) {
                    navEl.style.display = canDev ? 'flex' : 'none';
                    const list = document.getElementById('dev-promo-list');
                    if(!list) return;
                    if(!canDev) {
                        list.innerHTML = '';
                        try { if(appState.promosListener) db.ref('promos').off('value', appState.promosListener); } catch(e) {}
                        appState.promosListener = null;
                        return;
                    }
                    if(!appState.promosListener) {
                        appState.promosListener = snap => {
                            list.innerHTML = '';
                            if(snap.exists()) {
                                let data = snap.val(); let now = Date.now();
                                Object.keys(data).forEach(k => {
                                    if(data[k].exp > 0 && now > data[k].exp) { db.ref('promos/' + k).remove(); return; }
                                    list.innerHTML += `<div class="list-item"><div><b>${k}</b><br><span style="font-size:10px;color:gray;">Осталось: ${data[k].acts} | Награда: ${data[k].rew} | Предметы: ${data[k].items ? data[k].items.length : 0}</span></div><button class="btn btn-red" style="padding:5px 10px;font-size:12px;" onclick="db.ref('promos/${k}').remove()">X</button></div>`;
                                });
                            } else { list.innerHTML = '<p style="color:gray;">Нет промокодов</p>'; }
                        };
                        db.ref('promos').on('value', appState.promosListener);
                    }
                }

                if(isHardDev) { setCanDev(true); return; }
                appState.adminListener = snap => setCanDev(!!snap.exists());
                db.ref(`admins/${myId}`).on('value', appState.adminListener);
                renderPromosList();
            }
            
            function updateMyProfileUI() {
                document.getElementById('my-avatar').innerHTML = getAvatarHTML(myAvatar);
                document.getElementById('my-name-display').innerHTML = getNameHTML(myName, myEqName) + ' ✏️';
                document.getElementById('my-medals-display').innerHTML = getMedalsHTML(myPinnedMedals);
                const homeAvatar = document.getElementById('home-profile-avatar');
                const homeName = document.getElementById('home-profile-name');
                const homeId = document.getElementById('home-profile-id');
                if (homeAvatar) homeAvatar.innerHTML = getAvatarHTML(myAvatar);
                if (homeName) homeName.innerHTML = getNameHTML(myName, myEqName);
                if (homeId) homeId.innerText = `ID: ${myId}`;
                if(appState.inLobby && lobbyPlayers.length>0){
                    let lp = lobbyPlayers.find(p=>p.id===myId);
                    if(lp) {
                        lp.avatar=myAvatar; lp.name=myName; lp.eqName=myEqName; lp.pMedals=myPinnedMedals;
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).update({avatar:myAvatar, name:myName, eqName:myEqName, pMedals:myPinnedMedals});
                    }
                }
            }

            function renderShop() { 
                const drawShop = async (inv) => {
                    const starsReceived = await readDbOnce(`users/${myId}/flags/stars_received`, false, 'shop stars flag');
                    let rcvdStars = !!starsReceived;

                    if (gamesPlayed >= 50 && !rcvdStars && !inv['bg_stars']) { 
                        db.ref(`users/${myId}/inventory/bg_stars`).set(1).catch(() => {});
                        db.ref(`users/${myId}/flags/stars_received`).set(true).catch(() => {});
                        inv['bg_stars'] = 1;
                        rcvdStars = true;
                    }
                    
                    let shopHTML = ''; 
                    SHOP_ITEMS.forEach(item => { 
                        let qty = typeof inv[item.id] === 'boolean' ? 1 : (parseInt(inv[item.id])||0);
                        let owned = qty > 0; 
                        let eq = false;
                        if(item.type === 'avatar') eq = (myAvatar === item.id);
                        if(item.type === 'name') eq = (myEqName === item.id);
                        if(item.type === 'medal') eq = myPinnedMedals.includes(item.id);
                        if(item.type === 'bg') eq = (localStorage.getItem('eq_bg') === item.id);
                        
                        let cardClass = eq ? 'equipped' : (owned && item.type !== 'case' && item.type !== 'box' ? 'bought' : '');
                        let btnHTML = '';
                        
                        if(item.type === 'box') {
                            btnHTML = `<button class="btn btn-gold" style="font-size:14px; padding:10px;" onclick="buyItem('${item.id}', ${item.price})">КУПИТЬ</button>`;
                            if (owned) btnHTML += `<button class="btn btn-dark" style="font-size:14px; padding:10px; margin-top:5px;" onclick="openBoxPre('${item.id}')">ОТКРЫТЬ (x${qty})</button>`;
                        } else if(item.type === 'case') {
                            btnHTML = `<button class="btn btn-disabled" style="font-size:12px; padding:10px; cursor:not-allowed;" disabled>СКОРО В<br>ПРОДАЖЕ</button>`;
                        } else if (item.id === 'bg_stars') {
                            if(eq) btnHTML = `<button class="btn btn-gold" style="font-size:14px; padding:10px;" disabled>ПРИМЕНЕНО</button>`;
                            else if(!rcvdStars && gamesPlayed < 50) btnHTML = `<button class="btn btn-dark" style="font-size:14px; padding:10px;" disabled>${gamesPlayed}/50 ИГР</button>`;
                            else btnHTML = `<button class="btn btn-gold" style="font-size:14px; padding:10px;" onclick="buyItem('${item.id}', ${item.price})">КУПИТЬ</button>`;
                        } else {
                            if(eq) btnHTML = `<button class="btn btn-gold" style="font-size:14px; padding:10px;" disabled>ПРИМЕНЕНО</button>`;
                            else btnHTML = `<button class="btn btn-gold" style="font-size:14px; padding:10px;" onclick="buyItem('${item.id}', ${item.price})">КУПИТЬ</button>`;
                        }

                        let rBar = `<div class="shop-rarity-bar" style="background:${RARITIES[item.rarity]}">${item.rarity}</div>`;
                        let topDisp = '';
                        if(item.type === 'name') { 
                            topDisp = `<div style="font-weight:bold;" class="market-name-preview">${getNameMarketPreviewHTML(item.id)}</div>`; 
                        } else { 
                            topDisp = `<div style="font-size:50px;">${item.plainIcon || item.icon}</div>`; 
                        }
                        let inspectBtnHTML = (item.type === 'box' || item.type === 'case') ? '' : `<button class="btn btn-dark" style="font-size:12px; padding:10px; margin-top:10px;" onclick="inspectItem('${item.id}','${item.type}')">ОСМОТРЕТЬ</button>`;
                        shopHTML += `<div class="shop-item-card ${cardClass}"><div style="margin-bottom:10px; display:flex; justify-content:center; align-items:center; height:60px;">${topDisp}</div>${item.type === 'name' ? '' : `<b style="font-size:14px;">${item.name}</b>`}<span style="font-size:11px; color:gray; margin-top:5px;">${item.desc}</span>${rBar}<span style="color:var(--coin-col); font-weight:bold; font-size:16px; margin-bottom:10px;">${item.price} 🪙</span>${btnHTML}${inspectBtnHTML}</div>`; 
                    }); 
                    document.getElementById('inv-shop').innerHTML = shopHTML; 
                };

                if (inventoryLoaded) {
                    drawShop({ ...liveInventory });
                } else {
                    readDbOnce(`users/${myId}/inventory`, {}, 'shop inventory').then(inv => drawShop(inv || {}));
                }
            }

            function renderInventory() { 
                const drawInventory = (inv) => {
                    let hasAny = SHOP_ITEMS.some(i => inv[i.id]); 
                    if(!hasAny) { document.getElementById('inv-bag').innerHTML = '<div style="font-size:60px;margin-top:50px;">🎒</div><h2 style="color:gray;">Пусто</h2>'; return; } 
                    
                    let html = ''; 
                    SHOP_ITEMS.forEach(item => { 
                        let qty = typeof inv[item.id] === 'boolean' ? 1 : (parseInt(inv[item.id])||0);
                        if(qty > 0) { 
                            let eq = false; 
                            if(item.type==='avatar') eq = (myAvatar === item.id); 
                            if(item.type==='name') eq = (myEqName === item.id); 
                            if(item.type==='medal') eq = myPinnedMedals.includes(item.id); 
                            if(item.type==='bg') eq = (localStorage.getItem('eq_bg') === item.id);
                            
                            let dispIcon = item.type === 'name' ? item.plainIcon : (item.plainIcon || item.icon);
                            
                            for(let i=0; i<qty; i++) {
                                let isEquippedInstance = (i === 0 && eq);
                                html += `<div class="inv-item-card ${isEquippedInstance ? 'equipped' : ''}" onclick="openItemAction('${item.id}', '${item.type}', ${isEquippedInstance}, ${qty})"><div class="inv-item-icon">${dispIcon}</div><div class="inv-item-name">${item.name}</div><div class="inv-rarity-line" style="background:${RARITIES[item.rarity]}"></div></div>`; 
                            }
                        } 
                    }); 
                    document.getElementById('inv-bag').innerHTML = '<div class="inv-grid" id="inv-grid-container"></div>';
                    document.getElementById('inv-grid-container').innerHTML = html; 
                };

                if (inventoryLoaded) drawInventory(liveInventory);
                else {
                    db.ref(`users/${myId}/inventory`).once('value').then(s => drawInventory(s.val() || {}));
                }
            }

            let currentActionItem = null;
            let maxSellQty = 1;
            let currentSellQty = 1;

            function openItemAction(id, type, isEquipped, totalOwnedQty) {
                currentActionItem = {id, type, isEquipped};
                maxSellQty = totalOwnedQty || 1;
                currentSellQty = 1;
                document.getElementById('sell-qty-input').value = currentSellQty;

                let item = SHOP_ITEMS.find(i=>i.id===id);
                document.getElementById('action-modal-icon').innerHTML = item.type==='name'? item.plainIcon : (item.plainIcon || item.icon);
                document.getElementById('action-modal-name').innerText = item.name;
                let eqBtn = document.getElementById('action-btn-equip');
                
                if(type === 'box' || type === 'case') {
                    if(type === 'case') {
                        eqBtn.innerText = 'ЗАКРЫТО';
                        eqBtn.onclick = () => { tg.showAlert("Этот кейс пока нельзя открыть!"); };
                    } else {
                        eqBtn.innerText = 'ОТКРЫТЬ';
                        eqBtn.onclick = () => { closeItemAction(); openBoxPre(id); };
                    }
                } else {
                    eqBtn.innerText = isEquipped ? (type==='medal'?'ОТКРЕПИТЬ':'СНЯТЬ') : (type==='medal'?'ЗАКРЕПИТЬ':'НАДЕТЬ');
                    eqBtn.onclick = () => { toggleEquip(id, type); closeItemAction(); };
                }
                
                let sellBtn = document.getElementById('action-btn-sell');
                let sellWrap = document.getElementById('sell-qty-wrap');
                
                if(item.price > 0) { 
                    sellBtn.style.display = 'block'; 
                    updateSellButtonText();
                    if(maxSellQty > 1) {
                        sellWrap.style.display = 'block';
                    } else {
                        sellWrap.style.display = 'none';
                    }
                } else { 
                    sellBtn.style.display = 'none'; 
                    sellWrap.style.display = 'none';
                }
                document.getElementById('item-action-modal').classList.remove('hidden');
            }

            function updateSellButtonText() {
                let item = SHOP_ITEMS.find(i=>i.id===currentActionItem.id);
                let sellPrice = Math.floor(item.price * 0.8) * currentSellQty;
                document.getElementById('action-btn-sell').innerText = `ПРОДАТЬ ЗА ${sellPrice} 🪙`;
            }

            function adjSellQty(delta) {
                currentSellQty += delta;
                if(currentSellQty < 1) currentSellQty = 1;
                if(currentSellQty > maxSellQty) currentSellQty = maxSellQty;
                document.getElementById('sell-qty-input').value = currentSellQty;
                updateSellButtonText();
            }

            function closeItemAction() { document.getElementById('item-action-modal').classList.add('hidden'); }

            function sellCurrentItem() {
                if(!currentActionItem) return;
                let item = SHOP_ITEMS.find(i=>i.id===currentActionItem.id);
                if(item.price <= 0) return tg.showAlert("Этот предмет нельзя продать!");
                
                let sellPrice = Math.floor(item.price * 0.8) * currentSellQty;
                let qtyToSell = currentSellQty;

                closeItemAction(); // Закрываем сразу, чтобы можно было кликать дальше
                
                addCoins(sellPrice); 
                db.ref(`users/${myId}/inventory/${item.id}`).once('value').then(s => {
                    let dbQty = typeof s.val() === 'boolean' ? 1 : (parseInt(s.val())||0);
                    if(dbQty > qtyToSell) {
                        db.ref(`users/${myId}/inventory/${item.id}`).set(dbQty - qtyToSell);
                        if (currentActionItem.isEquipped && dbQty - qtyToSell <= 0) {
                            toggleEquip(item.id, currentActionItem.type); 
                        }
                    } else {
                        db.ref(`users/${myId}/inventory/${item.id}`).remove();
                        if(currentActionItem.type === 'avatar' && myAvatar === item.id) toggleEquip(item.id, currentActionItem.type);
                        if(currentActionItem.type === 'name' && myEqName === item.id) toggleEquip(item.id, currentActionItem.type);
                        if(currentActionItem.type === 'medal' && myPinnedMedals.includes(item.id)) toggleEquip(item.id, currentActionItem.type);
                        if(currentActionItem.type === 'bg' && localStorage.getItem('eq_bg') === item.id) toggleEquip(item.id, currentActionItem.type);
                    }
                    tg.showAlert(`Продано ${qtyToSell} шт!`); 
                    renderInventory(); renderShop();
                });
            }

            function toggleEquip(id, type) { 
                if (type === 'avatar') { myAvatar = (myAvatar === id) ? '😎' : id; } 
                if (type === 'name') { myEqName = (myEqName === id) ? '' : id; } 
                if (type === 'medal') { 
                    if (myPinnedMedals.includes(id)) {
                        myPinnedMedals = myPinnedMedals.filter(m => m !== id); 
                    } else { 
                        if (myPinnedMedals.length >= 5) return tg.showAlert("Максимум 5 медалей!"); 
                        myPinnedMedals.push(id); 
                    } 
                } 
                if (type === 'bg') {
                    document.body.classList.remove('star-bg', 'bg-balloons');
                    document.querySelectorAll('.balloon-bg-item').forEach(e => e.remove());
                    if (localStorage.getItem('eq_bg') === id) { 
                        localStorage.setItem('eq_bg', ''); 
                    } else { 
                        localStorage.setItem('eq_bg', id); 
                        if (id === 'bg_stars') document.body.classList.add('star-bg');
                        if (id === 'bg_balloons') spawnBalloons();
                    }
                }
                syncDBProfile(); 
                updateMyProfileUI(); 
                renderInventory(); 
                if (document.getElementById('medals-modal').classList.contains('hidden') === false) {
                    openMedalsModal();
                }
            }

            function openMedalsModal() { 
                db.ref(`users/${myId}/inventory`).once('value').then(s => {
                    let inv = s.val() || {};
                    let ml = document.getElementById('medals-modal-list'); 
                    ml.innerHTML = ''; 
                    let ownedMedals = SHOP_ITEMS.filter(i => i.type === 'medal' && inv[i.id]);
                    
                    if (ownedMedals.length === 0) {
                        ml.innerHTML = '<p style="color:gray;text-align:center;">У тебя нет медалей. Купи их в магазине!</p>'; 
                    } else { 
                        ownedMedals.forEach(m => { 
                            let isPinned = myPinnedMedals.includes(m.id);
                            ml.innerHTML += `
                                <div class="inv-item-card ${isPinned ? 'equipped' : ''}" style="width:100px; height:120px; justify-content:flex-start; cursor:pointer;" onclick="toggleEquip('${m.id}', 'medal')">
                                    <div style="font-size:30px; margin-top:10px; display:flex; justify-content:center;">${m.icon}</div>
                                    <b style="font-size:10px; margin-top:10px;">${m.name}</b>
                                    <div class="inv-rarity-line" style="background:${RARITIES[m.rarity]}"></div>
                                    <div style="font-size:9px; margin-top:5px; color:${isPinned ? '#34c759' : 'gray'};">${isPinned ? 'ЗАКРЕПЛЕНО' : 'ОТКРЕПЛЕНО'}</div>
                                </div>`; 
                        }); 
                    } 
                    document.getElementById('medals-modal').classList.remove('hidden'); 
                });
            }

            function closeMedalsModal() { document.getElementById('medals-modal').classList.add('hidden'); }

            function openAvatarModal() { 
                const grid = document.getElementById('emoji-grid'); 
                grid.innerHTML = ''; 
                EMOJIS.forEach(em => { 
                    let div = document.createElement('div'); 
                    div.className = 'emoji-item'; 
                    div.innerText = em; 
                    div.onclick = () => { 
                        myAvatar = em; 
                        syncDBProfile(); 
                        updateMyProfileUI(); 
                        closeAvatarModal(); 
                        renderInventory(); 
                    }; 
                    grid.appendChild(div); 
                }); 
                document.getElementById('avatar-modal').classList.remove('hidden'); 
            }

            function closeAvatarModal() { document.getElementById('avatar-modal').classList.add('hidden'); }

            function updateCoinsUI() { document.getElementById('global-coins-val').innerText = globalCoins; updateCoinsVisibility(); }

            function updateCoinsVisibility() {
                const coinsEl = document.getElementById('global-coins');
                if (!coinsEl) return;
                const invTabActive = document.getElementById('tab-inv')?.classList.contains('active');
                const shopActive = document.getElementById('inv-shop')?.classList.contains('active');
                const adminActive = document.getElementById('tab-admin')?.classList.contains('active');
                coinsEl.style.display = (invTabActive && shopActive) || adminActive ? 'flex' : 'none';
            }

            function addCoins(a) { 
                globalCoins = Math.max(0, globalCoins + a); 
                updateCoinsUI(); 
                try { tg.CloudStorage.setItem('player_coins', globalCoins.toString()); } catch(e) {} 
                writeDb('users/' + myId + '/coins', globalCoins, 'coins update').catch(() => {});
            }

            function switchTab(t, el) { 
                document.body.classList.remove('let5-active');
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
                if (!el) el = document.querySelector(`[data-tab="${t}"]`);
                if (el) el.classList.add('active');
                document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active')); 
                document.getElementById('tab-' + t).classList.add('active'); 
                updateCoinsVisibility();
            }

            function switchSubTab(p, s, el) { 
                el.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active')); 
                el.classList.add('active'); 
                document.querySelectorAll(`#tab-${p} .sub-tab-content`).forEach(c => c.classList.remove('active')); 
                document.getElementById(`${p === 'inv' ? 'inv' : 'adm'}-${s}`).classList.add('active'); 
                updateCoinsVisibility();
            }

            function switchMiniTab(id, el) { 
                el.parentElement.querySelectorAll('.mini-tab-btn').forEach(b => b.classList.remove('active')); 
                el.classList.add('active'); 
                document.querySelectorAll('.mini-tab-content').forEach(c => { 
                    if (c.parentElement.contains(el)) c.classList.remove('active'); 
                }); 
                document.getElementById(id).classList.add('active'); 
            }
