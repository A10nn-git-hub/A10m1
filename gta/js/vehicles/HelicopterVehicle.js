/**
 * Вертолет Maverick / Buzzard с аэродинамической физикой полета,
 * вращающимися винтами, звуковым синтезатором и посадкой/высадкой игрока.
 */
class HelicopterVehicle {
    constructor(scene, world, physicsMaterials, posX = -3.5, posY = 93.0, posZ = 0, rotY = 0) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.vehicleName = 'Maverick Helidrop';
        this.isPiloted = false;
        this.pilot = null;

        // Физические параметры полета
        this.rotorRPM = 0.0;
        this.targetRotorRPM = 0.0;
        this.maxLiftForce = 21000.0; // Достаточно для подъема и маневров
        this.currentLift = 0.0;
        this.pitchAngle = 0.0;
        this.rollAngle = 0.0;
        this.yawAngle = rotY;

        this.pitchVelocity = 0.0;
        this.rollVelocity = 0.0;
        this.yawVelocity = 0.0;

        this.rotorAngle = 0.0;
        this.tailRotorAngle = 0.0;

        this.transitionState = 'IDLE';
        this.transitionTimer = 0.0;

        // Сетевая интерполяция и экстраполяция (Standoff-2 style entity smoothing)
        this.isRemotelyPiloted = false;
        this.netTargetPos = new THREE.Vector3(posX, posY, posZ);
        this.netTargetHeading = rotY;
        this.netTargetPitch = 0.0;
        this.netTargetRoll = 0.0;
        this.netVelocity = new THREE.Vector3();
        this.netLastPacketTime = 0;

        this.buildMaterials();
        this.buildMesh(posX, posY, posZ, rotY);
        this.initPhysics(posX, posY, posZ, rotY);
        this.initAudioSynth();
    }

    applyNetworkTransform(x, y, z, rotY, pitch = 0, roll = 0, vx = 0, vy = 0, vz = 0, isPiloted = true) {
        this.isRemotelyPiloted = !!isPiloted;
        this.netTargetPos.set(x, y, z);
        this.netTargetHeading = rotY;
        this.netTargetPitch = pitch;
        this.netTargetRoll = roll;
        this.netVelocity.set(vx, vy, vz);
        this.netLastPacketTime = performance.now();

        if (this.group.position.distanceTo(this.netTargetPos) > 28.0) {
            this.group.position.copy(this.netTargetPos);
            this.body.position.copy(this.netTargetPos);
            this.headingAngle = rotY;
            this.pitchAngle = pitch;
            this.rollAngle = roll;
            this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
            this.group.quaternion.copy(this.body.quaternion);
        }
    }

    buildMaterials() {
        this.matBody = new THREE.MeshStandardMaterial({
            color: 0x1a237e, // Насыщенный темно-синий глянец
            roughness: 0.25,
            metalness: 0.7
        });
        this.matAccent = new THREE.MeshStandardMaterial({
            color: 0xffb300, // Золотисто-желтая полоса
            roughness: 0.3,
            metalness: 0.5
        });
        this.matGlass = new THREE.MeshPhysicalMaterial({
            color: 0x81d4fa,
            transparent: true,
            opacity: 0.55,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.6
        });
        this.matSkids = new THREE.MeshStandardMaterial({
            color: 0x37474f,
            roughness: 0.4,
            metalness: 0.8
        });
        this.matBlade = new THREE.MeshStandardMaterial({
            color: 0x212121,
            roughness: 0.5,
            metalness: 0.6
        });
        this.matInterior = new THREE.MeshLambertMaterial({
            color: 0x263238
        });
    }

    buildMesh(x, y, z, rotY) {
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this.group.rotation.y = rotY;

        // 1. Основной фюзеляж (кабина)
        const fuselageGeo = new THREE.BoxGeometry(1.85, 1.65, 3.8);
        const fuselage = new THREE.Mesh(fuselageGeo, this.matBody);
        fuselage.position.set(0, 0.85, 0);
        fuselage.castShadow = true;
        this.group.add(fuselage);

        // Носовой обтекатель
        const noseGeo = new THREE.ConeGeometry(0.92, 1.4, 16);
        const nose = new THREE.Mesh(noseGeo, this.matBody);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.82, 2.3);
        nose.castShadow = true;
        this.group.add(nose);

        // Просторное лобовое остекление кабины (без выпирания пилота)
        const glassGeo = new THREE.BoxGeometry(1.82, 1.25, 2.4);
        const glass = new THREE.Mesh(glassGeo, this.matGlass);
        glass.position.set(0, 1.15, 0.85);
        this.group.add(glass);

        // Декоративная полоса
        const stripeGeo = new THREE.BoxGeometry(1.88, 0.22, 3.6);
        const stripe = new THREE.Mesh(stripeGeo, this.matAccent);
        stripe.position.set(0, 0.8, 0);
        this.group.add(stripe);

        // Плоская посадочная площадка на крыше для стояния сверху
        const roofPlatGeo = new THREE.BoxGeometry(1.7, 0.1, 3.0);
        const roofPlat = new THREE.Mesh(roofPlatGeo, this.matAccent);
        roofPlat.position.set(0, 1.68, 0.1);
        roofPlat.receiveShadow = true;
        this.group.add(roofPlat);

        // 2 кресла в кабине (Место 0 = Пилот слева, Место 1 = Пассажир справа)
        const seatPilot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), this.matInterior);
        seatPilot.position.set(-0.38, 0.45, 0.45);
        this.group.add(seatPilot);

        const seatCopilot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), this.matInterior);
        seatCopilot.position.set(0.38, 0.45, 0.45);
        this.group.add(seatCopilot);

        // 2. Хвостовая балка и оперение
        const tailBoomGeo = new THREE.CylinderGeometry(0.22, 0.35, 4.6, 12);
        const tailBoom = new THREE.Mesh(tailBoomGeo, this.matBody);
        tailBoom.rotation.x = Math.PI / 2;
        tailBoom.position.set(0, 1.1, -3.8);
        tailBoom.castShadow = true;
        this.group.add(tailBoom);

        const vertFinGeo = new THREE.BoxGeometry(0.12, 1.3, 0.75);
        const vertFin = new THREE.Mesh(vertFinGeo, this.matAccent);
        vertFin.position.set(0, 1.5, -6.1);
        vertFin.castShadow = true;
        this.group.add(vertFin);

        const horizFinGeo = new THREE.BoxGeometry(1.5, 0.08, 0.45);
        const horizFin = new THREE.Mesh(horizFinGeo, this.matAccent);
        horizFin.position.set(0, 1.1, -5.7);
        this.group.add(horizFin);

        // 3. Шасси (полозья / лыжи)
        const skidGeo = new THREE.CylinderGeometry(0.065, 0.065, 4.4, 10);
        const skidLeft = new THREE.Mesh(skidGeo, this.matSkids);
        skidLeft.rotation.x = Math.PI / 2;
        skidLeft.position.set(-1.15, 0.08, 0.2);
        this.group.add(skidLeft);

        const skidRight = new THREE.Mesh(skidGeo, this.matSkids);
        skidRight.rotation.x = Math.PI / 2;
        skidRight.position.set(1.15, 0.08, 0.2);
        this.group.add(skidRight);

        // Стойки шасси
        const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 8);
        const struts = [
            { x: -0.9, y: 0.45, z: 1.1, rotZ: -0.35 },
            { x: -0.9, y: 0.45, z: -0.9, rotZ: -0.35 },
            { x: 0.9, y: 0.45, z: 1.1, rotZ: 0.35 },
            { x: 0.9, y: 0.45, z: -0.9, rotZ: 0.35 }
        ];
        for (const s of struts) {
            const strut = new THREE.Mesh(strutGeo, this.matSkids);
            strut.position.set(s.x, s.y, s.z);
            strut.rotation.z = s.rotZ;
            this.group.add(strut);
        }

        // 4. Главный несущий винт (Main Rotor)
        this.mainRotorHub = new THREE.Group();
        this.mainRotorHub.position.set(0, 2.05, 0.1);

        const mastGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.45, 12);
        const mast = new THREE.Mesh(mastGeo, this.matSkids);
        mast.position.y = -0.15;
        this.group.add(mast);

        const hubCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.15, 12), this.matSkids);
        this.mainRotorHub.add(hubCenter);

        // 4 лопасти несущего винта (диаметр 7.2м)
        const bladeGeo = new THREE.BoxGeometry(0.22, 0.03, 3.4);
        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(bladeGeo, this.matBlade);
            blade.position.set(0, 0, 1.7);
            const bladePivot = new THREE.Group();
            bladePivot.rotation.y = (i * Math.PI) / 2;
            bladePivot.add(blade);
            this.mainRotorHub.add(bladePivot);
        }
        this.group.add(this.mainRotorHub);

        // 5. Рулевой хвостовой винт (Tail Rotor)
        this.tailRotorHub = new THREE.Group();
        this.tailRotorHub.position.set(0.18, 1.6, -6.1);

        const tailBladeGeo = new THREE.BoxGeometry(0.08, 0.8, 0.02);
        const tailBlade1 = new THREE.Mesh(tailBladeGeo, this.matBlade);
        const tailBlade2 = new THREE.Mesh(tailBladeGeo, this.matBlade);
        tailBlade2.rotation.z = Math.PI / 2;
        this.tailRotorHub.add(tailBlade1);
        this.tailRotorHub.add(tailBlade2);
        this.group.add(this.tailRotorHub);

        // 6. Навигационные огни (Beacon & Strobes)
        const navLightRed = new THREE.PointLight(0xff1111, 0.8, 12);
        navLightRed.position.set(-1.1, 0.9, 0);
        this.group.add(navLightRed);

        const navLightGreen = new THREE.PointLight(0x00e676, 0.8, 12);
        navLightGreen.position.set(1.1, 0.9, 0);
        this.group.add(navLightGreen);

        const navBeacon = new THREE.PointLight(0xff1744, 1.5, 18);
        navBeacon.position.set(0, 2.15, -6.1);
        this.group.add(navBeacon);
        this.navBeacon = navBeacon;

        this.scene.add(this.group);
    }

    initPhysics(x, y, z, rotY) {
        this.body = new CANNON.Body({
            mass: 1250,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, y + 0.85, z),
            linearDamping: 0.45,
            angularDamping: 0.75
        });

        // Фюзеляж хитбокс
        const fuselageShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.85, 2.0));
        this.body.addShape(fuselageShape, new CANNON.Vec3(0, 0.1, 0));

        // Плоская крыша-платформа для стояния/полетов на крыше
        const roofPlatform = new CANNON.Box(new CANNON.Vec3(0.9, 0.15, 1.5));
        this.body.addShape(roofPlatform, new CANNON.Vec3(0, 0.95, 0.1));

        // Хвостовая балка хитбокс
        const tailShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 2.0));
        this.body.addShape(tailShape, new CANNON.Vec3(0, 0.3, -3.8));

        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        this.world.addBody(this.body);
    }

    initAudioSynth() {
        this.audioCtx = null;
        this.osc1 = null;
        this.osc2 = null;
        this.gainNode = null;
    }

    startAudio() {
        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtxClass) return;
            if (!this.audioCtx) this.audioCtx = new AudioCtxClass();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            if (this.gainNode) return;

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
            this.gainNode.connect(this.audioCtx.destination);

            // Низкочастотный рокочущий звук лопастей (Chopper chop)
            this.osc1 = this.audioCtx.createOscillator();
            this.osc1.type = 'sawtooth';
            this.osc1.frequency.setValueAtTime(28, this.audioCtx.currentTime);

            this.osc2 = this.audioCtx.createOscillator();
            this.osc2.type = 'triangle';
            this.osc2.frequency.setValueAtTime(84, this.audioCtx.currentTime);

            // Модулятор чоппера (LFO)
            this.lfo = this.audioCtx.createOscillator();
            this.lfo.frequency.setValueAtTime(14, this.audioCtx.currentTime);
            this.lfoGain = this.audioCtx.createGain();
            this.lfoGain.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
            this.lfo.connect(this.lfoGain.gain);

            this.osc1.connect(this.gainNode);
            this.osc2.connect(this.gainNode);

            this.osc1.start();
            this.osc2.start();
            this.lfo.start();
        } catch (e) {
            console.warn('[Helicopter] Audio init warning:', e);
        }
    }

    stopAudio() {
        if (this.gainNode && this.audioCtx) {
            try {
                this.gainNode.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.2);
                setTimeout(() => {
                    if (this.osc1) { this.osc1.stop(); this.osc1.disconnect(); this.osc1 = null; }
                    if (this.osc2) { this.osc2.stop(); this.osc2.disconnect(); this.osc2 = null; }
                    if (this.lfo) { this.lfo.stop(); this.lfo.disconnect(); this.lfo = null; }
                    this.gainNode = null;
                }, 300);
            } catch (e) {}
        }
    }

    updateAudio(rpm) {
        if (!this.audioCtx || !this.gainNode) return;
        const now = this.audioCtx.currentTime;
        const targetVol = Math.min(0.28, rpm * 0.28);
        this.gainNode.gain.setTargetAtTime(targetVol, now, 0.1);
        if (this.osc1) this.osc1.frequency.setTargetAtTime(20 + rpm * 26, now, 0.1);
        if (this.osc2) this.osc2.frequency.setTargetAtTime(60 + rpm * 75, now, 0.1);
        if (this.lfo) this.lfo.frequency.setTargetAtTime(8 + rpm * 18, now, 0.1);
    }

    getSeatOffset(seatIndex = 0) {
        // Место 0 = Пилот (слева), Место 1 = Пассажир (справа)
        return (seatIndex === 1)
            ? new THREE.Vector3(0.38, 0.12, 0.45)
            : new THREE.Vector3(-0.38, 0.12, 0.45);
    }

    getFirstAvailableSeat() {
        if (!this.occupants) this.occupants = [null, null];
        if (!this.occupants[0]) return 0; // Место пилота
        if (!this.occupants[1]) return 1; // Место пассажира
        return -1; // Полностью занят (2/2)
    }

    setOccupant(seatIndex, playerId) {
        if (!this.occupants) this.occupants = [null, null];
        if (seatIndex >= 0 && seatIndex < 2) {
            this.occupants[seatIndex] = playerId;
        }
    }

    removeOccupant(playerId) {
        if (!this.occupants) return;
        for (let i = 0; i < 2; i++) {
            if (this.occupants[i] === playerId) {
                this.occupants[i] = null;
            }
        }
    }

    toggleEnterExit(player) {
        if (this.isPiloted || this.isPassenger) {
            // Выход из вертолета
            const wasPilot = this.isPiloted;
            this.isPiloted = false;
            this.isPassenger = false;
            this.seatIndex = 0;
            this.removeOccupant('local');

            if (wasPilot && (!this.occupants || !this.occupants[1])) {
                this.targetRotorRPM = 0.0;
                this.stopAudio();
            }

            player.mesh.scale.set(1, 1, 1);
            player.mesh.visible = true;
            const exitPos = new THREE.Vector3(-2.4, 0, 0).applyQuaternion(this.group.quaternion).add(this.group.position);
            const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(exitPos.x, exitPos.z)
                : 0.0;
            const spawnY = Math.max(groundY + 0.82, this.group.position.y - 0.15);

            player.mesh.position.set(exitPos.x, spawnY - 0.815, exitPos.z);
            if (player.body) {
                player.body.position.set(exitPos.x, spawnY, exitPos.z);
                player.body.velocity.set(0, 0, 0);
                player.body.wakeUp();
            }

            const modeElem = document.getElementById('stat-player-mode');
            const titleElem = document.getElementById('hud-mode-title');
            if (modeElem) modeElem.innerText = 'Пешком';
            if (titleElem) titleElem.innerText = 'ПРОТАГОНИСТ';

            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage('🚁 Вы покинули вертолет Maverick');
            }
            if (window.gameEngine && window.gameEngine.multiplayerManager) {
                window.gameEngine.multiplayerManager.sendLocalStateNow();
                if (wasPilot) {
                    window.gameEngine.multiplayerManager.broadcastHeliSync(
                        this.body.position.x,
                        this.body.position.y,
                        this.body.position.z,
                        this.headingAngle || 0,
                        0,
                        0,
                        false
                    );
                }
            }
        } else {
            // Посадка в вертолет (Пилот или Пассажир)
            const seatIdx = this.getFirstAvailableSeat();
            if (seatIdx === -1) {
                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('❌ Вертолет полностью заполнен (2/2 мест)!');
                }
                return;
            }

            this.seatIndex = seatIdx;
            this.isPiloted = (seatIdx === 0);
            this.isPassenger = (seatIdx === 1);
            this.setOccupant(seatIdx, 'local');

            // Изоляция физического тела игрока от коллизий с фюзеляжем вертолета
            if (player && player.body) {
                player.body.position.set(0, -500, 0);
                player.body.velocity.set(0, 0, 0);
                player.body.sleep();
            }

            if (this.isPiloted) {
                // Если садится пилот — подготовка к взлету
                this.body.velocity.set(0, 0, 0);
                this.body.angularVelocity.set(0, 0, 0);
                this.pitchAngle = 0.0;
                this.rollAngle = 0.0;
                this.rotorRPM = 1.0;
                this.targetRotorRPM = 1.0;
                this.body.wakeUp();
                this.startAudio();
            }

            player.mesh.visible = true;

            const modeElem = document.getElementById('stat-player-mode');
            const titleElem = document.getElementById('hud-mode-title');
            if (modeElem) modeElem.innerText = this.isPiloted ? 'Пилот вертолета' : 'Пассажир вертолета';
            if (titleElem) titleElem.innerText = this.isPiloted ? 'MAVERICK HELI' : 'ПАССАЖИР (MAVERICK)';

            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                if (this.isPiloted) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('🚁 Вы сели за штурвал Maverick! [Space] Взлет | [Shift] Спуск | [W] Вперед | [S] Назад | [A/D] Поворот');
                } else {
                    window.gameEngine.multiplayerHUD.addSystemMessage('🚁 Вы сели на пассажирское место вертолета Maverick! [F] Выйти');
                }
            }
            if (window.gameEngine && window.gameEngine.multiplayerManager) {
                window.gameEngine.multiplayerManager.sendLocalStateNow();
            }
        }
    }

    applyFlightControls(inputKeys, dt) {
        if (!this.isPiloted) return;
        this.body.wakeUp();

        if (this.headingAngle === undefined) {
            this.headingAngle = 0;
        }

        const groundY = (window.gameEngine && window.gameEngine.terrainManager)
            ? window.gameEngine.terrainManager.getTerrainHeight(this.body.position.x, this.body.position.z)
            : 0.0;
        const isGrounded = (this.body.position.y <= groundY + 1.05);

        // 1. Вертикальный подъем, зависание и спуск
        const isAscending = !!(inputKeys.jump || (window.inputManager && window.inputManager.keys && window.inputManager.keys.jump));
        const isDescending = !!(inputKeys.sprint || (window.inputManager && window.inputManager.keys && window.inputManager.keys.sprint));

        if (isAscending) {
            const targetVelY = 16.0;
            this.body.velocity.y += (targetVelY - this.body.velocity.y) * Math.min(1.0, dt * 7.0);
        } else if (isDescending) {
            const targetVelY = -7.5;
            this.body.velocity.y += (targetVelY - this.body.velocity.y) * Math.min(1.0, dt * 7.0);
        } else if (isGrounded) {
            this.body.velocity.y = 0;
        } else {
            // Идеальное зависание на текущей высоте с компенсацией гравитации
            this.body.velocity.y += (0.0 - this.body.velocity.y) * Math.min(1.0, dt * 6.0);
            this.body.applyForce(new CANNON.Vec3(0, 1250 * 9.82, 0), this.body.position);
        }

        // 2. Управление курсом (Поворот носа влево / вправо)
        // Влево (A / Джойстик влево): вертолет поворачивает влево и плавно кренится влево
        // Вправо (D / Джойстик вправо): вертолет поворачивает вправо и плавно кренится вправо
        let yawRate = 0.0;
        let targetRoll = 0.0;
        if (inputKeys.left) {
            yawRate = 1.75;
            targetRoll = -0.26;
        }
        if (inputKeys.right) {
            yawRate = -1.75;
            targetRoll = 0.26;
        }
        this.headingAngle += yawRate * dt;

        // 3. Тангаж (Pitch / Вперед-Назад)
        // W = ПОЛЕТ ВПЕРЕД (наклон носа вниз), S = ПОЛЕТ НАЗАД / ТОРМОЗ (наклон носа вверх)
        let targetForwardVel = 0.0;
        let targetPitch = 0.0;
        if (inputKeys.forward) {
            targetForwardVel = 35.0; // Вперед ~125 км/ч
            targetPitch = -0.24;
        } else if (inputKeys.backward) {
            targetForwardVel = -18.0; // Назад / торможение
            targetPitch = 0.22;
        }

        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, Math.min(1.0, dt * 5.5));
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, Math.min(1.0, dt * 5.5));

        // 4. Стабилизированная аэродинамика движения (без заносов и кружения по спирали)
        const fwdX = Math.sin(this.headingAngle);
        const fwdZ = Math.cos(this.headingAngle);
        const rightX = Math.cos(this.headingAngle);
        const rightZ = -Math.sin(this.headingAngle);

        if (isGrounded && targetForwardVel === 0) {
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
        } else {
            // Разложение текущей скорости на продольную и поперечную
            const currentForward = this.body.velocity.x * fwdX + this.body.velocity.z * fwdZ;
            const currentLateral = this.body.velocity.x * rightX + this.body.velocity.z * rightZ;

            // Плавное ускорение вперед и быстрое гашение бокового сноса (Lateral Damping)
            const newForward = THREE.MathUtils.lerp(currentForward, targetForwardVel, Math.min(1.0, dt * 4.8));
            const newLateral = currentLateral * Math.exp(-6.5 * dt);

            this.body.velocity.x = fwdX * newForward + rightX * newLateral;
            this.body.velocity.z = fwdZ * newForward + rightZ * newLateral;
        }

        // 5. Ориентация вертолета
        this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
        this.body.angularVelocity.set(0, 0, 0);

        // Предотвращение проваливания под рельеф
        if (this.body.position.y < groundY + 0.95) {
            this.body.position.y = groundY + 0.95;
            if (this.body.velocity.y < 0) this.body.velocity.y = 0;
        }
    }

    update(deltaTime, player, inputKeys) {
        const dt = Math.min(deltaTime, 0.1);

        // 1. Раскрутка / остановка винтов (RPM 0..1)
        if (this.rotorRPM < this.targetRotorRPM) {
            this.rotorRPM = Math.min(1.0, this.rotorRPM + dt * 0.65);
        } else if (this.rotorRPM > this.targetRotorRPM) {
            this.rotorRPM = Math.max(0.0, this.rotorRPM - dt * 0.45);
        }

        // Вращение 3D лопастей
        if (this.rotorRPM > 0.001) {
            const rotSpeed = this.rotorRPM * 42.0;
            this.rotorAngle += dt * rotSpeed;
            if (this.mainRotorHub) this.mainRotorHub.rotation.y = this.rotorAngle;

            this.tailRotorAngle += dt * rotSpeed * 1.8;
            if (this.tailRotorHub) this.tailRotorHub.rotation.x = this.tailRotorAngle;

            this.updateAudio(this.rotorRPM);
        }

        // Мигающий маяк на хвосте
        if (this.navBeacon) {
            this.navBeacon.intensity = (Math.sin(Date.now() * 0.008) > 0.6) ? 2.5 : 0.2;
        }

        // 2. Управление полетом
        if (this.isPiloted) {
            this.applyFlightControls(inputKeys, dt);
        } else if (this.isRemotelyPiloted) {
            // Плавная интерполяция перемещения вертолета союзника (Standoff 2 style smoothing)
            const elapsedSec = Math.min(0.2, (performance.now() - (this.netLastPacketTime || performance.now())) / 1000);
            const predictedPos = this.netTargetPos.clone().addScaledVector(this.netVelocity, elapsedSec);

            const lerpFactor = 1.0 - Math.exp(-22.0 * dt);
            this.body.position.x += (predictedPos.x - this.body.position.x) * lerpFactor;
            this.body.position.y += (predictedPos.y - this.body.position.y) * lerpFactor;
            this.body.position.z += (predictedPos.z - this.body.position.z) * lerpFactor;
            this.body.velocity.copy(this.netVelocity);
            this.group.position.copy(this.body.position);

            let diffYaw = this.netTargetHeading - this.headingAngle;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            this.headingAngle += diffYaw * lerpFactor;
            this.pitchAngle += (this.netTargetPitch - this.pitchAngle) * lerpFactor;
            this.rollAngle += (this.netTargetRoll - this.rollAngle) * lerpFactor;

            this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
            this.group.quaternion.copy(this.body.quaternion);

            this.targetRotorRPM = 1.0;
            if (this.rotorRPM < 0.9) this.rotorRPM = 1.0;
        }

        // 3. Позиционирование локального персонажа внутри кабины (Пилот или Пассажир)
        if (this.isPiloted || this.isPassenger) {
            const seatOffset = this.getSeatOffset(this.seatIndex || 0);
            const worldSeat = seatOffset.clone().applyQuaternion(this.group.quaternion).add(this.group.position);
            if (player && player.mesh) {
                player.mesh.position.copy(worldSeat);
                player.mesh.quaternion.copy(this.group.quaternion);
                player.mesh.scale.set(0.85, 0.85, 0.85);

                const l = player.limbs;
                if (l && l.torso) {
                    l.torso.position.y = 0.38;
                    l.leftLeg.pivot.rotation.x = -1.45;
                    l.rightLeg.pivot.rotation.x = -1.45;
                    l.leftLeg.knee.rotation.x = 1.45;
                    l.rightLeg.knee.rotation.x = 1.45;
                    l.leftArm.pivot.rotation.set(-0.55, 0.15, 0.2);
                    l.rightArm.pivot.rotation.set(-0.55, -0.15, -0.2);
                }
            }

            // Обновление HUD
            const speedKmh = Math.hypot(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z) * 3.6;
            const speedElem = document.getElementById('hud-speed');
            const gearElem = document.getElementById('hud-gear');
            if (speedElem) speedElem.innerText = speedKmh.toFixed(1);
            if (gearElem) gearElem.innerText = this.isPassenger ? `[ПАССАЖИР 2/2]` : `ALT: ${Math.max(0, Math.round(this.body.position.y))}m`;
        }

        // 4. Синхронизация 3D группы с физическим телом Cannon
        this.group.position.copy(this.body.position);
        this.group.quaternion.copy(this.body.quaternion);
    }
}

window.HelicopterVehicle = HelicopterVehicle;
