class FullMapRenderer {
    constructor() {
        this.modal = document.getElementById('full-map-modal');
        this.canvas = document.getElementById('full-map-canvas');
        this.ctx = (this.canvas && typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;
        this.isOpen = false;
        this.btnClose = document.getElementById('btn-close-map');

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.toggle(false));
        }

        this.initInteractions();
    }

    initInteractions() {
        if (!this.canvas) return;

        // Обработка клика ЛКМ (установка навигации) и ПКМ (сброс навигации)
        this.canvas.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleMapClick(e);
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.gameEngine && window.gameEngine.flightNavigation) {
                window.gameEngine.flightNavigation.clearTarget();
                this.render();
            }
        });
    }

    handleMapClick(e) {
        if (!this.canvas || !window.gameEngine) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        const nav = window.gameEngine.flightNavigation;
        if (!nav) return;

        // 1. Проверяем клик по союзникам (RemotePlayers)
        if (window.gameEngine.multiplayerManager) {
            const remotes = window.gameEngine.multiplayerManager.getRemotePlayersArray();
            for (let i = 0; i < remotes.length; i++) {
                const rp = remotes[i];
                const rPos = this.worldToMap(rp.x, rp.z);
                const dist = Math.hypot(clickX - rPos.x, clickY - rPos.y);
                if (dist < 18.0) {
                    nav.setTarget(rp.x, rp.z, rp.y, `Тиммейт: ${rp.nickname || 'Player'}`, rp.id);
                    this.render();
                    return;
                }
            }
        }

        // 2. Проверяем клик по зданиям
        const buildings = [
            { x: 0, z: 0, w: 22, d: 22, name: 'Maze Bank Tower (Крыша)' },
            { x: -60, z: 60, w: 28, d: 24, name: 'Полицейский участок LSPD' },
            { x: 60, z: 60, w: 26, d: 22, name: 'Госпиталь Pillbox Hill (Helipad)' },
            { x: -60, z: -60, w: 18, d: 18, name: 'Коттеджный квартал 1' },
            { x: 60, z: -60, w: 18, d: 18, name: 'Коттеджный квартал 2' },
            { x: -120, z: 60, w: 32, d: 20, name: 'Промзона / Склады' },
            { x: 120, z: 60, w: 32, d: 20, name: 'Заводской терминал' }
        ];

        for (const b of buildings) {
            const bp = this.worldToMap(b.x - b.w/2, b.z - b.d/2);
            const bp2 = this.worldToMap(b.x + b.w/2, b.z + b.d/2);
            const minX = Math.min(bp.x, bp2.x);
            const maxX = Math.max(bp.x, bp2.x);
            const minY = Math.min(bp.y, bp2.y);
            const maxY = Math.max(bp.y, bp2.y);

            if (clickX >= minX && clickX <= maxX && clickY >= minY && clickY <= maxY) {
                nav.setTarget(b.x, b.z, null, b.name);
                this.render();
                return;
            }
        }

        // 3. Клик в любую свободную точку на карте
        const worldCoord = this.mapToWorld(clickX, clickY);
        nav.setTarget(worldCoord.x, worldCoord.z, null, `Координаты [${Math.round(worldCoord.x)}, ${Math.round(worldCoord.z)}]`);
        this.render();
    }

    toggle(forceState) {
        if (typeof forceState === 'boolean') {
            this.isOpen = forceState;
        } else {
            this.isOpen = !this.isOpen;
        }

        if (this.modal) {
            if (this.isOpen) {
                this.modal.classList.add('active');
                try { document.exitPointerLock(); } catch (e) {}
                this.render();
            } else {
                this.modal.classList.remove('active');
                if (window.gameEngine && window.gameEngine.thirdPersonCamera && typeof window.gameEngine.thirdPersonCamera.safeRequestPointerLock === 'function') {
                    window.gameEngine.thirdPersonCamera.safeRequestPointerLock();
                }
            }
        }
    }

    worldToMap(wx, wz) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const mx = ((wx + 180) / 360) * w;
        const my = ((wz + 150) / 300) * h;
        return { x: mx, y: my };
    }

    mapToWorld(mx, my) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const wx = (mx / w) * 360 - 180;
        const wz = (my / h) * 300 - 150;
        return { x: wx, z: wz };
    }

    render() {
        if (!this.isOpen || !this.ctx || !window.gameEngine) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Океан
        ctx.fillStyle = '#081326';
        ctx.fillRect(0, 0, w, h);

        // 2. Остров (суша)
        ctx.fillStyle = '#152438';
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88, 30);
        ctx.fill();
        ctx.stroke();

        // 3. Сетка из 20 секторов (5 колонок x 4 строки)
        const gridCols = 5;
        const gridRows = 4;

        const isHeli = (window.gameEngine && window.gameEngine.helicopter && (window.gameEngine.helicopter.isPiloted || window.gameEngine.helicopter.isPassenger));
        const isDriving = (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null);
        let playerPos = { x: 0, z: 0 };
        let playerYawWorld = 0;

        if (isHeli) {
            const hObj = window.gameEngine.helicopter;
            playerYawWorld = hObj.headingAngle || 0;
            playerPos = hObj.body ? hObj.body.position : { x: 0, z: 0 };
        } else if (isDriving) {
            const car = window.gameEngine.vehicleManager.activeDrivenCar;
            playerYawWorld = car.carGroup ? car.carGroup.rotation.y : 0;
            playerPos = car.chassisBody ? car.chassisBody.position : { x: 0, z: 0 };
        } else if (window.gameEngine && window.gameEngine.player) {
            playerYawWorld = window.gameEngine.player.mesh ? window.gameEngine.player.mesh.rotation.y : 0;
            playerPos = window.gameEngine.player.body ? window.gameEngine.player.body.position : (window.gameEngine.player.mesh ? window.gameEngine.player.mesh.position : { x: 0, z: 0 });
        }

        const playerCol = Math.max(0, Math.min(4, Math.floor((playerPos.x + 150) / 60)));
        const playerRow = Math.max(0, Math.min(3, Math.floor((playerPos.z + 120) / 60)));

        const sectorNames = [
            'СЕВЕРНЫЕ ХОЛМЫ', 'СОСНОВЫЙ БОР', 'ГОРНЫЙ ХРЕБЕТ', 'ОБСЕРВАТОРИЯ', 'ВОСТОЧНЫЕ ВЕРШИНЫ',
            'ТИХИЙ ПРИГОРОД', 'ДЕЛОВОЙ СИТИ', 'БАНКОВСКИЙ КВАРТАЛ', 'МЕДИЦИНСКИЙ ГОРОДОК', 'ВОСТОЧНЫЙ РАЙОН',
            'ТОРГОВАЯ ПЛОЩАДЬ', 'ЦЕНТРАЛЬНЫЙ ПАРК', 'ПОЛИЦЕЙСКИЙ ОКРУГ', 'АВТОМАГИСТРАЛЬ', 'ТЕРМИНАЛ',
            'ЗАПАДНЫЕ ДОКИ', 'ГРУЗОВОЙ ПОРТ', 'ЗАВОДСКАЯ ПРОМЗОНА', 'ЮЖНЫЙ СКЛАД', 'ЮЖНАЯ НАБЕРЕЖНАЯ'
        ];

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const sId = r * gridCols + c + 1;
                const sMin = this.worldToMap(-150 + c * 60, -120 + r * 60);
                const sMax = this.worldToMap(-150 + (c + 1) * 60, -120 + (r + 1) * 60);
                const sw = sMax.x - sMin.x;
                const sh = sMax.y - sMin.y;

                const isPlayerSector = (c === playerCol && r === playerRow);

                ctx.fillStyle = isPlayerSector ? 'rgba(0, 229, 255, 0.08)' : 'rgba(15, 23, 42, 0.35)';
                ctx.fillRect(sMin.x, sMin.y, sw, sh);
                ctx.strokeStyle = isPlayerSector ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = isPlayerSector ? 1.5 : 1;
                ctx.strokeRect(sMin.x, sMin.y, sw, sh);

                ctx.fillStyle = isPlayerSector ? '#00e5ff' : '#94a3b8';
                ctx.font = 'bold 10px monospace';
                ctx.fillText('СЕКТОР ' + String(sId).padStart(2, '0'), sMin.x + 6, sMin.y + 14);

                ctx.fillStyle = isPlayerSector ? '#ffffff' : '#cbd5e1';
                ctx.font = '8px sans-serif';
                ctx.fillText(sectorNames[sId - 1] || '', sMin.x + 6, sMin.y + 26);
            }
        }

        // 4. Дорожная сеть
        ctx.strokeStyle = '#2b394e';
        ctx.lineWidth = 10;
        for (let gx = -2; gx <= 2; gx++) {
            const p1 = this.worldToMap(gx * 60, -120);
            const p2 = this.worldToMap(gx * 60, 120);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        for (let gz = -2; gz <= 2; gz++) {
            const p1 = this.worldToMap(-150, gz * 60);
            const p2 = this.worldToMap(150, gz * 60);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }

        ctx.strokeStyle = '#3b4d66';
        ctx.lineWidth = 6;
        for (let gx = -2; gx <= 2; gx++) {
            const p1 = this.worldToMap(gx * 60, -120);
            const p2 = this.worldToMap(gx * 60, 120);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        for (let gz = -2; gz <= 2; gz++) {
            const p1 = this.worldToMap(-150, gz * 60);
            const p2 = this.worldToMap(150, gz * 60);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }

        // 5. Здания и дома (схематично)
        const buildings = [
            { x: 0, z: 0, w: 22, d: 22, name: 'MAZE BANK', col: '#0284c7', icon: '$' },
            { x: -60, z: 60, w: 28, d: 24, name: 'LSPD', col: '#1e40af', icon: '★' },
            { x: 60, z: 60, w: 26, d: 22, name: 'HOSPITAL', col: '#dc2626', icon: '✚' },
            { x: -60, z: -60, w: 18, d: 18, name: 'ДОМ 1', col: '#d97706' },
            { x: 60, z: -60, w: 18, d: 18, name: 'ДОМ 2', col: '#d97706' },
            { x: -120, z: 60, w: 32, d: 20, name: 'СКЛАД', col: '#475569' },
            { x: 120, z: 60, w: 32, d: 20, name: 'ЗАВОД', col: '#475569' }
        ];

        for (const b of buildings) {
            const bp = this.worldToMap(b.x - b.w/2, b.z - b.d/2);
            const bp2 = this.worldToMap(b.x + b.w/2, b.z + b.d/2);
            const bw = bp2.x - bp.x;
            const bh = bp2.y - bp.y;

            ctx.fillStyle = b.col || '#334155';
            ctx.fillRect(bp.x, bp.y, bw, bh);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(bp.x, bp.y, bw, bh);

            if (b.icon) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(b.icon, bp.x + bw/2 - 4, bp.y + bh/2 + 4);
            }
        }

        // 6. Деревья
        const veg = window.gameEngine.vegetationManager;
        if (veg && veg.treePositions) {
            ctx.fillStyle = '#22c55e';
            for (const t of veg.treePositions) {
                const tp = this.worldToMap(t.x, t.z);
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 7. Автомобили трафика и шоукейса
        const vm = window.gameEngine.vehicleManager;
        const tm = window.gameEngine.ambientTrafficManager;
        const cars = [
            ...(vm && vm.cars ? vm.cars : []),
            ...(tm && tm.vehicles ? tm.vehicles : [])
        ];

        for (const c of cars) {
            if (!c.chassisBody) continue;
            const cp = this.worldToMap(c.chassisBody.position.x, c.chassisBody.position.z);
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(cp.x - 2.5, cp.y - 2.5, 5, 5);
        }

        // 8. Удаленные игроки мультиплеера (тиммейты)
        if (window.gameEngine && window.gameEngine.multiplayerManager) {
            const remotes = window.gameEngine.multiplayerManager.getRemotePlayersArray();
            for (let i = 0; i < remotes.length; i++) {
                const rp = remotes[i];
                const rPos = this.worldToMap(rp.x, rp.z);
                ctx.save();
                ctx.translate(rPos.x, rPos.y);

                ctx.fillStyle = '#00f0ff';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, -7);
                ctx.lineTo(7, 0);
                ctx.lineTo(0, 7);
                ctx.lineTo(-7, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#00f0ff';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(rp.nickname || 'Player', 10, 3);
                ctx.restore();
            }
        }

        // 9. Универсальная GPS-линия (Foot / Car / Heli)
        const nav = window.gameEngine.flightNavigation;
        const isMegaHeli = !!(isHeli && window.gameEngine && window.gameEngine.helicopter && window.gameEngine.helicopter.isMega);
        if (nav && nav.hasActiveTarget()) {
            const target = nav.getTargetPosition();
            if (target) {
                const pStart = this.worldToMap(playerPos.x, playerPos.z);
                const pEnd = this.worldToMap(target.x, target.z);
                const navMode = nav.currentMode || (isHeli ? 'HELI' : (isDriving ? 'CAR' : 'FOOT'));

                // Отрисовка светящейся неоновой траектории
                ctx.save();
                const glowColor = (navMode === 'FOOT') ? 'rgba(0, 240, 255, 0.4)' : ((navMode === 'CAR') ? 'rgba(56, 189, 248, 0.45)' : (isMegaHeli ? 'rgba(0, 240, 255, 0.55)' : 'rgba(34, 197, 94, 0.45)'));
                const lineColor = (navMode === 'FOOT') ? '#00f0ff' : ((navMode === 'CAR') ? '#38bdf8' : (isMegaHeli ? '#00f0ff' : '#22c55e'));

                ctx.strokeStyle = glowColor;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(pStart.x, pStart.y);
                ctx.lineTo(pEnd.x, pEnd.y);
                ctx.stroke();

                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(pStart.x, pStart.y);
                ctx.lineTo(pEnd.x, pEnd.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Маркер целевой зоны
                const pulse = (Math.sin(Date.now() * 0.006) + 1.0) * 0.5;
                ctx.fillStyle = glowColor;
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pEnd.x, pEnd.y, 10 + pulse * 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = lineColor;
                ctx.font = 'bold 10px sans-serif';
                const prefix = isMegaHeli ? '⚡🚁 [X4]' : ((navMode === 'HELI') ? '🚁 [H]' : ((navMode === 'CAR') ? '🚗' : '🏃'));
                ctx.fillText(`${prefix} ${target.label}`, pEnd.x + 14, pEnd.y + 4);

                const distM = Math.round(Math.hypot(target.x - playerPos.x, target.z - playerPos.z));
                ctx.fillStyle = '#ffffff';
                ctx.font = '9px monospace';
                ctx.fillText(`${distM > 1000 ? (distM/1000).toFixed(2) + 'км' : distM + 'м'}`, pEnd.x + 14, pEnd.y + 15);
                ctx.restore();
            }
        }

        // 10. Метка локального игрока / вертолета
        const pp = this.worldToMap(playerPos.x, playerPos.z);
        const rotY = playerYawWorld;

        ctx.strokeStyle = isMegaHeli ? '#00f0ff' : (isHeli ? '#00ff88' : 'rgba(0, 229, 255, 0.8)');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, isHeli ? 11 : 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.translate(pp.x, pp.y);
        ctx.rotate(-rotY + Math.PI);
        ctx.fillStyle = isMegaHeli ? '#00f0ff' : (isHeli ? '#00ff88' : '#ffd700');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (isHeli) {
            // Иконка вертолета с лопастями
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
            ctx.moveTo(0, -9); ctx.lineTo(0, 7);
        } else {
            // Стрелка направления
            ctx.moveTo(0, -9);
            ctx.lineTo(6, 7);
            ctx.lineTo(0, 4);
            ctx.lineTo(-6, 7);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = isMegaHeli ? '#00f0ff' : '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        const heliLabel = isMegaHeli ? '⚡ CYBER GHOST X4' : (isHeli ? '🚁 ВЕРТОЛЕТ' : (isDriving ? '🚗 ЗА РУЛЕМ' : 'ВЫ ЗДЕСЬ'));
        ctx.fillText(heliLabel, pp.x + 14, pp.y + 4);

        // 11. Подсказка по клику внизу карты
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText('💡 Нажмите ЛКМ на любое место карты, здание или игрока для прокладки GPS-маршрута | ПКМ: сбросить', 18, h - 14);
    }
}

window.FullMapRenderer = FullMapRenderer;
