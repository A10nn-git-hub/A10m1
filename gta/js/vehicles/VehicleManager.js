/**
         * Менеджер автопарка и кинематики посадки / высадки
         */
        class VehicleManager {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;

                this.cars = [];
                this.activeDrivenCar = null;

                this.transitionState = 'ON_FOOT';
                this.transitionTimer = 0.0;
                this.transitionDuration = 0.95;
                this.transitionCar = null;

                this.promptElement = document.getElementById('vehicle-prompt');
                this.promptActionText = document.getElementById('prompt-action-text');
                this.promptCarName = document.getElementById('prompt-car-name');
                this.playerModeElement = document.getElementById('stat-player-mode');
                this.hudModeTitle = document.getElementById('hud-mode-title');
                this.hudGear = document.getElementById('hud-gear');
                this.hudSpeed = document.getElementById('hud-speed');

                this.spawnShowcaseVehicles();
            }

            spawnShowcaseVehicles() {
                const carFleet = [
                    { x: -18.5, z: -18.0, rot: 0, color: 0xd32f2f, name: 'Comet S2', topSpeed: 248 },
                    { x: 18.5, z: -18.0, rot: Math.PI, color: 0x0288d1, name: 'Elegy RH8', topSpeed: 215 },
                    { x: -38.5, z: -24.0, rot: Math.PI / 2, color: 0x15181e, name: 'Schafter V12', topSpeed: 205 },
                    { x: 38.5, z: -24.0, rot: -Math.PI / 2, color: 0xfbc02d, name: 'Infernus', topSpeed: 240 },
                    { x: -18.0, z: 18.0, rot: 0, color: 0xf5f5f5, name: 'Torero XO', topSpeed: 252 },
                    { x: 18.0, z: 18.0, rot: Math.PI, color: 0x2e7d32, name: 'Buffalo STX', topSpeed: 225 }
                ];

                for (let i = 0; i < carFleet.length; i++) {
                    const c = carFleet[i];
                    const car = new DetailedCarModel(
                        this.scene, this.world, this.physicsMaterials, c.x, c.z, c.rot, c.color, c.name, c.topSpeed
                    );
                    this.cars.push(car);
                }
            }

            findNearestCar(playerPos, maxDist = 4.2) {
                let nearest = null;
                let minDist = maxDist;

                for (let i = 0; i < this.cars.length; i++) {
                    const car = this.cars[i];
                    // Проверка разницы высот по Y (предотвращает посадку в машину с 10 этажа или крыши)
                    const dy = Math.abs(car.chassisBody.position.y - playerPos.y);
                    if (dy > 2.0) continue;

                    const d = Math.hypot(car.chassisBody.position.x - playerPos.x, car.chassisBody.position.z - playerPos.z);
                    if (d < minDist) {
                        minDist = d;
                        nearest = car;
                    }
                }
                return nearest;
            }

            toggleActiveCarHeadlights() {
                if (this.activeDrivenCar) {
                    return this.activeDrivenCar.toggleHeadlights();
                }
                return false;
            }

            forceEjectPlayer(player) {
                if (!this.activeDrivenCar) return;
                const car = this.activeDrivenCar;
                if (car.soundController) car.soundController.stopEngine();

                player.body.position.set(
                    car.chassisBody.position.x - 2.2,
                    car.chassisBody.position.y + 1.2,
                    car.chassisBody.position.z
                );
                player.body.velocity.set(-3.0, 2.5, 0);
                player.mesh.visible = true;

                this.activeDrivenCar = null;
                this.transitionState = 'ON_FOOT';
                if (this.playerModeElement) this.playerModeElement.innerText = 'Пешком';
                if (this.hudModeTitle) this.hudModeTitle.innerText = 'ПРОТАГОНИСТ';
                if (this.hudGear) this.hudGear.innerText = '';
            }

            toggleEnterExitVehicle(player) {
                if (this.transitionState === 'ENTERING_VEHICLE' || this.transitionState === 'EXITING_VEHICLE') {
                    return;
                }

                if (this.activeDrivenCar) {
                    this.transitionState = 'EXITING_VEHICLE';
                    this.transitionTimer = 0.0;
                    this.transitionDuration = 0.95;
                    this.transitionCar = this.activeDrivenCar;

                    if (this.activeDrivenCar.soundController) {
                        this.activeDrivenCar.soundController.stopEngine();
                    }

                    this.transitionCar.vehicle.setBrake(100, 0);
                    this.transitionCar.vehicle.setBrake(100, 1);
                    this.transitionCar.vehicle.setBrake(100, 2);
                    this.transitionCar.vehicle.setBrake(100, 3);

                    if (this.hudModeTitle) this.hudModeTitle.innerText = 'ВЫХОД...';
                } else {
                    const nearest = this.findNearestCar(player.body.position, 4.2);
                    if (nearest) {
                        if (nearest.isOverturned()) {
                            nearest.resetToWheels();
                        } else {
                            this.transitionState = 'ENTERING_VEHICLE';
                            this.transitionTimer = 0.0;
                            this.transitionDuration = 1.05;
                            this.transitionCar = nearest;

                            this.transitionCar.vehicle.setBrake(100, 0);
                            this.transitionCar.vehicle.setBrake(100, 1);
                            this.transitionCar.vehicle.setBrake(100, 2);
                            this.transitionCar.vehicle.setBrake(100, 3);

                            if (this.hudModeTitle) this.hudModeTitle.innerText = 'ПОСАДКА...';
                        }
                    }
                }
            }

            update(deltaTime, player, inputKeys) {
                if (this.transitionState === 'ENTERING_VEHICLE' && this.transitionCar) {
                    this.transitionTimer += deltaTime;
                    const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);

                    this.transitionCar.vehicle.setBrake(100, 0);
                    this.transitionCar.vehicle.setBrake(100, 1);
                    this.transitionCar.vehicle.setBrake(100, 2);
                    this.transitionCar.vehicle.setBrake(100, 3);

                    let doorAngle = 0;
                    if (progress < 0.35) {
                        doorAngle = (progress / 0.35) * 0.96;
                    } else if (progress < 0.75) {
                        doorAngle = 0.96;
                    } else {
                        doorAngle = (1.0 - ((progress - 0.75) / 0.25)) * 0.96;
                    }
                    this.transitionCar.setDriverDoorAngle(doorAngle);

                    const carPos = this.transitionCar.chassisBody.position;
                    const doorOffset = new THREE.Vector3(-1.3, 0.0, 0.1).applyQuaternion(this.transitionCar.carGroup.quaternion);
                    const seatOffset = new THREE.Vector3(-0.42, 0.22, -0.15).applyQuaternion(this.transitionCar.carGroup.quaternion);

                    const targetPos = new THREE.Vector3().lerpVectors(
                        new THREE.Vector3(carPos.x + doorOffset.x, carPos.y, carPos.z + doorOffset.z),
                        new THREE.Vector3(carPos.x + seatOffset.x, carPos.y, carPos.z + seatOffset.z),
                        progress
                    );
                    player.mesh.position.copy(targetPos);
                    player.mesh.quaternion.copy(this.transitionCar.carGroup.quaternion);

                    const l = player.limbs;
                    if (l && l.torso) {
                        const squatFactor = Math.min(1.0, progress * 1.3);
                        l.torso.position.y = THREE.MathUtils.lerp(1.15, 0.48, squatFactor);
                        l.torso.rotation.x = THREE.MathUtils.lerp(0.0, 0.28, Math.sin(progress * Math.PI));

                        l.leftLeg.pivot.rotation.x = THREE.MathUtils.lerp(0.0, -1.45, squatFactor);
                        l.rightLeg.pivot.rotation.x = THREE.MathUtils.lerp(0.0, -1.45, squatFactor);
                        l.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(0.0, 1.45, squatFactor);
                        l.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(0.0, 1.45, squatFactor);

                        l.leftArm.pivot.rotation.set(THREE.MathUtils.lerp(0.0, -0.7, squatFactor), 0.2, 0.3);
                        l.rightArm.pivot.rotation.set(THREE.MathUtils.lerp(-1.2, -0.7, squatFactor), -0.2, -0.3);
                    }

                    if (progress >= 1.0) {
                        this.activeDrivenCar = this.transitionCar;
                        this.transitionCar.setDriverDoorAngle(0.0);
                        this.transitionState = 'DRIVING';
                        this.transitionCar = null;

                        player.mesh.visible = false;
                        player.body.position.set(0, -100, 0);

                        this.activeDrivenCar.vehicle.setBrake(0, 0);
                        this.activeDrivenCar.vehicle.setBrake(0, 1);
                        this.activeDrivenCar.vehicle.setBrake(0, 2);
                        this.activeDrivenCar.vehicle.setBrake(0, 3);

                        // Звук закрытия двери авто
                        if (window.soundEngine) {
                            window.soundEngine.playDoorClose(carPos.x, carPos.y, carPos.z);
                        }

                        // Запуск звука двигателя
                        if (this.activeDrivenCar.soundController) {
                            this.activeDrivenCar.soundController.startEngine();
                        }

                        if (this.playerModeElement) this.playerModeElement.innerText = `За рулем (${this.activeDrivenCar.carName})`;
                        if (this.hudModeTitle) this.hudModeTitle.innerText = this.activeDrivenCar.carName.toUpperCase();
                    }
                } else if (this.transitionState === 'EXITING_VEHICLE' && this.transitionCar) {
                    this.transitionTimer += deltaTime;
                    const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);

                    this.transitionCar.vehicle.setBrake(100, 0);
                    this.transitionCar.vehicle.setBrake(100, 1);
                    this.transitionCar.vehicle.setBrake(100, 2);
                    this.transitionCar.vehicle.setBrake(100, 3);

                    let doorAngle = 0;
                    if (progress < 0.35) {
                        doorAngle = (progress / 0.35) * 0.96;
                    } else if (progress < 0.7) {
                        doorAngle = 0.96;
                    } else {
                        doorAngle = (1.0 - ((progress - 0.7) / 0.3)) * 0.96;
                    }
                    this.transitionCar.setDriverDoorAngle(doorAngle);

                    player.mesh.visible = true;
                    const carPos = this.transitionCar.chassisBody.position;
                    const seatOffset = new THREE.Vector3(-0.42, 0.22, -0.15).applyQuaternion(this.transitionCar.carGroup.quaternion);
                    const exitOffset = new THREE.Vector3(-1.85, 0.0, 0.0).applyQuaternion(this.transitionCar.carGroup.quaternion);

                    const targetPos = new THREE.Vector3().lerpVectors(
                        new THREE.Vector3(carPos.x + seatOffset.x, carPos.y, carPos.z + seatOffset.z),
                        new THREE.Vector3(carPos.x + exitOffset.x, carPos.y, carPos.z + exitOffset.z),
                        progress
                    );
                    player.mesh.position.copy(targetPos);
                    player.mesh.quaternion.copy(this.transitionCar.carGroup.quaternion);

                    const l = player.limbs;
                    if (l && l.torso) {
                        const standFactor = Math.min(1.0, progress * 1.3);
                        l.torso.position.y = THREE.MathUtils.lerp(0.48, 1.15, standFactor);
                        l.torso.rotation.x = THREE.MathUtils.lerp(0.28, 0.0, Math.sin(progress * Math.PI));

                        l.leftLeg.pivot.rotation.x = THREE.MathUtils.lerp(-1.45, 0.0, standFactor);
                        l.rightLeg.pivot.rotation.x = THREE.MathUtils.lerp(-1.45, 0.0, standFactor);
                        l.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(1.45, 0.0, standFactor);
                        l.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(1.45, 0.0, standFactor);

                        l.leftArm.pivot.rotation.set(0, 0, 0);
                        l.rightArm.pivot.rotation.set(0, 0, 0);
                    }

                    if (progress >= 1.0) {
                        this.transitionCar.setDriverDoorAngle(0.0);
                        player.body.position.set(targetPos.x, targetPos.y + 0.815, targetPos.z);
                        player.body.velocity.set(0, 0, 0);

                        // Звук закрытия двери авто
                        if (window.soundEngine) {
                            window.soundEngine.playDoorClose(carPos.x, carPos.y, carPos.z);
                        }

                        this.activeDrivenCar = null;
                        this.transitionState = 'ON_FOOT';
                        this.transitionCar = null;

                        if (this.playerModeElement) this.playerModeElement.innerText = 'Пешком';
                        if (this.hudModeTitle) this.hudModeTitle.innerText = 'ПРОТАГОНИСТ';
                        if (this.hudGear) this.hudGear.innerText = '';
                    }
                } else if (this.activeDrivenCar) {
                    this.activeDrivenCar.applyDriverInput(inputKeys, deltaTime);
                    
                    const speedKmh = this.activeDrivenCar.getSpeedKmh();
                    if (this.hudSpeed) this.hudSpeed.innerText = speedKmh.toFixed(1);
                    if (this.hudGear) this.hudGear.innerText = `[${this.activeDrivenCar.getGearName()}]`;
                    if (this.hudModeTitle) this.hudModeTitle.innerText = this.activeDrivenCar.carName.toUpperCase();

                    if (this.promptElement) this.promptElement.style.display = 'none';

                    if (this.activeDrivenCar.isOverturned()) {
                        this.activeDrivenCar.rolloverTimer = (this.activeDrivenCar.rolloverTimer || 0) + deltaTime;
                        if (this.activeDrivenCar.rolloverTimer > 0.45) {
                            this.forceEjectPlayer(player);
                        }
                    } else if (this.activeDrivenCar) {
                        this.activeDrivenCar.rolloverTimer = 0;
                    }
                } else if (player && player.body) {
                    const nearest = this.findNearestCar(player.body.position, 4.2);
                    if (nearest && this.promptElement) {
                        this.promptElement.style.display = 'block';
                        if (this.promptCarName) this.promptCarName.innerText = nearest.carName;
                        if (this.promptActionText) {
                            this.promptActionText.innerText = nearest.isOverturned() ? 'Перевернуть на колеса' : 'Сесть за руль';
                        }
                    } else if (this.promptElement) {
                        this.promptElement.style.display = 'none';
                    }
                }

                for (let i = 0; i < this.cars.length; i++) {
                    this.cars[i].update(deltaTime);
                }
            }

            setPowerSavingMode(isEco) {
                for (let i = 0; i < this.cars.length; i++) {
                    const car = this.cars[i];
                    if (typeof car.setEcoMode === 'function') {
                        car.setEcoMode(isEco);
                    }
                    if (isEco && car !== this.activeDrivenCar && car.chassisBody) {
                        car.chassisBody.sleep();
                    }
                }
            }
        }
