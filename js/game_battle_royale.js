            // ================== ВЫЖИВАНИЕ (BATTLE ROYALE) ==================
            let br = {
                active: false,
                myP: null,
                remotePlayers: {},
                remotePlayerViews: {},
                remoteShotSeqs: {},
                damageByPlayer: {},
                bots: [],
                bullets: [],
                remoteBullets: {},
                zone: {x: 1000, y: 1000, r: 2000},
                loop: null,
                kills: 0,
                placeShown: false,
                freeRoam: false,
                serverHp: 200,
                damageTaken: 0,
                lastSyncX: 0,
                lastSyncY: 0,
                lastSyncAt: 0,
                syncTimer: null,
                playersListener: null,
                shotsListener: null,
                damageListener: null,
                botsListener: null
            };
            const BR_SIZE = 2000;
            const BR_PLAYER_R = 20;
            let joyTouch = null, shootTouch = null, jx = 0, jy = 0, isShooting = false, lastShot = 0;

            function brSpawnForId(id) {
                const seed = String(id || '0').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
                const angle = (seed % 360) * Math.PI / 180;
                const radius = 520 + (seed % 260);
                return {
                    x: Math.max(120, Math.min(BR_SIZE - 120, BR_SIZE / 2 + Math.cos(angle) * radius)),
                    y: Math.max(120, Math.min(BR_SIZE - 120, BR_SIZE / 2 + Math.sin(angle) * radius))
                };
            }

            function brRealLobbyPlayers() {
                return (Array.isArray(lobbyPlayers) ? lobbyPlayers : []).filter(p => p.id && !isAiFriendId(p.id));
            }

            function initBR() {
                br.active = true;
                br.kills = 0;
                br.placeShown = false;
                br.zone = { x: BR_SIZE / 2, y: BR_SIZE / 2, r: BR_SIZE };
                br.remotePlayers = {};
                br.remotePlayerViews = {};
                br.remoteShotSeqs = {};
                br.damageByPlayer = {};
                br.bots = [];
                br.bullets = [];
                br.remoteBullets = {};
                br.freeRoam = false;
                br.serverHp = 200;
                br.damageTaken = 0;
                br.lastSyncX = 0;
                br.lastSyncY = 0;
                br.lastSyncAt = Date.now();
                shootTouch = null;
                isShooting = false;
                lastShot = 0;

                const spawn = brSpawnForId(myId);
                br.myP = { id: myId, name: myName, avatar: myAvatar, eqName: myEqName, x: spawn.x, y: spawn.y, vx: 0, vy: 0, hp: 200, a: 0, kills: 0, shotSeq: 0, alive: true, invuln: Date.now() + 3000 };
                br.lastSyncX = br.myP.x;
                br.lastSyncY = br.myP.y;

                document.getElementById('br-ui-alive').innerText = 'Живых: ?';
                document.getElementById('br-ui-kills').innerText = 'Киллы: 0';
                document.getElementById('br-death-screen').style.display = 'none';

                let c = document.getElementById('br-canvas');
                c.width = window.innerWidth;
                c.height = window.innerHeight;

                bindBrControls();
                initBrFirebaseState();
                br.loop = requestAnimationFrame(brLoop);
            }

            function bindBrControls() {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (!isMobile) {
                    document.getElementById('br-controls').style.display = 'none';
                    return;
                }

                document.getElementById('br-controls').style.display = 'flex';
                const jBox = document.getElementById('br-joystick');
                const jStick = document.getElementById('br-stick');
                const shootBtn = document.getElementById('br-shoot-btn');
                jBox.style.touchAction = 'none';
                if (shootBtn) {
                    shootBtn.style.touchAction = 'none';
                    shootBtn.style.webkitUserSelect = 'none';
                    shootBtn.style.userSelect = 'none';
                    bindBrShootButton(shootBtn);
                }
                jStick.style.transform = `translate(0px, 0px)`;

                jBox.ontouchstart = jBox.onmousedown = (e) => {
                    e.preventDefault();
                    let ev = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : e);
                    joyTouch = ev.identifier !== undefined ? ev.identifier : 'm';
                    updateJoy(ev);
                };
                jBox.ontouchmove = jBox.onmousemove = (e) => {
                    if (joyTouch === null) return;
                    e.preventDefault();
                    let ev = e.touches ? Array.from(e.touches).find(t => t.identifier === joyTouch) : e;
                    if (ev) updateJoy(ev);
                };
                jBox.ontouchend = jBox.ontouchcancel = (e) => {
                    if (joyTouch === null) return;
                    const ended = e.changedTouches ? Array.from(e.changedTouches).some(t => t.identifier === joyTouch) : true;
                    if (!ended) return;
                    resetJoy();
                };
                jBox.onmouseup = jBox.onmouseleave = () => {
                    if (joyTouch !== 'm') return;
                    resetJoy();
                };

                function resetJoy() {
                    joyTouch = null;
                    jx = 0;
                    jy = 0;
                    jStick.style.transform = `translate(0px, 0px)`;
                }

                function updateJoy(ev) {
                    let rect = jBox.getBoundingClientRect();
                    let cx = rect.left + rect.width / 2;
                    let cy = rect.top + rect.height / 2;
                    let dx = ev.clientX - cx;
                    let dy = ev.clientY - cy;
                    let dist = Math.min(45, Math.hypot(dx, dy));
                    let angle = Math.atan2(dy, dx);
                    jx = Math.cos(angle) * dist;
                    jy = Math.sin(angle) * dist;
                    jStick.style.transform = `translate(${jx}px, ${jy}px)`;
                    br.myP.a = angle;
                }
            }

            function bindBrShootButton(shootBtn) {
                if (shootBtn.dataset.brShootBound === '1') return;
                shootBtn.dataset.brShootBound = '1';

                const startShoot = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    const touch = e && e.changedTouches ? e.changedTouches[0] : null;
                    shootTouch = touch ? touch.identifier : 'm';
                    isShooting = true;
                    fireBrShot(Date.now());
                };

                const stopShoot = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (e && e.changedTouches && shootTouch !== null) {
                        const ended = Array.from(e.changedTouches).some(t => t.identifier === shootTouch);
                        if (!ended) return;
                    }
                    shootTouch = null;
                    isShooting = false;
                };

                shootBtn.addEventListener('touchstart', startShoot, {passive: false});
                shootBtn.addEventListener('touchend', stopShoot, {passive: false});
                shootBtn.addEventListener('touchcancel', stopShoot, {passive: false});
                shootBtn.addEventListener('pointerdown', startShoot);
                shootBtn.addEventListener('pointerup', stopShoot);
                shootBtn.addEventListener('pointercancel', stopShoot);
                shootBtn.addEventListener('pointerleave', stopShoot);
                shootBtn.addEventListener('mousedown', startShoot);
                shootBtn.addEventListener('mouseup', stopShoot);
                shootBtn.addEventListener('mouseleave', stopShoot);
            }

            function initBrFirebaseState() {
                const base = `lobbies/${lobbyId}/br`;
                if (isHost) {
                    const realPlayers = brRealLobbyPlayers();
                    const playersUpdate = {};
                    realPlayers.forEach(p => {
                        const sp = brSpawnForId(p.id);
                        playersUpdate[`${base}/players/${p.id}`] = {
                            id: p.id,
                            name: p.name || 'Игрок',
                            avatar: p.avatar || '👤',
                            eqName: p.eqName || '',
                            x: sp.x,
                            y: sp.y,
                            vx: 0,
                            vy: 0,
                            hp: 200,
                            damageTaken: 0,
                            a: 0,
                            kills: 0,
                            shotSeq: 0,
                            alive: true,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };
                        playersUpdate[`${base}/damage/${p.id}`] = 0;
                    });

                    const hasAiParticipant = (Array.isArray(lobbyPlayers) ? lobbyPlayers : []).some(p => p.id && isAiFriendId(p.id));
                    const botCount = hasAiParticipant ? Math.max(0, 6 - realPlayers.length) : 0;
                    br.freeRoam = realPlayers.length <= 1 && botCount === 0;
                    const bots = [];
                    for (let i = 0; i < botCount; i++) {
                        const sp = brSpawnForId('bot' + i);
                        bots.push({ id: 'bot' + i, label: 'Бот ' + (i + 1), x: sp.x, y: sp.y, hp: 150, a: 0, tx: BR_SIZE / 2, ty: BR_SIZE / 2, alive: true, nextThink: 0, kills: 0 });
                    }

                    updateDbPaths(Object.assign({
                        [`${base}/zone`]: br.zone,
                        [`${base}/bots`]: bots,
                        [`${base}/bullets`]: null
                    }, playersUpdate), 'init br state').catch(() => {});
                }

                db.ref(`${base}/players/${myId}`).update(brPublicPlayerState(true)).catch(() => {});
                db.ref(`${base}/players/${myId}`).onDisconnect().update({alive: false, hp: 0});

                br.playersListener = snap => {
                    applyBrRemotePlayers(snap.exists() ? snap.val() : {});
                    const remoteMe = br.remotePlayers[myId];
                    if (remoteMe && br.myP) {
                        const serverDamage = Math.max(parseInt(br.damageByPlayer[myId]) || 0, parseInt(remoteMe.damageTaken) || 0);
                        br.damageTaken = Math.max(br.damageTaken, serverDamage);
                        const legacyHp = remoteMe.hp === undefined ? 200 : (parseInt(remoteMe.hp) || 0);
                        const serverHp = Math.min(legacyHp, Math.max(0, 200 - br.damageTaken));
                        br.myP.hp = Math.min(br.myP.hp, serverHp);
                        br.serverHp = br.myP.hp;
                        br.kills = Math.max(br.kills, parseInt(remoteMe.kills) || 0);
                        document.getElementById('br-ui-kills').innerText = `Киллы: ${br.kills}`;
                        br.myP.alive = remoteMe.alive !== false && br.myP.hp > 0;
                    }
                };
                br.botsListener = snap => {
                    br.bots = snap.exists() ? Object.values(snap.val()) : [];
                };
                db.ref(`${base}/players`).on('value', br.playersListener);
                br.damageListener = snap => {
                    br.damageByPlayer = snap.exists() ? snap.val() : {};
                    const myDamage = Math.max(0, parseInt(br.damageByPlayer[myId]) || 0);
                    if (br.myP && myDamage > br.damageTaken) {
                        br.damageTaken = myDamage;
                        br.myP.hp = Math.min(br.myP.hp, Math.max(0, 200 - myDamage));
                        br.serverHp = br.myP.hp;
                        br.myP.alive = br.myP.hp > 0;
                    }
                    Object.values(br.remotePlayers).forEach(p => normalizeBrPlayerHealth(p));
                };
                db.ref(`${base}/damage`).on('value', br.damageListener);
                br.shotsListener = snap => {
                    const p = snap.exists() ? Object.assign({ id: snap.key }, snap.val()) : null;
                    if (!p || p.id === myId) return;
                    normalizeBrPlayerHealth(p);
                    br.remotePlayers[p.id] = p;
                    applyBrRemoteShot(p);
                };
                db.ref(`${base}/players`).on('child_changed', br.shotsListener);
                db.ref(`${base}/bots`).on('value', br.botsListener);
                br.syncTimer = setInterval(syncBrPlayerState, 80);
            }

            function brPublicPlayerState(includeHealth) {
                const state = {
                    id: myId,
                    name: myName,
                    avatar: myAvatar,
                    eqName: myEqName,
                    x: Math.round(br.myP.x),
                    y: Math.round(br.myP.y),
                    vx: Number((br.myP.vx || 0).toFixed(2)),
                    vy: Number((br.myP.vy || 0).toFixed(2)),
                    a: br.myP.a,
                    kills: br.kills,
                    shotSeq: br.myP.shotSeq || 0,
                    shotX: Math.round(br.myP.shotX !== undefined ? br.myP.shotX : br.myP.x),
                    shotY: Math.round(br.myP.shotY !== undefined ? br.myP.shotY : br.myP.y),
                    shotVx: Number((br.myP.shotVx || 0).toFixed(2)),
                    shotVy: Number((br.myP.shotVy || 0).toFixed(2)),
                    shotA: br.myP.shotA !== undefined ? br.myP.shotA : br.myP.a,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };
                if (includeHealth) {
                    state.hp = Math.max(0, Math.round(Math.min(br.myP.hp, br.serverHp)));
                    state.alive = br.myP.hp > 0;
                }
                return state;
            }

            function applyBrRemotePlayers(nextPlayers) {
                br.remotePlayers = nextPlayers || {};
                Object.keys(br.remotePlayerViews).forEach(id => {
                    if (!br.remotePlayers[id] || id === myId) delete br.remotePlayerViews[id];
                });
                Object.keys(br.remoteShotSeqs).forEach(id => {
                    if (!br.remotePlayers[id] || id === myId) delete br.remoteShotSeqs[id];
                });
                Object.values(br.remotePlayers).forEach(p => {
                    if (!p || p.id === myId) return;
                    normalizeBrPlayerHealth(p);
                    const x = Number(p.x) || 0;
                    const y = Number(p.y) || 0;
                    const vx = Number(p.vx) || 0;
                    const vy = Number(p.vy) || 0;
                    const view = br.remotePlayerViews[p.id];
                    if (!view) {
                        br.remotePlayerViews[p.id] = { x, y, a: p.a || 0, snapshotX: x, snapshotY: y, vx, vy, targetX: x, targetY: y, targetA: p.a || 0, receivedAt: Date.now(), lastSeen: Date.now() };
                        applyBrRemoteShot(p);
                        return;
                    }
                    view.snapshotX = x;
                    view.snapshotY = y;
                    view.vx = vx;
                    view.vy = vy;
                    view.targetX = x;
                    view.targetY = y;
                    view.targetA = p.a || 0;
                    view.receivedAt = Date.now();
                    view.lastSeen = Date.now();
                    if (Math.hypot(view.x - x, view.y - y) > 320) {
                        view.x = x;
                        view.y = y;
                        view.a = view.targetA;
                    }
                    applyBrRemoteShot(p);
                });
            }

            function applyBrRemoteShot(p) {
                const seq = Number(p.shotSeq) || 0;
                if (!seq || br.remoteShotSeqs[p.id] === seq) return;
                br.remoteShotSeqs[p.id] = seq;
                const angle = Number(p.shotA !== undefined ? p.shotA : p.a) || 0;
                const vx = Number(p.shotVx) || Math.cos(angle) * 20;
                const vy = Number(p.shotVy) || Math.sin(angle) * 20;
                const view = br.remotePlayerViews[p.id];
                const baseX = view ? view.x : (Number(p.shotX) || Number(p.x) || 0);
                const baseY = view ? view.y : (Number(p.shotY) || Number(p.y) || 0);
                br.remoteBullets[`${p.id}_seq_${seq}`] = {
                    owner: p.id,
                    x: baseX + Math.cos(angle) * (BR_PLAYER_R + 8),
                    y: baseY + Math.sin(angle) * (BR_PLAYER_R + 8),
                    vx,
                    vy,
                    receivedAt: Date.now()
                };
            }

            function updateBrRemotePlayerViews() {
                Object.values(br.remotePlayerViews).forEach(view => {
                    const framesAhead = Math.min(8, Math.max(0, (Date.now() - (view.receivedAt || Date.now())) / 16.67));
                    view.targetX = (view.snapshotX || view.targetX || 0) + (view.vx || 0) * framesAhead;
                    view.targetY = (view.snapshotY || view.targetY || 0) + (view.vy || 0) * framesAhead;
                    view.x += (view.targetX - view.x) * 0.22;
                    view.y += (view.targetY - view.y) * 0.22;
                    let da = (view.targetA || 0) - (view.a || 0);
                    while (da > Math.PI) da -= Math.PI * 2;
                    while (da < -Math.PI) da += Math.PI * 2;
                    view.a = (view.a || 0) + da * 0.25;
                });
            }

            function getBrRenderablePlayer(p) {
                const view = br.remotePlayerViews[p.id];
                return view ? Object.assign({}, p, {x: view.x, y: view.y, a: view.a}) : p;
            }

            function normalizeBrPlayerHealth(p) {
                if (!p) return p;
                const damageTaken = Math.max(parseInt(br.damageByPlayer[p.id]) || 0, parseInt(p.damageTaken) || 0);
                const damageHp = Math.max(0, 200 - damageTaken);
                const rawHp = p.hp === undefined ? damageHp : (parseInt(p.hp) || 0);
                p.hp = Math.min(rawHp, damageHp);
                p.alive = p.alive !== false && p.hp > 0;
                return p;
            }

            function syncBrPlayerState(includeHealth = false) {
                if (!br.active || !lobbyId || !br.myP) return;
                const now = Date.now();
                const dtFrames = Math.max(1, (now - (br.lastSyncAt || now)) / 16.67);
                br.myP.vx = (br.myP.x - br.lastSyncX) / dtFrames;
                br.myP.vy = (br.myP.y - br.lastSyncY) / dtFrames;
                br.lastSyncX = br.myP.x;
                br.lastSyncY = br.myP.y;
                br.lastSyncAt = now;
                db.ref(`lobbies/${lobbyId}/br/players/${myId}`).update(brPublicPlayerState(includeHealth)).catch(() => {});
            }

            function brStartShoot(e) {
                e.preventDefault(); e.stopPropagation();
                isShooting = true;
                fireBrShot(Date.now());
            }

            function brStopShoot(e) {
                e.preventDefault(); e.stopPropagation();
                isShooting = false;
            }

            function brLoop() {
                if (!br.active || appState.isPaused) return;

                const now = Date.now();
                updateBrLocalPlayer(now);
                updateBrRemotePlayerViews();
                if (isHost) updateBrBots(now);
                updateBrBullets(now);
                br.zone.r = Math.max(50, br.zone.r - 0.2);
                renderBR(now);
                checkBrEnd();

                if (br.active) br.loop = requestAnimationFrame(brLoop);
            }

            function updateBrLocalPlayer(now) {
                if (br.myP.hp <= 0) return;
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                let speed = 6;
                const oldX = br.myP.x;
                const oldY = br.myP.y;

                if (isMobile) {
                    if (Math.abs(jx) > 5 || Math.abs(jy) > 5) {
                        br.myP.x += Math.cos(br.myP.a) * speed;
                        br.myP.y += Math.sin(br.myP.a) * speed;
                    }
                } else {
                    let dx = 0, dy = 0;
                    if (brKeys['KeyW'] || brKeys['ArrowUp']) dy = -1;
                    if (brKeys['KeyS'] || brKeys['ArrowDown']) dy = 1;
                    if (brKeys['KeyA'] || brKeys['ArrowLeft']) dx = -1;
                    if (brKeys['KeyD'] || brKeys['ArrowRight']) dx = 1;
                    if (dx !== 0 || dy !== 0) {
                        let len = Math.hypot(dx, dy);
                        br.myP.x += (dx / len) * speed;
                        br.myP.y += (dy / len) * speed;
                    }
                }

                br.myP.x = Math.max(BR_PLAYER_R, Math.min(BR_SIZE - BR_PLAYER_R, br.myP.x));
                br.myP.y = Math.max(BR_PLAYER_R, Math.min(BR_SIZE - BR_PLAYER_R, br.myP.y));
                br.myP.vx = br.myP.x - oldX;
                br.myP.vy = br.myP.y - oldY;

                if (Math.hypot(br.myP.x - br.zone.x, br.myP.y - br.zone.y) > br.zone.r) {
                    br.myP.hp -= 0.5;
                    br.serverHp = Math.min(br.serverHp, br.myP.hp);
                    syncBrPlayerState(true);
                }
                if (isShooting) fireBrShot(now);
            }

            function fireBrShot(now) {
                if (!br.active || !br.myP || br.myP.hp <= 0 || now - lastShot <= 250) return;
                const shotA = br.myP.a || 0;
                const bullet = {
                    x: br.myP.x + Math.cos(shotA) * (BR_PLAYER_R + 8),
                    y: br.myP.y + Math.sin(shotA) * (BR_PLAYER_R + 8),
                    vx: Math.cos(shotA) * 20,
                    vy: Math.sin(shotA) * 20,
                    owner: myId,
                    createdAt: now
                };
                br.bullets.push(bullet);
                br.myP.shotSeq = (br.myP.shotSeq || 0) + 1;
                br.myP.shotX = bullet.x;
                br.myP.shotY = bullet.y;
                br.myP.shotVx = bullet.vx;
                br.myP.shotVy = bullet.vy;
                br.myP.shotA = shotA;
                syncBrPlayerState();
                lastShot = now;
            }

            function updateBrBots(now) {
                let changed = false;
                br.bots.forEach(b => {
                    if (!b.alive || b.hp <= 0) return;
                    if (now > (b.nextThink || 0)) {
                        const targets = Object.values(br.remotePlayers).filter(p => p.alive && p.hp > 0);
                        const target = targets[Math.floor(Math.random() * targets.length)];
                        if (target && Math.random() > 0.35) {
                            b.tx = target.x;
                            b.ty = target.y;
                        } else {
                            b.tx = br.zone.x + (Math.random() * br.zone.r - br.zone.r / 2);
                            b.ty = br.zone.y + (Math.random() * br.zone.r - br.zone.r / 2);
                        }
                        b.nextThink = now + 1000 + Math.random() * 2000;
                        changed = true;
                    }
                    let dx = b.tx - b.x, dy = b.ty - b.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist > 10) {
                        b.a = Math.atan2(dy, dx);
                        b.x += Math.cos(b.a) * 2;
                        b.y += Math.sin(b.a) * 2;
                        changed = true;
                    }
                    if (Math.hypot(b.x - br.zone.x, b.y - br.zone.y) > br.zone.r) {
                        b.hp -= 0.5;
                        if (b.hp <= 0) b.alive = false;
                        changed = true;
                    }
                });
                if (changed) db.ref(`lobbies/${lobbyId}/br/bots`).set(br.bots).catch(() => {});
            }

            function updateBrBullets(now) {
                for (let i = br.bullets.length - 1; i >= 0; i--) {
                    let bul = br.bullets[i];
                    bul.x += bul.vx;
                    bul.y += bul.vy;
                    if (bul.x < 0 || bul.x > BR_SIZE || bul.y < 0 || bul.y > BR_SIZE) {
                        br.bullets.splice(i, 1);
                        continue;
                    }

                    let hit = false;
                    br.bots.forEach(b => {
                        if (hit || !b.alive || b.hp <= 0) return;
                        if (Math.hypot(bul.x - b.x, bul.y - b.y) < BR_PLAYER_R) {
                            b.hp -= 25;
                            hit = true;
                            if (b.hp <= 0) {
                                b.alive = false;
                                br.kills++;
                                document.getElementById('br-ui-kills').innerText = `Киллы: ${br.kills}`;
                                syncBrPlayerState(false);
                                if (isHost) db.ref(`lobbies/${lobbyId}/br/bots`).set(br.bots).catch(() => {});
                            }
                        }
                    });

                    Object.values(br.remotePlayers).forEach(p => {
                        if (hit || p.id === myId || !p.alive || p.hp <= 0) return;
                        if (Math.hypot(bul.x - p.x, bul.y - p.y) < BR_PLAYER_R) {
                            hit = true;
                            const damageRef = db.ref(`lobbies/${lobbyId}/br/damage/${p.id}`);
                            damageRef.transaction(v => Math.min(200, (parseInt(v) || 0) + 18)).then(res => {
                                const damageTaken = parseInt(res.snapshot.val()) || 0;
                                const nextHp = Math.max(0, 200 - damageTaken);
                                br.damageByPlayer[p.id] = damageTaken;
                                p.damageTaken = damageTaken;
                                p.hp = nextHp;
                                p.alive = nextHp > 0;
                                db.ref(`lobbies/${lobbyId}/br/players/${p.id}`).update({ hp: nextHp, alive: nextHp > 0 }).catch(() => {});
                                if (nextHp <= 0) db.ref(`lobbies/${lobbyId}/br/players/${myId}/kills`).transaction(v => (parseInt(v) || 0) + 1).catch(() => {});
                            });
                        }
                    });

                    if (hit) br.bullets.splice(i, 1);
                }
                updateBrRemoteBulletHits(now);
            }

            function updateBrRemoteBulletHits(now) {
                Object.keys(br.remoteBullets || {}).forEach(key => {
                    const bul = br.remoteBullets[key];
                    if (!bul || bul.owner === myId) return;
                    const age = Math.max(0, now - (Number(bul.receivedAt) || now));
                    if (age > 1500) {
                        delete br.remoteBullets[key];
                        return;
                    }
                    const steps = age / 16.67;
                    const x = (Number(bul.x) || 0) + (Number(bul.vx) || 0) * steps;
                    const y = (Number(bul.y) || 0) + (Number(bul.vy) || 0) * steps;

                    if (br.myP && br.myP.hp > 0 && Math.hypot(x - br.myP.x, y - br.myP.y) < BR_PLAYER_R) {
                        delete br.remoteBullets[key];
                        return;
                    }

                    const hitRemote = Object.values(br.remotePlayers).some(p => {
                        if (!p || p.id === myId || p.id === bul.owner || !p.alive || p.hp <= 0) return false;
                        const rp = getBrRenderablePlayer(p);
                        return Math.hypot(x - rp.x, y - rp.y) < BR_PLAYER_R;
                    });
                    if (hitRemote) delete br.remoteBullets[key];
                });
            }

            function renderBR(now) {
                let c = document.getElementById('br-canvas');
                let ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
                ctx.save();

                let camX = br.myP.hp > 0 ? br.myP.x - c.width / 2 : br.zone.x - c.width / 2;
                let camY = br.myP.hp > 0 ? br.myP.y - c.height / 2 : br.zone.y - c.height / 2;
                ctx.translate(-camX, -camY);

                ctx.strokeStyle = '#4e7a27';
                ctx.lineWidth = 2;
                for (let x = 0; x <= BR_SIZE; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BR_SIZE); ctx.stroke(); }
                for (let y = 0; y <= BR_SIZE; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BR_SIZE, y); ctx.stroke(); }

                ctx.strokeStyle = 'rgba(255,0,0,0.8)';
                ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(br.zone.x, br.zone.y, br.zone.r, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,0,0,0.1)'; ctx.fill();

                br.bots.filter(b => b.alive && b.hp > 0).forEach(b => drawBrFighter(ctx, b, '#ff453a', b.label, 150));
                Object.values(br.remotePlayers).forEach(p => {
                    if (p.id !== myId && p.alive && p.hp > 0) drawBrFighter(ctx, getBrRenderablePlayer(p), '#af52de', p.name || 'Игрок', 200);
                });
                if (br.myP.hp > 0) {
                    if (now < br.myP.invuln) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.beginPath(); ctx.arc(br.myP.x, br.myP.y, BR_PLAYER_R + 10, 0, Math.PI * 2); ctx.fill();
                    }
                    drawBrFighter(ctx, br.myP, '#3390ec', myName, 200);
                }

                ctx.fillStyle = '#ffd60a';
                br.bullets.forEach(bul => { ctx.beginPath(); ctx.arc(bul.x, bul.y, 4, 0, Math.PI * 2); ctx.fill(); });
                Object.keys(br.remoteBullets || {}).forEach(key => {
                    const bul = br.remoteBullets[key];
                    if (!bul || bul.owner === myId) return;
                    const age = Math.max(0, now - (Number(bul.receivedAt) || now));
                    if (age > 1500) {
                        delete br.remoteBullets[key];
                        return;
                    }
                    const steps = age / 16.67;
                    const x = (Number(bul.x) || 0) + (Number(bul.vx) || 0) * steps;
                    const y = (Number(bul.y) || 0) + (Number(bul.vy) || 0) * steps;
                    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
                });
                ctx.restore();

                const aliveCount = getBrAliveRows().length;
                document.getElementById('br-ui-alive').innerText = `Живых: ${aliveCount}`;
            }

            function drawBrFighter(ctx, p, color, label, maxHp) {
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(p.x, p.y, BR_PLAYER_R, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'black'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.a || 0) * 35, p.y + Math.sin(p.a || 0) * 35); ctx.stroke();
                ctx.fillStyle = '#111'; ctx.fillRect(p.x - 20, p.y - 30, 40, 6);
                ctx.fillStyle = '#34c759'; ctx.fillRect(p.x - 20, p.y - 30, 40 * ((p.hp || 0) / maxHp), 6);
                ctx.fillStyle = '#fff';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(label, p.x, p.y - 38);
            }

            function getBrAliveRows() {
                const rows = [];
                Object.values(br.remotePlayers).forEach(p => {
                    rows.push({ id: p.id, name: p.name || 'Игрок', kills: p.kills || 0, alive: !!p.alive && (p.hp || 0) > 0 });
                });
                br.bots.forEach(b => rows.push({ id: b.id, name: b.label || b.id, kills: b.kills || 0, alive: !!b.alive && (b.hp || 0) > 0 }));
                return rows.filter(r => r.alive);
            }

            function checkBrEnd() {
                if (br.placeShown) return;
                if (br.myP.hp <= 0) {
                    br.myP.alive = false;
                    syncBrPlayerState(true);
                    showBrFinal(false);
                    return;
                }
                if (br.freeRoam) return;
                const alive = getBrAliveRows();
                if (alive.length <= 1 && alive.some(r => r.id === myId)) showBrFinal(true);
            }

            function showBrFinal(isWin) {
                br.placeShown = true;
                br.active = false;
                const allRows = Object.values(br.remotePlayers)
                    .map(p => ({ id: p.id, name: p.name || 'Игрок', kills: p.kills || 0, alive: !!p.alive && (p.hp || 0) > 0 }))
                    .concat(br.bots.map(b => ({ id: b.id, name: b.label || b.id, kills: b.kills || 0, alive: !!b.alive && (b.hp || 0) > 0 })))
                    .sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills);

                const winner = allRows[0] || {name: myName, kills: br.kills};
                let ds = document.getElementById('br-death-screen');
                ds.style.display = 'flex';
                document.getElementById('br-death-title').innerText = isWin ? 'ПОБЕДА!' : 'МАТЧ ОКОНЧЕН';
                document.getElementById('br-death-title').style.color = isWin ? '#ffd60a' : '#ff453a';
                document.getElementById('br-death-sub').innerHTML = `
                    <div class="br-final-winner">ПОБЕДИТЕЛЬ: ${escapeHTML(winner.name)} - ${winner.kills || 0} КИЛЛОВ</div>
                    <div class="br-final-list">
                        ${allRows.slice(1).map((r, i) => `<div>${i + 2}. ${escapeHTML(r.name)} - ${r.kills || 0} киллов</div>`).join('')}
                    </div>`;
                addCoins(isWin ? 50 + br.kills * 5 : br.kills * 5);
                addGamePlayed();
            }

            function stopBR() {
                br.active = false;
                cancelAnimationFrame(br.loop);
                if (br.syncTimer) clearInterval(br.syncTimer);
                if (lobbyId) {
                    if (br.playersListener) db.ref(`lobbies/${lobbyId}/br/players`).off('value', br.playersListener);
                    if (br.shotsListener) db.ref(`lobbies/${lobbyId}/br/players`).off('child_changed', br.shotsListener);
                    if (br.damageListener) db.ref(`lobbies/${lobbyId}/br/damage`).off('value', br.damageListener);
                    if (br.botsListener) db.ref(`lobbies/${lobbyId}/br/bots`).off('value', br.botsListener);
                    db.ref(`lobbies/${lobbyId}/br/players/${myId}`).update({alive: false, hp: 0}).catch(() => {});
                }
                br.syncTimer = null;
                br.playersListener = null;
                br.shotsListener = null;
                br.damageListener = null;
                br.botsListener = null;
                shootTouch = null;
                isShooting = false;
            }
