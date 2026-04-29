            // ================== ВЫЖИВАНИЕ (BATTLE ROYALE) ==================
            let br = { active: false, myP: null, bots: [], bullets: [], zone: {x: 1000, y: 1000, r: 2000}, loop: null, kills: 0 };
            const BR_SIZE = 2000; 
            const BR_PLAYER_R = 20;
            let joyTouch = null, jx = 0, jy = 0, isShooting = false, lastShot = 0;

            function initBR() {
                br.active = true; 
                br.kills = 0; 
                br.zone = { x: BR_SIZE / 2, y: BR_SIZE / 2, r: BR_SIZE };
                br.myP = { x: Math.random() * (BR_SIZE - 200) + 100, y: Math.random() * (BR_SIZE - 200) + 100, hp: 200, a: 0, invuln: Date.now() + 3000 };
                br.bots = []; 
                br.bullets = [];
                
                for (let i = 0; i < 5; i++) {
                    br.bots.push({ 
                        id: 'bot' + i, 
                        x: Math.random() * (BR_SIZE - 200) + 100, 
                        y: Math.random() * (BR_SIZE - 200) + 100, 
                        hp: 150, 
                        a: 0, 
                        tx: BR_SIZE / 2, 
                        ty: BR_SIZE / 2, 
                        nextThink: 0 
                    });
                }
                
                document.getElementById('br-ui-alive').innerText = `Живых: ${br.bots.length + 1}`;
                document.getElementById('br-ui-kills').innerText = `Киллы: 0`;
                document.getElementById('br-death-screen').style.display = 'none';

                let c = document.getElementById('br-canvas');
                c.width = window.innerWidth; 
                c.height = window.innerHeight;
                
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (!isMobile) {
                    document.getElementById('br-controls').style.display = 'none';
                } else {
                    document.getElementById('br-controls').style.display = 'flex';
                    const jBox = document.getElementById('br-joystick');
                    const jStick = document.getElementById('br-stick');
                    jStick.style.transform = `translate(0px, 0px)`;
                    
                    jBox.ontouchstart = jBox.onmousedown = (e) => { 
                        e.preventDefault(); 
                        let ev = e.touches ? e.touches[0] : e; 
                        joyTouch = ev.identifier || 'm'; 
                        updateJoy(ev); 
                    };
                    
                    jBox.ontouchmove = jBox.onmousemove = (e) => { 
                        if (!joyTouch) return; 
                        let ev = e.touches ? Array.from(e.touches).find(t => t.identifier === joyTouch) : e; 
                        if (ev) updateJoy(ev); 
                    };
                    
                    jBox.ontouchend = jBox.onmouseup = jBox.onmouseleave = (e) => { 
                        joyTouch = null; jx = 0; jy = 0; 
                        jStick.style.transform = `translate(0px, 0px)`; 
                    };
                    
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

                br.loop = requestAnimationFrame(brLoop);
            }

            function brStartShoot(e) { 
                e.preventDefault(); e.stopPropagation(); 
                isShooting = true; 
            }

            function brStopShoot(e) { 
                e.preventDefault(); e.stopPropagation(); 
                isShooting = false; 
            }

            function brLoop() {
                if (!br.active || appState.isPaused) return;
                
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                // Player logic
                if (br.myP.hp > 0) {
                    let speed = 6;
                    
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

                    if (isShooting && Date.now() - lastShot > 250) {
                        br.bullets.push({
                            x: br.myP.x, 
                            y: br.myP.y, 
                            vx: Math.cos(br.myP.a) * 20, 
                            vy: Math.sin(br.myP.a) * 20, 
                            owner: 'me'
                        });
                        lastShot = Date.now();
                    }
                    
                    if (Math.hypot(br.myP.x - br.zone.x, br.myP.y - br.zone.y) > br.zone.r) { 
                        br.myP.hp -= 0.5; 
                    }
                }

                // Bots logic
                let now = Date.now();
                br.bots.forEach(b => {
                    if (b.hp <= 0) return;
                    
                    if (now > b.nextThink) {
                        if (Math.random() > 0.5 && br.myP.hp > 0 && Math.hypot(b.x - br.myP.x, b.y - br.myP.y) < 600) {
                            b.tx = br.myP.x; 
                            b.ty = br.myP.y;
                        } else {
                            b.tx = br.zone.x + (Math.random() * br.zone.r - br.zone.r / 2);
                            b.ty = br.zone.y + (Math.random() * br.zone.r - br.zone.r / 2);
                        }
                        b.nextThink = now + 1000 + Math.random() * 2000;
                    }
                    
                    let dx = b.tx - b.x; 
                    let dy = b.ty - b.y;
                    let dist = Math.hypot(dx, dy);
                    
                    if (dist > 10) { 
                        b.a = Math.atan2(dy, dx); 
                        b.x += Math.cos(b.a) * 2; 
                        b.y += Math.sin(b.a) * 2; 
                    }
                    
                    if (Math.hypot(b.x - br.myP.x, b.y - br.myP.y) < 600 && Math.random() < 0.03 && br.myP.hp > 0 && now > br.myP.invuln) {
                        let aimA = Math.atan2(br.myP.y - b.y, br.myP.x - b.x) + (Math.random() * 0.4 - 0.2);
                        br.bullets.push({
                            x: b.x, y: b.y, vx: Math.cos(aimA)*15, vy: Math.sin(aimA)*15, owner: b.id
                        });
                    }
                    
                    if (Math.hypot(b.x - br.zone.x, b.y - br.zone.y) > br.zone.r) { 
                        b.hp -= 0.5; 
                    }
                });

                // Bullets logic
                for (let i = br.bullets.length - 1; i >= 0; i--) {
                    let bul = br.bullets[i]; 
                    bul.x += bul.vx; 
                    bul.y += bul.vy;
                    
                    if (bul.x < 0 || bul.x > BR_SIZE || bul.y < 0 || bul.y > BR_SIZE) { 
                        br.bullets.splice(i, 1); 
                        continue; 
                    }
                    
                    let hit = false;
                    if (bul.owner !== 'me' && br.myP.hp > 0 && now > br.myP.invuln && Math.hypot(bul.x - br.myP.x, bul.y - br.myP.y) < BR_PLAYER_R) {
                        br.myP.hp -= 15; 
                        hit = true;
                    }
                    if (!hit && bul.owner === 'me') {
                        for (let j = 0; j < br.bots.length; j++) {
                            let b = br.bots[j];
                            if (b.hp > 0 && Math.hypot(bul.x - b.x, bul.y - b.y) < BR_PLAYER_R) {
                                b.hp -= 25; 
                                hit = true;
                                if (b.hp <= 0) { 
                                    br.kills++; 
                                    document.getElementById('br-ui-kills').innerText = `Киллы: ${br.kills}`; 
                                }
                                break;
                            }
                        }
                    }
                    if (hit) br.bullets.splice(i, 1);
                }

                br.bots = br.bots.filter(b => b.hp > 0);
                br.zone.r = Math.max(50, br.zone.r - 0.2); 

                // Render Graphics
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

                br.bots.forEach(b => {
                    ctx.fillStyle = '#ff453a'; 
                    ctx.beginPath(); ctx.arc(b.x, b.y, BR_PLAYER_R, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'black'; ctx.lineWidth = 3; 
                    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.a) * 30, b.y + Math.sin(b.a) * 30); ctx.stroke();
                    ctx.fillStyle = '#111'; ctx.fillRect(b.x - 20, b.y - 30, 40, 6); 
                    ctx.fillStyle = '#34c759'; ctx.fillRect(b.x - 20, b.y - 30, 40 * (b.hp / 150), 6);
                });

                if (br.myP.hp > 0) {
                    if(now < br.myP.invuln) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.beginPath(); ctx.arc(br.myP.x, br.myP.y, BR_PLAYER_R + 10, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.fillStyle = '#3390ec'; 
                    ctx.beginPath(); ctx.arc(br.myP.x, br.myP.y, BR_PLAYER_R, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'black'; ctx.lineWidth = 4; 
                    ctx.beginPath(); ctx.moveTo(br.myP.x, br.myP.y); ctx.lineTo(br.myP.x + Math.cos(br.myP.a) * 35, br.myP.y + Math.sin(br.myP.a) * 35); ctx.stroke();
                    ctx.fillStyle = '#111'; ctx.fillRect(br.myP.x - 20, br.myP.y - 30, 40, 6); 
                    ctx.fillStyle = '#34c759'; ctx.fillRect(br.myP.x - 20, br.myP.y - 30, 40 * (br.myP.hp / 200), 6);
                }

                ctx.fillStyle = '#ffd60a';
                br.bullets.forEach(bul => { ctx.beginPath(); ctx.arc(bul.x, bul.y, 4, 0, Math.PI * 2); ctx.fill(); });

                ctx.restore();

                document.getElementById('br-ui-alive').innerText = `Живых: ${br.bots.length + (br.myP.hp > 0 ? 1 : 0)}`;

                if (br.myP.hp <= 0 && br.active) {
                    br.active = false;
                    let ds = document.getElementById('br-death-screen');
                    ds.style.display = 'flex';
                    document.getElementById('br-death-title').innerText = "ПОТРАЧЕНО";
                    document.getElementById('br-death-title').style.color = "#ff453a";
                    document.getElementById('br-death-sub').innerText = `Топ: ${br.bots.length + 1}\nКиллы: ${br.kills}`;
                    addCoins(br.kills * 5);
                } else if (br.bots.length === 0 && br.active) {
                    br.active = false;
                    let ds = document.getElementById('br-death-screen');
                    ds.style.display = 'flex';
                    document.getElementById('br-death-title').innerText = "ТОП-1 ПОБЕДА!";
                    document.getElementById('br-death-title').style.color = "#ffd60a";
                    document.getElementById('br-death-sub').innerText = `Киллы: ${br.kills}\n+${50 + br.kills * 5} 🪙`;
                    addCoins(50 + br.kills * 5);
                }

                if (br.active) br.loop = requestAnimationFrame(brLoop);
            }

            function stopBR() { 
                br.active = false; 
                cancelAnimationFrame(br.loop); 
            }
