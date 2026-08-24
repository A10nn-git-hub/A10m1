/**
 * Класс удаленного сетевого игрока (RemotePlayer)
 * Рендерит 3D-модель персонажа, неймтег с никнеймом и здоровьем, баббл сообщений чата
 * и выполняет плавную интерполяцию координат (Snapshot Interpolation) и анимаций.
 */
class RemotePlayer {
    constructor(scene, playerId, initialData = {}) {
        this.scene = scene;
        this.playerId = playerId;
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
        this.limbs = {};

        this.buildMesh();
        this.buildNameplate();

        this.group.position.copy(this.currentPos);
        this.group.rotation.y = this.currentRotY;
        this.scene.add(this.group);
    }

    hashString(str) {
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

        this.group.add(torsoGroup);
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
            this.group.add(hip);
            return { pivot: hip, knee };
        };

        this.limbs.leftLeg = createLeg(true);
        this.limbs.rightLeg = createLeg(false);
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

        if (data.rotY !== undefined) this.targetRotY = data.rotY;
        if (data.walkCycle !== undefined) this.walkCycle = data.walkCycle;
        if (data.speed !== undefined) this.speed = data.speed;
        if (data.isSprinting !== undefined) this.isSprinting = data.isSprinting;
        if (data.isDriving !== undefined) this.isDriving = data.isDriving;
        if (data.vehicleId !== undefined) this.vehicleId = data.vehicleId;
        if (data.weaponIndex !== undefined) this.weaponIndex = data.weaponIndex;

        if (data.nickname && data.nickname !== this.nickname) {
            this.nickname = data.nickname;
            this.redrawNameplate();
        }

        if (data.health !== undefined && data.health !== this.health) {
            this.health = data.health;
            this.redrawNameplate();
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

        // 1. Плавная интерполяция позиции (Hermite Lerp)
        const lerpFactor = 1.0 - Math.exp(-14.0 * dt);
        this.currentPos.lerp(this.targetPos, lerpFactor);
        this.group.position.copy(this.currentPos);

        // 2. Плавный поворот персонажа
        let diff = this.targetRotY - this.currentRotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentRotY += diff * lerpFactor;
        this.group.rotation.y = this.currentRotY;

        // 3. Таймер показа сообщения чата
        if (this.chatMessageTimer > 0) {
            this.chatMessageTimer -= dt;
            if (this.chatMessageTimer <= 0) {
                this.chatMessage = '';
                this.redrawNameplate();
            }
        }

        // 4. Процедурная анимация ходьбы / бега / вождения
        if (this.isDriving) {
            // Персонаж сидит в машине
            if (this.limbs.leftLeg && this.limbs.rightLeg) {
                this.limbs.leftLeg.pivot.rotation.x = -Math.PI / 2;
                this.limbs.rightLeg.pivot.rotation.x = -Math.PI / 2;
                this.limbs.leftLeg.knee.rotation.x = Math.PI / 2;
                this.limbs.rightLeg.knee.rotation.x = Math.PI / 2;
            }
            if (this.limbs.leftArm && this.limbs.rightArm) {
                this.limbs.leftArm.pivot.rotation.x = -0.7;
                this.limbs.rightArm.pivot.rotation.x = -0.7;
            }
            if (this.limbs.torso) this.limbs.torso.position.y = 0.85;
            return;
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
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
        if (this.nameplateTexture) this.nameplateTexture.dispose();
    }
}

window.RemotePlayer = RemotePlayer;
