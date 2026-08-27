/**
         * Монолитный плоский пол и надежная физическая плоскость Cannon.js
         */
        class ProceduralTerrainManager {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;

                this.mesh = null;
                this.cityGroundMesh = null;
                this.body = null;

                this.generateFlatGround();
            }

            getTerrainHeight(x, z) {
                return 0.0;
            }

            isPositionOnDirt(x, z) {
                const dist = Math.hypot(x, z);
                return dist > 200.0;
            }

            generateFlatGround() {
                // 1. Общий природный настил карты (600м х 600м, опущен вниз на 15см для устранения Z-fighting)
                const worldGroundGeo = new THREE.PlaneGeometry(600, 600);
                const worldGroundMat = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createGrassTexture(),
                    depthWrite: true
                });
                this.mesh = new THREE.Mesh(worldGroundGeo, worldGroundMat);
                this.mesh.rotation.x = -Math.PI / 2;
                this.mesh.position.set(0, -0.15, 0);
                this.mesh.receiveShadow = true;
                this.scene.add(this.mesh);

                // 2. Городской плоский асфальтово-плиточный настил (300м х 300м) с гарантированным приоритетом глубины
                const cityGroundGeo = new THREE.PlaneGeometry(300, 300);
                const cityGroundMat = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createCityGroundTexture(),
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1,
                    depthWrite: true
                });
                this.cityGroundMesh = new THREE.Mesh(cityGroundGeo, cityGroundMat);
                this.cityGroundMesh.rotation.x = -Math.PI / 2;
                this.cityGroundMesh.position.set(0, 0.0, 0);
                this.cityGroundMesh.receiveShadow = true;
                this.scene.add(this.cityGroundMesh);

                // 3. Безупречное физическое тело CANNON.Plane на Y = 0 (если еще не создано в world)
                if (this.world && this.physicsMaterials && this.physicsMaterials.ground) {
                    const existingGround = this.world.bodies.find(b => b.material === this.physicsMaterials.ground);
                    if (!existingGround) {
                        const groundBody = new CANNON.Body({ mass: 0, material: this.physicsMaterials.ground });
                        groundBody.addShape(new CANNON.Plane());
                        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
                        this.world.addBody(groundBody);
                        this.body = groundBody;
                    } else {
                        this.body = existingGround;
                    }
                }
            }
        }

window.ProceduralTerrainManager = ProceduralTerrainManager;
