/**
 * Менеджер автопарка и кинематики посадки / высадки (4 места в авто: 1 водитель + 3 пассажира)
 */
class VehicleManager {
    constructor(scene, world, physicsMaterials) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.cars = [];
        this.activeDrivenCar = null;
        this.isPassenger = false;
        this.seatIndex = 0;

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

        this._tDoorOffset = new THREE.Vector3();
        this._tSeatOffset = new THREE.Vector3();
        this._tExitOffset = new THREE.Vector3();
        this._tPosA = new THREE.Vector3();
        this._tPosB = new THREE.Vector3();
        this._tTargetPos = new THREE.Vector3();

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
            car.carIndex = i;
            car.initialSpawnX = c.x;
            car.initialSpawnZ = c.z;
            car.initialSpawnRot = c.rot;
            this.cars.push(car);
        }
    }

    /**
     * Сброс всех автомобилей автопарка в исходные парковочные места при выходе из карты
     */
    resetAllCars() {
        this.activeDrivenCar = null;
        this.isPassenger = false;
        this.transitionState = 'ON_FOOT';
        this.transitionTimer = 0.0;
        this.transitionCar = null;

        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            const sx = car.initialSpawnX !== undefined ? car.initialSpawnX : 0;
            const sz = car.initialSpawnZ !== undefined ? car.initialSpawnZ : 0;
            const sRot = car.initialSpawnRot !== undefined ? car.initialSpawnRot : 0;

            if (car.soundController) {
                try { car.soundController.stopEngine(); } catch (e) {}
            }
            car.occupants = {};
            if (car.chassisBody) {
                car.chassisBody.position.set(sx, 0.8, sz);
                car.chassisBody.velocity.set(0, 0, 0);
                car.chassisBody.angularVelocity.set(0, 0, 0);
                if (typeof CANNON !== 'undefined') {
                    const q = new CANNON.Quaternion();
                    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), sRot);
                    car.chassisBody.quaternion.copy(q);
                }
            }
            if (car.carGroup) {
                car.carGroup.position.set(sx, 0.8, sz);
                car.carGroup.rotation.set(0, sRot, 0);
            }
            if (typeof car.resetToWheels === 'function') {
                car.resetToWheels();
            }
        }
    }

    findNearestCar(playerPos, maxDist = 4.2) {
        let nearest = null;
        let minDist = maxDist;

        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            const dy = Math.abs(car.chassisBody.position.y - playerPos.y);
            if (dy > 2.2) continue;

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
        if (!this.isPassenger && car.soundController) car.soundController.stopEngine();
        car.removeOccupant('local');

        player.body.position.set(
            car.chassisBody.position.x - 2.2,
            car.chassisBody.position.y + 1.2,
            car.chassisBody.position.z
        );
        player.body.velocity.set(-3.0, 2.5, 0);
        player.mesh.visible = true;

        const carIndex = car.carIndex;
        const carX = car.carGroup ? car.carGroup.position.x : car.chassisBody.position.x;
        const carY = car.carGroup ? car.carGroup.position.y : car.chassisBody.position.y;
        const carZ = car.carGroup ? car.carGroup.position.z : car.chassisBody.position.z;
        const carRotY = car.carGroup ? car.carGroup.rotation.y : 0;
        const wasDriver = !this.isPassenger;

        this.activeDrivenCar = null;
        this.isPassenger = false;
        this.seatIndex = 0;
        this.transitionState = 'ON_FOOT';

        if (window.gameEngine && window.gameEngine.multiplayerManager) {
            window.gameEngine.multiplayerManager.sendLocalStateNow();
            if (wasDriver && carIndex !== undefined) {
                window.gameEngine.multiplayerManager.broadcastCarSync(carIndex, carX, carY, carZ, carRotY, false);
            }
        }

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

            if (!this.isPassenger && this.activeDrivenCar.soundController) {
                this.activeDrivenCar.soundController.stopEngine();
            }

            if (this.hudModeTitle) this.hudModeTitle.innerText = 'ВЫХОД...';
        } else {
            const nearest = this.findNearestCar(player.body.position, 4.2);
            if (nearest) {
                if (nearest.isOverturned()) {
                    nearest.resetToWheels();
                } else {
                    const seatIdx = nearest.getFirstAvailableSeat();
                    if (seatIdx === -1) {
                        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                            window.gameEngine.multiplayerHUD.addSystemMessage(`❌ Автомобиль "${nearest.carName}" полностью заполнен (4/4 мест)!`);
                        }
                        return;
                    }

                    this.seatIndex = seatIdx;
                    this.isPassenger = (seatIdx > 0);
                    nearest.setOccupant(seatIdx, 'local');
                    this.transitionState = 'ENTERING_VEHICLE';
                    this.transitionTimer = 0.0;
                    this.transitionDuration = 1.05;
                    this.transitionCar = nearest;

                    // Немедленное оповещение сети о занятии места
                    if (window.gameEngine && window.gameEngine.multiplayerManager) {
                        window.gameEngine.multiplayerManager.sendLocalStateNow();
                    }

                    if (this.hudModeTitle) {
                        this.hudModeTitle.innerText = this.isPassenger ? `ПОСАДКА (ПАССАЖИР [Место ${seatIdx + 1}])...` : 'ПОСАДКА ЗА РУЛЬ...';
                    }
                }
            }
        }
    }

    update(deltaTime, player, inputKeys) {
        if (this.transitionState === 'ENTERING_VEHICLE' && this.transitionCar) {
            this.transitionTimer += deltaTime;
            const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);

            let doorAngle = 0;
            if (progress < 0.35) {
                doorAngle = (progress / 0.35) * 0.96;
            } else if (progress < 0.75) {
                doorAngle = 0.96;
            } else {
                doorAngle = (1.0 - ((progress - 0.75) / 0.25)) * 0.96;
            }
            if (this.seatIndex === 0) {
                this.transitionCar.setDriverDoorAngle(doorAngle);
            }

            const carPos = this.transitionCar.chassisBody.position;
            const isLeft = (this.seatIndex % 2 === 0);
            const doorOffset = this._tDoorOffset.set(isLeft ? -1.3 : 1.3, 0.0, this.seatIndex > 1 ? -0.7 : 0.1).applyQuaternion(this.transitionCar.carGroup.quaternion);
            const rawSeat = this.transitionCar.getSeatOffset(this.seatIndex);
            const seatOffset = this._tSeatOffset.set(rawSeat.x, rawSeat.y, rawSeat.z).applyQuaternion(this.transitionCar.carGroup.quaternion);

            const posA = this._tPosA.set(carPos.x + doorOffset.x, carPos.y, carPos.z + doorOffset.z);
            const posB = this._tPosB.set(carPos.x + seatOffset.x, carPos.y, carPos.z + seatOffset.z);
            const targetPos = this._tTargetPos.lerpVectors(posA, posB, progress);
            player.mesh.position.copy(targetPos);
            player.mesh.quaternion.copy(this.transitionCar.carGroup.quaternion);

            const l = player.limbs;
            if (l && l.torso) {
                const squatFactor = Math.min(1.0, progress * 1.3);
                l.torso.position.y = THREE.MathUtils.lerp(1.15, 0.55, squatFactor);
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
                this.transitionCar.setOccupant(this.seatIndex, 'local');
                this.transitionState = this.isPassenger ? 'PASSENGER' : 'DRIVING';
                this.transitionCar = null;

                player.mesh.visible = true;

                if (!this.isPassenger) {
                    this.activeDrivenCar.chassisBody.wakeUp();
                    this.activeDrivenCar.vehicle.setBrake(0, 0);
                    this.activeDrivenCar.vehicle.setBrake(0, 1);
                    this.activeDrivenCar.vehicle.setBrake(0, 2);
                    this.activeDrivenCar.vehicle.setBrake(0, 3);

                    if (this.activeDrivenCar.soundController) {
                        this.activeDrivenCar.soundController.startEngine();
                    }

                    if (this.playerModeElement) this.playerModeElement.innerText = `За рулем (${this.activeDrivenCar.carName})`;
                    if (this.hudModeTitle) this.hudModeTitle.innerText = this.activeDrivenCar.carName.toUpperCase();
                } else {
                    if (this.playerModeElement) this.playerModeElement.innerText = `Пассажир [Место ${this.seatIndex + 1}] (${this.activeDrivenCar.carName})`;
                    if (this.hudModeTitle) this.hudModeTitle.innerText = `ПАССАЖИР (${this.activeDrivenCar.carName})`;
                }

                if (window.soundEngine) {
                    window.soundEngine.playDoorClose(carPos.x, carPos.y, carPos.z);
                }
            }
        } else if (this.transitionState === 'EXITING_VEHICLE' && this.transitionCar) {
            this.transitionTimer += deltaTime;
            const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);

            let doorAngle = 0;
            if (progress < 0.35) {
                doorAngle = (progress / 0.35) * 0.96;
            } else if (progress < 0.7) {
                doorAngle = 0.96;
            } else {
                doorAngle = (1.0 - ((progress - 0.7) / 0.3)) * 0.96;
            }
            if (this.seatIndex === 0) {
                this.transitionCar.setDriverDoorAngle(doorAngle);
            }

            player.mesh.visible = true;
            const carPos = this.transitionCar.chassisBody.position;
            const isLeft = (this.seatIndex % 2 === 0);
            const rawSeat = this.transitionCar.getSeatOffset(this.seatIndex);
            const seatOffset = this._tSeatOffset.set(rawSeat.x, rawSeat.y, rawSeat.z).applyQuaternion(this.transitionCar.carGroup.quaternion);
            const exitOffset = this._tExitOffset.set(isLeft ? -1.85 : 1.85, 0.0, this.seatIndex > 1 ? -0.7 : 0.0).applyQuaternion(this.transitionCar.carGroup.quaternion);

            const posA = this._tPosA.set(carPos.x + seatOffset.x, carPos.y, carPos.z + seatOffset.z);
            const posB = this._tPosB.set(carPos.x + exitOffset.x, carPos.y, carPos.z + exitOffset.z);
            const targetPos = this._tTargetPos.lerpVectors(posA, posB, progress);
            player.mesh.position.copy(targetPos);
            player.mesh.quaternion.copy(this.transitionCar.carGroup.quaternion);

            const l = player.limbs;
            if (l && l.torso) {
                const standFactor = Math.min(1.0, progress * 1.3);
                l.torso.position.y = THREE.MathUtils.lerp(0.55, 1.15, standFactor);
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
                this.transitionCar.removeOccupant('local');

                player.body.position.set(targetPos.x, targetPos.y + 0.815, targetPos.z);
                player.body.velocity.set(0, 0, 0);

                if (window.soundEngine) {
                    window.soundEngine.playDoorClose(carPos.x, carPos.y, carPos.z);
                }

                const exitedCar = this.transitionCar;
                const wasDriver = !this.isPassenger;
                const carIdx = exitedCar ? exitedCar.carIndex : undefined;
                const cX = exitedCar && exitedCar.carGroup ? exitedCar.carGroup.position.x : carPos.x;
                const cY = exitedCar && exitedCar.carGroup ? exitedCar.carGroup.position.y : carPos.y;
                const cZ = exitedCar && exitedCar.carGroup ? exitedCar.carGroup.position.z : carPos.z;
                const cRotY = exitedCar && exitedCar.carGroup ? exitedCar.carGroup.rotation.y : 0;

                this.activeDrivenCar = null;
                this.isPassenger = false;
                this.seatIndex = 0;
                this.transitionState = 'ON_FOOT';
                this.transitionCar = null;

                if (window.gameEngine && window.gameEngine.multiplayerManager) {
                    window.gameEngine.multiplayerManager.sendLocalStateNow();
                    if (wasDriver && carIdx !== undefined) {
                        window.gameEngine.multiplayerManager.broadcastCarSync(carIdx, cX, cY, cZ, cRotY, false);
                    }
                }

                if (this.playerModeElement) this.playerModeElement.innerText = 'Пешком';
                if (this.hudModeTitle) this.hudModeTitle.innerText = 'ПРОТАГОНИСТ';
                if (this.hudGear) this.hudGear.innerText = '';
            }
        } else if (this.activeDrivenCar) {
            const car = this.activeDrivenCar;

            if (!this.isPassenger) {
                car.applyDriverInput(inputKeys, deltaTime);
            }

            // Позиционирование тела и визуала игрока строго в занятом кресле автомобиля
            const seatOffset = car.getSeatOffset(this.seatIndex);
            const worldSeat = seatOffset.clone().applyQuaternion(car.carGroup.quaternion).add(car.carGroup.position);
            player.mesh.position.copy(worldSeat);
            player.mesh.quaternion.copy(car.carGroup.quaternion);

            const l = player.limbs;
            if (l && l.torso) {
                l.torso.position.y = 0.55;
                l.leftLeg.pivot.rotation.x = -1.45;
                l.rightLeg.pivot.rotation.x = -1.45;
                l.leftLeg.knee.rotation.x = 1.45;
                l.rightLeg.knee.rotation.x = 1.45;
                if (!this.isPassenger) {
                    l.leftArm.pivot.rotation.set(-0.75, 0.2, 0.3);
                    l.rightArm.pivot.rotation.set(-0.75, -0.2, -0.3);
                } else {
                    l.leftArm.pivot.rotation.set(-0.4, 0.1, 0.1);
                    l.rightArm.pivot.rotation.set(-0.4, -0.1, -0.1);
                }
            }

            player.body.position.copy(worldSeat);
            player.body.velocity.set(0, 0, 0);

            const speedKmh = car.getSpeedKmh();
            if (this.hudSpeed) this.hudSpeed.innerText = speedKmh.toFixed(1);
            if (this.hudGear) this.hudGear.innerText = this.isPassenger ? `[ПАССАЖИР ${this.seatIndex + 1}]` : `[${car.getGearName()}]`;
            if (this.hudModeTitle) this.hudModeTitle.innerText = this.isPassenger ? `ПАССАЖИР (${car.carName})` : car.carName.toUpperCase();

            if (this.promptElement) this.promptElement.style.display = 'none';

            if (!this.isPassenger && car.isOverturned()) {
                car.rolloverTimer = (car.rolloverTimer || 0) + deltaTime;
                if (car.rolloverTimer > 0.45) {
                    this.forceEjectPlayer(player);
                }
            } else if (car) {
                car.rolloverTimer = 0;
            }
        } else if (player && player.body) {
            const nearest = this.findNearestCar(player.body.position, 4.2);
            if (nearest && this.promptElement) {
                this.promptElement.style.display = 'block';
                if (this.promptCarName) this.promptCarName.innerText = nearest.carName;
                const seatIdx = nearest.getFirstAvailableSeat();
                if (this.promptActionText) {
                    if (nearest.isOverturned()) {
                        this.promptActionText.innerText = 'Перевернуть на колеса';
                    } else if (seatIdx === 0) {
                        this.promptActionText.innerText = 'Сесть за руль (Водитель)';
                    } else if (seatIdx > 0) {
                        this.promptActionText.innerText = `Сесть пассажиром (Место ${seatIdx + 1}/4)`;
                    } else {
                        this.promptActionText.innerText = 'Автомобиль полон (4/4)';
                    }
                }
            } else if (this.promptElement) {
                this.promptElement.style.display = 'none';
            }
        }

        for (let i = 0; i < this.cars.length; i++) {
            this.cars[i].update(deltaTime);
        }
    }

    findNearestMergeCar(activeCar, maxDist = 16.0) {
        if (!activeCar || !activeCar.chassisBody) return null;
        let nearest = null;
        let minDist = maxDist;
        const posA = activeCar.chassisBody.position;

        // 1. Поиск среди автомобилей автопарка
        for (let i = 0; i < this.cars.length; i++) {
            const other = this.cars[i];
            if (!other || other === activeCar || other.isMerged || other.isBeingMerged || !other.chassisBody) continue;
            const dist = posA.distanceTo(other.chassisBody.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }

        // 2. Поиск среди автономного трафика (если есть)
        if (!nearest && window.gameEngine && window.gameEngine.ambientTrafficManager && window.gameEngine.ambientTrafficManager.vehicles) {
            const traffic = window.gameEngine.ambientTrafficManager.vehicles;
            for (let i = 0; i < traffic.length; i++) {
                const tCar = traffic[i];
                if (!tCar || tCar === activeCar || tCar.isMerged || tCar.isBeingMerged) continue;
                const tPos = tCar.chassisBody ? tCar.chassisBody.position : (tCar.group ? tCar.group.position : null);
                if (tPos) {
                    const dist = posA.distanceTo(tPos);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = tCar;
                    }
                }
            }
        }

        return nearest;
    }

    transformCarToSolarHelicopter(car, player, partnerCar) {
        if (!car || !player) return;

        const posX = car.chassisBody.position.x;
        const posY = Math.max(car.chassisBody.position.y, 1.5);
        const posZ = car.chassisBody.position.z;
        const rotY = car.carGroup ? car.carGroup.rotation.y : 0;

        // Останавливаем мотор машины
        if (car.soundController) {
            try { car.soundController.stopEngine(); } catch (e) {}
        }
        car.removeOccupant('local');

        // Удаляем машины слияния
        if (partnerCar) {
            partnerCar.isMerged = true;
            partnerCar.isBeingMerged = false;
            if (partnerCar.carGroup) this.scene.remove(partnerCar.carGroup);
            if (partnerCar.chassisBody && this.world) this.world.removeBody(partnerCar.chassisBody);
        }

        car.isMerged = true;
        car.isBeingMerged = false;
        if (car.carGroup) this.scene.remove(car.carGroup);
        if (car.chassisBody && this.world) this.world.removeBody(car.chassisBody);

        this.activeDrivenCar = null;
        this.isPassenger = false;
        this.transitionState = 'ON_FOOT';

        // Спавн и апгрейд 5-го вертолета прямо на месте автомобиля
        const solarHeli = new HelicopterVehicle(this.scene, this.world, this.physicsMaterials, posX, posY + 2.5, posZ, rotY);
        solarHeli.upgradeToSolarLeviathanHelicopter();
        solarHeli.isPiloted = true;
        solarHeli.occupants = [player, null];

        // Добавляем в общий список вертолетов движка
        if (window.gameEngine) {
            if (!window.gameEngine.helicopters) window.gameEngine.helicopters = [];
            solarHeli.heliIndex = window.gameEngine.helicopters.length;
            window.gameEngine.helicopters.push(solarHeli);
            window.gameEngine.helicopter = solarHeli;
        }

        // Плавный взлет в воздух при трансформации
        if (solarHeli.body) {
            solarHeli.body.position.set(posX, posY + 3.0, posZ);
            solarHeli.body.velocity.set(0, 22.0, 0);
            solarHeli.body.wakeUp();
        }

        // Обновление посадки игрока
        player.mesh.visible = true;
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

        let toast = document.getElementById('mega-heli-toast') || document.getElementById('opt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'opt-toast';
            toast.className = 'opt-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = '👑 <b>ЛЕГЕНДАРНАЯ КВАНТОВАЯ ТРАНСФОРМАЦИЯ!</b> АВТОМОБИЛЬ ПРЕОБРАЗОВАН В CELESTIAL SOLAR LEVIATHAN X16 (2000 КМ/Ч, 16 ЛОПАСТЕЙ)! 🚁☀️';
        toast.style.borderColor = '#ffd700';
        toast.style.background = 'linear-gradient(135deg, rgba(69, 26, 3, 0.95), rgba(255, 183, 3, 0.75))';
        toast.style.boxShadow = '0 10px 60px rgba(255, 215, 0, 0.95)';
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 7000);

        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            window.gameEngine.multiplayerHUD.addSystemMessage('👑 АВТОМОБИЛЬ ТРАНСФОРМИРОВАН В 5-Й ВЕРТОЛЕТ LEVIATHAN X16! [Space] Взлет | [W] Полет 2000 км/ч');
        }

        const modeElem = document.getElementById('stat-player-mode');
        const titleElem = document.getElementById('hud-mode-title');
        if (modeElem) modeElem.innerText = 'Пилот (👑 CELESTIAL SOLAR LEVIATHAN X16 👑)';
        if (titleElem) {
            titleElem.innerText = '👑 CELESTIAL SOLAR LEVIATHAN X16 👑';
            titleElem.style.color = '#ffd700';
            titleElem.style.textShadow = '0 0 15px rgba(255, 215, 0, 0.95)';
        }

        if (window.soundEngine && typeof window.soundEngine.playHelicopterTakeoff === 'function') {
            window.soundEngine.playHelicopterTakeoff(posX, posY, posZ);
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
