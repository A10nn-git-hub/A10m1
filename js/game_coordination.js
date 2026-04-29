            // ================== КООРДИНАЦИЯ ==================
            let accInt = null;
            let coordState = { l: 1, k: [], rTime: 0, rScore: 0, spawnCount: 1, r3T: 0, r3Attempt: 0, r3State: 'wait' };
            let rInt1, react3Timeout;

            function initCoord(level) {
                coordState = { l: level, k: [], rTime: 0, rScore: 0, spawnCount: 1, r3T: 0, r3Attempt: 0, r3State: 'wait' };
                clearInterval(accInt); 
                clearInterval(rInt1); 
                clearTimeout(react3Timeout);
                document.getElementById('screen-game-coord').classList.add('active');
                renderCoord();
            }

            function renderCoord() {
                if (appState.isPaused) return;
                
                [1, 2, 3, 4, 5].forEach(i => { 
                    let el = document.getElementById('coord-area-' + i); 
                    if (el) el.style.display = (i === coordState.l ? 'block' : 'none'); 
                });
                
                let names = ['Ножи', 'Лягушка', 'Скорость', 'Кнопка', 'Утки'];
                document.getElementById('coord-header').innerText = `Координация: ${names[coordState.l - 1]}`;
                
                if (coordState.l === 1) { 
                    let spinner = document.getElementById('coord-t1');
                    let currentKnives = spinner.querySelectorAll('.acc-stuck-knife').length;
                    if (currentKnives < coordState.k.length) {
                        for (let i = currentKnives; i < coordState.k.length; i++) {
                            let k = coordState.k[i];
                            let d = document.createElement('div'); 
                            d.className = 'acc-stuck-knife'; 
                            d.style.transform = `translate(-50%, 0) rotate(${k.a}deg)`; 
                            d.innerHTML = '<div class="acc-big-sword" style="top: 8vh; bottom: auto;"></div>'; 
                            spinner.appendChild(d); 
                        }
                    } else if (currentKnives > coordState.k.length) { 
                        spinner.querySelectorAll('.acc-stuck-knife').forEach(e => e.remove()); 
                    }
                    
                    document.getElementById('coord-ready-knife').style.display = !window.isKnifeFlying ? 'block' : 'none';
                    setIsland('Тапни чтобы метнуть!', '#34c759');
                    
                } else if (coordState.l === 2) { 
                    document.getElementById('coord-frog').style.display = 'block';
                    setIsland('Тапни чтобы лягушка прыгнула!', '#34c759');
                    
                } else if (coordState.l === 3) {
                    coordState.rTime = 60; 
                    coordState.rScore = 0; 
                    coordState.spawnCount = 1;
                    document.getElementById('r1-time').innerText = "60"; 
                    document.getElementById('r1-score').innerText = "0"; 
                    document.getElementById('r1-area').innerHTML = ''; 
                    setIsland("Лопай шарики на скорость!", "#34c759");
                    
                    rInt1 = setInterval(() => { 
                        if (appState.isPaused) return; 
                        coordState.rTime--; 
                        let tStr = coordState.rTime < 10 ? "0"+coordState.rTime : coordState.rTime;
                        document.getElementById('r1-time').innerText = tStr; 
                        
                        if(coordState.rTime % 10 === 0 && coordState.rTime !== 60) coordState.spawnCount++;

                        if (coordState.rTime <= 0) {
                            clearInterval(rInt1); 
                            showResult(`Счет: ${coordState.rScore}`, '#34c759', '🎈', `+${Math.floor(coordState.rScore / 5)} 🪙`); 
                            addCoins(Math.floor(coordState.rScore / 5));
                            lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'win'); });
                        } else { 
                            for(let i=0; i<coordState.spawnCount; i++) {
                                if (Math.random() > 0.3) spawnSpeedBalloon('r1-area', coordState); 
                            }
                        } 
                    }, 1000);
                    
                } else if (coordState.l === 4) {
                    document.getElementById('r3-results').innerHTML = ''; 
                    document.getElementById('r3-btn').style.background = 'gray'; 
                    coordState.r3Attempt = 0; 
                    nextR3Turn();
                } else if (coordState.l === 5) {
                    coordState.rTime = 30; 
                    coordState.rScore = 0; 
                    document.getElementById('duck-time').innerText = "30"; 
                    document.getElementById('duck-score').innerText = "0"; 
                    document.getElementById('duck-area').innerHTML = ''; 
                    setIsland("Сбивай уток!", "#34c759");
                    
                    rInt1 = setInterval(() => { 
                        if (appState.isPaused) return; 
                        coordState.rTime--; 
                        let tStr = coordState.rTime < 10 ? "0"+coordState.rTime : coordState.rTime;
                        document.getElementById('duck-time').innerText = tStr; 
                        
                        if (coordState.rTime <= 0) {
                            clearInterval(rInt1); 
                            showResult(`Счет: ${coordState.rScore}`, '#34c759', '🦆', `+${Math.floor(coordState.rScore / 3)} 🪙`); 
                            addCoins(Math.floor(coordState.rScore / 3));
                            lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'win'); });
                        } else { 
                            if (Math.random() > 0.4) spawnDuck(); 
                        } 
                    }, 1000);
                }
            }

            function accThrowKnifeClick() {
                if (window.isKnifeFlying || appState.isPaused) return; 
                window.isKnifeFlying = true;
                
                let fly = document.getElementById('coord-flying-knife'); 
                let ready = document.getElementById('coord-ready-knife');
                ready.style.display = 'none'; 
                fly.style.display = 'block'; 
                fly.style.bottom = '5vh'; 
                
                void fly.offsetWidth; 
                fly.style.transition = 'bottom 0.25s ease-in'; 
                fly.style.bottom = '65vh'; 
                
                setTimeout(() => {
                    fly.style.display = 'none'; 
                    fly.style.transition = 'none'; 
                    fly.style.bottom = '5vh'; 
                    ready.style.display = 'block'; 
                    window.isKnifeFlying = false;
                    
                    let currentRot = ((Date.now() % 3000) / 3000) * 360; 
                    let hitAngle = (540 - currentRot) % 360; 
                    let collision = coordState.k.some(k => Math.abs(k.a - hitAngle) < 15 || Math.abs(k.a - hitAngle) > 345);
                    
                    if (collision) { 
                        tg.showAlert("Дзинь! Попал в меч!"); 
                        showResult(`НОЖИ: ${coordState.k.length}`, '#ff453a', '🗡️'); 
                        lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'loss'); });
                    } else { 
                        coordState.k.push({a: hitAngle}); 
                        if (coordState.k.length >= 10) { 
                            showResult("МАСТЕР!", '#34c759', '🗡️', '+10 🪙'); 
                            addCoins(10); 
                            lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'win'); });
                        } else {
                            renderCoord(); 
                        }
                    }
                }, 250);
            }

            function accTriggerFrogClick() {
                if (appState.isPaused) return;
                let fr = document.getElementById('coord-frog'); 
                fr.style.animation = 'acc-frog-jump 0.5s ease-out';
                
                setTimeout(() => {
                    let t = document.getElementById('coord-t2').getBoundingClientRect(); 
                    let f = fr.getBoundingClientRect();
                    let hit = !(f.right < t.left || f.left > t.right || f.bottom < t.top || f.top > t.bottom); 
                    if (hit) { 
                        showResult("ПОПАЛ!", '#34c759', '🐸', '+5 🪙'); 
                        addCoins(5); 
                        lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'win'); });
                    } else { 
                        showResult("МИМО!", '#ff453a', '🐸'); 
                        lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'loss'); });
                    }
                }, 250);
                
                setTimeout(() => { fr.style.animation = 'none'; }, 500); 
            }

            function spawnSpeedBalloon(areaId, state) {
                let area = document.getElementById(areaId); 
                let b = document.createElement('div'); 
                b.className = 'react-balloon'; 
                b.innerText = ['🎈', '🎯', '🔴', '🔵', '🟢'][Math.floor(Math.random() * 5)]; 
                b.style.left = (5 + Math.random() * 85) + '%'; 
                b.style.top = (5 + Math.random() * 85) + '%'; 
                b.style.animation = `popInOut 1.5s ease-in-out forwards`; 
                
                b.onmousedown = b.ontouchstart = (e) => { 
                    e.preventDefault(); e.stopPropagation(); 
                    if (appState.isPaused) return; 
                    b.remove(); 
                    state.rScore++; 
                    document.getElementById('r1-score').innerText = state.rScore; 
                };
                
                area.appendChild(b); 
                setTimeout(() => { if (b.parentElement) b.remove(); }, 1500);
            }

            function spawnDuck() {
                let area = document.getElementById('duck-area'); 
                let d = document.createElement('div'); 
                d.style.position = 'absolute';
                d.style.fontSize = '8vh';
                d.innerText = '🦆'; 
                d.style.top = (10 + Math.random() * 60) + '%';
                let startLeft = Math.random() > 0.5;
                d.style.left = startLeft ? '-10%' : '110%';
                d.style.transform = startLeft ? 'scaleX(-1)' : 'scaleX(1)';
                d.style.transition = 'left 3s linear';
                
                d.onmousedown = d.ontouchstart = (e) => { 
                    e.preventDefault(); e.stopPropagation(); 
                    if (appState.isPaused) return; 
                    d.remove(); 
                    coordState.rScore++; 
                    document.getElementById('duck-score').innerText = coordState.rScore; 
                };
                
                area.appendChild(d); 
                setTimeout(() => { d.style.left = startLeft ? '110%' : '-10%'; }, 50);
                setTimeout(() => { if (d.parentElement) d.remove(); }, 3000);
            }

            function nextR3Turn() {
                if (coordState.r3Attempt >= 5) { 
                    let avg = (coordState.r3T / 5000).toFixed(3);
                    showResult("ТЕСТ ОКОНЧЕН", '#34c759', '⚡', `Среднее: ${avg}с\n+5 🪙`); 
                    addCoins(5);
                    lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'acc', 'win'); });
                    return;
                }
                coordState.r3State = 'wait'; 
                document.getElementById('r3-btn').style.background = '#ff453a'; 
                document.getElementById('r3-status').innerText = `Попытка ${coordState.r3Attempt + 1}/5. Жди желтый!`; 
                
                react3Timeout = setTimeout(() => { 
                    if (appState.isPaused) { nextR3Turn(); return; } 
                    coordState.r3State = 'go'; 
                    document.getElementById('r3-btn').style.background = '#ffd60a'; 
                    window.react3StartTm = Date.now(); 
                }, 2000 + Math.random() * 8000);
            }

            function r3Click(e) {
                e.preventDefault(); e.stopPropagation(); 
                if (appState.isPaused) return;
                
                if (coordState.r3State === 'wait') {
                    clearTimeout(react3Timeout); 
                    document.getElementById('r3-status').innerText = 'Фальстарт! Штраф +5 сек.'; 
                    coordState.r3T += 5000; 
                    coordState.r3Attempt++;
                    document.getElementById('r3-results').innerHTML = `<div>Попытка ${coordState.r3Attempt}: <span style="color:#ff453a;">ФАЛЬСТАРТ (5с)</span></div>` + document.getElementById('r3-results').innerHTML;
                    coordState.r3State = 'done'; 
                    setTimeout(nextR3Turn, 1000);
                } else if (coordState.r3State === 'go') {
                    coordState.r3State = 'done'; 
                    let timeMs = Date.now() - window.react3StartTm; 
                    coordState.r3T += timeMs; 
                    coordState.r3Attempt++; 
                    document.getElementById('r3-status').innerText = `Время: ${(timeMs / 1000).toFixed(3)} с!`;
                    document.getElementById('r3-results').innerHTML = `<div>Попытка ${coordState.r3Attempt}: <span style="color:#34c759;">${(timeMs / 1000).toFixed(3)} сек</span></div>` + document.getElementById('r3-results').innerHTML;
                    setTimeout(nextR3Turn, 1000);
                }
            }
