/**
 * GPSNavigationSystem / FlightNavigationSystem - Универсальный 3D GPS-навигатор открытого мира
 * 
 * Поддерживает 3 режима:
 * 1. 🏃 FOOT (Пешком) - Светящаяся наземная направляющая линия по рельефу, расстояние, шаговый ETA, маяк цели.
 * 2. 🚗 CAR (На машине) - Дорожная навигационная лента с указателями, расчет скорости авто, ETA прибытия.
 * 3. 🚁 HELI (В вертолете) - Воздушный крейсерский эшелон (85м), посадочная глиссада и 3D-вертодром [H].
 */
class FlightNavigationSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeTarget = null; // { type: 'COORDS' | 'PLAYER', x, y, z, playerId, label }
        this.cruisingAltitude = 85.0; // Безопасный крейсерский эшелон вертолета

        // 3D визуальные элементы в сцене
        this.navGroup = new THREE.Group();
        this.navGroup.name = 'GPSNavGroup';
        this.scene.add(this.navGroup);

        this.routeMesh = null;
        this.routeGlowLine = null;
        this.landingBeacon = null;
        this.landingRing = null;
        this.destinationPin = null;
        this.pulseTime = 0;
        this.lastRouteUpdate = 0;
        this.currentMode = 'FOOT'; // 'FOOT', 'CAR', 'HELI'

        this.init3DVisuals();
    }

    init3DVisuals() {
        // 1. Материал для объемной светящейся 3D линии
        this.routeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.85,
            wireframe: false,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // Внутреннее яркое ядро линии (Core glow)
        this.coreMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 3,
            transparent: true,
            opacity: 0.95
        });

        // 2. 3D Вертикальный световой столб маяка цели (Beacon Light Beam)
        const beamGeo = new THREE.CylinderGeometry(0.35, 2.8, 140, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.40,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.landingBeacon = new THREE.Mesh(beamGeo, beamMat);
        this.landingBeacon.position.set(0, 70, 0);
        this.landingBeacon.visible = false;
        this.navGroup.add(this.landingBeacon);

        // 3. Горизонтальное пульсирующее посадочное / целевое кольцо на земле
        const discGeo = new THREE.RingGeometry(0.3, 4.8, 32);
        const discMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        this.landingRing = new THREE.Mesh(discGeo, discMat);
        this.landingRing.rotation.x = -Math.PI / 2;
        this.landingRing.position.set(0, 0.25, 0);
        this.landingRing.visible = false;
        this.navGroup.add(this.landingRing);

        // 4. 3D Маркер-ромб над точкой назначения
        const pinGeo = new THREE.OctahedronGeometry(1.6, 0);
        const pinMat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            wireframe: false
        });
        this.destinationPin = new THREE.Mesh(pinGeo, pinMat);
        this.destinationPin.position.set(0, 5.0, 0);
        this.destinationPin.visible = false;
        this.navGroup.add(this.destinationPin);
    }

    setTarget(x, z, y = null, label = 'Точка назначения', playerId = null) {
        let groundY = y;
        if (groundY === null || groundY === undefined) {
            groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(x, z)
                : 0.2;
        }

        this.activeTarget = {
            type: playerId ? 'PLAYER' : 'COORDS',
            x: x,
            y: groundY + 0.3,
            z: z,
            playerId: playerId,
            label: label || (playerId ? 'Союзник' : 'Точка назначения')
        };

        if (this.landingBeacon) this.landingBeacon.visible = true;
        if (this.landingRing) this.landingRing.visible = true;
        if (this.destinationPin) this.destinationPin.visible = true;
        this.navGroup.visible = true;

        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            window.gameEngine.multiplayerHUD.addSystemMessage(`📍 GPS-Навигатор: маршрут проложен к "${this.activeTarget.label}"!`);
        }
    }

    clearTarget() {
        this.activeTarget = null;
        this.destroyRouteMesh();
        if (this.landingBeacon) this.landingBeacon.visible = false;
        if (this.landingRing) this.landingRing.visible = false;
        if (this.destinationPin) this.destinationPin.visible = false;
        this.navGroup.visible = false;

        const navHud = document.getElementById('heli-nav-hud');
        if (navHud) navHud.style.display = 'none';

        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            window.gameEngine.multiplayerHUD.addSystemMessage('📍 Маршрут навигатора сброшен.');
        }
    }

    hasActiveTarget() {
        return !!this.activeTarget;
    }

    getTargetPosition() {
        if (!this.activeTarget) return null;

        // Если цель привязана к игроку/тиммейту — динамически получаем его свежую позицию
        if (this.activeTarget.type === 'PLAYER' && this.activeTarget.playerId && window.gameEngine && window.gameEngine.multiplayerManager) {
            const remotes = window.gameEngine.multiplayerManager.remotePlayers;
            if (remotes && remotes.has(this.activeTarget.playerId)) {
                const rp = remotes.get(this.activeTarget.playerId);
                if (rp) {
                    this.activeTarget.x = rp.x;
                    this.activeTarget.y = rp.y + 0.2;
                    this.activeTarget.z = rp.z;
                    if (rp.nickname) this.activeTarget.label = rp.nickname;
                }
            }
        }
        return this.activeTarget;
    }

    destroyRouteMesh() {
        if (this.routeMesh) {
            this.navGroup.remove(this.routeMesh);
            if (this.routeMesh.geometry) this.routeMesh.geometry.dispose();
            this.routeMesh = null;
        }
        if (this.routeGlowLine) {
            this.navGroup.remove(this.routeGlowLine);
            if (this.routeGlowLine.geometry) this.routeGlowLine.geometry.dispose();
            this.routeGlowLine = null;
        }
    }

    build3DRoute(startPos, target, mode) {
        const start = new THREE.Vector3(startPos.x, startPos.y + 0.4, startPos.z);
        const end = new THREE.Vector3(target.x, target.y + 0.4, target.z);
        const hDist = Math.hypot(end.x - start.x, end.z - start.z);

        const points = [];

        if (mode === 'HELI') {
            // Режим полета: эшелон + глиссада
            points.push(start.clone());
            if (hDist > 20.0) {
                const cruiseY = Math.max(this.cruisingAltitude, Math.max(start.y + 8.0, end.y + 25.0));
                points.push(new THREE.Vector3(
                    THREE.MathUtils.lerp(start.x, end.x, 0.22),
                    THREE.MathUtils.lerp(start.y, cruiseY, 0.85),
                    THREE.MathUtils.lerp(start.z, end.z, 0.22)
                ));
                points.push(new THREE.Vector3(
                    THREE.MathUtils.lerp(start.x, end.x, 0.55),
                    cruiseY,
                    THREE.MathUtils.lerp(start.z, end.z, 0.55)
                ));
                points.push(new THREE.Vector3(
                    THREE.MathUtils.lerp(start.x, end.x, 0.82),
                    THREE.MathUtils.lerp(cruiseY, end.y + 4.0, 0.65),
                    THREE.MathUtils.lerp(start.z, end.z, 0.82)
                ));
            } else {
                points.push(new THREE.Vector3(
                    THREE.MathUtils.lerp(start.x, end.x, 0.5),
                    Math.max(start.y, end.y + 6.0),
                    THREE.MathUtils.lerp(start.z, end.z, 0.5)
                ));
            }
            points.push(end.clone().add(new THREE.Vector3(0, 0.3, 0)));
        } else {
            // Наземный режим (Пешком или На машине): плавная кривая с учетом рельефа
            const segCount = Math.max(3, Math.min(16, Math.floor(hDist / 20.0)));
            points.push(start.clone());
            for (let i = 1; i < segCount; i++) {
                const t = i / segCount;
                const px = THREE.MathUtils.lerp(start.x, end.x, t);
                const pz = THREE.MathUtils.lerp(start.z, end.z, t);
                const py = (window.gameEngine && window.gameEngine.terrainManager)
                    ? window.gameEngine.terrainManager.getTerrainHeight(px, pz) + 0.45
                    : THREE.MathUtils.lerp(start.y, end.y, t);
                points.push(new THREE.Vector3(px, py, pz));
            }
            points.push(end.clone());
        }

        if (points.length < 2) return;

        // Построение плавной кривой Catmull-Rom
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
        const tubeRadius = (mode === 'HELI') ? 0.45 : (mode === 'CAR' ? 0.38 : 0.28);
        const segments = Math.max(20, Math.min(80, Math.round(hDist * 0.4)));
        const tubeGeo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);

        if (!this.routeMesh) {
            this.routeMesh = new THREE.Mesh(tubeGeo, this.routeMaterial);
            this.navGroup.add(this.routeMesh);
        } else {
            this.routeMesh.geometry.dispose();
            this.routeMesh.geometry = tubeGeo;
        }

        // Яркая центральная световая линия
        const linePoints = curve.getPoints(segments);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);

        if (!this.routeGlowLine) {
            this.routeGlowLine = new THREE.Line(lineGeo, this.coreMaterial);
            this.navGroup.add(this.routeGlowLine);
        } else {
            this.routeGlowLine.geometry.dispose();
            this.routeGlowLine.geometry = lineGeo;
        }
    }

    update(deltaTime, helicopter = null) {
        const target = this.getTargetPosition();
        if (!target) {
            this.navGroup.visible = false;
            this.destroyRouteMesh();
            const navHud = document.getElementById('heli-nav-hud');
            if (navHud) navHud.style.display = 'none';
            return;
        }

        // Определение текущего режима перемещения (Heli, Car, Foot)
        let mode = 'FOOT';
        let startPos = null;
        let currentSpeedKmh = 0;

        const isHeli = !!(helicopter && (helicopter.isPiloted || helicopter.isPassenger) && helicopter.group && helicopter.body);
        const activeCar = (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar && window.gameEngine.vehicleManager.activeDrivenCar.chassisBody)
            ? window.gameEngine.vehicleManager.activeDrivenCar
            : null;
        const isDriving = activeCar !== null;

        if (isHeli) {
            mode = 'HELI';
            startPos = helicopter.group.position;
            currentSpeedKmh = Math.hypot(helicopter.body.velocity.x, helicopter.body.velocity.y, helicopter.body.velocity.z) * 3.6;
        } else if (isDriving) {
            mode = 'CAR';
            startPos = activeCar.chassisBody.position;
            currentSpeedKmh = Math.hypot(activeCar.chassisBody.velocity.x, activeCar.chassisBody.velocity.y, activeCar.chassisBody.velocity.z) * 3.6;
        } else {
            mode = 'FOOT';
            const player = window.gameEngine ? window.gameEngine.player : null;
            if (player && player.body && player.body.position) {
                startPos = player.body.position;
                currentSpeedKmh = Math.hypot(player.body.velocity.x, player.body.velocity.z) * 3.6;
            } else if (player && player.mesh && player.mesh.position) {
                startPos = player.mesh.position;
                currentSpeedKmh = 0;
            } else {
                startPos = new THREE.Vector3(0, 1, 0);
                currentSpeedKmh = 0;
            }
        }

        if (!startPos) {
            startPos = new THREE.Vector3(0, 1, 0);
        }

        this.currentMode = mode;
        this.navGroup.visible = true;
        this.pulseTime += deltaTime * 3.5;

        // 1. Динамическое обновление геометрии 3D линии маршрута (~15 FPS)
        const now = performance.now();
        if (now - this.lastRouteUpdate > 65) {
            this.build3DRoute(startPos, target, mode);
            this.lastRouteUpdate = now;
        }

        // 2. Анимация пульсации и свечения линии
        const pulse = (Math.sin(this.pulseTime) + 1.0) * 0.5;
        if (this.routeMaterial) {
            this.routeMaterial.opacity = 0.72 + pulse * 0.25;
            if (mode === 'FOOT') {
                this.routeMaterial.color.setHex(0x00f0ff);
            } else if (mode === 'CAR') {
                this.routeMaterial.color.setHex(0x38bdf8);
            } else {
                this.routeMaterial.color.setHex(0x22c55e);
            }
        }

        // 3. Обновление маяка и маркера
        if (this.landingBeacon && this.landingRing && this.destinationPin) {
            this.landingBeacon.visible = true;
            this.landingRing.visible = true;
            this.destinationPin.visible = true;

            this.landingBeacon.position.set(target.x, target.y + 70, target.z);
            this.landingRing.position.set(target.x, target.y + 0.15, target.z);
            this.destinationPin.position.set(target.x, target.y + 4.5 + Math.sin(this.pulseTime * 1.5) * 0.6, target.z);
            this.destinationPin.rotation.y += deltaTime * 2.0;

            this.landingRing.scale.set(1.0 + pulse * 0.25, 1.0 + pulse * 0.25, 1.0);
            this.landingBeacon.material.opacity = 0.20 + pulse * 0.25;
        }

        // 4. Расчет расстояния и ETA
        const isMegaHeli = !!(isHeli && helicopter && helicopter.isMega);
        const hDist = Math.hypot(target.x - startPos.x, target.z - startPos.z);
        let speedMs = currentSpeedKmh / 3.6;
        if (mode === 'FOOT') {
            speedMs = Math.max(speedMs, 5.5); // ~20 км/ч средний бег
        } else if (mode === 'CAR') {
            speedMs = Math.max(speedMs, 18.0); // ~65 км/ч на авто
        } else if (isMegaHeli) {
            speedMs = Math.max(speedMs, 50.0); // ~180 км/ч на супер-вертолете
        } else {
            speedMs = Math.max(speedMs, 25.0); // ~90 км/ч на вертолете
        }

        const etaSec = Math.max(1, Math.round(hDist / speedMs));

        // Если игрок прибыл на место (ближе 4м пешком или 8м на авто/вертолете)
        const arrivalThreshold = (mode === 'FOOT') ? 4.5 : (mode === 'CAR' ? 8.0 : 12.0);
        const isArrived = hDist <= arrivalThreshold;

        this.updateHUD(target.label, hDist, startPos.y, target.y, currentSpeedKmh, etaSec, mode, isArrived, isMegaHeli);
    }

    updateHUD(label, hDist, currentAlt, targetAlt, speedKmh, etaSec, mode, isArrived, isMegaHeli = false) {
        let navHud = document.getElementById('heli-nav-hud');
        if (!navHud) {
            navHud = document.createElement('div');
            navHud.id = 'heli-nav-hud';
            navHud.className = 'heli-nav-hud';
            document.body.appendChild(navHud);
        }

        navHud.style.display = 'flex';

        let distText = (hDist > 1000) ? `${(hDist / 1000).toFixed(2)} км` : `${Math.round(hDist)} м`;
        let icon = '🏃';
        let modeName = 'ПЕШКОМ';
        let statusBadge = '';

        if (mode === 'HELI') {
            icon = isMegaHeli ? '⚡🚁' : '🚁';
            modeName = isMegaHeli ? 'CYBER GHOST X4' : 'ВЕРТОЛЕТ';
            if (isArrived) {
                statusBadge = '<span class="heli-nav-badge landing">🎯 ВЫ ПРИБЫЛИ К ЦЕЛИ!</span>';
            } else if (hDist < 30.0) {
                statusBadge = '<span class="heli-nav-badge landing">🛬 СНИЖЕНИЕ И ПОСАДКА</span>';
            } else if (currentAlt < this.cruisingAltitude - 15.0) {
                statusBadge = '<span class="heli-nav-badge climb">▲ НАБОР ВЫСОТЫ</span>';
            } else {
                statusBadge = isMegaHeli ? '<span class="heli-nav-badge cruise" style="background:rgba(0,240,255,0.25); border-color:#00f0ff; color:#00f0ff;">⚡ ПОЛЕТ 2X СКОРОСТИ</span>' : '<span class="heli-nav-badge cruise">✈ ПОЛЕТ ПО КУРСУ</span>';
            }
        } else if (mode === 'CAR') {
            icon = '🚗';
            modeName = 'НА АВТОМОБИЛЕ';
            if (isArrived) {
                statusBadge = '<span class="heli-nav-badge landing">🎯 ВЫ ПРИБЫЛИ К ЦЕЛИ!</span>';
            } else {
                statusBadge = '<span class="heli-nav-badge cruise">🛣️ ДВИЖЕНИЕ ПО МАРШРУТУ</span>';
            }
        } else {
            icon = '🏃';
            modeName = 'ПЕШКОМ';
            if (isArrived) {
                statusBadge = '<span class="heli-nav-badge landing">🎯 ВЫ ПРИБЫЛИ К ЦЕЛИ!</span>';
            } else {
                statusBadge = '<span class="heli-nav-badge climb">🚶 ПЕШИЙ МАРШРУТ</span>';
            }
        }

        navHud.innerHTML = `
            <div class="heli-nav-icon">${icon}</div>
            <div class="heli-nav-info">
                <div class="heli-nav-top">
                    <span class="heli-nav-title">GPS: <b>${label}</b> <small style="opacity:0.85; font-size:10px; color:${isMegaHeli ? '#00f0ff' : 'inherit'};">[${modeName}]</small></span>
                    ${statusBadge}
                </div>
                <div class="heli-nav-stats">
                    <span>Дистанция: <b>${distText}</b></span>
                    <span>Скорость: <b>${Math.round(speedKmh)} км/ч</b></span>
                    <span>ETA: <b>~${etaSec} сек</b></span>
                </div>
            </div>
            <button type="button" class="heli-nav-btn-cancel" id="btn-cancel-flight-nav" title="Сбросить маршрут">✕</button>
        `;

        const cancelBtn = document.getElementById('btn-cancel-flight-nav');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.clearTarget();
            };
        }
    }
}

window.FlightNavigationSystem = FlightNavigationSystem;
window.GPSNavigationSystem = FlightNavigationSystem;

