            // ================== МИНИ-ИГРЫ ==================

            function makeDraggable(item, slotsParentId, onDropCallback) {
                let startX, startY, initX, initY, isDragging = false;
                
                item.onmousedown = item.ontouchstart = (e) => { 
                    isDragging = true; 
                    item.style.zIndex = 1000; 
                    startX = e.touches ? e.touches[0].clientX : e.clientX; 
                    startY = e.touches ? e.touches[0].clientY : e.clientY; 
                    let rect = item.getBoundingClientRect(); 
                    initX = rect.left; 
                    initY = rect.top; 
                    item.style.position = 'fixed'; 
                    item.style.left = initX + 'px'; 
                    item.style.top = initY + 'px'; 
                    item.style.margin = 0; 
                };
                
                document.addEventListener('mousemove', drag); 
                document.addEventListener('touchmove', drag, {passive:false}); 
                document.addEventListener('mouseup', drop); 
                document.addEventListener('touchend', drop);
                
                function drag(e) { 
                    if (!isDragging) return; 
                    e.preventDefault(); 
                    let x = e.touches ? e.touches[0].clientX : e.clientX; 
                    let y = e.touches ? e.touches[0].clientY : e.clientY; 
                    item.style.left = (initX + x - startX) + 'px'; 
                    item.style.top = (initY + y - startY) + 'px'; 
                }
                
                function drop(e) { 
                    if (!isDragging) return; 
                    isDragging = false; 
                    item.style.zIndex = 1; 
                    let rect = item.getBoundingClientRect(); 
                    let cx = rect.left + rect.width / 2; 
                    let cy = rect.top + rect.height / 2; 
                    let dropped = false; 
                    
                    document.querySelectorAll(`#${slotsParentId} .math-slot, #${slotsParentId}`).forEach(slot => { 
                        if (slot.id === slotsParentId && slotsParentId !== 'let5-rows') return; 
                        let sr = slot.getBoundingClientRect(); 
                        if (cx > sr.left && cx < sr.right && cy > sr.top && cy < sr.bottom && (!slot.hasChildNodes() || slotsParentId.includes('let4'))) { 
                            if (slotsParentId.includes('let4')) slot.appendChild(item.cloneNode(true)); 
                            else slot.appendChild(item); 
                            item.style.position = 'static'; 
                            item.style.margin = '0'; 
                            dropped = true; 
                            if (onDropCallback) onDropCallback(slot, item); 
                        } 
                    }); 
                    
                    if (!dropped) { 
                        document.getElementById(item.dataset.originId).appendChild(item); 
                        item.style.position = 'static'; 
                        item.style.margin = '0'; 
                    } 
                }
            }

            let mathAnswer = 0, mathCorrect = 0, mathTotal = 10, mathMode = 1, math1InputVal = '';
            
            function startMathMode(m) { 
                mathMode = m; 
                mathCorrect = 0; 
                math1InputVal = ''; 
                generateMathTask(); 
            }

            function updateMathDots() { 
                let p = document.getElementById('math-prog-' + mathMode); 
                if (!p) return; 
                p.innerHTML = ''; 
                for (let i = 0; i < mathTotal; i++) {
                    let div = document.createElement('div');
                    div.className = 'math-dot' + (i < mathCorrect ? ' done-dot' : (i === mathCorrect ? ' active-dot' : ''));
                    p.appendChild(div);
                }
            }

            function generateMathTask() {
                if ((mathMode !== 3 && mathCorrect >= mathTotal) || (mathMode === 3 && mathCorrect >= 1)) { 
                    addCoins(15); 
                    showResult('УМНИЦА!', '#34c759', '🧮', '+15 🪙'); 
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'math', 'win'); }); 
                    return; 
                }
                
                updateMathDots(); 
                
                if (mathMode === 1 || mathMode === 2) { 
                    let a = Math.floor(Math.random() * 10) + 1;
                    let b = Math.floor(Math.random() * 10) + 1;
                    let op = Math.random() > 0.5 ? '+' : '-'; 
                    
                    if (op === '-' && a < b) { let t = a; a = b; b = t; } 
                    mathAnswer = op === '+' ? a + b : a - b; 
                    let qStr = `${a} ${op} ${b} =`;
                    
                    if (mathMode === 1) { 
                        document.getElementById('math1-q').innerText = qStr; 
                        let ans = document.getElementById('math1-ans'); 
                        ans.innerText = '?'; 
                        ans.style.borderColor = '#666'; 
                    } else if (mathMode === 2) { 
                        document.getElementById('math2-q').innerText = qStr; 
                        let c = document.getElementById('math2-cards'); 
                        c.innerHTML = ''; 
                        let anss = [mathAnswer]; 
                        
                        while (anss.length < 4) {
                            let r = mathAnswer + Math.floor(Math.random() * 10) - 5; 
                            if (r !== mathAnswer && r >= 0 && !anss.includes(r)) anss.push(r);
                        } 
                        
                        anss.sort(() => Math.random() - 0.5).forEach(ans => { 
                            let d = document.createElement('div'); 
                            d.className = 'math-ans-card'; 
                            d.innerText = ans; 
                            d.onclick = () => {
                                if (ans === mathAnswer) {
                                    mathCorrect++;
                                    generateMathTask();
                                } else {
                                    tg.showAlert("Неправильно!");
                                }
                            }; 
                            c.appendChild(d); 
                        }); 
                    }
                } else if (mathMode === 3) {
                    let sP = document.getElementById('math3-slots');
                    let iP = document.getElementById('math3-items'); 
                    sP.innerHTML = ''; 
                    iP.innerHTML = ''; 
                    
                    let nums = []; 
                    while (nums.length < 10) {
                        let r = Math.floor(Math.random() * 99) + 1;
                        if (!nums.includes(r)) nums.push(r);
                    } 
                    nums.sort((a, b) => a - b); 
                    let shuf = [...nums].sort(() => Math.random() - 0.5);
                    
                    for (let i = 0; i < 10; i++) { 
                        sP.innerHTML += `<div class="math-slot small-slot" data-expected="${nums[i]}"></div>`; 
                        let item = document.createElement('div'); 
                        item.className = 'math-drag-item small-item'; 
                        item.innerText = shuf[i]; 
                        item.dataset.originId = 'math3-items'; 
                        iP.appendChild(item); 
                        
                        makeDraggable(item, 'math3-slots', () => {
                            let w = true;
                            document.querySelectorAll('#math3-slots .math-slot').forEach(s => {
                                if (!s.firstChild || s.firstChild.innerText !== s.dataset.expected) w = false;
                            }); 
                            if (w) {
                                mathCorrect++;
                                setTimeout(generateMathTask, 500);
                            }
                        }); 
                    }
                }
            }

            let brKeys = {}; // Global for BR WASD
            
            function math1Input(num) { 
                let ans = document.getElementById('math1-ans'); 
                if (math1InputVal.length >= 2) math1InputVal = ''; 
                math1InputVal += num; 
                ans.innerText = math1InputVal; 
                
                if (parseInt(math1InputVal) === mathAnswer) {
                    ans.style.borderColor = '#34c759';
                    mathCorrect++;
                    math1InputVal = '';
                    setTimeout(generateMathTask, 300);
                } else if (math1InputVal.length >= mathAnswer.toString().length) {
                    ans.classList.add('c-wrong');
                    setTimeout(() => {
                        ans.classList.remove('c-wrong');
                        math1InputVal = '';
                        ans.innerText = '?';
                    }, 400);
                } 
            }

            let let3TargetWord = '';
            
            function startLettersMode(m) {
                if (m === 1) { 
                    let start = Math.floor(Math.random() * (ALPHABET.length - 5)); 
                    let seq = ALPHABET.slice(start, start + 5); 
                    let shuf = [...seq].sort(() => Math.random() - 0.5); 
                    let sP = document.getElementById('let1-slots');
                    let iP = document.getElementById('let1-items'); 
                    sP.innerHTML = ''; 
                    iP.innerHTML = ''; 
                    
                    for (let i = 0; i < 5; i++) { 
                        sP.innerHTML += `<div class="math-slot" data-expected="${seq[i]}"></div>`; 
                        let item = document.createElement('div'); 
                        item.className = 'math-drag-item'; 
                        item.innerText = shuf[i]; 
                        item.dataset.originId = 'let1-items'; 
                        iP.appendChild(item); 
                        
                        makeDraggable(item, 'let1-slots', () => { 
                            let win = true;
                            document.querySelectorAll('#let1-slots .math-slot').forEach(s => {
                                if (!s.firstChild || s.firstChild.innerText !== s.dataset.expected) win = false;
                            }); 
                            if (win) {
                                addCoins(10);
                                showResult('СУПЕР!', '#34c759', '🎓', '+10 🪙');
                                lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'letters', 'win'); });
                            } 
                        }); 
                    } 
                } else if (m === 3) { 
                    let3TargetWord = BIG_WORD_LIST[Math.floor(Math.random() * BIG_WORD_LIST.length)]; 
                    document.getElementById('let3-word').innerText = let3TargetWord; 
                    document.getElementById('let3-input').value = ''; 
                } else if (m === 4) { 
                    initConnectWords(); 
                } else if (m === 5) { 
                    initWordle(); 
                }
            }

            function checkLet3Words() { 
                let val = document.getElementById('let3-input').value.toUpperCase().trim(); 
                let target = let3TargetWord; 
                let mistakes = Math.abs(val.length - target.length); 
                
                for (let i = 0; i < Math.min(val.length, target.length); i++) {
                    if (val[i] !== target[i]) mistakes++;
                } 
                
                if (mistakes <= 2) {
                    document.getElementById('let3-input').value = '';
                    addCoins(10);
                    showResult('ОТЛИЧНО!', '#34c759', '🎓', '+10 🪙');
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'letters', 'win'); });
                } else {
                    tg.showAlert("Попробуй еще раз!");
                }
            }

            let cPairs = [], cConnections = {}, cActiveWord = null, lastLet4Pairs = [];

            function initConnectWords() { 
                cConnections = {}; 
                cActiveWord = null; 
                let available = CONNECT_PAIRS.filter(p => !lastLet4Pairs.includes(p.w)); 
                if (available.length < 4) available = CONNECT_PAIRS; 
                
                let shuf = [...available].sort(() => Math.random() - 0.5).slice(0, 4); 
                cPairs = shuf; 
                lastLet4Pairs = shuf.map(p => p.w); 
                
                let picsHtml = '', wordsHtml = ''; 
                shuf.forEach((p, i) => picsHtml += `<div class="connect-pic-box" id="cpic-${i}" onclick="connectPicClick(${i})">${p.e}</div>`); 
                
                [...shuf].sort(() => Math.random() - 0.5).forEach(w => wordsHtml += `<div class="connect-word-box" id="cword-${w.w}" onclick="connectWordClick('${w.w}')">${w.w}</div>`); 
                
                document.getElementById('connect-pics').innerHTML = picsHtml; 
                document.getElementById('connect-words').innerHTML = wordsHtml; 
                setTimeout(drawConnectLines, 50); 
            }

            function connectWordClick(w) { 
                document.querySelectorAll('.connect-word-box').forEach(e => e.classList.remove('active')); 
                if (cActiveWord === w) { cActiveWord = null; return; } 
                cActiveWord = w; 
                document.getElementById('cword-' + w).classList.add('active'); 
            }

            function connectPicClick(i) { 
                if (!cActiveWord) return tg.showAlert("Сначала выбери слово!"); 
                let kDel = []; 
                for (let k in cConnections) { 
                    if (k === cActiveWord || cConnections[k] === i) kDel.push(k); 
                } 
                kDel.forEach(k => delete cConnections[k]); 
                cConnections[cActiveWord] = i; 
                cActiveWord = null; 
                document.querySelectorAll('.connect-word-box').forEach(e => e.classList.remove('active')); 
                drawConnectLines(); 
            }

            function drawConnectLines() { 
                let c = document.getElementById('connect-lines'); 
                if (!c) return; 
                let rect = c.parentElement.getBoundingClientRect(); 
                c.width = rect.width; 
                c.height = rect.height; 
                let ctx = c.getContext('2d'); 
                ctx.clearRect(0, 0, c.width, c.height); 
                ctx.lineWidth = 6; 
                ctx.strokeStyle = 'var(--coin-col)'; 
                ctx.lineCap = 'round'; 
                
                document.querySelectorAll('.connect-pic-box, .connect-word-box').forEach(e => {
                    e.classList.remove('connected', 'c-wrong', 'c-right');
                }); 
                
                for (let w in cConnections) { 
                    let i = cConnections[w]; 
                    let wEl = document.getElementById('cword-' + w);
                    let pEl = document.getElementById('cpic-' + i); 
                    if (!wEl || !pEl) continue; 
                    wEl.classList.add('connected'); 
                    pEl.classList.add('connected'); 
                    let wR = wEl.getBoundingClientRect(), pR = pEl.getBoundingClientRect(); 
                    ctx.beginPath(); 
                    ctx.moveTo(wR.left + (wR.width / 2) - rect.left, wR.top - rect.top); 
                    ctx.lineTo(pR.left + (pR.width / 2) - rect.left, pR.bottom - rect.top); 
                    ctx.stroke(); 
                } 
            }

            function checkLet4Connect() { 
                if (Object.keys(cConnections).length < 4) return tg.showAlert("Соедини все 4 слова!"); 
                let err = 0; 
                for (let w in cConnections) { 
                    let i = cConnections[w]; 
                    let wEl = document.getElementById('cword-' + w);
                    let pEl = document.getElementById('cpic-' + i); 
                    if (cPairs[i].w !== w) {
                        err++;
                        wEl.classList.add('c-wrong');
                        pEl.classList.add('c-wrong');
                    } else {
                        wEl.classList.add('c-right');
                        pEl.classList.add('c-right');
                    } 
                } 
                
                if (err === 0) {
                    addCoins(15);
                    setTimeout(() => showResult('ПОБЕДА!', '#34c759', '🎓', 'Ошибок: 0\n+15 🪙'), 800);
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'letters', 'win'); });
                } else {
                    tg.showAlert(`Ошибок: ${err}. Исправь красные!`);
                    setTimeout(drawConnectLines, 500);
                } 
            }

            let wdlTarget = '', wdlRow = 0, wdlCol = 0, wdlGrid = [];

            function initWordle() { 
                wdlTarget = VALID_5_LETTER_WORDS[Math.floor(Math.random() * VALID_5_LETTER_WORDS.length)]; 
                wdlRow = 0; 
                wdlCol = 0; 
                wdlGrid = Array.from({length: 6}, () => new Array(5).fill('')); 
                
                let g = document.getElementById('wordle-grid'); 
                g.innerHTML = ''; 
                for (let i = 0; i < 6; i++) { 
                    let r = document.createElement('div'); 
                    r.className = 'wordle-row'; 
                    r.id = 'w-row-' + i; 
                    for (let j = 0; j < 5; j++) {
                        r.innerHTML += `<div class="wordle-cell" id="w-${i}-${j}"></div>`;
                    }
                    g.appendChild(r); 
                } 
                
                let kb = document.getElementById('wdl-kb'); 
                kb.innerHTML = ''; 
                ["ЙЦУКЕНГШЩЗХ", "ФЫВАПРОЛДЖЭ", "ЯЧСМИТЬБЮ"].forEach((str, i) => { 
                    let rDiv = document.createElement('div'); 
                    rDiv.className = 'wdl-kb-row'; 
                    if (i === 2) rDiv.innerHTML += `<div class="w-key action" onclick="wEnter()">ВВОД</div>`; 
                    str.split('').forEach(l => rDiv.innerHTML += `<div class="w-key" id="wk-${l}" onclick="wPress('${l}')">${l}</div>`); 
                    if (i === 2) rDiv.innerHTML += `<div class="w-key action" onclick="wBack()">⌫</div>`; 
                    kb.appendChild(rDiv); 
                }); 
            }

            function wPress(l) { 
                if (wdlCol < 5 && wdlRow < 6) {
                    wdlGrid[wdlRow][wdlCol] = l;
                    document.getElementById(`w-${wdlRow}-${wdlCol}`).innerText = l;
                    wdlCol++;
                } 
            }

            function wBack() { 
                if (wdlCol > 0) {
                    wdlCol--;
                    wdlGrid[wdlRow][wdlCol] = '';
                    document.getElementById(`w-${wdlRow}-${wdlCol}`).innerText = '';
                } 
            }

            function wEnter() { 
                if (wdlCol < 5) return tg.showAlert("Слово короткое!"); 
                let guess = wdlGrid[wdlRow].join(''); 
                if (!VALID_5_LETTER_WORDS.includes(guess)) return tg.showAlert("НЕТ ТАКОГО СЛОВА!"); 
                
                let tArr = wdlTarget.split('');
                let rArr = new Array(5).fill('w-absent'); 
                
                for (let i = 0; i < 5; i++) {
                    if (guess[i] === tArr[i]) {
                        rArr[i] = 'w-correct';
                        tArr[i] = null;
                    }
                } 
                for (let i = 0; i < 5; i++) {
                    if (rArr[i] !== 'w-correct' && tArr.includes(guess[i])) {
                        rArr[i] = 'w-present';
                        tArr[tArr.indexOf(guess[i])] = null;
                    }
                } 
                
                for (let i = 0; i < 5; i++) { 
                    document.getElementById(`w-${wdlRow}-${i}`).classList.add(rArr[i]); 
                    let k = document.getElementById(`wk-${guess[i]}`); 
                    if (k) { 
                        if (rArr[i] === 'w-correct') k.className = 'w-key w-key-correct'; 
                        else if (rArr[i] === 'w-present' && !k.classList.contains('w-key-correct')) k.className = 'w-key w-key-present'; 
                        else if (rArr[i] === 'w-absent' && !k.classList.contains('w-key-correct') && !k.classList.contains('w-key-present')) k.className = 'w-key w-key-absent'; 
                    } 
                } 
                
                if (guess === wdlTarget) {
                    addCoins(10);
                    setTimeout(() => showResult('УГАДАЛ!', '#34c759', '🎓', 'Слово: ' + wdlTarget + '\n+10 🪙'), 500);
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'letters', 'win'); });
                } else if (wdlRow === 5) {
                    setTimeout(() => showResult('НЕ УГАДАЛ', '#ff453a', '🎓', 'Было: ' + wdlTarget), 500);
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'letters', 'loss'); });
                } else { 
                    wdlRow++; 
                    wdlCol = 0; 
                } 
            }

            let hiddenFound = 0, hiddenMisses = 0, hiddenActive = false;

            function initHiddenGame() { 
                document.getElementById('hidden-found').innerText = '0'; 
                const scene = document.getElementById('hidden-scene'); 
                scene.innerHTML = '<div class="sun-decor">☀️</div>'; 
                
                for (let i = 0; i < 15; i++) { 
                    let tx = 5 + Math.random() * 90;
                    let ty = 5 + Math.random() * 90; 
                    let item = document.createElement('div'); 
                    item.className = 'hidden-item'; 
                    item.innerText = '💎'; 
                    item.style.left = tx + '%'; 
                    item.style.top = ty + '%'; 
                    item.style.zIndex = '10'; 
                    item.onmousedown = (e) => hitHiddenItem(e, item); 
                    item.ontouchstart = (e) => { e.preventDefault(); hitHiddenItem(e, item); }; 
                    scene.appendChild(item); 
                    
                    let d = document.createElement('div'); 
                    d.className = 'scene-decor'; 
                    d.innerText = ['🌲', '☁️', '🍄', '🌿', '🍂', '🍁'][Math.floor(Math.random() * 6)]; 
                    d.style.left = (tx + (Math.random() * 6 - 3)) + '%'; 
                    d.style.top = (ty + (Math.random() * 6 - 3)) + '%'; 
                    d.style.zIndex = '20'; 
                    scene.appendChild(d); 
                } 
                
                for (let i = 0; i < 25; i++) { 
                    let d = document.createElement('div'); 
                    d.className = 'scene-decor'; 
                    d.innerText = ['🌲', '☁️', '🍄', '🌿', '🍂', '🍁'][Math.floor(Math.random() * 6)]; 
                    d.style.left = (5 + Math.random() * 90) + '%'; 
                    d.style.top = (5 + Math.random() * 90) + '%'; 
                    d.style.zIndex = '20'; 
                    scene.appendChild(d); 
                } 
                setIsland(`Найди 15 кристаллов!`); 
                hiddenFound = 0; 
                hiddenMisses = 0; 
                hiddenActive = false; 
            }

            function hitHiddenItem(e, el) { 
                e.stopPropagation(); 
                if (appState.isPaused || hiddenActive) return; 
                el.remove(); 
                hiddenFound++; 
                document.getElementById('hidden-found').innerText = hiddenFound; 
                setIsland('Найдено!', '#34c759'); 
                
                if (hiddenFound >= 15) { 
                    setTimeout(() => showResult('Пройдено!', '#34c759', '🕵️‍♂️', 'Все найдено!\n+15 🪙'), 500); 
                    addCoins(15);
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'hidden', 'win'); }); 
                } 
            }

            function missHiddenClick(e) { 
                if (appState.isPaused || hiddenActive) return; 
                hiddenActive = true; 
                hiddenMisses++; 
                setIsland('Мимо! Штраф 1с', '#ff453a'); 
                setTimeout(() => {
                    hiddenActive = false;
                    setIsland('Ищи дальше!', '#fff');
                }, 1000); 
            }

            let clicks = 0, clickTimeSetting = 15, clickTimeCurrent = 0, clickInterval, clickActive = false;

            function changeClickTime(delta) { 
                if (clickActive || appState.isPaused) return; 
                if (!isHost) return tg.showAlert("Только Хост меняет время!"); 
                let n = Math.max(5, Math.min(100, clickTimeSetting + delta)); 
                db.ref(`lobbies/${lobbyId}/clickTime`).set(n); 
            }

            function initClickerUI() { 
                clicks = 0; 
                clickActive = false; 
                clearInterval(clickInterval); 
                document.getElementById('click-score').innerText = 0; 
                document.getElementById('click-time-val').innerText = `${clickTimeSetting} сек`; 
                document.getElementById('clicker-controls').style.display = 'flex'; 
                document.getElementById('click-btn').style.display = 'block'; 
                document.getElementById('clk-btn-m').style.display = isHost ? 'block' : 'none'; 
                document.getElementById('clk-btn-p').style.display = isHost ? 'block' : 'none'; 
                document.getElementById('clk-msg').innerText = isHost ? "Настрой время и ЖМИ!" : "Жди запуска..."; 
                setIsland(isHost ? 'Настраивай!' : 'Ожидание...'); 
            }

            function doClickStart() { 
                if (appState.isPaused) return; 
                if (!clickActive) {
                    if (isHost) db.ref(`lobbies/${lobbyId}/clickState`).set('playing');
                    else tg.showAlert("Жди хоста!");
                } else {
                    clicks++;
                    document.getElementById('click-score').innerText = clicks;
                } 
            }

            function startClickerGame() { 
                clickActive = true; 
                clickTimeCurrent = clickTimeSetting; 
                clicks = 0; 
                document.getElementById('click-score').innerText = 0; 
                document.getElementById('clicker-controls').style.display = 'none'; 
                document.getElementById('clk-msg').innerText = "ТАПАЙ!!!"; 
                
                clickInterval = setInterval(() => { 
                    if (appState.isPaused) return; 
                    clickTimeCurrent--; 
                    setIsland(`Время: ${clickTimeCurrent} сек`); 
                    if (clickTimeCurrent <= 0) {
                        clearInterval(clickInterval); 
                        clickActive = false; 
                        document.getElementById('click-btn').style.display = 'none'; 
                        
                        if (isHost) {
                            db.ref(`lobbies/${lobbyId}/clickScores/${myId}`).set(clicks);
                        } else {
                            db.ref(`lobbies/${lobbyId}/clickScores/${myId}`).set(clicks);
                        }
                    } 
                }, 1000); 
            }

            let tttBoard = [], tttTurnIdx = 0, tttGameOver = false, tttSize = 3, tttWinReq = 3; 
            const TTT_SYMBOLS = ['x', 'o', 'triangle', 'square', 'circle_solid']; 
            const TTT_CHARS = {'x': '❌', 'o': '⭕', 'triangle': '🔺', 'square': '🔲', 'circle_solid': '🔴'}; 
            const TTT_COLORS = {'x': '#ff453a', 'o': '#32ade6', 'triangle': '#34c759', 'square': '#ffd60a', 'circle_solid': '#af52de'};

            function initTicTacToe() { 
                tttGameOver = false; 
                tttTurnIdx = 0; 
                tttSize = 3; 
                tttWinReq = 3; 
                tttBoard = new Array(tttSize * tttSize).fill(''); 
                renderTicTacToe(); 
                setIsland('Ход: ❌', '#ff453a'); 
            }

            function renderTicTacToe() { 
                document.getElementById('ttt-board').style.gridTemplateColumns = `repeat(${tttSize}, 1fr)`; 
                document.getElementById('ttt-board').style.gridTemplateRows = `repeat(${tttSize}, 1fr)`; 
                const b = document.getElementById('ttt-board'); 
                b.innerHTML = ''; 
                let fSize = Math.max(3, 12 - tttSize) + 'vh'; 
                
                tttBoard.forEach((cell, i) => { 
                    let div = document.createElement('div'); 
                    div.className = `cell ${cell}`; 
                    div.innerText = cell ? TTT_CHARS[cell] : ''; 
                    div.style.fontSize = fSize; 
                    div.onclick = () => moveTicTacToe(i, false); 
                    b.appendChild(div); 
                }); 
            }

            function moveTicTacToe(i, isBot) { 
                if (tttGameOver || tttBoard[i] || appState.isPaused) return; 
                
                let currentPlayer = lobbyPlayers[tttTurnIdx];
                if (!isBot && currentPlayer && currentPlayer.id.startsWith('ИИ')) return;

                tttBoard[i] = TTT_SYMBOLS[tttTurnIdx]; 
                renderTicTacToe(); 
                if (checkDynamicWin()) return; 
                
                tttTurnIdx = (tttTurnIdx + 1) % lobbyPlayers.length; 
                setIsland(`Ход: ${TTT_CHARS[TTT_SYMBOLS[tttTurnIdx]]}`, TTT_COLORS[TTT_SYMBOLS[tttTurnIdx]]); 
                
                let nextPlayer = lobbyPlayers[tttTurnIdx];
                if (nextPlayer && nextPlayer.id.startsWith('ИИ')) {
                    setTimeout(makeTicTacToeBotMove, Math.random()*500 + 500);
                }
            }

            function makeTicTacToeBotMove() {
                if(tttGameOver || appState.isPaused) return;
                let empty = [];
                tttBoard.forEach((c, i) => { if(!c) empty.push(i); });
                if(empty.length === 0) return;

                let move = empty[Math.floor(Math.random() * empty.length)];
                
                if (aiDifficulty !== 'easy') {
                    let canWin = findWinningMove(TTT_SYMBOLS[tttTurnIdx]);
                    if(canWin !== null) move = canWin;
                    else {
                        let prevIdx = (tttTurnIdx - 1 + lobbyPlayers.length) % lobbyPlayers.length;
                        let canBlock = findWinningMove(TTT_SYMBOLS[prevIdx]);
                        if (canBlock !== null && (aiDifficulty === 'hard' || Math.random() > 0.3)) {
                            move = canBlock;
                        } else if (aiDifficulty === 'hard' && tttBoard[4] === '') {
                            move = 4;
                        }
                    }
                }
                moveTicTacToe(move, true);
            }

            function findWinningMove(symbol) {
                for (let i = 0; i < tttBoard.length; i++) {
                    if (tttBoard[i] === '') {
                        tttBoard[i] = symbol;
                        let win = checkDynamicWinSilent(symbol);
                        tttBoard[i] = '';
                        if (win) return i;
                    }
                }
                return null;
            }

            function checkDynamicWinSilent(sym) {
                let s = tttSize, req = tttWinReq;
                for (let r = 0; r < s; r++) {
                    for (let c = 0; c < s; c++) {
                        let cell = tttBoard[r * s + c];
                        if (cell !== sym) continue;
                        if (c <= s - req) { let w = true; for (let i = 1; i < req; i++) if (tttBoard[r * s + c + i] !== sym) w = false; if (w) return true; }
                        if (r <= s - req) { let w = true; for (let i = 1; i < req; i++) if (tttBoard[(r + i) * s + c] !== sym) w = false; if (w) return true; }
                        if (c <= s - req && r <= s - req) { let w = true; for (let i = 1; i < req; i++) if (tttBoard[(r + i) * s + c + i] !== sym) w = false; if (w) return true; }
                        if (c >= req - 1 && r <= s - req) { let w = true; for (let i = 1; i < req; i++) if (tttBoard[(r + i) * s + c - i] !== sym) w = false; if (w) return true; }
                    }
                }
                return false;
            }
            
            function checkDynamicWin() { 
                let winner = null; 
                for (let sym of TTT_SYMBOLS) {
                    if(checkDynamicWinSilent(sym)) { winner = sym; break; }
                }
                if (!winner && !tttBoard.includes('')) {
                    tttGameOver = true; 
                    setTimeout(() => showResult("НИЧЬЯ!", '#ffd60a', '🤝'), 300); 
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'ttt', 'draw'); });
                    return true;
                } 
                if (winner) {
                    tttGameOver = true; 
                    let wIdx = TTT_SYMBOLS.indexOf(winner);
                    let isMyWin = (wIdx === lobbyPlayers.findIndex(p => p.id === myId)); 
                    let wName = isMyWin ? "ПОБЕДА! +5 🪙" : `ПОБЕДИЛ ${TTT_CHARS[winner]}!`; 
                    if (isMyWin) addCoins(5); 
                    setTimeout(() => showResult(wName, isMyWin ? '#34c759' : TTT_COLORS[winner], TTT_CHARS[winner]), 300); 
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'ttt', isMyWin ? 'win' : 'loss'); });
                    return true;
                } 
                return false; 
            }
