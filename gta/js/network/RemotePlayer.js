/**
 * Класс удаленного сетевого игрока (RemotePlayer)
 * Рендерит 3D-модель персонажа, неймтег с никнеймом и здоровьем, баббл сообщений чата
 * и выполняет плавную интерполяцию координат (Snapshot Interpolation) и анимаций.
 */
class RemotePlayer {
    constructor(scene, playerId, initialData = {}) {
        this.scene = scene;
        this.playerId = playerId;
        this.colorSeed = this.hashString(playerId);
        this.nickname = initialData.nickname || `Игрок_${playerId.substring(0, 4)}`;
        this.health = initialData.health !== undefined ? initialData.health : 100;
        const initY = initialData.y !== undefined ? initialData.y : 0;
        this.currentPos = new THREE.Vector3(initialData.x !== undefined ? initialData.x : 0, initY, initialData.z !== undefined ? initialData.z : 0);
        this.targetPos = new THREE.Vector3().copy(this.currentPos);
        this.prevPos = new THREE.Vector3().copy(this.currentPos);

        this.currentRotY = initialData.rotY || 0;
        this.targetRotY = initialData.rotY || 0;

        this.walkCycle = initialData.walkCycle || 0;
        this.speed = initialData.speed || 0;
        this.isSprinting = !!initialData.isSprinting;
        this.isDriving = !!initialData.isDriving;
        this.vehicleId = initialData.vehicleId || null;
        this.weaponIndex = initialData.weaponIndex || 0;

        this.lastUpdateTime = Date.now();
        this.chatMessage = '';
        this.chatMessageTimer = 0;

        this.group = new THREE.Group();
        this.characterGroup = new THREE.Group();
        this.group.add(this.characterGroup);
        this.carGroup = null;
        this.limbs = {};

        this.buildMesh();
        this.buildRemoteCar();
        this.buildNameplate();

        this.group.position.copy(this.currentPos);
        this.group.rotation.y = this.currentRotY;
        this.scene.add(this.group);
    }

    hashString(str) {
        if (!str || typeof str !== 'string') return Math.floor(Math.random() * 100);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    buildMesh() {
        const clothesPalettes = [
            { jacket: 0x0284c7, pants: 0x1e293b, skin: 0xdca17a, shirt: 0xffffff }, // Голубой
            { jacket: 0x16a34a, pants: 0x334155, skin: 0xf5d0b5, shirt: 0x0f172a }, // Зеленый
            { jacket: 0xdc2626, pants: 0x18181b, skin: 0xb87b56, shirt: 0xfafafa }, // Красный
            { jacket: 0x9333ea, pants: 0x27272a, skin: 0xdca17a, shirt: 0x18181b }, // Фиолетовый
            { jacket: 0xea580c, pants: 0x1e293b, skin: 0x7c4f35, shirt: 0xffffff }, // Оранжевый
            { jacket: 0x0d9488, pants: 0x0f172a, skin: 0xf5d0b5, shirt: 0xf3f4f6 }  // Бирюзовый
        ];
        const pal = clothesPalettes[this.colorSeed % clothesPalettes.length];

        const matSkin = new THREE.MeshLambertMaterial({ color: pal.skin });
        const matJacket = new THREE.MeshLambertMaterial({ color: pal.jacket });
        const matShirt = new THREE.MeshLambertMaterial({ color: pal.shirt });
        const matPants = new THREE.MeshLambertMaterial({ color: pal.pants });
        const matShoes = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const matGlasses = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
        const matGlassesFrame = new THREE.MeshBasicMaterial({ color: 0xd4af37 });

        // Торс
        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 1.15, 0);

        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 0.28), matJacket);
        chest.position.set(0, 0.1, 0);
        chest.castShadow = true; chest.receiveShadow = true;
        torsoGroup.add(chest);

        const innerShirt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.05), matShirt);
        innerShirt.position.set(0, 0.12, 0.12);
        torsoGroup.add(innerShirt);

        const belly = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.25), matJacket);
        belly.position.set(0, -0.18, 0); belly.castShadow = true;
        torsoGroup.add(belly);

        this.characterGroup.add(torsoGroup);
        this.limbs.torso = torsoGroup;

        // Голова
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.38, 0);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10), matSkin);
        neck.position.set(0, -0.02, 0);
        headGroup.add(neck);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.26), matSkin);
        head.position.set(0, 0.16, 0); head.castShadow = true;
        headGroup.add(head);

        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x1e1510 }));
        hair.position.set(0, 0.27, -0.01);
        headGroup.add(hair);

        const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.07, 0.04), matGlasses);
        glasses.position.set(0, 0.17, 0.14);
        headGroup.add(glasses);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.05), matGlassesFrame);
        frame.position.set(0, 0.2, 0.14);
        headGroup.add(frame);

        torsoGroup.add(headGroup);
        this.limbs.head = headGroup;

        // Руки
        const createArm = (isLeft) => {
            const side = isLeft ? 1 : -1;
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.32, 0.26, 0);

            const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.16), matJacket);
            shoulder.position.set(0, -0.12, 0); shoulder.castShadow = true;
            pivot.add(shoulder);

            const forearm = new THREE.Group();
            forearm.position.set(0, -0.26, 0);

            const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.13), matSkin);
            forearmMesh.position.set(0, -0.11, 0); forearmMesh.castShadow = true;
            forearm.add(forearmMesh);

            const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.08), matSkin);
            handMesh.position.set(0, -0.26, 0); handMesh.castShadow = true;
            forearm.add(handMesh);

            pivot.add(forearm);
            torsoGroup.add(pivot);
            return { pivot, forearm };
        };

        this.limbs.leftArm = createArm(true);
        this.limbs.rightArm = createArm(false);

        // Ноги
        const createLeg = (isLeft) => {
            const side = isLeft ? 1 : -1;
            const hip = new THREE.Group();
            hip.position.set(side * 0.14, 0.88, 0);

            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.2), matPants);
            thigh.position.set(0, -0.2, 0); thigh.castShadow = true;
            hip.add(thigh);

            const knee = new THREE.Group();
            knee.position.set(0, -0.42, 0);

            const calf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), matPants);
            calf.position.set(0, -0.18, 0); calf.castShadow = true;
            knee.add(calf);

            const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), matShoes);
            shoe.position.set(0, 0.04, 0.04); shoe.castShadow = true;
            knee.add(shoe);

            hip.add(knee);
            this.characterGroup.add(hip);
            return { pivot: hip, knee };
        };

        this.limbs.leftLeg = createLeg(true);
        this.limbs.rightLeg = createLeg(false);
    }

    buildRemoteCar() {
        this.carGroup = new THREE.Group();
        this.carGroup.visible = false;

        const carColors = [0xd32f2f, 0x0288d1, 0xfbc02d, 0x2e7d32, 0x9333ea, 0x15181e];
        const carCol = carColors[this.colorSeed % carColors.length];
        const matBody = new THREE.MeshLambertMaterial({ color: carCol });
        const matGlass = new THREE.MeshLambertMaterial({ color: 0x1e293b, transparent: true, opacity: 0.75 });
        const matWheel = new THREE.MeshLambertMaterial({ color: 0x18181b });

        // Шасси и кузов
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 4.2), matBody);
        bodyMesh.position.set(0, 0.45, 0);
        bodyMesh.castShadow = true;
        this.carGroup.add(bodyMesh);

        // Крыша и кабина
        const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 2.0), matGlass);
        cabinMesh.position.set(0, 0.85, -0.2);
        cabinMesh.castShadow = true;
        this.carGroup.add(cabinMesh);

        // Колеса
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelOffsets = [
            [-0.95, 0.38, 1.3],
            [0.95, 0.38, 1.3],
            [-0.95, 0.38, -1.3],
            [0.95, 0.38, -1.3]
        ];
        wheelOffsets.forEach(([wx, wy, wz]) => {
            const wMesh = new THREE.Mesh(wheelGeo, matWheel);
            wMesh.position.set(wx, wy, wz);
            wMesh.castShadow = true;
            this.carGroup.add(wMesh);
        });

        // Фары
        const matLight = new THREE.MeshBasicMaterial({ color: 0xfff5cc });
        const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), matLight);
        hl1.position.set(-0.65, 0.48, 2.12);
        const hl2 = hl1.clone();
        hl2.position.x = 0.65;
        this.carGroup.add(hl1);
        this.carGroup.add(hl2);

        this.group.add(this.carGroup);
    }

    buildNameplate() {
        this.nameplateCanvas = document.createElement('canvas');
        this.nameplateCanvas.width = 384;
        this.nameplateCanvas.height = 128;
        this.nameplateCtx = this.nameplateCanvas.getContext('2d');

        this.nameplateTexture = new THREE.CanvasTexture(this.nameplateCanvas);
        this.nameplateTexture.minFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({
            map: this.nameplateTexture,
            transparent: true,
            depthTest: false
        });

        this.nameplateSprite = new THREE.Sprite(spriteMat);
        this.nameplateSprite.position.set(0, 2.25, 0);
        this.nameplateSprite.scale.set(1.9, 0.63, 1.0);
        this.group.add(this.nameplateSprite);

        this.redrawNameplate();
    }

    redrawNameplate() {
        if (!this.nameplateCtx) return;
        const ctx = this.nameplateCtx;
        ctx.clearRect(0, 0, 384, 128);

        // 1. Плашка никнейма
        ctx.fillStyle = 'rgba(10, 15, 29, 0.82)';
        this.roundRect(ctx, 32, 20, 320, 52, 10);
        ctx.fill();

        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.5;
        this.roundRect(ctx, 32, 20, 320, 52, 10);
        ctx.stroke();

        // Текст никнейма
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.nickname, 192, 46);

        // 2. Полоска здоровья (Health Bar)
        const barX = 48;
        const barY = 80;
        const barW = 288;
        const barH = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.roundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fill();

        const healthRatio = Math.max(0, Math.min(1.0, this.health / 100));
        const healthW = barW * healthRatio;
        if (healthW > 0) {
            ctx.fillStyle = healthRatio > 0.4 ? '#10b981' : '#ef4444';
            this.roundRect(ctx, barX, barY, healthW, barH, 4);
            ctx.fill();
        }

        // 3. Сообщение чата (если активно)
        if (this.chatMessage && this.chatMessageTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            this.roundRect(ctx, 16, 96, 352, 28, 6);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 16px -apple-system, sans-serif';
            const cleanMsg = this.chatMessage.length > 28 ? this.chatMessage.substring(0, 26) + '...' : this.chatMessage;
            ctx.fillText(`💬 ${cleanMsg}`, 192, 110);
        }

        this.nameplateTexture.needsUpdate = true;
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Принять сетевой пакет состояния от Firebase
     */
    applyNetworkState(data) {
        if (!data) return;

        this.prevPos.copy(this.currentPos);
        if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
            this.targetPos.set(data.x, data.y, data.z);
        }

        if (data.nickname && data.nickname !== this.nickname) {
            this.nickname = data.nickname;
            this.redrawNameplate();
        }

        if (data.health !== undefined && data.health !== this.health) {
            this.health = data.health;
            this.redrawNameplate();
        }

        const wasDriving = this.isDriving;
        const oldCarIndex = this.carIndex;
        const oldSeatIndex = this.seatIndex;

        if (data.isDriving !== undefined) this.isDriving = !!data.isDriving;
        if (data.carIndex !== undefined) this.carIndex = data.carIndex;
        if (data.seatIndex !== undefined) this.seatIndex = data.seatIndex;
        if (data.vehicleId !== undefined) this.vehicleId = data.vehicleId;
        if (data.weaponIndex !== undefined) this.weaponIndex = data.weaponIndex;

        // Синхронизация занятости мест в автопарке мира
        if (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.cars) {
            const cars = window.gameEngine.vehicleManager.cars;

            // Если игрок вышел из машины или пересел
            if (wasDriving && (!this.isDriving || oldCarIndex !== this.carIndex || oldSeatIndex !== this.seatIndex)) {
                if (oldCarIndex !== undefined && cars[oldCarIndex]) {
                    cars[oldCarIndex].removeOccupant(this.playerId);
                }
            }

            // Если игрок сидит в машине
            if (this.isDriving && this.carIndex !== undefined && cars[this.carIndex]) {
                cars[this.carIndex].setOccupant(this.seatIndex !== undefined ? this.seatIndex : 0, this.playerId);
            }
        }

        // Если удаленный игрок является ВОДИТЕЛЕМ (seatIndex === 0), он авторитетно управляет перемещением машины
        if (this.isDriving && (this.seatIndex === 0 || this.seatIndex === undefined) && this.carIndex !== undefined && window.gameEngine && window.gameEngine.vehicleManager) {
            const sharedCar = window.gameEngine.vehicleManager.cars[this.carIndex];
            const localCar = window.gameEngine.vehicleManager.activeDrivenCar;
            const localIsDriver = (localCar === sharedCar && !window.gameEngine.vehicleManager.isPassenger && window.gameEngine.vehicleManager.seatIndex === 0);

            // Если локальный игрок НЕ является водителем этого авто (например, он пассажир или пешком)
            if (sharedCar && !localIsDriver) {
                if (data.carX !== undefined && data.carY !== undefined && data.carZ !== undefined) {
                    if (sharedCar.chassisBody) {
                        sharedCar.chassisBody.position.set(data.carX, data.carY, data.carZ);
                        sharedCar.chassisBody.velocity.set(0, 0, 0);
                        sharedCar.chassisBody.angularVelocity.set(0, 0, 0);
                    }
                    if (sharedCar.carGroup) {
                        sharedCar.carGroup.position.set(data.carX, data.carY, data.carZ);
                        if (data.carRotY !== undefined) {
                            sharedCar.carGroup.rotation.set(0, data.carRotY, 0);
                            if (sharedCar.chassisBody) {
                                sharedCar.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), data.carRotY);
                            }
                        }
                    }
                }
            }
        }

        const wasFlyingHeli = this.isFlyingHeli;
        const oldHeliSeat = this.heliSeat;

        if (data.isFlyingHeli !== undefined) this.isFlyingHeli = !!data.isFlyingHeli;
        if (data.heliSeat !== undefined) this.heliSeat = data.heliSeat;

        const heli = window.gameEngine?.helicopter;
        if (heli) {
            if (wasFlyingHeli && (!this.isFlyingHeli || oldHeliSeat !== this.heliSeat)) {
                heli.removeOccupant(this.playerId);
            }
            if (this.isFlyingHeli) {
                heli.setOccupant(this.heliSeat !== undefined ? this.heliSeat : 0, this.playerId);
                if ((this.heliSeat === 0 || this.heliSeat === undefined) && !heli.isPiloted) {
                    if (data.heliX !== undefined && data.heliY !== undefined && data.heliZ !== undefined) {
                        heli.body.position.set(data.heliX, data.heliY, data.heliZ);
                        heli.body.velocity.set(0, 0, 0);
                        heli.body.angularVelocity.set(0, 0, 0);
                        heli.group.position.set(data.heliX, data.heliY, data.heliZ);
                        if (data.heliRotY !== undefined) {
                            heli.headingAngle = data.heliRotY;
                            heli.pitchAngle = data.heliPitch || 0;
                            heli.rollAngle = data.heliRoll || 0;
                            heli.group.rotation.set(0, data.heliRotY, 0);
                            heli.body.quaternion.setFromEuler(heli.pitchAngle, heli.headingAngle, heli.rollAngle, 'YXZ');
                        }
                    }
                    if (heli.rotorRPM < 0.8) {
                        heli.rotorRPM = 1.0;
                        heli.targetRotorRPM = 1.0;
                        heli.startAudio();
                    }
                }
            }
        }

        this.lastUpdateTime = Date.now();
    }

    setChatMessage(msg) {
        this.chatMessage = msg;
        this.chatMessageTimer = 5.0; // 5 секунд показа над головой
        this.redrawNameplate();
    }

    /**
     * Обновление интерполяции и процедурной анимации конечностей
     */
    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);

        // 1. Нахождение внутри вертолета Maverick (Пилот или Пассажир)
        if (this.isFlyingHeli && window.gameEngine && window.gameEngine.helicopter) {
            const heli = window.gameEngine.helicopter;
            const seatOffset = heli.getSeatOffset(this.heliSeat || 0);
            const worldSeat = seatOffset.clone().applyQuaternion(heli.group.quaternion).add(heli.group.position);

            this.group.position.copy(worldSeat);
            this.group.quaternion.copy(heli.group.quaternion);
            this.characterGroup.scale.set(0.85, 0.85, 0.85);

            if (this.nameplateSprite) this.nameplateSprite.position.set(0, 2.35, 0);

            if (this.limbs.torso) this.limbs.torso.position.y = 0.38;
            if (this.limbs.leftLeg && this.limbs.rightLeg) {
                this.limbs.leftLeg.pivot.rotation.x = -1.45;
                this.limbs.rightLeg.pivot.rotation.x = -1.45;
                this.limbs.leftLeg.knee.rotation.x = 1.45;
                this.limbs.rightLeg.knee.rotation.x = 1.45;
            }
            if (this.limbs.leftArm && this.limbs.rightArm) {
                this.limbs.leftArm.pivot.rotation.set(-0.55, 0.15, 0.2);
                this.limbs.rightArm.pivot.rotation.set(-0.55, -0.15, -0.2);
            }
            return;
        }
        this.characterGroup.scale.set(1, 1, 1);

        // 2. Плавная интерполяция позиции (Hermite Lerp)
        const lerpFactor = 1.0 - Math.exp(-14.0 * dt);
        this.currentPos.lerp(this.targetPos, lerpFactor);

        // 3. Плавный поворот персонажа
        let diff = this.targetRotY - this.currentRotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentRotY += diff * lerpFactor;

        // 3. Проверка нахождения в общем автомобиле мира
        let isInsideSharedCar = false;
        if (this.isDriving && this.carIndex !== undefined && window.gameEngine && window.gameEngine.vehicleManager) {
            const sharedCar = window.gameEngine.vehicleManager.cars[this.carIndex];
            if (sharedCar && sharedCar.carGroup) {
                isInsideSharedCar = true;
                const seatOffset = sharedCar.getSeatOffset(this.seatIndex || 0);
                const worldSeat = seatOffset.clone().applyQuaternion(sharedCar.carGroup.quaternion).add(sharedCar.carGroup.position);

                this.group.position.copy(worldSeat);
                this.group.quaternion.copy(sharedCar.carGroup.quaternion);

                if (this.nameplateSprite) {
                    this.nameplateSprite.position.set(0, 2.35, 0);
                }

                // Посадка в кресло
                if (this.limbs.torso) this.limbs.torso.position.y = 0.55;
                if (this.limbs.leftLeg && this.limbs.rightLeg) {
                    this.limbs.leftLeg.pivot.rotation.x = -1.45;
                    this.limbs.rightLeg.pivot.rotation.x = -1.45;
                    this.limbs.leftLeg.knee.rotation.x = 1.45;
                    this.limbs.rightLeg.knee.rotation.x = 1.45;
                }
                if (this.limbs.leftArm && this.limbs.rightArm) {
                    if (this.seatIndex === 0) {
                        this.limbs.leftArm.pivot.rotation.set(-0.75, 0.2, 0.3);
                        this.limbs.rightArm.pivot.rotation.set(-0.75, -0.2, -0.3);
                    } else {
                        this.limbs.leftArm.pivot.rotation.set(-0.4, 0.1, 0.1);
                        this.limbs.rightArm.pivot.rotation.set(-0.4, -0.1, -0.1);
                    }
                }
                return;
            }
        }

        // Вне автомобиля (пешком)
        this.group.position.copy(this.currentPos);
        this.group.rotation.set(0, this.currentRotY, 0);
        if (this.nameplateSprite) this.nameplateSprite.position.set(0, 2.25, 0);

        // 4. Таймер показа сообщения чата
        if (this.chatMessageTimer > 0) {
            this.chatMessageTimer -= dt;
            if (this.chatMessageTimer <= 0) {
                this.chatMessage = '';
                this.redrawNameplate();
            }
        }

        if (this.limbs.torso) this.limbs.torso.position.y = 1.15;

        const isMoving = this.speed > 0.25 || this.currentPos.distanceTo(this.targetPos) > 0.08;
        if (isMoving) {
            const freq = this.isSprinting ? 12.0 : 7.5;
            this.walkCycle += dt * freq;

            const armSwing = Math.sin(this.walkCycle) * (this.isSprinting ? 0.95 : 0.55);
            const legSwing = Math.sin(this.walkCycle) * (this.isSprinting ? 1.05 : 0.65);

            if (this.limbs.leftArm) this.limbs.leftArm.pivot.rotation.x = armSwing;
            if (this.limbs.rightArm) this.limbs.rightArm.pivot.rotation.x = -armSwing;

            if (this.limbs.leftLeg) {
                this.limbs.leftLeg.pivot.rotation.x = -legSwing;
                this.limbs.leftLeg.knee.rotation.x = Math.max(0, legSwing * 0.9);
            }
            if (this.limbs.rightLeg) {
                this.limbs.rightLeg.pivot.rotation.x = legSwing;
                this.limbs.rightLeg.knee.rotation.x = Math.max(0, -legSwing * 0.9);
            }
        } else {
            // Плавный сброс в стойку покоя (Idle)
            const resetLerp = 1.0 - Math.exp(-12.0 * dt);
            if (this.limbs.leftArm) this.limbs.leftArm.pivot.rotation.x += (0 - this.limbs.leftArm.pivot.rotation.x) * resetLerp;
            if (this.limbs.rightArm) this.limbs.rightArm.pivot.rotation.x += (0 - this.limbs.rightArm.pivot.rotation.x) * resetLerp;
            if (this.limbs.leftLeg) {
                this.limbs.leftLeg.pivot.rotation.x += (0 - this.limbs.leftLeg.pivot.rotation.x) * resetLerp;
                this.limbs.leftLeg.knee.rotation.x += (0 - this.limbs.leftLeg.knee.rotation.x) * resetLerp;
            }
            if (this.limbs.rightLeg) {
                this.limbs.rightLeg.pivot.rotation.x += (0 - this.limbs.rightLeg.pivot.rotation.x) * resetLerp;
                this.limbs.rightLeg.knee.rotation.x += (0 - this.limbs.rightLeg.knee.rotation.x) * resetLerp;
            }
        }
    }

    destroy() {
        if (this.isDriving && this.carIndex !== undefined && window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.cars) {
            const car = window.gameEngine.vehicleManager.cars[this.carIndex];
            if (car) car.removeOccupant(this.playerId);
        }
        if (this.isFlyingHeli && window.gameEngine && window.gameEngine.helicopter) {
            window.gameEngine.helicopter.removeOccupant(this.playerId);
        }
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
        if (this.nameplateTexture) this.nameplateTexture.dispose();
    }
}

window.RemotePlayer = RemotePlayer;
