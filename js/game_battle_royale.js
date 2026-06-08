            // ================== ВЫЖИВАНИЕ (BATTLE ROYALE) ==================
            let currentMode = 'tdm_5v5';

            let mapWalls = [];

            function rectCircleOverlap(rx, ry, rw, rh, cx, cy, cr) {
                const closestX = Math.max(rx, Math.min(cx, rx + rw));
                const closestY = Math.max(ry, Math.min(cy, ry + rh));
                const distanceX = cx - closestX;
                const distanceY = cy - closestY;
                return (distanceX * distanceX + distanceY * distanceY) < (cr * cr);
            }

            function rectsOverlap(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
                return r1x < r2x + r2w && r1x + r1w > r2x && r1y < r2y + r2h && r1y + r1h > r2y;
            }

            function getBrSize() {
                return (typeof currentMode !== 'undefined' && currentMode === 'tdm_5v5') ? 3500 : 2000;
            }

            function getBrBaseRects() {
                if (typeof currentMode !== 'undefined' && currentMode === 'tdm_5v5') {
                    const ctX = 100;
                    const ctY = BR_SIZE / 2 - 225;
                    const tX = BR_SIZE - 550;
                    const tY = BR_SIZE / 2 - 225;
                    return {
                        ct: { x: ctX, y: ctY, w: 450, h: 450, textX: ctX + 225, textY: ctY + 235 },
                        t: { x: tX, y: tY, w: 450, h: 450, textX: tX + 225, textY: tY + 235 }
                    };
                }
                if (typeof currentMode !== 'undefined' && (currentMode === 'duel_1v1' || currentMode === 'duel_2v2')) {
                    return {
                        ct: { x: 450, y: 850, w: 300, h: 300, textX: 600, textY: 1010 },
                        t: { x: 1250, y: 850, w: 300, h: 300, textX: 1400, textY: 1010 }
                    };
                }
                return {
                    ct: { x: 50, y: 775, w: 450, h: 450, textX: 275, textY: 1010 },
                    t: { x: 1500, y: 775, w: 450, h: 450, textX: 1725, textY: 1010 }
                };
            }

            function generateMap() {
                mapWalls = [];
                const midX = BR_SIZE / 2;
                const passagesCount = (BR_SIZE === 3500) ? 8 : 3;
                const gap = 140; // width of passage gap
                const wallWidth = 60; // thickness of long central walls

                // Define passage y-positions
                const passageYPositions = [];
                for (let i = 1; i <= passagesCount; i++) {
                    const ratio = i / (passagesCount + 1);
                    // Add slight random offset to keep it organic
                    const offset = -40 + Math.floor(Math.random() * 80);
                    passageYPositions.push(Math.round(BR_SIZE * ratio) + offset);
                }
                // Sort just in case
                passageYPositions.sort((a, b) => a - b);

                // Build long divider walls on midX, keeping passages clear
                const yMin = 100;
                const yMax = BR_SIZE - 100;

                // Segment 1
                let yStart = yMin;
                let yEnd = passageYPositions[0] - gap / 2;
                if (yEnd > yStart + 40) {
                    mapWalls.push({ x: midX - wallWidth / 2, y: yStart, w: wallWidth, h: yEnd - yStart });
                }

                // Middle Segments
                for (let i = 0; i < passagesCount - 1; i++) {
                    yStart = passageYPositions[i] + gap / 2;
                    yEnd = passageYPositions[i + 1] - gap / 2;
                    if (yEnd > yStart + 40) {
                        mapWalls.push({ x: midX - wallWidth / 2, y: yStart, w: wallWidth, h: yEnd - yStart });
                    }
                }

                // Last Segment
                yStart = passageYPositions[passagesCount - 1] + gap / 2;
                yEnd = yMax;
                if (yEnd > yStart + 40) {
                    mapWalls.push({ x: midX - wallWidth / 2, y: yStart, w: wallWidth, h: yEnd - yStart });
                }

                // Add regular cover blocks randomly on both sides of the divider
                const totalWallCount = 25;
                let attempts = 0;

                while (mapWalls.length < totalWallCount && attempts < 300) {
                    attempts++;

                    const w = 60 + Math.floor(Math.random() * 100);
                    const h = 60 + Math.floor(Math.random() * 100);

                    // Random coordinate
                    const x = 100 + Math.floor(Math.random() * (BR_SIZE - 200 - w));
                    const y = 100 + Math.floor(Math.random() * (BR_SIZE - 200 - h));

                    // 1. Center check (radius 250px from center)
                    if (rectCircleOverlap(x, y, w, h, BR_SIZE / 2, BR_SIZE / 2, 250)) {
                        continue;
                    }

                    // 2. Base checks (with 20px padding)
                    const bases = getBrBaseRects();
                    if (rectsOverlap(x, y, w, h, bases.ct.x - 20, bases.ct.y - 20, bases.ct.w + 40, bases.ct.h + 40)) {
                        continue;
                    }
                    if (rectsOverlap(x, y, w, h, bases.t.x - 20, bases.t.y - 20, bases.t.w + 40, bases.t.h + 40)) {
                        continue;
                    }

                    // 3. Clear range check around central passages to prevent blocking them
                    let blocksPassage = false;
                    const clearRangeX = 140; // width of horizontal clear zone around midX
                    if (x + w > midX - clearRangeX && x < midX + clearRangeX) {
                        for (let py of passageYPositions) {
                            if (y + h > py - gap / 2 - 20 && y < py + gap / 2 + 20) {
                                blocksPassage = true;
                                break;
                            }
                        }
                    }
                    if (blocksPassage) {
                        continue;
                    }

                    // 4. Overlap with existing walls check (AABB with 40px padding to keep walking paths)
                    let overlapsWall = false;
                    for (let wall of mapWalls) {
                        if (x < wall.x + wall.w + 40 &&
                            x + w > wall.x - 40 &&
                            y < wall.y + wall.h + 40 &&
                            y + h > wall.y - 40) {
                            overlapsWall = true;
                            break;
                        }
                    }
                    if (overlapsWall) {
                        continue;
                    }

                    mapWalls.push({ x, y, w, h });
                }
                initBrBackgroundCanvas();
            }

            function checkPlayerCollisionWithWalls(px, py, r) {
                for (let wall of mapWalls) {
                    if (rectCircleOverlap(wall.x, wall.y, wall.w, wall.h, px, py, r)) {
                        return true;
                    }
                }
                return false;
            }

            function checkBulletCollisionWithWalls(bx, by) {
                for (let wall of mapWalls) {
                    if (bx >= wall.x && bx <= wall.x + wall.w && by >= wall.y && by <= wall.y + wall.h) {
                        return true;
                    }
                }
                return false;
            }

            function bulletHitWall(x, y) {
                // Spawn minor grey sparks or dust when bullet hits a wall
                if (!br.bloodParticles) br.bloodParticles = [];
                for (let i = 0; i < 4; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 0.5 + Math.random() * 1.5;
                    br.bloodParticles.push({
                        x: x,
                        y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        r: 1.5 + Math.random() * 1.5,
                        alpha: 0.8,
                        decay: 0.04 + Math.random() * 0.04,
                        isDust: true // grey sparks rather than red blood
                    });
                }
            }

            function lineIntersectsCircle(ax, ay, bx, by, cx, cy, cr) {
                const abx = bx - ax;
                const aby = by - ay;
                const acx = cx - ax;
                const acy = cy - ay;
                const abLenSq = abx * abx + aby * aby;
                if (abLenSq === 0) {
                    return (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy) < cr * cr;
                }
                let t = (acx * abx + acy * aby) / abLenSq;
                t = Math.max(0, Math.min(1, t));
                const projX = ax + t * abx;
                const projY = ay + t * aby;
                const dx = projX - cx;
                const dy = projY - cy;
                return (dx * dx + dy * dy) < (cr * cr);
            }

            function getBrPlayerSmokeAlpha(px, py) {
                let minAlpha = 1.0;
                if (br.smokeZones) {
                    br.smokeZones.forEach(smoke => {
                        const dx = px - smoke.x;
                        const dy = py - smoke.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist < smoke.r) {
                            const ratio = dist / smoke.r;
                            if (ratio < minAlpha) {
                                minAlpha = ratio;
                            }
                        }
                    });
                }
                return minAlpha;
            }

            function generateSmokeZones(mode) {
                br.smokeZones = [];
                const count = 5;
                const maxMapSize = (typeof mode !== 'undefined' && (mode === 'duel_1v1' || mode === 'duel_2v2')) ? 1200 : BR_SIZE;
                const minCoord = (BR_SIZE - maxMapSize) / 2;

                for (let i = 0; i < count; i++) {
                    const x = minCoord + 150 + Math.random() * (maxMapSize - 300);
                    const y = minCoord + 150 + Math.random() * (maxMapSize - 300);
                    const r = 120 + Math.random() * 60; // radius 120-180px
                    br.smokeZones.push({ x, y, r });
                }
            }

            function drawSmokeZones(ctx) {
                if (!br.smokeZones) return;
                ctx.save();
                br.smokeZones.forEach(smoke => {
                    const grad = ctx.createRadialGradient(smoke.x, smoke.y, smoke.r * 0.15, smoke.x, smoke.y, smoke.r);
                    grad.addColorStop(0, 'rgba(210, 215, 223, 0.7)');
                    grad.addColorStop(0.5, 'rgba(180, 185, 195, 0.5)');
                    grad.addColorStop(0.8, 'rgba(160, 165, 175, 0.25)');
                    grad.addColorStop(1, 'rgba(160, 165, 175, 0)');

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(smoke.x, smoke.y, smoke.r, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw soft inner core ring
                    ctx.strokeStyle = 'rgba(220, 225, 235, 0.05)';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(smoke.x, smoke.y, smoke.r * 0.4, 0, Math.PI * 2);
                    ctx.stroke();
                });
                ctx.restore();
            }

            function initBrBackgroundCanvas() {
                if (!br.bgCanvas) {
                    br.bgCanvas = document.createElement('canvas');
                }
                if (br.bgCanvas.width !== BR_SIZE || br.bgCanvas.height !== BR_SIZE) {
                    br.bgCanvas.width = BR_SIZE;
                    br.bgCanvas.height = BR_SIZE;
                }
                br.bgCtx = br.bgCanvas.getContext('2d');
                drawStaticBackground();
            }

            function drawStaticBackground() {
                const bgCtx = br.bgCtx;
                if (!bgCtx) return;

                // Clear background
                bgCtx.clearRect(0, 0, BR_SIZE, BR_SIZE);

                // Draw map grid
                bgCtx.strokeStyle = '#4e7a27';
                bgCtx.lineWidth = 2;
                for (let x = 0; x <= BR_SIZE; x += 100) { bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, BR_SIZE); bgCtx.stroke(); }
                for (let y = 0; y <= BR_SIZE; y += 100) { bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(BR_SIZE, y); bgCtx.stroke(); }

                const bases = getBrBaseRects();

                // Draw Team 1 Base (Blue floor)
                bgCtx.fillStyle = 'rgba(50, 173, 230, 0.12)';
                bgCtx.fillRect(bases.ct.x, bases.ct.y, bases.ct.w, bases.ct.h);
                bgCtx.strokeStyle = 'rgba(50, 173, 230, 0.45)';
                bgCtx.lineWidth = 4;
                bgCtx.strokeRect(bases.ct.x, bases.ct.y, bases.ct.w, bases.ct.h);

                // Draw Team 2 Base (Orange floor)
                bgCtx.fillStyle = 'rgba(255, 159, 10, 0.12)';
                bgCtx.fillRect(bases.t.x, bases.t.y, bases.t.w, bases.t.h);
                bgCtx.strokeStyle = 'rgba(255, 159, 10, 0.45)';
                bgCtx.lineWidth = 4;
                bgCtx.strokeRect(bases.t.x, bases.t.y, bases.t.w, bases.t.h);

                // Base text labels
                bgCtx.fillStyle = 'rgba(50, 173, 230, 0.4)';
                bgCtx.font = 'bold 24px sans-serif';
                bgCtx.textAlign = 'center';
                bgCtx.fillText('БАЗА CT', bases.ct.textX, bases.ct.textY);
                bgCtx.fillStyle = 'rgba(255, 159, 10, 0.4)';
                bgCtx.fillText('БАЗА T', bases.t.textX, bases.t.textY);

                // Draw walls
                mapWalls.forEach(wall => {
                    bgCtx.fillStyle = '#1c1f22';
                    bgCtx.fillRect(wall.x - 2, wall.y - 2, wall.w + 4, wall.h + 4);
                    bgCtx.fillStyle = '#4c525a';
                    bgCtx.fillRect(wall.x, wall.y, wall.w, wall.h);
                    bgCtx.strokeStyle = '#6e7680';
                    bgCtx.lineWidth = 2;
                    bgCtx.strokeRect(wall.x, wall.y, wall.w, wall.h);

                    bgCtx.fillStyle = '#3b4046';
                    bgCtx.fillRect(wall.x + wall.w * 0.2, wall.y + wall.h * 0.15, 2, 10);
                    bgCtx.fillRect(wall.x + wall.w * 0.6, wall.y + wall.h * 0.7, 10, 2);
                    if (wall.w > 80 && wall.h > 80) {
                        bgCtx.fillRect(wall.x + wall.w * 0.4, wall.y + wall.h * 0.45, 6, 2);
                        bgCtx.fillRect(wall.x + wall.w * 0.75, wall.y + wall.h * 0.25, 2, 6);
                    }
                });

                // Draw blood stains
                if (br.bloodStains) {
                    br.bloodStains.forEach(stain => {
                        bgCtx.fillStyle = 'rgba(139, 0, 0, 0.75)';
                        bgCtx.beginPath();
                        bgCtx.arc(stain.x, stain.y, stain.r, 0, Math.PI * 2);
                        bgCtx.fill();

                        bgCtx.fillStyle = 'rgba(110, 0, 0, 0.6)';
                        const seed = Math.sin(stain.x) * Math.cos(stain.y);
                        const splatterCount = 3 + Math.floor(Math.abs(seed * 3));
                        for (let i = 0; i < splatterCount; i++) {
                            const angle = (seed * 123.45 + i) * Math.PI;
                            const dist = stain.r * (0.8 + Math.abs(Math.sin(i)) * 0.7);
                            const sx = stain.x + Math.cos(angle) * dist;
                            const sy = stain.y + Math.sin(angle) * dist;
                            const sr = stain.r * (0.15 + Math.abs(Math.cos(i)) * 0.2);
                            bgCtx.beginPath();
                            bgCtx.arc(sx, sy, sr, 0, Math.PI * 2);
                            bgCtx.fill();
                        }
                    });
                }
            }

            function drawBloodStainOnBg(stain) {
                if (!br.bgCtx) return;
                br.bgCtx.fillStyle = 'rgba(139, 0, 0, 0.75)';
                br.bgCtx.beginPath();
                br.bgCtx.arc(stain.x, stain.y, stain.r, 0, Math.PI * 2);
                br.bgCtx.fill();

                br.bgCtx.fillStyle = 'rgba(110, 0, 0, 0.6)';
                const splatterCount = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < splatterCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = stain.r * (0.8 + Math.random() * 0.7);
                    const sx = stain.x + Math.cos(angle) * dist;
                    const sy = stain.y + Math.sin(angle) * dist;
                    const sr = stain.r * (0.15 + Math.random() * 0.2);
                    br.bgCtx.beginPath();
br.bgCtx.arc(sx, sy, sr, 0, Math.PI * 2);
                    br.bgCtx.fill();
                }
            }

            function spawnBloodSplatter(x, y) {
                if (br.lowPerformanceMode) return;
                if (!br.bloodParticles) br.bloodParticles = [];
                const particleCount = 8 + Math.floor(Math.random() * 6);
                for (let i = 0; i < particleCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 4;
                    br.bloodParticles.push({
                        x: x,
                        y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        r: 2 + Math.random() * 3,
                        alpha: 1.0,
                        decay: 0.02 + Math.random() * 0.03
                    });
                }
            }

            function checkAndAddBloodDecal(entity, hitX, hitY) {
                if (!entity) return;
                for (let wall of mapWalls) {
                    const closestX = Math.max(wall.x, Math.min(entity.x, wall.x + wall.w));
                    const closestY = Math.max(wall.y, Math.min(entity.y, wall.y + wall.h));
                    const dx = entity.x - closestX;
                    const dy = entity.y - closestY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 50) {
                        const stain = {
                            x: closestX,
                            y: closestY,
                            r: 8 + Math.random() * 12
                        };
                        if (!br.bloodStains) br.bloodStains = [];
                        br.bloodStains.push(stain);
                        drawBloodStainOnBg(stain);
                        break;
                    }
                }
            }

            function updateAndDrawBloodParticles(ctx) {
                if (!br.bloodParticles) return;
                ctx.save();
                for (let i = br.bloodParticles.length - 1; i >= 0; i--) {
                    const p = br.bloodParticles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.95;
                    p.vy *= 0.95;
                    p.alpha -= p.decay;
                    if (p.alpha <= 0) {
                        br.bloodParticles.splice(i, 1);
                        continue;
                    }
                    if (p.isDust) {
                        ctx.fillStyle = `rgba(130, 135, 140, ${p.alpha})`;
                    } else {
                        ctx.fillStyle = `rgba(180, 0, 0, ${p.alpha})`;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            function drawBulletWithTracer(ctx, bx, by, bvx, bvy) {
                if (!br.lowPerformanceMode) {
                    ctx.save();
                    const grad = ctx.createLinearGradient(bx, by, bx - bvx * 2.5, by - bvy * 2.5);
                    grad.addColorStop(0, 'rgba(255, 214, 10, 0.85)');
                    grad.addColorStop(0.2, 'rgba(220, 220, 220, 0.55)');
                    grad.addColorStop(1, 'rgba(180, 180, 180, 0)');

                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 3.5;
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.lineTo(bx - bvx * 2.5, by - bvy * 2.5);
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.fillStyle = '#ffd60a';
                ctx.beginPath();
                ctx.arc(bx, by, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            function initLobby(mode) {
                currentMode = mode;
                if (lobbyId && isHost) {
                    db.ref(`lobbies/${lobbyId}/currentMode`).set(mode).catch(() => {});
                }
            }

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
                isSpectator: false,
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
            let BR_SIZE = 2000;
            const BR_PLAYER_R = 20;
            const BR_DEFAULT_HP = 200;
            let joyTouch = null, shootTouch = null, jx = 0, jy = 0, isShooting = false, lastShot = 0;

            let brAudioCtx = null;

            function playBrSound(type) {
                try {
                    if (!brAudioCtx) {
                        brAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (brAudioCtx.state === 'suspended') {
                        brAudioCtx.resume();
                    }

                    const now = brAudioCtx.currentTime;

                    if (type === 'shoot') {
                        const bufferSize = brAudioCtx.sampleRate * 0.12;
                        const buffer = brAudioCtx.createBuffer(1, bufferSize, brAudioCtx.sampleRate);
                        const data = buffer.getChannelData(0);
                        for (let i = 0; i < bufferSize; i++) {
                            data[i] = Math.random() * 2 - 1;
                        }

                        const noise = brAudioCtx.createBufferSource();
                        noise.buffer = buffer;

                        const noiseFilter = brAudioCtx.createBiquadFilter();
                        noiseFilter.type = 'bandpass';
                        noiseFilter.frequency.setValueAtTime(1200, now);
                        noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.1);

                        const noiseGain = brAudioCtx.createGain();
                        noiseGain.gain.setValueAtTime(0.25, now);
                        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

                        noise.connect(noiseFilter);
                        noiseFilter.connect(noiseGain);
                        noiseGain.connect(brAudioCtx.destination);

                        const osc = brAudioCtx.createOscillator();
                        const oscGain = brAudioCtx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(180, now);
                        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

                        oscGain.gain.setValueAtTime(0.4, now);
                        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                        osc.connect(oscGain);
                        oscGain.connect(brAudioCtx.destination);

                        noise.start(now);
                        osc.start(now);
                        noise.stop(now + 0.12);
                        osc.stop(now + 0.08);
                    }
                    else if (type === 'hit') {
                        const osc = brAudioCtx.createOscillator();
                        const gain = brAudioCtx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(950, now);
                        osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

                        osc.connect(gain);
                        gain.connect(brAudioCtx.destination);

                        osc.start(now);
                        osc.stop(now + 0.06);
                    }
                    else if (type === 'death') {
                        const osc = brAudioCtx.createOscillator();
                        const gain = brAudioCtx.createGain();
                        const filter = brAudioCtx.createBiquadFilter();

                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(160, now);
                        osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(350, now);
                        filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

                        gain.gain.setValueAtTime(0.35, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

                        osc.connect(filter);
                        filter.connect(gain);
                        gain.connect(brAudioCtx.destination);

                        osc.start(now);
                        osc.stop(now + 0.45);
                    }
                } catch (err) {
                    console.warn("AudioContext playback failed", err);
                }
            }

            function brNormalizeTeam(value) {
                const team = String(value || '').trim();
                if (team === 'Counter-Terrorists' || team === '1' || team === 'ct') return 'Counter-Terrorists';
                if (team === 'Terrorists' || team === '2' || team === 't') return 'Terrorists';
                return '';
            }

            function brNormalizeSpeed(value) {
                return Math.max(1, Math.min(15, parseInt(value) || 3));
            }

            function brSpeedMultiplier(value) {
                return brNormalizeSpeed(value) / 3;
            }

            function brTeamFor(entityOrId) {
                if (!entityOrId) return '';
                if (typeof entityOrId === 'object') return brNormalizeTeam(entityOrId.team);
                if (br.myP && br.myP.id === entityOrId) return brNormalizeTeam(br.myP.team);
                const bot = br.bots.find(b => b.id === entityOrId);
                if (bot) return brNormalizeTeam(bot.team);
                const player = br.remotePlayers[entityOrId];
                if (player) return brNormalizeTeam(player.team);
                return '';
            }

            function brAreAllies(a, b) {
                const teamA = brTeamFor(a);
                const teamB = brTeamFor(b);
                return !!teamA && teamA === teamB;
            }

            function brIsEnemyTarget(ownerId, target) {
                const targetId = typeof target === 'object' ? target.id : target;
                return ownerId !== targetId && !brAreAllies(ownerId, target);
            }

            function brIsInvulnerable(target, now = Date.now()) {
                return !!target && Number(target.invulnUntil || target.invuln || 0) > now;
            }

            function brSpawnForId(id, team) {
                if (!team) {
                    team = brTeamFor(id);
                }
                if (!team && typeof id === 'string') {
                    if (id.includes('_t1_')) team = 'Counter-Terrorists';
                    else if (id.includes('_t2_')) team = 'Terrorists';
                }
                if (!team && id === myId) {
                    const realPlayers = brRealLobbyPlayers();
                    const idx = realPlayers.findIndex(p => p.id === myId);
                    if (idx !== -1) {
                        let maxTeamSize = 5;
                        if (typeof currentMode !== 'undefined') {
                            if (currentMode === 'duel_1v1') maxTeamSize = 1;
                            else if (currentMode === 'duel_2v2') maxTeamSize = 2;
                        }
                        let team1Real = [];
                        let team2Real = [];
                        realPlayers.forEach((p, i) => {
                            if (team1Real.length < maxTeamSize && team2Real.length < maxTeamSize) {
                                if (i % 2 === 0) team1Real.push(p);
                                else team2Real.push(p);
                            } else if (team1Real.length < maxTeamSize) {
                                team1Real.push(p);
                            } else if (team2Real.length < maxTeamSize) {
                                team2Real.push(p);
                            }
                        });
                        if (team1Real.some(p => p.id === myId)) team = 'Counter-Terrorists';
                        else if (team2Real.some(p => p.id === myId)) team = 'Terrorists';
                    }
                }
                if (!team) team = 'Counter-Terrorists';

                const seed = String(id || '0').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
                const bases = getBrBaseRects();

                if (team === 'Counter-Terrorists') {
                    // Blue Base (CT)
                    const x = bases.ct.x + 50 + (seed % (bases.ct.w - 150));
                    const y = bases.ct.y + 50 + ((seed * 17) % (bases.ct.h - 150));
                    return { x, y };
                } else {
                    // Orange Base (T)
                    const x = bases.t.x + 50 + (seed % (bases.t.w - 150));
                    const y = bases.t.y + 50 + ((seed * 17) % (bases.t.h - 150));
                    return { x, y };
                }
            }

            function brRealLobbyPlayers() {
                return (Array.isArray(lobbyPlayers) ? lobbyPlayers : []).filter(p => p.id && !isAiFriendId(p.id));
            }

            function getFighterColor(p) {
                const team = brTeamFor(p);
                if (team === 'Counter-Terrorists') return '#32ade6';
                if (team === 'Terrorists') return '#ff9f0a';
                return '#ff453a';
            }

            function selectGameMode(mode) {
                if (lobbyId && !isHost) {
                    return showNegativeAlert("Только хост может выбрать режим!");
                }
                initLobby(mode);
                if (lobbyId && isHost) {
                    const base = `lobbies/${lobbyId}/br`;
                    db.ref(`${base}/currentMode`).set(mode).then(() => {
                        db.ref(`${base}/matchActive`).set(true);
                    }).catch(() => {});
                } else {
                    startBrMatchLocal(mode);
                }
            }

            function startBrMatchLocal(mode) {
                if (mode && mode.startsWith('br_')) {
                    mode = mode.replace('br_', '');
                }
                currentMode = mode;
                BR_SIZE = (mode === 'tdm_5v5') ? 3500 : 2000;
                br.matchActive = true;
                br.matchStartTime = Date.now();
                br.kills = 0;
                br.placeShown = false;
                br.isSpectator = false;
                br.aliveTracker = {};
                br.zone = { x: BR_SIZE / 2, y: BR_SIZE / 2, r: (mode === 'duel_1v1' || mode === 'duel_2v2') ? 600 : BR_SIZE };
                br.bgCanvas = null;
                br.bgCtx = null;

                br.settings = mergedSettingsForGame('br_2d');
                const mySettings = br.settings.players?.[myId] || {};
                const myMaxHp = Math.max(1, parseInt(mySettings.lives) || BR_DEFAULT_HP);
                const mySpeed = brNormalizeSpeed(mySettings.speed);
                
                let myTeam = brNormalizeTeam(mySettings.team);
                if (!myTeam) {
                    const myIdx = Array.isArray(lobbyPlayers) ? lobbyPlayers.findIndex(p => p.id === myId) : -1;
                    if (myIdx >= 0) {
                        let maxTeamSize = 5;
                        if (mode === 'duel_1v1') maxTeamSize = 1;
                        else if (mode === 'duel_2v2') maxTeamSize = 2;
                        
                        let team1Real = [];
                        let team2Real = [];
                        lobbyPlayers.forEach((p, idx) => {
                            if (team1Real.length < maxTeamSize && team2Real.length < maxTeamSize) {
                                if (idx % 2 === 0) team1Real.push(p);
                                else team2Real.push(p);
                            } else if (team1Real.length < maxTeamSize) {
                                team1Real.push(p);
                            } else if (team2Real.length < maxTeamSize) {
                                team2Real.push(p);
                            }
                        });
                        
                        if (team1Real.some(p => p.id === myId)) myTeam = 'Counter-Terrorists';
                        else if (team2Real.some(p => p.id === myId)) myTeam = 'Terrorists';
                    }
                }
                if (!myTeam) myTeam = 'Counter-Terrorists';

                br.serverHp = myMaxHp;
                br.damageTaken = 0;
                br.lastSyncX = 0;
                br.lastSyncY = 0;
                br.lastSyncAt = Date.now();
                shootTouch = null;
                isShooting = false;
                lastShot = 0;

                const spawn = brSpawnForId(myId, myTeam);
                const invulnUntil = Date.now() + 5000;
                br.myP = { id: myId, name: myName, avatar: myAvatar, eqName: myEqName, x: spawn.x, y: spawn.y, vx: 0, vy: 0, hp: myMaxHp, maxHp: myMaxHp, team: myTeam, speed: mySpeed, a: 0, kills: 0, shotSeq: 0, alive: true, invuln: invulnUntil, invulnUntil };
                br.lastSyncX = br.myP.x;
                br.lastSyncY = br.myP.y;

                // Hide the Standoff 2 overlay menu!
                const overlay = document.getElementById('so2-lobby-overlay');
                if (overlay) overlay.style.display = 'none';

                // Show controls if mobile
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const controls = document.getElementById('br-controls');
                if (controls) {
                    controls.style.display = isMobile ? 'flex' : 'none';
                }

                br.bloodStains = [];
                br.bloodParticles = [];
                generateSmokeZones(mode);
                br.teamInitialized = true;
                initBrFirebaseState(mode);
            }

            function initBR() {
                br.active = true;
                br.kills = 0;
                br.placeShown = false;
                br.isSpectator = false;
                br.aliveTracker = {};
                br.bloodStains = [];
                br.bloodParticles = [];
                br.smokeZones = [];
                br.bgCanvas = null;
                br.bgCtx = null;
                const submode = (appState.selectedGameId || '').startsWith('br_') ? appState.selectedGameId.replace('br_', '') : 'tdm_5v5';
                currentMode = submode;
                BR_SIZE = (submode === 'tdm_5v5') ? 3500 : 2000;
                br.zone = { x: BR_SIZE / 2, y: BR_SIZE / 2, r: (submode === 'duel_1v1' || submode === 'duel_2v2') ? 600 : BR_SIZE };
                br.joystickTargetAngle = null;
                br.remotePlayers = {};
                br.remotePlayerViews = {};
                br.remoteShotSeqs = {};
                br.damageByPlayer = {};
                br.bots = [];
                br.bullets = [];
                br.remoteBullets = {};
                br.freeRoam = false;
                br.settings = mergedSettingsForGame('br_2d');
                const mySettings = br.settings.players?.[myId] || {};
                const myMaxHp = Math.max(1, parseInt(mySettings.lives) || BR_DEFAULT_HP);
                const myTeam = brNormalizeTeam(mySettings.team);
                const mySpeed = brNormalizeSpeed(mySettings.speed);
                br.serverHp = myMaxHp;
                br.damageTaken = 0;
                br.lastSyncX = 0;
                br.lastSyncY = 0;

                document.getElementById('br-ui-alive').innerText = 'Живых: ?';
                document.getElementById('br-ui-kills').innerText = 'Киллы: 0';
                const spectatorLabel = document.getElementById('br-ui-spectator');
                if (spectatorLabel) spectatorLabel.style.display = 'none';
                document.getElementById('br-death-screen').style.display = 'none';

                let c = document.getElementById('br-canvas');
                resizeBrCanvas();
                bindBrControls();

                // Hide the Standoff 2 overlay menu!
                const overlay = document.getElementById('so2-lobby-overlay');
                if (overlay) overlay.style.display = 'none';

                // Listen to host starting the game
                if (lobbyId) {
                    db.ref(`lobbies/${lobbyId}/br/matchActive`).off();
                    br.matchActiveListener = snap => {
                        if (snap.exists() && snap.val() === true) {
                            db.ref(`lobbies/${lobbyId}/br/currentMode`).once('value').then(modeSnap => {
                                const mode = modeSnap.val() || 'tdm_5v5';
                                currentMode = mode;
                                startBrMatchLocal(mode);
                            });
                        }
                    };
                    db.ref(`lobbies/${lobbyId}/br/matchActive`).on('value', br.matchActiveListener);

                    if (isHost) {
                        const submode = (appState.selectedGameId || '').startsWith('br_') ? appState.selectedGameId.replace('br_', '') : 'tdm_5v5';
                        selectGameMode(submode);
                    }
                } else {
                    const submode = (appState.selectedGameId || '').startsWith('br_') ? appState.selectedGameId.replace('br_', '') : 'tdm_5v5';
                    startBrMatchLocal(submode);
                }

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

                // Prevent default page scroll on mobile Telegram when battle royale game is active
                if (!window._brTouchmoveBound) {
                    window._brTouchmoveBound = true;
                    document.addEventListener('touchmove', (e) => {
                        if (br && br.active) {
                            e.preventDefault();
                        }
                    }, { passive: false });
                }

                jBox.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    let ev = e.changedTouches ? e.changedTouches[0] : e;
                    joyTouch = ev.identifier !== undefined ? ev.identifier : 'm';
                    updateJoy(ev);
                }, { passive: false });

                jBox.addEventListener('touchmove', (e) => {
                    if (joyTouch === null) return;
                    e.preventDefault();
                    let ev = e.touches ? Array.from(e.touches).find(t => t.identifier === joyTouch) : e;
                    if (ev) updateJoy(ev);
                }, { passive: false });

                jBox.addEventListener('touchend', (e) => {
                    if (joyTouch === null) return;
                    const ended = e.changedTouches ? Array.from(e.changedTouches).some(t => t.identifier === joyTouch) : true;
                    if (!ended) return;
                    resetJoy();
                }, { passive: false });

                jBox.addEventListener('touchcancel', (e) => {
                    if (joyTouch === null) return;
                    resetJoy();
                }, { passive: false });

                jBox.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    joyTouch = 'm';
                    updateJoy(e);
                });

                jBox.addEventListener('mousemove', (e) => {
                    if (joyTouch !== 'm') return;
                    updateJoy(e);
                });

                jBox.addEventListener('mouseup', (e) => {
                    if (joyTouch !== 'm') return;
                    resetJoy();
                });

                jBox.addEventListener('mouseleave', (e) => {
                    if (joyTouch !== 'm') return;
                    resetJoy();
                });

                function resetJoy() {
                    joyTouch = null;
                    jx = 0;
                    jy = 0;
                    jStick.style.transform = `translate(0px, 0px)`;
                    br.joystickTargetAngle = null;
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
                    br.joystickTargetAngle = angle;
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

            function initBrFirebaseState(mode) {
                const botHp = (mode === 'tdm_5v5') ? 100 : 200;
                if (!lobbyId) {
                    generateMap();

                    let maxTeamSize = 5;
                    if (mode === 'duel_1v1') maxTeamSize = 1;
                    else if (mode === 'duel_2v2') maxTeamSize = 2;
                    else maxTeamSize = 5;

                    const myTeam = br.myP.team || 'Counter-Terrorists';
                    const enemyTeam = myTeam === 'Counter-Terrorists' ? 'Terrorists' : 'Counter-Terrorists';

                    br.bots = [];
                    // Spawn bots for my team
                    for (let i = 0; i < maxTeamSize - 1; i++) {
                        const botId = 'bot_t1_' + i;
                        const sp = brSpawnForId(botId, myTeam);
                        br.bots.push({ id: botId, label: 'Бот CT-' + (i + 1), x: sp.x, y: sp.y, hp: botHp, maxHp: botHp, team: myTeam, speed: 3, aiLevel: 2, ammoPerSec: 2, a: 0, tx: BR_SIZE / 2, ty: BR_SIZE / 2, alive: true, nextThink: 0, nextShot: 0, kills: 0 });
                    }
                    // Spawn bots for enemy team
                    for (let i = 0; i < maxTeamSize; i++) {
                        const botId = 'bot_t2_' + i;
                        const sp = brSpawnForId(botId, enemyTeam);
                        br.bots.push({ id: botId, label: 'Бот T-' + (i + 1), x: sp.x, y: sp.y, hp: botHp, maxHp: botHp, team: enemyTeam, speed: 3, aiLevel: 2, ammoPerSec: 2, a: 0, tx: BR_SIZE / 2, ty: BR_SIZE / 2, alive: true, nextThink: 0, nextShot: 0, kills: 0 });
                    }
                    return;
                }
                const base = `lobbies/${lobbyId}/br`;
                if (isHost) {
                    generateMap();
                    const realPlayers = brRealLobbyPlayers();

                    let maxTeamSize = 5;
                    if (mode === 'duel_1v1') maxTeamSize = 1;
                    else if (mode === 'duel_2v2') maxTeamSize = 2;
                    else maxTeamSize = 5;

                    let team1Real = [];
                    let team2Real = [];
                    realPlayers.forEach((p, idx) => {
                        if (team1Real.length < maxTeamSize && team2Real.length < maxTeamSize) {
                            if (idx % 2 === 0) team1Real.push(p);
                            else team2Real.push(p);
                        } else if (team1Real.length < maxTeamSize) {
                            team1Real.push(p);
                        } else if (team2Real.length < maxTeamSize) {
                            team2Real.push(p);
                        }
                    });

                    let team1BotCount = maxTeamSize - team1Real.length;
                    let team2BotCount = maxTeamSize - team2Real.length;

                    const bots = [];
                    // Spawn bots for Team 1 (Counter-Terrorists)
                    for (let i = 0; i < team1BotCount; i++) {
                        const botId = 'bot_t1_' + i;
                        const sp = brSpawnForId(botId, 'Counter-Terrorists');
                        bots.push({ id: botId, label: 'Бот CT-' + (i + 1), x: sp.x, y: sp.y, hp: botHp, maxHp: botHp, team: 'Counter-Terrorists', speed: 3, aiLevel: 2, ammoPerSec: 2, a: 0, tx: BR_SIZE / 2, ty: BR_SIZE / 2, alive: true, nextThink: 0, nextShot: 0, kills: 0 });
                    }
                    // Spawn bots for Team 2 (Terrorists)
                    for (let i = 0; i < team2BotCount; i++) {
                        const botId = 'bot_t2_' + i;
                        const sp = brSpawnForId(botId, 'Terrorists');
                        bots.push({ id: botId, label: 'Бот T-' + (i + 1), x: sp.x, y: sp.y, hp: botHp, maxHp: botHp, team: 'Terrorists', speed: 3, aiLevel: 2, ammoPerSec: 2, a: 0, tx: BR_SIZE / 2, ty: BR_SIZE / 2, alive: true, nextThink: 0, nextShot: 0, kills: 0 });
                    }

                    br.freeRoam = false;

                    let teamAssign = {};
                    team1Real.forEach(p => { teamAssign[p.id] = 'Counter-Terrorists'; });
                    team2Real.forEach(p => { teamAssign[p.id] = 'Terrorists'; });

                    const playersObj = {};
                    const damageObj = {};

                    realPlayers.forEach(p => {
                        const assignedTeam = teamAssign[p.id] || 'Counter-Terrorists';
                        const sp = brSpawnForId(p.id, assignedTeam);
                        playersObj[p.id] = {
                            id: p.id,
                            name: p.name || 'Игрок',
                            avatar: p.avatar || '👤',
                            eqName: p.eqName || '',
                            x: sp.x,
                            y: sp.y,
                            vx: 0,
                            vy: 0,
                            hp: Math.max(1, parseInt(br.settings.players?.[p.id]?.lives) || BR_DEFAULT_HP),
                            maxHp: Math.max(1, parseInt(br.settings.players?.[p.id]?.lives) || BR_DEFAULT_HP),
                            team: assignedTeam,
                            speed: brNormalizeSpeed(br.settings.players?.[p.id]?.speed),
                            invulnUntil: Date.now() + 5000,
                            damageTaken: 0,
                            a: 0,
                            kills: 0,
                            shotSeq: 0,
                            alive: true,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };
                        damageObj[p.id] = 0;
                    });

                    br.teamInitialized = true;
                    br.bots = bots;

                    updateDbPaths({
                        [`${base}/zone`]: br.zone,
                        [`${base}/bots`]: bots,
                        [`${base}/walls`]: mapWalls,
                        [`${base}/smokes`]: br.smokeZones,
                        [`${base}/bullets`]: null,
                        [`${base}/players`]: playersObj,
                        [`${base}/damage`]: damageObj
                    }, 'init br state').catch(() => {});

                    db.ref(`${base}/players/${myId}`).update(brPublicPlayerState(true)).catch(() => {});
                } else {
                    br.teamInitialized = false;
                    br.smokesListener = snap => {
                        if (snap.exists()) {
                            const val = snap.val();
                            br.smokeZones = Array.isArray(val) ? val : Object.values(val);
                        } else {
                            br.smokeZones = [];
                        }
                    };
                    db.ref(`${base}/smokes`).on('value', br.smokesListener);

                    db.ref(`${base}/players/${myId}`).once('value').then(snap => {
                        if (snap.exists()) {
                            const data = snap.val();
                            if (data.team && br.myP) {
                                br.myP.team = data.team;
                                const sp = brSpawnForId(myId, data.team);
                                br.myP.x = sp.x;
                                br.myP.y = sp.y;
                                br.lastSyncX = sp.x;
                                br.lastSyncY = sp.y;
                            }
                        }
                        br.teamInitialized = true;
                        db.ref(`${base}/players/${myId}`).update(brPublicPlayerState(true)).catch(() => {});
                    });
                }

                db.ref(`${base}/players/${myId}`).onDisconnect().update({alive: false, hp: 0});

                br.playersListener = snap => {
                    applyBrRemotePlayers(snap.exists() ? snap.val() : {});
                    const remoteMe = br.remotePlayers[myId];
                    if (remoteMe && br.myP) {
                        const serverDamage = Math.max(parseInt(br.damageByPlayer[myId]) || 0, parseInt(remoteMe.damageTaken) || 0);
                        const maxHp = Math.max(1, parseInt(remoteMe.maxHp) || parseInt(br.myP.maxHp) || BR_DEFAULT_HP);
                        const legacyHp = remoteMe.hp === undefined ? maxHp : (parseInt(remoteMe.hp) || 0);
                        if (!brIsInvulnerable(br.myP)) br.damageTaken = Math.max(br.damageTaken, serverDamage);
                        const serverHp = brIsInvulnerable(br.myP) ? maxHp : Math.min(legacyHp, Math.max(0, maxHp - br.damageTaken));
                        br.myP.hp = brIsInvulnerable(br.myP) ? maxHp : Math.min(br.myP.hp, serverHp);
                        br.serverHp = br.myP.hp;
                        br.kills = Math.max(br.kills, parseInt(remoteMe.kills) || 0);
                        document.getElementById('br-ui-kills').innerText = `Киллы: ${br.kills}`;
                        br.myP.alive = (brIsInvulnerable(br.myP) || remoteMe.alive !== false) && br.myP.hp > 0;
                        if (remoteMe.team) br.myP.team = remoteMe.team;
                    }
                };
                br.botsListener = snap => {
                    if (isHost && lobbyId) return;
                    applyBrBotViews(snap.exists() ? Object.values(snap.val()) : []);
                };
                db.ref(`${base}/players`).on('value', br.playersListener);
                br.damageListener = snap => {
                    br.damageByPlayer = snap.exists() ? snap.val() : {};
                    const myDamage = Math.max(0, parseInt(br.damageByPlayer[myId]) || 0);
                    if (br.myP && myDamage > br.damageTaken && !brIsInvulnerable(br.myP)) {
                        br.damageTaken = myDamage;
                        br.myP.hp = Math.min(br.myP.hp, Math.max(0, (br.myP.maxHp || BR_DEFAULT_HP) - myDamage));
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

                br.wallsListener = snap => {
                    if (snap.exists()) {
                        const val = snap.val();
                        mapWalls = Array.isArray(val) ? val : Object.values(val);
                    } else {
                        mapWalls = [];
                    }
                    initBrBackgroundCanvas();
                };
                db.ref(`${base}/walls`).on('value', br.wallsListener);

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
                    maxHp: br.myP.maxHp || BR_DEFAULT_HP,
                    team: brNormalizeTeam(br.myP.team),
                    speed: brNormalizeSpeed(br.myP.speed),
                    invulnUntil: Number(br.myP.invulnUntil || br.myP.invuln || 0),
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
                        br.remotePlayerViews[p.id] = { 
                            x, y, a: p.a || 0, 
                            snapshotX: x, snapshotY: y, 
                            vx, vy, 
                            targetX: x, targetY: y, 
                            targetA: p.a || 0, 
                            receivedAt: Date.now(), 
                            lastSeen: Date.now(),
                            lastUpdatedAt: p.updatedAt || 0
                        };
                        applyBrRemoteShot(p);
                        return;
                    }
                    const isNewUpdate = (p.updatedAt !== undefined && view.lastUpdatedAt !== p.updatedAt) ||
                                        view.snapshotX !== x ||
                                        view.snapshotY !== y ||
                                        view.vx !== vx ||
                                        view.vy !== vy ||
                                        view.targetA !== (p.a || 0);
                    if (isNewUpdate) {
                        view.snapshotX = x;
                        view.snapshotY = y;
                        view.vx = vx;
                        view.vy = vy;
                        view.targetX = x;
                        view.targetY = y;
                        view.targetA = p.a || 0;
                        view.receivedAt = Date.now();
                        view.lastSeen = Date.now();
                        view.lastUpdatedAt = p.updatedAt || 0;
                        if (Math.hypot(view.x - x, view.y - y) > 320) {
                            view.x = x;
                            view.y = y;
                            view.a = view.targetA;
                        }
                    }
                    applyBrRemoteShot(p);
                });
            }

            function applyBrBotViews(nextBots) {
                br.bots = nextBots || [];
                if (!br.botViews) br.botViews = {};
                Object.keys(br.botViews).forEach(id => {
                    if (!br.bots.some(b => b.id === id)) delete br.botViews[id];
                });
                br.bots.forEach(b => {
                    if (!b.alive || b.hp <= 0) return;
                    const x = Number(b.x) || 0;
                    const y = Number(b.y) || 0;
                    const vx = Number(b.vx) || 0;
                    const vy = Number(b.vy) || 0;
                    const view = br.botViews[b.id];
                    if (!view) {
                        br.botViews[b.id] = {
                            x, y, a: b.a || 0,
                            snapshotX: x, snapshotY: y,
                            vx, vy,
                            targetX: x, targetY: y,
                            targetA: b.a || 0,
                            receivedAt: Date.now(),
                            lastSeen: Date.now(),
                            lastUpdatedAt: b.updatedAt || 0
                        };
                        return;
                    }
                    const isNewUpdate = view.lastUpdatedAt !== b.updatedAt ||
                                        view.snapshotX !== x ||
                                        view.snapshotY !== y ||
                                        view.vx !== vx ||
                                        view.vy !== vy ||
                                        view.targetA !== (b.a || 0);
                    if (isNewUpdate) {
                        view.snapshotX = x;
                        view.snapshotY = y;
                        view.vx = vx;
                        view.vy = vy;
                        view.targetX = x;
                        view.targetY = y;
                        view.targetA = b.a || 0;
                        view.receivedAt = Date.now();
                        view.lastSeen = Date.now();
                        view.lastUpdatedAt = b.updatedAt || 0;
                    }
                });
            }

            function updateBrBotViews() {
                if (isHost || !lobbyId) return;
                if (!br.botViews) br.botViews = {};
                Object.values(br.botViews).forEach(view => {
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

            function getBrRenderableBot(b) {
                if (isHost || !lobbyId) return b;
                if (!br.botViews) br.botViews = {};
                const view = br.botViews[b.id];
                return view ? Object.assign({}, b, {x: view.x, y: view.y, a: view.a}) : b;
            }

            function applyBrRemoteShot(p) {
                const seq = Number(p.shotSeq) || 0;
                if (!seq || br.remoteShotSeqs[p.id] === seq) return;
                br.remoteShotSeqs[p.id] = seq;
                playBrSound('shoot');
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
                if (brIsInvulnerable(p)) {
                    p.hp = Math.max(1, parseInt(p.maxHp) || BR_DEFAULT_HP);
                    p.alive = true;
                    return p;
                }
                const damageTaken = Math.max(parseInt(br.damageByPlayer[p.id]) || 0, parseInt(p.damageTaken) || 0);
                const maxHp = Math.max(1, parseInt(p.maxHp) || BR_DEFAULT_HP);
                const damageHp = Math.max(0, maxHp - damageTaken);
                const rawHp = p.hp === undefined ? damageHp : (parseInt(p.hp) || 0);
                p.hp = Math.min(rawHp, damageHp);
                p.alive = p.alive !== false && p.hp > 0;
                return p;
            }

            function syncBrPlayerState(includeHealth = false) {
                if (!br.active || !lobbyId || !br.myP || !br.teamInitialized) return;
                const now = Date.now();
                const dtFrames = Math.max(1, (now - (br.lastSyncAt || now)) / 16.67);
                br.myP.vx = (br.myP.x - br.lastSyncX) / dtFrames;
                br.myP.vy = (br.myP.y - br.lastSyncY) / dtFrames;
                br.lastSyncX = br.myP.x;
                br.lastSyncY = br.myP.y;
                br.lastSyncAt = now;
                db.ref(`lobbies/${lobbyId}/br/players/${myId}`).update(brPublicPlayerState(includeHealth)).catch(() => {});
            }

            function resizeBrCanvas() {
                const c = document.getElementById('br-canvas');
                if (!c) return null;
                const w = Math.max(1, Math.floor(window.innerWidth || c.clientWidth || 1));
                const h = Math.max(1, Math.floor(window.innerHeight || c.clientHeight || 1));
                if (c.width !== w) c.width = w;
                if (c.height !== h) c.height = h;
                return c;
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

                const scoreboard = document.getElementById('br-scoreboard');

                if (!br.matchActive) {
                    if (scoreboard) scoreboard.style.display = 'none';
                    const overlay = document.getElementById('so2-lobby-overlay');
                    if (overlay) overlay.style.display = 'flex';

                    let c = document.getElementById('br-canvas');
                    if (c) {
                        let ctx = c.getContext('2d');
                        ctx.fillStyle = '#0e1118';
                        ctx.fillRect(0, 0, c.width, c.height);
                    }
                    if (br.active) br.loop = requestAnimationFrame(brLoop);
                    return;
                }

                if (scoreboard) scoreboard.style.display = 'flex';

                const now = Date.now();

                // FPS Tracker for low performance mode
                if (!br._fpsLastUpdate) {
                    br._fpsLastUpdate = now;
                    br._fpsFrameCount = 0;
                    br.lowPerformanceMode = false;
                }
                br._fpsFrameCount++;
                if (now - br._fpsLastUpdate >= 1000) {
                    const fps = (br._fpsFrameCount * 1000) / (now - br._fpsLastUpdate);
                    br.lowPerformanceMode = (fps < 45);
                    br._fpsFrameCount = 0;
                    br._fpsLastUpdate = now;
                }

                updateBrLocalPlayer(now);
                updateBrRemotePlayerViews();
                updateBrBotViews();
                if (isHost || !lobbyId) updateBrBots(now);
                updateBrBullets(now);
                if (!br.settings || br.settings.shrinkZone !== false) br.zone.r = Math.max(50, br.zone.r - 0.2);
                renderBR(now);

                // Frame-by-frame tracker to play death sounds
                if (br.aliveTracker) {
                    // Track local player
                    if (br.myP) {
                        const wasAlive = br.aliveTracker[myId] !== false;
                        const isAlive = br.myP.hp > 0 && br.myP.alive && !br.isSpectator;
                        br.aliveTracker[myId] = isAlive;
                        if (wasAlive && !isAlive) {
                            playBrSound('death');
                        }
                    }

                    // Track remote players
                    Object.values(br.remotePlayers).forEach(p => {
                        const wasAlive = br.aliveTracker[p.id] !== false;
                        const isAlive = p.hp > 0 && p.alive;
                        br.aliveTracker[p.id] = isAlive;
                        if (wasAlive && !isAlive) {
                            playBrSound('death');
                        }
                    });

                    // Track bots
                    br.bots.forEach(b => {
                        const wasAlive = br.aliveTracker[b.id] !== false;
                        const isAlive = b.hp > 0 && b.alive;
                        br.aliveTracker[b.id] = isAlive;
                        if (wasAlive && !isAlive) {
                            playBrSound('death');
                        }
                    });
                }

                checkBrEnd();

                if (br.active) br.loop = requestAnimationFrame(brLoop);
            }

            function updateBrLocalPlayer(now) {
                 if (br.isSpectator || br.myP.hp <= 0) return;
                 const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                 
                 if (br.joystickTargetAngle !== null && br.joystickTargetAngle !== undefined) {
                     let sens = window.gameSensitivity !== undefined ? window.gameSensitivity : 5;
                     let step = 0.03 * sens;
                     let diff = br.joystickTargetAngle - br.myP.a;
                     diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                     if (Math.abs(diff) < step) {
                         br.myP.a = br.joystickTargetAngle;
                     } else {
                         br.myP.a += Math.sign(diff) * step;
                     }
                 }

                 let speed = 6 * brSpeedMultiplier(br.myP.speed);
                 const oldX = br.myP.x;
                 const oldY = br.myP.y;
                 let moveX = 0;
                 let moveY = 0;

                 const maxMapSize = (typeof currentMode !== 'undefined' && (currentMode === 'duel_1v1' || currentMode === 'duel_2v2')) ? 1200 : BR_SIZE;
                 const minX = (BR_SIZE - maxMapSize) / 2;
                 const maxX = minX + maxMapSize;
                 const minY = (BR_SIZE - maxMapSize) / 2;
                 const maxY = minY + maxMapSize;

                 if (isMobile) {
                     if (Math.abs(jx) > 5 || Math.abs(jy) > 5) {
                         moveX = Math.cos(br.myP.a) * speed;
                         moveY = Math.sin(br.myP.a) * speed;
                     }
                 } else {
                     let dx = 0, dy = 0;
                     if (brKeys['KeyW'] || brKeys['ArrowUp']) dy = -1;
                     if (brKeys['KeyS'] || brKeys['ArrowDown']) dy = 1;
                     if (brKeys['KeyA'] || brKeys['ArrowLeft']) dx = -1;
                     if (brKeys['KeyD'] || brKeys['ArrowRight']) dx = 1;
                     if (dx !== 0 || dy !== 0) {
                         let len = Math.hypot(dx, dy);
                         moveX = (dx / len) * speed;
                         moveY = (dy / len) * speed;
                     }
                 }

                 if (moveX !== 0) {
                     br.myP.x += moveX;
                     br.myP.x = Math.max(minX + BR_PLAYER_R, Math.min(maxX - BR_PLAYER_R, br.myP.x));
                     if (checkPlayerCollisionWithWalls(br.myP.x, br.myP.y, BR_PLAYER_R)) {
                         br.myP.x = oldX;
                     }
                 }
                 if (moveY !== 0) {
                     br.myP.y += moveY;
                     br.myP.y = Math.max(minY + BR_PLAYER_R, Math.min(maxY - BR_PLAYER_R, br.myP.y));
                     if (checkPlayerCollisionWithWalls(br.myP.x, br.myP.y, BR_PLAYER_R)) {
                         br.myP.y = oldY;
                     }
                 }

                 br.myP.vx = br.myP.x - oldX;
                 br.myP.vy = br.myP.y - oldY;

                 if (!brIsInvulnerable(br.myP, now) && Math.hypot(br.myP.x - br.zone.x, br.myP.y - br.zone.y) > br.zone.r) {
                     br.myP.hp -= 0.5;
                     br.serverHp = Math.min(br.serverHp, br.myP.hp);
                     syncBrPlayerState(true);
                 }
                 if (isShooting) fireBrShot(now);
            }

            function fireBrShot(now) {
                const mySettings = br.settings?.players?.[myId] || {};
                const cooldown = 1000 / Math.max(1, Math.min(10, parseInt(mySettings.ammoPerSec) || 1));
                if (!br.active || br.isSpectator || !br.myP || br.myP.hp <= 0 || now - lastShot <= cooldown) return;
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
                playBrSound('shoot');
            }

            function updateBrBots(now) {
                let changed = false;
                const maxMapSize = (typeof currentMode !== 'undefined' && (currentMode === 'duel_1v1' || currentMode === 'duel_2v2')) ? 1200 : BR_SIZE;
                const minX = (BR_SIZE - maxMapSize) / 2;
                const maxX = minX + maxMapSize;
                const minY = (BR_SIZE - maxMapSize) / 2;
                const maxY = minY + maxMapSize;

                br.bots.forEach(b => {
                    if (!b.alive || b.hp <= 0) return;
                    const level = Math.max(1, Math.min(3, parseInt(b.aiLevel) || 1));
                    let playerTargets = Object.values(br.remotePlayers).filter(p => p.alive && p.hp > 0 && brIsEnemyTarget(b.id, p));
                    if (br.myP && br.myP.alive && br.myP.hp > 0 && brIsEnemyTarget(b.id, br.myP)) {
                        playerTargets.push(br.myP);
                    }
                    const botTargets = br.bots.filter(other => other.id !== b.id && other.alive && other.hp > 0 && brIsEnemyTarget(b.id, other));
                    const targets = playerTargets.concat(botTargets);
                    const target = targets[Math.floor(Math.random() * targets.length)];

                    if (now > (b.nextThink || 0)) {
                        if (target && level === 3) {
                            b.tx = target.x;
                            b.ty = target.y;
                        } else {
                            const zoneMinX = Math.max(minX, br.zone.x - br.zone.r);
                            const zoneMaxX = Math.min(maxX, br.zone.x + br.zone.r);
                            const zoneMinY = Math.max(minY, br.zone.y - br.zone.r);
                            const zoneMaxY = Math.min(maxY, br.zone.y + br.zone.r);
                            b.tx = zoneMinX + Math.random() * (zoneMaxX - zoneMinX);
                            b.ty = zoneMinY + Math.random() * (zoneMaxY - zoneMinY);
                        }
                        b.nextThink = now + 1000 + Math.random() * 2000;
                        changed = true;
                    }
                    let dx = b.tx - b.x, dy = b.ty - b.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist > 10) {
                        b.a = Math.atan2(dy, dx);
                        const botSpeed = 2 * brSpeedMultiplier(b.speed);
                        const moveX = Math.cos(b.a) * botSpeed;
                        const moveY = Math.sin(b.a) * botSpeed;
                        b.vx = moveX;
                        b.vy = moveY;
                        const oldBx = b.x;
                        const oldBy = b.y;

                        if (moveX !== 0) {
                            b.x += moveX;
                            b.x = Math.max(minX + BR_PLAYER_R, Math.min(maxX - BR_PLAYER_R, b.x));
                            if (checkPlayerCollisionWithWalls(b.x, b.y, BR_PLAYER_R)) {
                                b.x = oldBx;
                                b.vx = 0;
                            }
                        }
                        if (moveY !== 0) {
                            b.y += moveY;
                            b.y = Math.max(minY + BR_PLAYER_R, Math.min(maxY - BR_PLAYER_R, b.y));
                            if (checkPlayerCollisionWithWalls(b.x, b.y, BR_PLAYER_R)) {
                                b.y = oldBy;
                                b.vy = 0;
                            }
                        }
                        changed = true;
                    } else {
                        b.vx = 0;
                        b.vy = 0;
                    }
                    if (Math.hypot(b.x - br.zone.x, b.y - br.zone.y) > br.zone.r) {
                        b.hp -= 0.5;
                        if (b.hp <= 0) b.alive = false;
                        changed = true;
                    }
                    if (target && level >= 2) {
                        const aim = level === 3 ? target : targets[Math.floor(Math.random() * targets.length)];
                        if (aim) {
                            b.a = Math.atan2((aim.y || b.y) - b.y, (aim.x || b.x) - b.x);
                            brBotTryShoot(b, now);
                        }
                    }
                    b.updatedAt = now;
                });
                if (changed && lobbyId) {
                    if (!br.lastBotSyncAt || now - br.lastBotSyncAt >= 80) {
                        db.ref(`lobbies/${lobbyId}/br/bots`).set(br.bots).catch(() => {});
                        br.lastBotSyncAt = now;
                    }
                }
            }

            function brBotTryShoot(bot, now) {
                const cooldown = 1000 / Math.max(1, Math.min(10, parseInt(bot.ammoPerSec) || 1));
                if (now < (bot.nextShot || 0)) return;
                bot.nextShot = now + cooldown;
                br.bullets.push({
                    x: bot.x + Math.cos(bot.a) * (BR_PLAYER_R + 8),
                    y: bot.y + Math.sin(bot.a) * (BR_PLAYER_R + 8),
                    vx: Math.cos(bot.a) * 16,
                    vy: Math.sin(bot.a) * 16,
                    owner: bot.id,
                    isBot: true,
                    createdAt: now
                });
                playBrSound('shoot');
            }

            function applyBrBotDamage(bot, amount, ownerId, ownerIsBot = false) {
                if ((lobbyId && !isHost) || !bot || !bot.alive || bot.hp <= 0) return;
                bot.hp -= amount;
                if (bot.hp <= 0) {
                    bot.hp = 0;
                    bot.alive = false;
                    if (ownerId === myId) {
                        br.kills++;
                        document.getElementById('br-ui-kills').innerText = `Киллы: ${br.kills}`;
                        syncBrPlayerState(false);
                    } else if (ownerIsBot) {
                        const killerBot = br.bots.find(b => b.id === ownerId);
                        if (killerBot) killerBot.kills = (parseInt(killerBot.kills) || 0) + 1;
                    } else if (ownerId && lobbyId) {
                        db.ref(`lobbies/${lobbyId}/br/players/${ownerId}/kills`).transaction(v => (parseInt(v) || 0) + 1).catch(() => {});
                    }
                }
                if (lobbyId) db.ref(`lobbies/${lobbyId}/br/bots`).set(br.bots).catch(() => {});
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

                    if (checkBulletCollisionWithWalls(bul.x, bul.y)) {
                        bulletHitWall(bul.x, bul.y);
                        br.bullets.splice(i, 1);
                        continue;
                    }

                    let hit = false;
                    br.bots.forEach(b => {
                        if (hit || !b.alive || b.hp <= 0) return;
                        if (!brIsEnemyTarget(bul.owner, b)) return;
                        if (brIsInvulnerable(b, now)) return;
                        const rb = getBrRenderableBot(b);
                        if (Math.hypot(bul.x - rb.x, bul.y - rb.y) < BR_PLAYER_R) {
                            hit = true;
                            applyBrBotDamage(b, 25, bul.owner, !!bul.isBot);
                            spawnBloodSplatter(bul.x, bul.y);
                            checkAndAddBloodDecal(rb, bul.x, bul.y);
                            if (bul.owner === myId) playBrSound('hit');
                        }
                    });

                    Object.values(br.remotePlayers).forEach(p => {
                        if (hit || (!bul.isBot && p.id === myId) || !p.alive || p.hp <= 0) return;
                        if (!brIsEnemyTarget(bul.owner, p)) return;
                        if (brIsInvulnerable(p, now)) return;
                        if (Math.hypot(bul.x - p.x, bul.y - p.y) < BR_PLAYER_R) {
                            hit = true;
                            spawnBloodSplatter(bul.x, bul.y);
                            checkAndAddBloodDecal(p, bul.x, bul.y);
                            if (bul.owner === myId || p.id === myId) playBrSound('hit');
                            const maxHp = Math.max(1, parseInt(p.maxHp) || BR_DEFAULT_HP);
                            const damageRef = db.ref(`lobbies/${lobbyId}/br/damage/${p.id}`);
                            damageRef.transaction(v => Math.min(maxHp, (parseInt(v) || 0) + 18)).then(res => {
                                const damageTaken = parseInt(res.snapshot.val()) || 0;
                                const nextHp = Math.max(0, maxHp - damageTaken);
                                br.damageByPlayer[p.id] = damageTaken;
                                p.damageTaken = damageTaken;
                                p.hp = nextHp;
                                p.alive = nextHp > 0;
                                db.ref(`lobbies/${lobbyId}/br/players/${p.id}`).update({ hp: nextHp, alive: nextHp > 0 }).catch(() => {});
                                if (p.id === myId && br.myP) {
                                    br.damageTaken = damageTaken;
                                    br.myP.hp = nextHp;
                                    br.myP.alive = nextHp > 0;
                                }
                                if (nextHp <= 0 && !bul.isBot) db.ref(`lobbies/${lobbyId}/br/players/${myId}/kills`).transaction(v => (parseInt(v) || 0) + 1).catch(() => {});
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

                    if (checkBulletCollisionWithWalls(x, y)) {
                        bulletHitWall(x, y);
                        delete br.remoteBullets[key];
                        return;
                    }

                    if (isHost) {
                        const hitBot = br.bots.some(b => {
                            if (!b || !b.alive || b.hp <= 0) return false;
                            if (!brIsEnemyTarget(bul.owner, b)) return false;
                            if (brIsInvulnerable(b, now)) return false;
                            if (Math.hypot(x - b.x, y - b.y) >= BR_PLAYER_R) return false;
                            applyBrBotDamage(b, 25, bul.owner, !!bul.isBot);
                            spawnBloodSplatter(x, y);
                            checkAndAddBloodDecal(b, x, y);
                            return true;
                        });
                        if (hitBot) {
                            delete br.remoteBullets[key];
                            return;
                        }
                    }

                    if (br.myP && br.myP.hp > 0 && brIsEnemyTarget(bul.owner, br.myP) && !brIsInvulnerable(br.myP, now) && Math.hypot(x - br.myP.x, y - br.myP.y) < BR_PLAYER_R) {
                        spawnBloodSplatter(x, y);
                        checkAndAddBloodDecal(br.myP, x, y);
                        playBrSound('hit');
                        delete br.remoteBullets[key];
                        return;
                    }

                    const hitRemote = Object.values(br.remotePlayers).some(p => {
                        if (!p || p.id === myId || p.id === bul.owner || !p.alive || p.hp <= 0) return false;
                        if (!brIsEnemyTarget(bul.owner, p)) return false;
                        if (brIsInvulnerable(p, now)) return false;
                        const rp = getBrRenderablePlayer(p);
                        const isHit = Math.hypot(x - rp.x, y - rp.y) < BR_PLAYER_R;
                        if (isHit) {
                            spawnBloodSplatter(x, y);
                            checkAndAddBloodDecal(rp, x, y);
                        }
                        return isHit;
                    });
                    if (hitRemote) delete br.remoteBullets[key];
                });
            }

            function renderBR(now) {
                let c = resizeBrCanvas();
                let ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
                ctx.save();

                if (br.isSpectator || br.myP.hp <= 0) {
                    const scale = Math.min(c.width / BR_SIZE, c.height / BR_SIZE);
                    const offsetX = (c.width - BR_SIZE * scale) / 2;
                    const offsetY = (c.height - BR_SIZE * scale) / 2;
                    ctx.translate(offsetX, offsetY);
                    ctx.scale(scale, scale);
                } else {
                    let targetSize = 600;
                    let scale = Math.min(c.width / targetSize, c.height / targetSize);
                    scale = Math.max(0.4, scale);
                    ctx.scale(scale, scale);
                    const camX = br.myP.x - (c.width / scale) / 2;
                    const camY = br.myP.y - (c.height / scale) / 2;
                    ctx.translate(-camX, -camY);
                }

                // Draw pre-rendered background canvas (includes grid, bases, walls, and blood stains)
                if (!br.bgCanvas) {
                    initBrBackgroundCanvas();
                }
                ctx.drawImage(br.bgCanvas, 0, 0);

                // Draw duel mode limits overlay if applicable
                if (typeof currentMode !== 'undefined' && (currentMode === 'duel_1v1' || currentMode === 'duel_2v2')) {
                    const maxMapSize = 1200;
                    const minX = (BR_SIZE - maxMapSize) / 2;
                    const minY = (BR_SIZE - maxMapSize) / 2;

                    // Semi-transparent dark overlay outside the duel zone
                    ctx.fillStyle = 'rgba(10, 10, 12, 0.65)';
                    ctx.fillRect(0, 0, BR_SIZE, minY);
                    ctx.fillRect(0, minY + maxMapSize, BR_SIZE, BR_SIZE - (minY + maxMapSize));
                    ctx.fillRect(0, minY, minX, maxMapSize);
                    ctx.fillRect(minX + maxMapSize, minY, BR_SIZE - (minX + maxMapSize), maxMapSize);

                    // Draw red border around the duel area
                    ctx.strokeStyle = '#ff3b30';
                    ctx.lineWidth = 6;
                    ctx.strokeRect(minX, minY, maxMapSize, maxMapSize);

                    ctx.strokeStyle = 'rgba(255, 59, 48, 0.15)';
                    ctx.lineWidth = 14;
                    ctx.strokeRect(minX, minY, maxMapSize, maxMapSize);
                }

                ctx.strokeStyle = 'rgba(255,0,0,0.8)';
                ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(br.zone.x, br.zone.y, br.zone.r, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,0,0,0.1)'; ctx.fill();

                // Draw smoke zones
                drawSmokeZones(ctx);

                // Draw and update blood particles
                updateAndDrawBloodParticles(ctx);

                // Local player visibility context (for smoke checks)
                const localAlive = br.myP && br.myP.alive && br.myP.hp > 0 && !br.isSpectator;

                // Draw bots with smoke transparency checks
                br.bots.filter(b => b.alive && b.hp > 0).forEach(b => {
                    const rb = getBrRenderableBot(b);
                    let alpha = 1.0;
                    if (localAlive && brIsEnemyTarget(myId, b)) {
                        if (br.smokeZones) {
                            for (let smoke of br.smokeZones) {
                                if (lineIntersectsCircle(br.myP.x, br.myP.y, rb.x, rb.y, smoke.x, smoke.y, smoke.r)) {
                                    alpha = 0.2;
                                    break;
                                }
                            }
                        }
                    }
                    const insideAlpha = getBrPlayerSmokeAlpha(rb.x, rb.y);
                    alpha = Math.min(alpha, insideAlpha);
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    drawBrFighter(ctx, rb, getFighterColor(b), b.label, b.maxHp || 150);
                    ctx.restore();
                });

                // Draw remote players with smoke transparency checks
                Object.values(br.remotePlayers).forEach(p => {
                    if (p.id !== myId && p.alive && p.hp > 0) {
                        const rp = getBrRenderablePlayer(p);
                        let alpha = 1.0;
                        if (localAlive && brIsEnemyTarget(myId, p)) {
                            if (br.smokeZones) {
                                for (let smoke of br.smokeZones) {
                                    if (lineIntersectsCircle(br.myP.x, br.myP.y, rp.x, rp.y, smoke.x, smoke.y, smoke.r)) {
                                        alpha = 0.2;
                                        break;
                                    }
                                }
                            }
                        }
                        const insideAlpha = getBrPlayerSmokeAlpha(rp.x, rp.y);
                        alpha = Math.min(alpha, insideAlpha);
                        ctx.save();
                        ctx.globalAlpha = alpha;
                        drawBrFighter(ctx, rp, getFighterColor(p), p.name || 'Игрок', p.maxHp || BR_DEFAULT_HP);
                        ctx.restore();
                    }
                });

                // Draw local player
                if (br.myP.hp > 0) {
                    ctx.save();
                    const localAlpha = getBrPlayerSmokeAlpha(br.myP.x, br.myP.y);
                    ctx.globalAlpha = localAlpha;
                    if (brIsInvulnerable(br.myP, now)) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.beginPath(); ctx.arc(br.myP.x, br.myP.y, BR_PLAYER_R + 10, 0, Math.PI * 2); ctx.fill();
                    }
                    drawBrFighter(ctx, br.myP, getFighterColor(br.myP), myName, br.myP.maxHp || BR_DEFAULT_HP);
                    ctx.restore();
                }

                // Draw local bullets with tracers
                br.bullets.forEach(bul => {
                    drawBulletWithTracer(ctx, bul.x, bul.y, bul.vx, bul.vy);
                });

                // Draw remote bullets with tracers
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
                    drawBulletWithTracer(ctx, x, y, Number(bul.vx) || 0, Number(bul.vy) || 0);
                });
                ctx.restore();

                const aliveCount = getBrAliveRows().length;
                document.getElementById('br-ui-alive').innerText = `Живых: ${aliveCount}`;
                updateBrScoreboard();
            }

            function updateBrScoreboard() {
                if (!br.active || !br.matchActive) return;

                let ctKills = 0;
                let tKills = 0;

                if (br.myP) {
                    const team = brNormalizeTeam(br.myP.team);
                    if (team === 'Counter-Terrorists') ctKills += br.kills || 0;
                    else if (team === 'Terrorists') tKills += br.kills || 0;
                }

                Object.values(br.remotePlayers).forEach(p => {
                    const team = brNormalizeTeam(p.team);
                    if (team === 'Counter-Terrorists') ctKills += p.kills || 0;
                    else if (team === 'Terrorists') tKills += p.kills || 0;
                });

                br.bots.forEach(b => {
                    const team = brNormalizeTeam(b.team);
                    if (team === 'Counter-Terrorists') ctKills += b.kills || 0;
                    else if (team === 'Terrorists') tKills += b.kills || 0;
                });

                const ctEl = document.getElementById('br-ct-score-val');
                const tEl = document.getElementById('br-t-score-val');
                if (ctEl) ctEl.innerText = ctKills;
                if (tEl) tEl.innerText = tKills;

                const elapsedMs = Date.now() - br.matchStartTime;
                const totalSec = Math.floor(elapsedMs / 1000);
                const minutes = Math.floor(totalSec / 60);
                const seconds = totalSec % 60;
                const timeStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

                const timerValEl = document.getElementById('br-match-timer-val');
                if (timerValEl) timerValEl.innerText = timeStr;

                const timerLabelEl = document.getElementById('br-match-timer-label');
                if (timerLabelEl) {
                    let label = 'MATCH';
                    if (typeof currentMode !== 'undefined') {
                        if (currentMode === 'tdm_5v5') label = 'TDM 5V5';
                        else if (currentMode === 'duel_1v1') label = 'DUEL 1V1';
                        else if (currentMode === 'duel_2v2') label = 'DUEL 2V2';
                    }
                    timerLabelEl.innerText = label;
                }
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
                    rows.push({ id: p.id, name: p.name || 'Игрок', team: brNormalizeTeam(p.team), kills: p.kills || 0, alive: !!p.alive && (p.hp || 0) > 0 });
                });
                br.bots.forEach(b => rows.push({ id: b.id, name: b.label || b.id, team: brNormalizeTeam(b.team), kills: b.kills || 0, alive: !!b.alive && (b.hp || 0) > 0 }));
                return rows.filter(r => r.alive);
            }

            function brWinningTeamForAliveRows(alive) {
                if (!alive.length) return '';
                const firstTeam = brNormalizeTeam(alive[0].team);
                if (!firstTeam) return alive.length === 1 ? '' : null;
                return alive.every(r => brNormalizeTeam(r.team) === firstTeam) ? firstTeam : null;
            }

            function checkBrEnd() {
                if (Date.now() - br.matchStartTime < 4000) return;
                if (br.placeShown) return;
                if (br.myP.hp <= 0) {
                    enterBrSpectator();
                }
                if (br.freeRoam) return;
                const alive = getBrAliveRows();
                const myTeam = brNormalizeTeam(br.myP.team);
                const winnerTeam = brWinningTeamForAliveRows(alive);
                const mySideAlive = alive.some(r => r.id === myId || (!!myTeam && brNormalizeTeam(r.team) === myTeam));
                if (br.isSpectator) {
                    if (alive.length <= 1 || winnerTeam !== null) showBrFinal(false, winnerTeam || '');
                } else if (alive.length <= 1 && alive.some(r => r.id === myId)) {
                    showBrFinal(true, '');
                } else if (winnerTeam !== null && mySideAlive) {
                    showBrFinal(true, winnerTeam);
                }
            }

            function enterBrSpectator() {
                if (br.isSpectator || !br.myP) return;
                br.isSpectator = true;
                br.myP.alive = false;
                br.myP.hp = 0;
                br.serverHp = 0;
                shootTouch = null;
                isShooting = false;
                syncBrPlayerState(true);
                const controls = document.getElementById('br-controls');
                if (controls) controls.style.display = 'none';
                const spectatorLabel = document.getElementById('br-ui-spectator');
                if (spectatorLabel) spectatorLabel.style.display = 'block';
                setIsland("Ты выбыл. Наблюдение до конца матча.", "#ff9f0a");
            }

            function showBrFinal(isWin, winnerTeam = '') {
                br.placeShown = true;
                br.active = false;
                const spectatorLabel = document.getElementById('br-ui-spectator');
                if (spectatorLabel) spectatorLabel.style.display = 'none';
                const allRows = Object.values(br.remotePlayers)
                    .map(p => ({ id: p.id, name: p.name || 'Игрок', team: brNormalizeTeam(p.team), kills: p.kills || 0, alive: !!p.alive && (p.hp || 0) > 0 }))
                    .concat(br.bots.map(b => ({ id: b.id, name: b.label || b.id, team: brNormalizeTeam(b.team), kills: b.kills || 0, alive: !!b.alive && (b.hp || 0) > 0 })))
                    .sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills);

                const winner = allRows[0] || {name: myName, kills: br.kills};
                const winnerLabel = winnerTeam ? `КОМАНДА ${winnerTeam}` : escapeHTML(winner.name);
                let ds = document.getElementById('br-death-screen');
                ds.style.display = 'flex';
                document.getElementById('br-death-title').innerText = isWin ? 'ПОБЕДА!' : 'МАТЧ ОКОНЧЕН';
                document.getElementById('br-death-title').style.color = isWin ? '#ffd60a' : '#ff453a';
                document.getElementById('br-death-sub').innerHTML = `
                    <div class="br-final-winner">ПОБЕДИТЕЛЬ: ${winnerLabel} - ${winner.kills || 0} КИЛЛОВ</div>
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
                 const scoreboard = document.getElementById('br-scoreboard');
                 if (scoreboard) scoreboard.style.display = 'none';
                 if (lobbyId) {
                     if (br.matchActiveListener) {
                         db.ref(`lobbies/${lobbyId}/br/matchActive`).off('value', br.matchActiveListener);
                         br.matchActiveListener = null;
                     }
                     if (br.wallsListener) {
                         db.ref(`lobbies/${lobbyId}/br/walls`).off('value', br.wallsListener);
                     }
                     if (br.smokesListener) {
                         db.ref(`lobbies/${lobbyId}/br/smokes`).off('value', br.smokesListener);
                     }
                     if (isHost) {
                         db.ref(`lobbies/${lobbyId}/br/matchActive`).remove().catch(() => {});
                         db.ref(`lobbies/${lobbyId}/br/walls`).remove().catch(() => {});
                         db.ref(`lobbies/${lobbyId}/br/smokes`).remove().catch(() => {});
                     }
                     if (br.playersListener) db.ref(`lobbies/${lobbyId}/br/players`).off('value', br.playersListener);
                     if (br.shotsListener) db.ref(`lobbies/${lobbyId}/br/players`).off('child_changed', br.shotsListener);
                     if (br.damageListener) db.ref(`lobbies/${lobbyId}/br/damage`).off('value', br.damageListener);
                     if (br.botsListener) db.ref(`lobbies/${lobbyId}/br/bots`).off('value', br.botsListener);
                     if (!br.placeShown && br.matchActive === true) {
                         db.ref(`lobbies/${lobbyId}/br/players/${myId}`).update({alive: false, hp: 0}).catch(() => {});
                     }
                 }
                 br.matchActive = false;
                 br.syncTimer = null;
                 br.playersListener = null;
                 br.shotsListener = null;
                 br.damageListener = null;
                 br.botsListener = null;
                 br.wallsListener = null;
                 br.smokesListener = null;
                 shootTouch = null;
                 isShooting = false;
                 br.bloodStains = [];
                 br.bloodParticles = [];
                 br.smokeZones = [];
                 br.bgCanvas = null;
                 br.bgCtx = null;
                 br.botViews = {};
                 br.lastBotSyncAt = null;
             }
