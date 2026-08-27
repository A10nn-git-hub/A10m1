/**
 * WeaponSystem - отключена система оружия по запросу пользователя (чистый режим без оружия)
 */
class WeaponSystem {
    constructor(scene, camera, player, vfxManager, explosionSystem) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.vfx = vfxManager;
        this.explosionSystem = explosionSystem;

        this.weapons = [];
        this.currentWeaponIndex = -1;
        this.fireCooldown = 0.0;
        this.isAiming = false;
        this.isFiring = false;
        this.rockets = [];

        this.raycaster = new THREE.Raycaster();
        this.weaponContainer = new THREE.Group();
        this.weaponContainer.visible = false;

        // Скрыть и удалить элементы HUD оружия и прицела
        const weaponHud = document.getElementById('weapon-hud');
        if (weaponHud) weaponHud.style.display = 'none';
        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.display = 'none';
    }

    buildProceduralWeaponMeshes() {}
    attachWeaponToHand() {}

    initHUD() {
        const weaponHud = document.getElementById('weapon-hud');
        if (weaponHud) weaponHud.style.display = 'none';
    }

    updateHUD() {
        const weaponHud = document.getElementById('weapon-hud');
        if (weaponHud) weaponHud.style.display = 'none';
    }

    selectWeapon(index) {}
    nextWeapon() {}
    prevWeapon() {}
    addAmmo(weaponId, amount) {}

    fire() {}
    startFiring() {}
    stopFiring() {}
    update(deltaTime) {}
}
window.WeaponSystem = WeaponSystem;
