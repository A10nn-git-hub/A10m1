/**
 * PoliceVehicleManager - менеджер спавна, жизненного цикла и координации патрульных машин и офицеров полиции
 */
class PoliceVehicleManager {
    constructor(scene, world, physicsMaterials) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.policeCars = [];
        this.officers = [];
        this.spawnCooldown = 0.0;
    }

    spawnPoliceCar(playerPos, playerYaw = 0) {
        if (this.policeCars.length >= 4) return;

        // Спавним машину в 40-60 метрах перед или позади игрока
        const angle = playerYaw + (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
        const dist = 45.0 + Math.random() * 15.0;
        const spawnX = playerPos.x + Math.sin(angle) * dist;
        const spawnZ = playerPos.z + Math.cos(angle) * dist;

        const pCar = new PoliceVehicle(
            this.scene, this.world, this.physicsMaterials,
            spawnX, spawnZ, angle + Math.PI
        );
        this.policeCars.push(pCar);
    }

    spawnOfficersNearCar(carPos) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            if (this.officers.length >= 8) break;
            const offsetX = (i === 0 ? -1.8 : 1.8);
            const officer = new PoliceOfficerNPC(
                this.scene, this.world, this.physicsMaterials,
                new THREE.Vector3(carPos.x + offsetX, carPos.y, carPos.z)
            );
            this.officers.push(officer);
        }
    }

    clearAllPolice() {
        for (let i = 0; i < this.policeCars.length; i++) {
            this.policeCars[i].destroy();
        }
        this.policeCars = [];

        for (let i = 0; i < this.officers.length; i++) {
            this.officers[i].destroy();
        }
        this.officers = [];
    }

    update(deltaTime, playerPos, wantedStars) {
        const dt = Math.min(deltaTime, 0.1);

        if (this.spawnCooldown > 0) {
            this.spawnCooldown -= dt;
        }

        // Автоматический спавн подкрепления при розыске >= 2 звезд
        if (wantedStars >= 2 && playerPos && this.spawnCooldown <= 0) {
            const maxCars = (wantedStars >= 4) ? 4 : (wantedStars >= 3 ? 2 : 1);
            if (this.policeCars.length < maxCars) {
                this.spawnPoliceCar(playerPos);
                this.spawnCooldown = 8.0 - wantedStars * 1.0;
            }
        }

        // Обновление патрульных машин
        for (let i = this.policeCars.length - 1; i >= 0; i--) {
            const pCar = this.policeCars[i];
            pCar.update(dt, playerPos, this);

            // Удаление машины, если игрок уехал слишком далеко (> 140м)
            if (playerPos && pCar.chassisBody) {
                const d = Math.hypot(playerPos.x - pCar.chassisBody.position.x, playerPos.z - pCar.chassisBody.position.z);
                if (d > 140.0) {
                    pCar.destroy();
                    this.policeCars.splice(i, 1);
                }
            }
        }

        // Обновление офицеров
        for (let i = this.officers.length - 1; i >= 0; i--) {
            const off = this.officers[i];
            off.update(dt, playerPos);

            if (playerPos && off.body) {
                const d = Math.hypot(playerPos.x - off.body.position.x, playerPos.z - off.body.position.z);
                if (d > 100.0) {
                    off.destroy();
                    this.officers.splice(i, 1);
                }
            }
        }
    }
}
window.PoliceVehicleManager = PoliceVehicleManager;
