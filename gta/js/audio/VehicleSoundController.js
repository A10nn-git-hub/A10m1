/**
 * Звуковой контроллер автомобиля:
 * - Реальный сэмпл запуска двигателя (starter & rev-up)
 * - Реальный бесшовный сэмпл работы мотора с динамической модуляцией питча (обороты/скорость)
 * - Реальный сэмпл визга шин и торможения при дрифте/экстренном торможении
 * - Процедурный синтезаторный фолбэк
 */
class VehicleSoundController {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        
        // Сэмплерные ноды двигателя
        this.engineLoopSource = null;
        this.engineStartSource = null;
        this.engineLoopGain = null;
        this.engineLoopFilter = null;

        // Сэмплерные ноды визга шин / тормозов
        this.skidSource = null;
        this.skidGain = null;

        // Синтезаторный фолбэк
        this.engineOsc = null;
        this.engineSubOsc = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.screechSource = null;
        this.screechGain = null;
        this.screechFilter = null;

        this.isActive = false;
        this.currentRpmPitch = 44.0;
        this.currentSamplePlaybackRate = 1.0;
    }

    startEngine() {
        if (!this.audioEngine) return;
        this.audioEngine.initAudioContext();
        const ctx = this.audioEngine.audioCtx;
        if (!ctx || this.isActive) return;

        try {
            const now = ctx.currentTime;
            const samples = this.audioEngine.samples || {};

            // 1. Проигрывание сэмпла запуска авто (Завод машины)
            if (samples.car_start) {
                this.engineStartSource = ctx.createBufferSource();
                this.engineStartSource.buffer = samples.car_start;
                const startGain = ctx.createGain();
                startGain.gain.setValueAtTime(0.85, now);
                this.engineStartSource.connect(startGain);
                startGain.connect(this.audioEngine.vehicleGain);
                this.engineStartSource.start(now);
            }

            // 2. Запуск основного сэмплерного лупа движения
            if (samples.car_drive_loop) {
                this.engineLoopSource = ctx.createBufferSource();
                this.engineLoopSource.buffer = samples.car_drive_loop;
                this.engineLoopSource.loop = true;
                this.engineLoopSource.playbackRate.setValueAtTime(0.85, now);

                this.engineLoopFilter = ctx.createBiquadFilter();
                this.engineLoopFilter.type = 'lowpass';
                this.engineLoopFilter.frequency.setValueAtTime(3200, now);

                this.engineLoopGain = ctx.createGain();
                // Плавное нарастание громкости после завода
                this.engineLoopGain.gain.setValueAtTime(0.001, now);
                this.engineLoopGain.gain.linearRampToValueAtTime(0.70, now + 1.2);

                this.engineLoopSource.connect(this.engineLoopFilter);
                this.engineLoopFilter.connect(this.engineLoopGain);
                this.engineLoopGain.connect(this.audioEngine.vehicleGain);
                this.engineLoopSource.start(now);
            }

            // 3. Подготовка сэмпла визга шин / тормозов
            if (samples.car_skid_brake) {
                this.skidSource = ctx.createBufferSource();
                this.skidSource.buffer = samples.car_skid_brake;
                this.skidSource.loop = true;

                this.skidGain = ctx.createGain();
                this.skidGain.gain.setValueAtTime(0.0001, now);

                this.skidSource.connect(this.skidGain);
                this.skidGain.connect(this.audioEngine.vehicleGain);
                this.skidSource.start(now);
            }

            // 4. Синтетический фолбэк на случай отсутствия сэмплов
            if (!samples.car_drive_loop) {
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
            }

            if (!samples.car_skid_brake && this.audioEngine.noiseBuffer) {
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
        } catch (e) {
            console.warn('VehicleSoundController startEngine error:', e);
        }
    }

    stopEngine() {
        if (!this.isActive || !this.audioEngine || !this.audioEngine.audioCtx) return;
        const ctx = this.audioEngine.audioCtx;
        try {
            const now = ctx.currentTime;
            if (this.engineLoopGain) this.engineLoopGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
            if (this.skidGain) this.skidGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
            if (this.engineGain) this.engineGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
            if (this.screechGain) this.screechGain.gain.linearRampToValueAtTime(0.0001, now + 0.1);

            setTimeout(() => {
                if (this.engineLoopSource) { try { this.engineLoopSource.stop(); } catch(e){} this.engineLoopSource = null; }
                if (this.engineStartSource) { try { this.engineStartSource.stop(); } catch(e){} this.engineStartSource = null; }
                if (this.skidSource) { try { this.skidSource.stop(); } catch(e){} this.skidSource = null; }
                if (this.engineOsc) { try { this.engineOsc.stop(); } catch(e){} this.engineOsc = null; }
                if (this.engineSubOsc) { try { this.engineSubOsc.stop(); } catch(e){} this.engineSubOsc = null; }
                if (this.screechSource) { try { this.screechSource.stop(); } catch(e){} this.screechSource = null; }
                this.isActive = false;
            }, 380);
        } catch (e) {
            this.isActive = false;
        }
    }

    update(speedKmh, isBraking, steeringAngle) {
        if (!this.isActive || !this.audioEngine || !this.audioEngine.audioCtx) return;
        const ctx = this.audioEngine.audioCtx;

        try {
            const now = ctx.currentTime;

            // 1. Модуляция реального сэмпла двигателя
            if (this.engineLoopSource && this.engineLoopGain) {
                // Питч от 0.78 (холостой ход) до 1.85 (максимальная скорость)
                const targetRate = 0.78 + Math.min(speedKmh / 130.0, 1.05);
                this.currentSamplePlaybackRate += (targetRate - this.currentSamplePlaybackRate) * 0.15;
                this.engineLoopSource.playbackRate.setValueAtTime(this.currentSamplePlaybackRate, now);

                // Динамическая громкость в зависимости от скорости и нагрузки
                const targetVol = 0.55 + Math.min(speedKmh / 160.0, 0.40);
                this.engineLoopGain.gain.setValueAtTime(targetVol, now);

                if (this.engineLoopFilter) {
                    this.engineLoopFilter.frequency.setValueAtTime(2000 + this.currentSamplePlaybackRate * 1800, now);
                }
            }

            // 2. Модуляция реального сэмпла тормозов и визга шин
            const isSharpTurn = Math.abs(steeringAngle) > 0.18 && speedKmh > 22;
            const isHardBraking = isBraking && speedKmh > 16;
            const shouldScreech = (isSharpTurn || isHardBraking);
            const skidIntensity = shouldScreech ? Math.min(1.0, (speedKmh / 75.0)) * 0.75 : 0.0001;

            if (this.skidGain) {
                this.skidGain.gain.setValueAtTime(Math.max(0.0001, skidIntensity), now);
            }

            // 3. Синтетический фолбэк
            if (this.engineOsc) {
                const targetFreq = 42 + Math.min(speedKmh * 2.1, 260) + Math.sin(now * 8) * 2;
                this.currentRpmPitch += (targetFreq - this.currentRpmPitch) * 0.18;
                this.engineOsc.frequency.setValueAtTime(this.currentRpmPitch, now);
                if (this.engineSubOsc) this.engineSubOsc.frequency.setValueAtTime(this.currentRpmPitch * 0.5, now);
                if (this.engineFilter) this.engineFilter.frequency.setValueAtTime(220 + this.currentRpmPitch * 1.8, now);
            }

            if (this.screechGain) {
                this.screechGain.gain.setValueAtTime(Math.max(0.0001, skidIntensity * 0.35), now);
            }
        } catch (e) {}
    }
}

window.VehicleSoundController = VehicleSoundController;
