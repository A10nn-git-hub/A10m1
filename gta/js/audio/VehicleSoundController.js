/**
         * Звуковой контроллер автомобиля (гул холостого хода, обороты мотора по скорости, визг покрышек)
         */
        class VehicleSoundController {
            constructor(audioEngine) {
                this.audioEngine = audioEngine;
                this.engineOsc = null;
                this.engineSubOsc = null;
                this.engineGain = null;
                this.engineFilter = null;

                this.screechSource = null;
                this.screechGain = null;
                this.screechFilter = null;

                this.isActive = false;
                this.currentRpmPitch = 44.0;
            }

            startEngine() {
                if (!this.audioEngine) return;
                this.audioEngine.initAudioContext();
                const ctx = this.audioEngine.audioCtx;
                if (!ctx || this.isActive) return;

                try {
                    const now = ctx.currentTime;
                    this.engineOsc = ctx.createOscillator();
                    this.engineSubOsc = ctx.createOscillator();
                    this.engineGain = ctx.createGain();
                    this.engineFilter = ctx.createBiquadFilter();

                    this.engineFilter.type = 'lowpass';
                    this.engineFilter.frequency.setValueAtTime(240, now);

                    this.engineOsc.type = 'sawtooth';
                    this.engineOsc.frequency.setValueAtTime(42, now);

                    this.engineSubOsc.type = 'triangle';
                    this.engineSubOsc.frequency.setValueAtTime(21, now);

                    this.engineGain.gain.setValueAtTime(0.001, now);
                    this.engineGain.gain.linearRampToValueAtTime(0.24, now + 0.3);

                    this.engineOsc.connect(this.engineFilter);
                    this.engineSubOsc.connect(this.engineFilter);
                    this.engineFilter.connect(this.engineGain);
                    this.engineGain.connect(this.audioEngine.vehicleGain);

                    this.engineOsc.start(now);
                    this.engineSubOsc.start(now);

                    // Визг резины
                    if (this.audioEngine.noiseBuffer) {
                        this.screechSource = ctx.createBufferSource();
                        this.screechSource.buffer = this.audioEngine.noiseBuffer;
                        this.screechSource.loop = true;

                        this.screechFilter = ctx.createBiquadFilter();
                        this.screechFilter.type = 'bandpass';
                        this.screechFilter.frequency.setValueAtTime(2600, now);
                        this.screechFilter.Q.setValueAtTime(4.5, now);

                        this.screechGain = ctx.createGain();
                        this.screechGain.gain.setValueAtTime(0.0001, now);

                        this.screechSource.connect(this.screechFilter);
                        this.screechFilter.connect(this.screechGain);
                        this.screechGain.connect(this.audioEngine.vehicleGain);

                        this.screechSource.start(now);
                    }

                    this.isActive = true;
                } catch (e) {}
            }

            stopEngine() {
                if (!this.isActive || !this.audioEngine || !this.audioEngine.audioCtx) return;
                const ctx = this.audioEngine.audioCtx;
                try {
                    const now = ctx.currentTime;
                    if (this.engineGain) this.engineGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
                    if (this.screechGain) this.screechGain.gain.linearRampToValueAtTime(0.0001, now + 0.1);

                    setTimeout(() => {
                        if (this.engineOsc) { try { this.engineOsc.stop(); } catch(e){} this.engineOsc = null; }
                        if (this.engineSubOsc) { try { this.engineSubOsc.stop(); } catch(e){} this.engineSubOsc = null; }
                        if (this.screechSource) { try { this.screechSource.stop(); } catch(e){} this.screechSource = null; }
                        this.isActive = false;
                    }, 300);
                } catch (e) {
                    this.isActive = false;
                }
            }

            update(speedKmh, isBraking, steeringAngle) {
                if (!this.isActive || !this.audioEngine || !this.audioEngine.audioCtx) return;
                const ctx = this.audioEngine.audioCtx;

                try {
                    const now = ctx.currentTime;
                    // Частота двигателя в зависимости от скорости и оборотов
                    const targetFreq = 42 + Math.min(speedKmh * 2.1, 260) + Math.sin(now * 8) * 2;
                    this.currentRpmPitch += (targetFreq - this.currentRpmPitch) * 0.18;

                    if (this.engineOsc) {
                        this.engineOsc.frequency.setValueAtTime(this.currentRpmPitch, now);
                    }
                    if (this.engineSubOsc) {
                        this.engineSubOsc.frequency.setValueAtTime(this.currentRpmPitch * 0.5, now);
                    }
                    if (this.engineFilter) {
                        this.engineFilter.frequency.setValueAtTime(220 + this.currentRpmPitch * 1.8, now);
                    }

                    // Определение скольжения и визга шин
                    const isSharpTurn = Math.abs(steeringAngle) > 0.18 && speedKmh > 24;
                    const isHardBraking = isBraking && speedKmh > 18;
                    const screechIntensity = (isSharpTurn || isHardBraking) ? Math.min(1.0, (speedKmh / 80)) * 0.28 : 0.0001;

                    if (this.screechGain) {
                        this.screechGain.gain.setValueAtTime(Math.max(0.0001, screechIntensity), now);
                    }
                } catch (e) {}
            }
        }
