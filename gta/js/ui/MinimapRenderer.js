/**
         * STEP 40: Модернизированная стилизованная 2D-миникарта HUD (GTA V Vector Minimap)
         * - Стилизованная отрисовка 2D-карты: темный океан (#0c1a2d), суша темно-серая (#1e242d),
         *   утолщенные цветные дороги (шоссе, городская сетка, грунтовые сельские трассы).
         * - Динамические маркеры (Blips):
         *   1. Белая стрелка игрока в центре с точным углом поворота (Player White Arrow).
         *   2. Синяя звезда для полицейского департамента (LSPD Star Blip '★').
         *   3. Красный крест для медицинского центра (Pillbox Medical Cross '✚').
         *   4. Зеленый значок доллара для банка (Maze Bank '$').
         * - Бесшовное вращение карты в реальном времени вслед за камерой игрока (Camera Yaw).
         */
        class MinimapRenderer {
            constructor(isMobile = false) {
                this.canvas = document.getElementById('minimap-canvas');
                this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
                this.isMobile = isMobile;
                this.frameSkip = 0;
                this.width = 176;
                this.height = 176;
                this.centerX = 88;
                this.centerY = 88;
                this.radius = 84;
                this.scale = 0.92;

                this.initStaticMap();
            }

            initStaticMap() {
                // Создаем оффскрин-холст для статичной карты острова, дорог и ориентиров
                const mapSize = Math.ceil(500 * this.scale);
                this.staticCanvas = document.createElement('canvas');
                this.staticCanvas.width = mapSize;
                this.staticCanvas.height = mapSize;
                this.staticOrigin = mapSize / 2;

                const sctx = this.staticCanvas.getContext('2d');
                sctx.translate(this.staticOrigin, this.staticOrigin);

                // Суша острова
                sctx.fillStyle = '#1e242d';
                sctx.fillRect(-220 * this.scale, -220 * this.scale, 440 * this.scale, 440 * this.scale);
                sctx.strokeStyle = '#334155';
                sctx.lineWidth = 2.0;
                sctx.strokeRect(-220 * this.scale, -220 * this.scale, 440 * this.scale, 440 * this.scale);

                // Сетка секторов
                const sectorW = 60.0 * this.scale;
                const sectorH = 60.0 * this.scale;
                const originX = -150.0 * this.scale;
                const originZ = -120.0 * this.scale;

                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 5; c++) {
                        const sx = originX + c * sectorW;
                        const sz = originZ + r * sectorH;
                        const sId = r * 5 + c + 1;

                        sctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
                        sctx.fillRect(sx, sz, sectorW, sectorH);
                        sctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                        sctx.lineWidth = 0.8;
                        sctx.strokeRect(sx, sz, sectorW, sectorH);

                        sctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        sctx.font = 'bold 8px Courier New, monospace';
                        sctx.textAlign = 'left';
                        sctx.textBaseline = 'top';
                        sctx.fillText(String(sId).padStart(2, '0'), sx + 3, sz + 3);
                    }
                }

                // Дорожная сеть
                const gridRadius = 3;
                const BLOCK = 60.0 * this.scale;
                const maxCoord = gridRadius * BLOCK;

                sctx.strokeStyle = '#0f172a';
                sctx.lineWidth = 8.5;
                sctx.beginPath();
                for (let i = -gridRadius; i <= gridRadius; i++) {
                    const pos = i * BLOCK;
                    sctx.moveTo(-maxCoord, pos); sctx.lineTo(maxCoord, pos);
                    sctx.moveTo(pos, -maxCoord); sctx.lineTo(pos, maxCoord);
                }
                sctx.stroke();

                sctx.strokeStyle = '#94a3b8';
                sctx.lineWidth = 5.2;
                sctx.beginPath();
                for (let i = -gridRadius; i <= gridRadius; i++) {
                    const pos = i * BLOCK;
                    sctx.moveTo(-maxCoord, pos); sctx.lineTo(maxCoord, pos);
                    sctx.moveTo(pos, -maxCoord); sctx.lineTo(pos, maxCoord);
                }
                sctx.stroke();

                // Ориентиры POI
                // Банк Maze Bank ($)
                const bankX = 0 * this.scale;
                const bankZ = 60 * this.scale;
                sctx.fillStyle = '#16a34a';
                sctx.beginPath();
                sctx.arc(bankX, bankZ, 9.5, 0, Math.PI * 2);
                sctx.fill();
                sctx.strokeStyle = '#ffffff';
                sctx.lineWidth = 1.8;
                sctx.stroke();
                sctx.fillStyle = '#ffffff';
                sctx.font = 'bold 12px Arial Black, Arial, sans-serif';
                sctx.textAlign = 'center';
                sctx.textBaseline = 'middle';
                sctx.fillText('$', bankX, bankZ + 0.5);

                // LSPD (★)
                const lspdX = -60 * this.scale;
                const lspdZ = 60 * this.scale;
                sctx.fillStyle = '#1e40af';
                sctx.beginPath();
                sctx.arc(lspdX, lspdZ, 9.5, 0, Math.PI * 2);
                sctx.fill();
                sctx.strokeStyle = '#ffffff';
                sctx.lineWidth = 1.8;
                sctx.stroke();
                this.drawStar(sctx, lspdX, lspdZ, 5, 5.5, 2.5, '#60a5fa', null);

                // Госпиталь (✚)
                const hospX = 60 * this.scale;
                const hospZ = 60 * this.scale;
                sctx.fillStyle = '#dc2626';
                sctx.beginPath();
                sctx.arc(hospX, hospZ, 9.5, 0, Math.PI * 2);
                sctx.fill();
                sctx.strokeStyle = '#ffffff';
                sctx.lineWidth = 1.8;
                sctx.stroke();
                this.drawCross(sctx, hospX, hospZ, 7.5, '#ffffff', null);
            }

            drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fill, stroke) {
                let rot = Math.PI / 2 * 3;
                let x = cx;
                let y = cy;
                const step = Math.PI / spikes;

                ctx.beginPath();
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    x = cx + Math.cos(rot) * outerRadius;
                    y = cy + Math.sin(rot) * outerRadius;
                    ctx.lineTo(x, y);
                    rot += step;

                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                }
                ctx.lineTo(cx, cy - outerRadius);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                if (stroke) {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }

            drawCross(ctx, cx, cy, size, fill, stroke) {
                const w = size;
                const thick = size * 0.38;
                ctx.beginPath();
                ctx.rect(cx - thick / 2, cy - w / 2, thick, w);
                ctx.rect(cx - w / 2, cy - thick / 2, w, thick);
                ctx.fillStyle = fill;
                ctx.fill();
                if (stroke) {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            }

            render(playerPos, cameraYaw, allCars, allNPCs, soccerBalls) {
                if (!this.ctx || !playerPos) return;

                if (this.isMobile) {
                    this.frameSkip++;
                    if (this.frameSkip % 2 !== 0) return;
                }

                const ctx = this.ctx;

                ctx.clearRect(0, 0, this.width, this.height);

                // 1. Ограничение круглой маской миникарты
                ctx.save();
                ctx.beginPath();
                ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
                ctx.clip();

                // 2. Фон: Океан
                ctx.fillStyle = '#0c1a2d';
                ctx.fillRect(0, 0, this.width, this.height);

                // 3. Мировая система координат (Трансляция и вращение вслед за камерой)
                ctx.save();
                ctx.translate(this.centerX, this.centerY);
                ctx.rotate(cameraYaw);
                ctx.translate(-playerPos.x * this.scale, -playerPos.z * this.scale);

                // 4. Отрисовка предрассчитанной статичной карты в 1 вызов drawImage (60 FPS Boost)
                if (this.staticCanvas) {
                    ctx.drawImage(this.staticCanvas, -this.staticOrigin, -this.staticOrigin);
                }

                // 7. Отрисовка футбольных мячей
                if (soccerBalls) {
                    ctx.fillStyle = '#ffffff';
                    for (let i = 0; i < soccerBalls.length; i++) {
                        const b = soccerBalls[i].body.position;
                        ctx.beginPath();
                        ctx.arc(b.x * this.scale, b.z * this.scale, 2.4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }

                // 8. Отрисовка пешеходов NPC
                if (allNPCs) {
                    for (let i = 0; i < allNPCs.length; i++) {
                        const npc = allNPCs[i];
                        if (!npc.body) continue;
                        const np = npc.body.position;
                        ctx.fillStyle = npc.npcType === 'SOCCER_PLAYER' ? '#2ecc71' : (npc.state === 'PANIC' ? '#ef4444' : '#fbbf24');
                        ctx.beginPath();
                        ctx.arc(np.x * this.scale, np.z * this.scale, 2.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // 9. Отрисовка автомобилей AI-трафика и шоукейса
                if (allCars) {
                    for (let i = 0; i < allCars.length; i++) {
                        const car = allCars[i];
                        const cp = car.chassisBody.position;
                        const cyaw = car.carGroup ? car.carGroup.rotation.y : 0;

                        ctx.save();
                        ctx.translate(cp.x * this.scale, cp.z * this.scale);
                        ctx.rotate(cyaw);

                        // Корпус авто
                        ctx.fillStyle = '#06b6d4';
                        ctx.fillRect(-2.0, -4.2, 4.0, 8.4);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(-1.6, 1.8, 3.2, 1.8);
                        ctx.restore();
                    }
                }

                ctx.restore(); // Конец мировой системы координат

                // 10. Радарная разметка (Concentric Distance Rings & Crosshairs)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(this.centerX, 4); ctx.lineTo(this.centerX, this.height - 4);
                ctx.moveTo(4, this.centerY); ctx.lineTo(this.width - 4, this.centerY);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(this.centerX, this.centerY, 36, 0, Math.PI * 2);
                ctx.arc(this.centerX, this.centerY, 64, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // 11. Белая стрелка игрока в центре (White Player Rotation Arrow)
                const isDriving = (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null);
                let playerYawWorld = 0;
                if (isDriving) {
                    const car = window.gameEngine.vehicleManager.activeDrivenCar;
                    playerYawWorld = car.carGroup ? car.carGroup.rotation.y : 0;
                } else if (window.gameEngine && window.gameEngine.player && window.gameEngine.player.mesh) {
                    playerYawWorld = window.gameEngine.player.mesh.rotation.y;
                }

                // Угол направления взгляда/движения персонажа относительно камеры на миникарте
                const playerRelativeAngle = (-playerYawWorld + Math.PI) + cameraYaw;

                ctx.save();
                ctx.translate(this.centerX, this.centerY);
                ctx.rotate(playerRelativeAngle);

                // Тень стрелки
                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                // Белая треугольная стрелка в стиле GTA V
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(0, -10.5);
                ctx.lineTo(7.5, 7.5);
                ctx.lineTo(0, 4.5);
                ctx.lineTo(-7.5, 7.5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                // 12. Компас: Красный указатель Севера 'N'
                const compassAngle = cameraYaw - Math.PI / 2;
                const compX = this.centerX + Math.cos(compassAngle) * (this.radius - 11);
                const compY = this.centerY + Math.sin(compassAngle) * (this.radius - 11);

                ctx.fillStyle = '#ef4444';
                ctx.font = '900 11px Arial Black, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N', compX, compY);

                // Внешний декоративный ободок миникарты
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 3.0;
                ctx.beginPath();
                ctx.arc(this.centerX, this.centerY, this.radius - 1.5, 0, Math.PI * 2);
                ctx.stroke();

                ctx.restore(); // Конец маски
            }
        }
