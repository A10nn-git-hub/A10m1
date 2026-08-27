/**
         * Физический интерактивный футбольный мяч (Cannon.js + Three.js)
         */
        class PhysicalSoccerBall {
            constructor(scene, world, physicsMaterials, posX, posY, posZ) {
                this.scene = scene;
                this.world = world;

                const radius = 0.22;
                const ballGeo = new THREE.SphereGeometry(radius, 20, 20);
                const ballMat = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createSoccerBallTexture()
                });
                this.mesh = new THREE.Mesh(ballGeo, ballMat);
                this.mesh.castShadow = true;
                this.mesh.receiveShadow = true;
                this.scene.add(this.mesh);

                this.body = new CANNON.Body({
                    mass: 0.45,
                    material: physicsMaterials.ball,
                    position: new CANNON.Vec3(posX, posY, posZ),
                    linearDamping: 0.15,
                    angularDamping: 0.25
                });
                this.body.addShape(new CANNON.Sphere(radius));
                this.world.addBody(this.body);
            }

            kick(dirX, dirY, dirZ, force) {
                const len = Math.hypot(dirX, dirZ) || 1;
                this.body.velocity.x = (dirX / len) * force;
                this.body.velocity.y = dirY;
                this.body.velocity.z = (dirZ / len) * force;
                this.body.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
            }

            update() {
                this.mesh.position.copy(this.body.position);
                this.mesh.quaternion.copy(this.body.quaternion);

                const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                    ? window.gameEngine.terrainManager.getTerrainHeight(this.body.position.x, this.body.position.z)
                    : 0.0;
                if (this.body.position.y < groundY + 0.22) {
                    this.body.position.y = groundY + 0.22;
                    if (this.body.velocity.y < 0) this.body.velocity.y = -this.body.velocity.y * 0.75;
                }
            }
        }

window.PhysicalSoccerBall = PhysicalSoccerBall;
