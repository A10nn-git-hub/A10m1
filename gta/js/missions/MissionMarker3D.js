/**
 * MissionMarker3D - 3D светящиеся цилиндры и анимированные маркеры миссий и чекпоинтов в мире
 */
class MissionMarker3D {
    constructor(scene, type, x, y, z, title, reward) {
        this.scene = scene;
        this.type = type;
        this.position = new THREE.Vector3(x, y, z);
        this.title = title;
        this.reward = reward;
        this.animTimer = Math.random() * Math.PI;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.buildMarkerVisuals();
    }

    buildMarkerVisuals() {
        let color = 0x00f0ff;
        if (this.type === 'TAXI') color = 0xffd700;
        else if (this.type === 'GANG') color = 0xff3344;
        else if (this.type === 'DELIVERY') color = 0x22c55e;
        else if (this.type === 'CHECKPOINT') color = 0xffe600;

        // 1. Светящийся столб света (Light Pillar)
        const pillarGeo = new THREE.CylinderGeometry(1.6, 1.6, 12.0, 16, 1, true);
        const pillarMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
        });
        this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
        this.pillar.position.y = 6.0;
        this.group.add(this.pillar);

        // 2. Внутренний яркий луч
        const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 14.0, 8, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        this.beam = new THREE.Mesh(beamGeo, beamMat);
        this.beam.position.y = 7.0;
        this.group.add(this.beam);

        // 3. Кольцо на земле
        const ringGeo = new THREE.RingGeometry(1.2, 1.8, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        this.groundRing = new THREE.Mesh(ringGeo, ringMat);
        this.groundRing.position.y = 0.08;
        this.group.add(this.groundRing);

        // 4. Парящая иконка
        const iconGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const iconMat = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.2,
            metalness: 0.8,
            emissive: color,
            emissiveIntensity: 0.4
        });
        this.floatingBox = new THREE.Mesh(iconGeo, iconMat);
        this.floatingBox.position.y = 1.6;
        this.group.add(this.floatingBox);
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        this.animTimer += dt * 2.2;

        // Вращение столба и парящего элемента
        if (this.pillar) this.pillar.rotation.y += dt * 0.8;
        if (this.floatingBox) {
            this.floatingBox.rotation.y += dt * 2.0;
            this.floatingBox.rotation.x = Math.sin(this.animTimer) * 0.2;
            this.floatingBox.position.y = 1.6 + Math.sin(this.animTimer * 1.5) * 0.35;
        }

        // Пульсация кольца на земле
        if (this.groundRing) {
            const s = 1.0 + Math.sin(this.animTimer * 2.0) * 0.12;
            this.groundRing.scale.set(s, s, s);
        }
    }

    destroy() {
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
    }
}
window.MissionMarker3D = MissionMarker3D;
