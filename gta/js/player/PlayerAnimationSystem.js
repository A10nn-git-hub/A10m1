/**
         * Анимационная система игрока
         */
        class PlayerAnimationSystem {
            constructor(limbs) {
                this.limbs = limbs;
                this.walkCycle = 0.0;
                this.currentStateName = 'IDLE';
            }

            update(deltaTime, speed) {
                if (!this.limbs.torso) return;

                if (speed < 0.3) {
                    this.currentStateName = 'IDLE';
                } else if (speed <= 6.2) {
                    this.currentStateName = 'WALK';
                } else {
                    this.currentStateName = 'RUN (SPRINT)';
                }

                this.walkCycle += deltaTime * (speed * 1.5 + 2.0);
                const sinP = Math.sin(this.walkCycle);
                const w = speed > 0.2 ? 1.0 : 0.0;
                const isRunning = speed > 6.2;

                const l = this.limbs;
                l.torso.position.set(0, 1.15 + Math.abs(Math.cos(this.walkCycle)) * 0.03 * w, 0);
                l.torso.rotation.set((isRunning ? 0.2 : 0.08) * w, 0, 0);
                l.leftArm.pivot.rotation.x = -sinP * (isRunning ? 1.0 : 0.55) * w;
                l.rightArm.pivot.rotation.x = sinP * (isRunning ? 1.0 : 0.55) * w;
                l.leftLeg.pivot.rotation.x = sinP * (isRunning ? 0.95 : 0.65) * w;
                l.rightLeg.pivot.rotation.x = -sinP * (isRunning ? 0.95 : 0.65) * w;
                l.leftLeg.knee.rotation.x = Math.max(0.02, -sinP * 0.8) * w;
                l.rightLeg.knee.rotation.x = Math.max(0.02, sinP * 0.8) * w;
            }
        }

        /**
         * Контроллер ввода (с поддержкой переключения погоды U / P)
         */
