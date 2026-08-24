/**
 * CombatVFXManager - визуальные спецэффекты стрельбы, попаданий, взрывов и трассеров пуль
 */
class CombatVFXManager {
    constructor(scene) {
        this.scene = scene;
        this.tracers = [];
        this.sparks = [];
        this.smokeParticles = [];
        this.muzzleFlashes = [];
        this.explosions = [];

        this.tracerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffe680,
            transparent: true,
            opacity: 0.95
        });

        this.sparkMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 1.0
        });

        this.smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.7
        });

        this.fireMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            transparent: true,
            opacity: 0.85
        });
    }

    createMuzzleFlash(position, direction) {
        const group = new THREE.Group();
        group.position.copy(position);

        const flashGeo = new THREE.SphereGeometry(0.18, 6, 6);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.95 });
        const flashMesh = new THREE.Mesh(flashGeo, flashMat);
        group.add(flashMesh);

        const coneGeo = new THREE.ConeGeometry(0.12, 0.35, 6);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.85 });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.copy(direction).multiplyScalar(0.18);
        coneMesh.lookAt(position.clone().add(direction));
        group.add(coneMesh);

        const light = new THREE.PointLight(0xffaa22, 3.5, 8.0);
        group.add(light);

        this.scene.add(group);
        this.muzzleFlashes.push({ group, flashMesh, coneMesh, light, life: 0.06 });
    }

    createBulletTracer(startPos, endPos) {
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const length = dir.length();
        if (length < 0.1) return;

        const geom = new THREE.CylinderGeometry(0.02, 0.02, Math.min(length, 4.0), 4);
        geom.rotateX(Math.PI / 2);
        const mesh = new THREE.Mesh(geom, this.tracerMaterial.clone());

        mesh.position.copy(startPos);
        mesh.lookAt(endPos);

        this.scene.add(mesh);
        this.tracers.push({
            mesh,
            startPos: startPos.clone(),
            endPos: endPos.clone(),
            dir: dir.normalize(),
            speed: 130.0,
            currentDist: 0,
            maxDist: length,
            life: 0.2
        });
    }

    createImpactSparks(position, normal) {
        const count = 6 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.035, 4, 4);
            const sparkMesh = new THREE.Mesh(sparkGeo, this.sparkMaterial);
            sparkMesh.position.copy(position);

            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                Math.random() * 2.0 + 0.5,
                (Math.random() - 0.5) * 2.0
            );
            if (normal) {
                spread.addScaledVector(normal, 2.5);
            }
            spread.normalize().multiplyScalar(4.0 + Math.random() * 6.0);

            this.scene.add(sparkMesh);
            this.sparks.push({
                mesh: sparkMesh,
                vel: spread,
                life: 0.35 + Math.random() * 0.25,
                maxLife: 0.5
            });
        }
    }

    createExplosion(position, radius = 5.0) {
        const group = new THREE.Group();
        group.position.copy(position);

        const fireGeo = new THREE.SphereGeometry(radius * 0.5, 12, 12);
        const fireMesh = new THREE.Mesh(fireGeo, this.fireMaterial.clone());
        group.add(fireMesh);

        const ringGeo = new THREE.RingGeometry(0.1, 0.4, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.1;
        group.add(ringMesh);

        const light = new THREE.PointLight(0xff5500, 8.0, radius * 3.5);
        light.position.y = 1.0;
        group.add(light);

        this.scene.add(group);

        this.explosions.push({
            group,
            fireMesh,
            ringMesh,
            light,
            scale: 0.2,
            targetRadius: radius,
            life: 0.85,
            maxLife: 0.85
        });

        for (let i = 0; i < 14; i++) {
            const smokeGeo = new THREE.SphereGeometry(0.6 + Math.random() * 0.8, 6, 6);
            const smokeMesh = new THREE.Mesh(smokeGeo, this.smokeMaterial.clone());
            smokeMesh.position.copy(position).add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                Math.random() * 1.5,
                (Math.random() - 0.5) * 2.0
            ));

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 6.0,
                3.0 + Math.random() * 5.0,
                (Math.random() - 0.5) * 6.0
            );

            this.scene.add(smokeMesh);
            this.smokeParticles.push({
                mesh: smokeMesh,
                vel,
                scale: 1.0,
                growth: 1.8 + Math.random() * 1.5,
                life: 1.6 + Math.random() * 1.2,
                maxLife: 2.2
            });
        }
    }

    createRocketSmoke(position) {
        const smokeGeo = new THREE.SphereGeometry(0.25, 4, 4);
        const smokeMat = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.55
        });
        const mesh = new THREE.Mesh(smokeGeo, smokeMat);
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.smokeParticles.push({
            mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4),
            scale: 0.5,
            growth: 1.2,
            life: 0.6,
            maxLife: 0.6
        });
    }

    triggerHitMarker() {
        const crosshair = document.getElementById('crosshair');
        if (!crosshair) return;
        crosshair.classList.remove('hit');
        void crosshair.offsetWidth;
        crosshair.classList.add('hit');
        setTimeout(() => crosshair.classList.remove('hit'), 150);
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);

        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const mf = this.muzzleFlashes[i];
            mf.life -= dt;
            if (mf.life <= 0) {
                this.scene.remove(mf.group);
                this.muzzleFlashes.splice(i, 1);
            }
        }

        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const tr = this.tracers[i];
            tr.life -= dt;
            tr.currentDist += tr.speed * dt;
            tr.mesh.position.copy(tr.startPos).addScaledVector(tr.dir, tr.currentDist);

            if (tr.life <= 0 || tr.currentDist >= tr.maxDist) {
                this.scene.remove(tr.mesh);
                this.tracers.splice(i, 1);
            }
        }

        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const sp = this.sparks[i];
            sp.life -= dt;
            sp.vel.y -= 12.0 * dt;
            sp.mesh.position.addScaledVector(sp.vel, dt);
            const alpha = Math.max(0, sp.life / sp.maxLife);
            sp.mesh.material.opacity = alpha;

            if (sp.life <= 0) {
                this.scene.remove(sp.mesh);
                this.sparks.splice(i, 1);
            }
        }

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const ex = this.explosions[i];
            ex.life -= dt;
            const progress = 1.0 - (ex.life / ex.maxLife);

            ex.scale = THREE.MathUtils.lerp(0.2, ex.targetRadius, Math.min(1.0, progress * 2.5));
            ex.fireMesh.scale.setScalar(ex.scale);
            ex.ringMesh.scale.setScalar(ex.scale * 1.8);

            ex.fireMesh.material.opacity = Math.max(0, 1.0 - progress);
            ex.ringMesh.material.opacity = Math.max(0, (1.0 - progress) * 0.8);
            ex.light.intensity = Math.max(0, (1.0 - progress) * 8.0);

            if (ex.life <= 0) {
                this.scene.remove(ex.group);
                this.explosions.splice(i, 1);
            }
        }

        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const sm = this.smokeParticles[i];
            sm.life -= dt;
            sm.mesh.position.addScaledVector(sm.vel, dt);
            sm.scale += sm.growth * dt;
            sm.mesh.scale.setScalar(sm.scale);

            const alpha = Math.max(0, (sm.life / sm.maxLife) * 0.65);
            sm.mesh.material.opacity = alpha;

            if (sm.life <= 0) {
                this.scene.remove(sm.mesh);
                this.smokeParticles.splice(i, 1);
            }
        }
    }
}
window.CombatVFXManager = CombatVFXManager;
