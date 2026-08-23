/**
         * STEP 29: Комплексный 3D Spatial Audio Engine (Web Audio API)
         * - Фолей шагов (Footsteps) с распознаванием асфальта vs плитки/пола интерьера
         * - Динамический звук двигателя автомобиля (Idle гул, обороты по скорости, переключение передач)
         * - Визг покрышек (Tire Screeching) при резких поворотах и торможении
         * - Шуршание одежды и предметов (Rustling) при действиях NPC
         * - Атмосферный эмбиент дождя (Heavy Rain loop) при ухудшении погоды
         * - Узнаваемый ночной стрекот цикад (Twilight / Night Crickets loop), плавно нарастающий на закате
         */
        class SpatialSoundEngine {
            constructor() {
                this.audioCtx = null;
                this.listenerPosition = new THREE.Vector3();
                this.masterGain = null;
                this.foleyGain = null;
                this.vehicleGain = null;
                this.weatherGain = null;
                this.nightAmbienceGain = null;

                this.noiseBuffer = null;
                this.isInitialized = false;

                // Загруженные и нарезанные сэмплы
                this.samples = {};
                this.isSamplesLoaded = false;
                this.footstepGrassIdx = 0;
                this.footstepDefaultIdx = 0;

                this.rainSourceNode = null;
                this.cricketsOscs = [];
                this.targetRainVolume = 0.0;
                this.currentRainVolume = 0.0;
                this.targetNightVolume = 0.0;
                this.currentNightVolume = 0.0;

                this.initUnlockListeners();
            }

            initUnlockListeners() {
                const unlock = () => {
                    this.initAudioContext();
                    window.removeEventListener('click', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                    window.removeEventListener('mousedown', unlock);
                };
                window.addEventListener('click', unlock, { once: true });
                window.addEventListener('keydown', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
                window.addEventListener('mousedown', unlock, { once: true });
            }

            initAudioContext() {
                if (this.isInitialized) {
                    if (this.audioCtx && this.audioCtx.state === 'suspended') {
                        this.audioCtx.resume();
                    }
                    return;
                }

                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return;
                    this.audioCtx = new AudioContextClass();

                    // Мастер-шина и подгруппы
                    this.masterGain = this.audioCtx.createGain();
                    this.masterGain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);
                    this.masterGain.connect(this.audioCtx.destination);

                    this.foleyGain = this.audioCtx.createGain();
                    this.foleyGain.gain.setValueAtTime(0.75, this.audioCtx.currentTime);
                    this.foleyGain.connect(this.masterGain);

                    this.vehicleGain = this.audioCtx.createGain();
                    this.vehicleGain.gain.setValueAtTime(0.80, this.audioCtx.currentTime);
                    this.vehicleGain.connect(this.masterGain);

                    this.weatherGain = this.audioCtx.createGain();
                    this.weatherGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
                    this.weatherGain.connect(this.masterGain);

                    this.nightAmbienceGain = this.audioCtx.createGain();
                    this.nightAmbienceGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
                    this.nightAmbienceGain.connect(this.masterGain);

                    // Генерация буфера розового шума
                    this.createPinkNoiseBuffer();

                    // Загрузка внешних 5 аудиофайлов MP3
                    this.loadAudioSamples();

                    // Запуск постоянных эмбиент-генераторов
                    this.startRainSynthLoop();
                    this.startNightCricketsSynth();

                    this.isInitialized = true;
                } catch (e) {
                    console.warn('SpatialSoundEngine init error', e);
                }
            }

            /**
             * Вспомогательный метод для создания подбуфера (среза) из AudioBuffer
             */
            createSubBuffer(srcBuffer, startSec, endSec) {
                if (!this.audioCtx || !srcBuffer) return null;
                const sampleRate = srcBuffer.sampleRate;
                const totalDuration = srcBuffer.duration;
                const startClamped = Math.max(0, Math.min(startSec, totalDuration));
                const endClamped = Math.max(startClamped + 0.05, Math.min(endSec || totalDuration, totalDuration));
                const length = Math.floor((endClamped - startClamped) * sampleRate);
                if (length <= 0) return null;

                const subBuffer = this.audioCtx.createBuffer(srcBuffer.numberOfChannels, length, sampleRate);
                const startOffset = Math.floor(startClamped * sampleRate);

                for (let ch = 0; ch < srcBuffer.numberOfChannels; ch++) {
                    const srcData = srcBuffer.getChannelData(ch);
                    const subData = subBuffer.getChannelData(ch);
                    for (let i = 0; i < length; i++) {
                        subData[i] = srcData[startOffset + i] || 0;
                    }
                }
                return subBuffer;
            }

            /**
             * Асинхронная загрузка и распаковка 5 MP3 файлов
             */
            async loadAudioSamples() {
                if (!this.audioCtx) return;
                const audioFiles = [
                    {
                        key: 'engine_start_drive',
                        paths: ['audio/car_engine_start_drive.mp3', 'Завод машины + звук машины во время поездки.mp3']
                    },
                    {
                        key: 'door_close',
                        paths: ['audio/car_door_close.mp3', 'Звук закрытия дверей.mp3']
                    },
                    {
                        key: 'brake_crash',
                        paths: ['audio/car_brake_crash.mp3', 'Звук тормозов у машины + врезание в предмет.mp3']
                    },
                    {
                        key: 'footstep_default',
                        paths: ['audio/footstep_default.mp3', 'Звук ходьбы по умолчанию.mp3']
                    },
                    {
                        key: 'footstep_grass',
                        paths: ['audio/footstep_grass.mp3', 'Звук хождения по траве.mp3']
                    }
                ];

                for (const item of audioFiles) {
                    try {
                        let arrayBuffer = null;
                        for (const p of item.paths) {
                            try {
                                const res = await fetch(encodeURI(p));
                                if (res.ok) {
                                    arrayBuffer = await res.arrayBuffer();
                                    break;
                                }
                            } catch (err) {}
                        }

                        if (!arrayBuffer) continue;
                        const decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                        const dur = decodedBuffer.duration;

                        if (item.key === 'engine_start_drive') {
                            // Файл 1: 10.58 сек -> содержит 2 звука:
                            // Звук 1. Завод двигателя (стартер, раскрутка ~0-3.3 сек)
                            // Звук 2. Звук машины во время поездки (бесшовный луп ~3.3-10.58 сек)
                            const splitPoint = Math.min(3.3, dur * 0.35);
                            this.samples.car_start = this.createSubBuffer(decodedBuffer, 0, splitPoint);
                            this.samples.car_drive_loop = this.createSubBuffer(decodedBuffer, splitPoint, dur);
                        } else if (item.key === 'brake_crash') {
                            // Файл 2: 9.09 сек -> содержит 2 звука:
                            // Звук 1. Торможение / визг шин (~0-4.4 сек)
                            // Звук 2. Врезание / сокрушительный удар в препятствие (~4.4-9.09 сек)
                            const splitPoint = Math.min(4.4, dur * 0.48);
                            this.samples.car_skid_brake = this.createSubBuffer(decodedBuffer, 0, splitPoint);
                            this.samples.car_crash = this.createSubBuffer(decodedBuffer, splitPoint, dur);
                        } else if (item.key === 'door_close') {
                            this.samples.car_door_close = decodedBuffer;
                        } else if (item.key === 'footstep_default') {
                            this.samples.footstep_default = decodedBuffer;
                        } else if (item.key === 'footstep_grass') {
                            this.samples.footstep_grass = decodedBuffer;
                        }
                    } catch (e) {
                        console.warn(`Ошибка загрузки аудиосэмпла [${item.key}]:`, e);
                    }
                }
                this.isSamplesLoaded = true;
            }

            createPinkNoiseBuffer() {
                if (!this.audioCtx) return;
                const bufferSize = this.audioCtx.sampleRate * 3.0;
                this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                    b6 = white * 0.115926;
                }
            }

            updateListener(cameraPosition) {
                if (cameraPosition) {
                    this.listenerPosition.copy(cameraPosition);
                }
            }

            getSpatialVolumeAndPan(posX, posY, posZ, maxDistance = 35.0) {
                const dx = posX - this.listenerPosition.x;
                const dy = posY - this.listenerPosition.y;
                const dz = posZ - this.listenerPosition.z;
                const dist = Math.hypot(dx, dy, dz);

                if (dist > maxDistance) return { volume: 0, pan: 0, dist };

                const normDist = dist / maxDistance;
                const volume = Math.max(0.0, Math.pow(1.0 - normDist, 1.8));
                const pan = Math.max(-1.0, Math.min(1.0, dx / (dist || 1)));
                return { volume, pan, dist };
            }

            /**
             * Воспроизведение произвольного AudioBuffer с пространственным 3D-позиционированием
             */
            playSample(buffer, posX, posY, posZ, options = {}) {
                if (!this.audioCtx || !this.isInitialized || !buffer) return null;
                const maxDist = options.maxDistance || 35.0;
                const { volume, pan } = this.getSpatialVolumeAndPan(posX, posY, posZ, maxDist);
                if (volume <= 0.005) return null;

                try {
                    const now = this.audioCtx.currentTime;
                    const source = this.audioCtx.createBufferSource();
                    source.buffer = buffer;

                    const pitchVariation = options.pitchVariation || 0.0;
                    const playbackRate = (options.playbackRate || 1.0) + (Math.random() * 2 - 1) * pitchVariation;
                    source.playbackRate.setValueAtTime(Math.max(0.4, Math.min(2.5, playbackRate)), now);

                    const gainNode = this.audioCtx.createGain();
                    const baseVol = (options.volumeScale !== undefined ? options.volumeScale : 1.0);
                    gainNode.gain.setValueAtTime(volume * baseVol, now);

                    const targetBus = (options.bus === 'vehicle') ? this.vehicleGain : this.foleyGain;
                    const pannerNode = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;

                    if (pannerNode) {
                        pannerNode.pan.setValueAtTime(pan, now);
                        source.connect(gainNode);
                        gainNode.connect(pannerNode);
                        pannerNode.connect(targetBus);
                    } else {
                        source.connect(gainNode);
                        gainNode.connect(targetBus);
                    }

                    const offset = options.offset || 0;
                    const duration = options.duration;
                    if (duration) {
                        source.start(now, offset, duration);
                    } else {
                        source.start(now, offset);
                    }
                    return source;
                } catch (e) {
                    return null;
                }
            }

            /**
             * Звук закрытия дверей авто (Door Close / Slam)
             */
            playDoorClose(posX, posY, posZ, volumeScale = 1.0) {
                if (!this.audioCtx || !this.isInitialized) return;
                if (this.samples.car_door_close) {
                    this.playSample(this.samples.car_door_close, posX, posY, posZ, {
                        volumeScale: volumeScale * 0.95,
                        pitchVariation: 0.05,
                        maxDistance: 45.0,
                        bus: 'vehicle'
                    });
                    return;
                }

                // Синтетический фолбэк для закрытия двери
                const { volume, pan } = this.getSpatialVolumeAndPan(posX, posY, posZ, 35.0);
                if (volume <= 0.005) return;
                try {
                    const now = this.audioCtx.currentTime;
                    const osc = this.audioCtx.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(140, now);
                    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

                    const gain = this.audioCtx.createGain();
                    gain.gain.setValueAtTime(volume * volumeScale * 0.8, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

                    osc.connect(gain);
                    gain.connect(this.vehicleGain);
                    osc.start(now);
                    osc.stop(now + 0.18);
                } catch (e) {}
            }

            /**
             * Звук аварии / удара в препятствие (Car Crash)
             */
            playCarCrash(posX, posY, posZ, impactVelocity = 10.0) {
                if (!this.audioCtx || !this.isInitialized) return;
                const volScale = Math.min(1.0, Math.max(0.35, impactVelocity / 18.0));

                if (this.samples.car_crash) {
                    this.playSample(this.samples.car_crash, posX, posY, posZ, {
                        volumeScale: volScale * 1.1,
                        pitchVariation: 0.08,
                        maxDistance: 70.0,
                        bus: 'vehicle'
                    });
                    return;
                }

                // Синтетический фолбэк для аварии
                this.playPropCrash('metal', posX, posY, posZ);
            }

            /**
             * Звук шагов (синхронизирован с фазой анимации и типом покрытия: асфальт / трава / интерьер)
             */
            playFootstep(posX, posY, posZ, isIndoor = false, volumeScale = 1.0, surfaceType = 'default') {
                if (!this.audioCtx || !this.isInitialized) return;

                // 1. Шаги по траве и грунту
                if (surfaceType === 'grass' && this.samples.footstep_grass) {
                    const dur = this.samples.footstep_grass.duration;
                    const stepDuration = 0.38;
                    const numSteps = Math.floor(dur / stepDuration) || 1;
                    const offset = (this.footstepGrassIdx % numSteps) * stepDuration;
                    this.footstepGrassIdx++;

                    this.playSample(this.samples.footstep_grass, posX, posY, posZ, {
                        offset: offset,
                        duration: stepDuration,
                        volumeScale: volumeScale * 0.88,
                        pitchVariation: 0.08,
                        maxDistance: 28.0,
                        bus: 'foley'
                    });
                    return;
                }

                // 2. Шаги по асфальту/плитке по умолчанию
                if (surfaceType !== 'grass' && this.samples.footstep_default) {
                    const dur = this.samples.footstep_default.duration;
                    const stepDuration = isIndoor ? 0.30 : 0.36;
                    const numSteps = Math.floor(dur / stepDuration) || 1;
                    const offset = (this.footstepDefaultIdx % numSteps) * stepDuration;
                    this.footstepDefaultIdx++;

                    this.playSample(this.samples.footstep_default, posX, posY, posZ, {
                        offset: offset,
                        duration: stepDuration,
                        volumeScale: volumeScale * (isIndoor ? 0.75 : 0.90),
                        pitchVariation: 0.06,
                        playbackRate: isIndoor ? 1.12 : 1.0,
                        maxDistance: 28.0,
                        bus: 'foley'
                    });
                    return;
                }

                // 3. Синтетический фолбэк
                const { volume, pan } = this.getSpatialVolumeAndPan(posX, posY, posZ, 28.0);
                if (volume <= 0.005) return;

                try {
                    const now = this.audioCtx.currentTime;
                    const gainNode = this.audioCtx.createGain();
                    const pannerNode = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;

                    gainNode.gain.setValueAtTime(volume * volumeScale * (isIndoor ? 0.36 : 0.46), now);

                    if (isIndoor) {
                        const osc = this.audioCtx.createOscillator();
                        osc.type = 'triangle';
                        const baseFreq = 480 + Math.random() * 90;
                        osc.frequency.setValueAtTime(baseFreq, now);
                        osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);

                        const filter = this.audioCtx.createBiquadFilter();
                        filter.type = 'bandpass';
                        filter.frequency.setValueAtTime(1400, now);
                        filter.Q.setValueAtTime(2.5, now);

                        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

                        osc.connect(filter);
                        filter.connect(gainNode);
                        osc.start(now);
                        osc.stop(now + 0.085);
                    } else {
                        const osc = this.audioCtx.createOscillator();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(160 + Math.random() * 40, now);
                        osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);

                        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

                        osc.connect(gainNode);
                        osc.start(now);
                        osc.stop(now + 0.1);

                        if (this.noiseBuffer) {
                            const noiseSource = this.audioCtx.createBufferSource();
                            noiseSource.buffer = this.noiseBuffer;
                            const noiseFilter = this.audioCtx.createBiquadFilter();
                            noiseFilter.type = 'highpass';
                            noiseFilter.frequency.setValueAtTime(2400, now);

                            const noiseGain = this.audioCtx.createGain();
                            noiseGain.gain.setValueAtTime(volume * volumeScale * 0.16, now);
                            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

                            noiseSource.connect(noiseFilter);
                            noiseFilter.connect(noiseGain);
                            if (pannerNode) noiseGain.connect(pannerNode);
                            else noiseGain.connect(this.foleyGain);
                            noiseSource.start(now);
                            noiseSource.stop(now + 0.07);
                        }
                    }

                    if (pannerNode) {
                        pannerNode.pan.setValueAtTime(pan, now);
                        gainNode.connect(pannerNode);
                        pannerNode.connect(this.foleyGain);
                    } else {
                        gainNode.connect(this.foleyGain);
                    }
                } catch (e) {}
            }

            /**
             * Шуршание одежды и предметов при движениях NPC
             */
            playRustle(posX, posY, posZ, volumeScale = 1.0) {
                if (!this.audioCtx || !this.isInitialized || !this.noiseBuffer) return;
                const { volume } = this.getSpatialVolumeAndPan(posX, posY, posZ, 22.0);
                if (volume <= 0.005) return;

                try {
                    const now = this.audioCtx.currentTime;
                    const noise = this.audioCtx.createBufferSource();
                    noise.buffer = this.noiseBuffer;

                    const filter = this.audioCtx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1600 + Math.random() * 400, now);
                    filter.Q.setValueAtTime(1.8, now);

                    const gain = this.audioCtx.createGain();
                    gain.gain.setValueAtTime(volume * volumeScale * 0.22, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.foleyGain);

                    noise.start(now);
                    noise.stop(now + 0.2);
                } catch (e) {}
            }

            /**
             * STEP 37: Звуки разрушения и столкновения с физическими объектами (деревянный хруст, металлический лязг)
             */
            playPropCrash(materialType, posX, posY, posZ) {
                if (!this.audioCtx || !this.isInitialized) return;
                const { volume, pan } = this.getSpatialVolumeAndPan(posX, posY, posZ, 55.0);
                if (volume <= 0.005) return;

                try {
                    const now = this.audioCtx.currentTime;
                    const gain = this.audioCtx.createGain();
                    gain.gain.setValueAtTime(volume * 0.85, now);
                    const panner = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;
                    if (panner) panner.pan.setValueAtTime(pan, now);

                    if (materialType === 'wood') {
                        // Деревянный треск / сокрушительный удар досок
                        const osc = this.audioCtx.createOscillator();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(340, now);
                        osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);

                        const filter = this.audioCtx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(850, now);

                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                        osc.connect(filter);
                        filter.connect(gain);
                        if (panner) { gain.connect(panner); panner.connect(this.foleyGain); }
                        else { gain.connect(this.foleyGain); }

                        osc.start(now);
                        osc.stop(now + 0.24);
                    } else {
                        // Металлический звонкий удар / лязг (столбы, гидранты, урны)
                        const osc1 = this.audioCtx.createOscillator();
                        const osc2 = this.audioCtx.createOscillator();
                        osc1.type = 'triangle';
                        osc2.type = 'sine';

                        osc1.frequency.setValueAtTime(920, now);
                        osc1.frequency.exponentialRampToValueAtTime(220, now + 0.35);
                        osc2.frequency.setValueAtTime(1480, now);
                        osc2.frequency.exponentialRampToValueAtTime(380, now + 0.28);

                        const filter = this.audioCtx.createBiquadFilter();
                        filter.type = 'bandpass';
                        filter.frequency.setValueAtTime(1700, now);
                        filter.Q.setValueAtTime(3.5, now);

                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

                        osc1.connect(filter);
                        osc2.connect(filter);
                        filter.connect(gain);
                        if (panner) { gain.connect(panner); panner.connect(this.foleyGain); }
                        else { gain.connect(this.foleyGain); }

                        osc1.start(now);
                        osc2.start(now);
                        osc1.stop(now + 0.45);
                        osc2.stop(now + 0.45);
                    }
                } catch (e) {}
            }

            /**
             * STEP 37: Звук свистящей струи воды под давлением для сбитых гидрантов
             */
            playWaterSprayBurst(posX, posY, posZ) {
                if (!this.audioCtx || !this.isInitialized || !this.noiseBuffer) return;
                const { volume, pan } = this.getSpatialVolumeAndPan(posX, posY, posZ, 45.0);
                if (volume <= 0.005) return;

                try {
                    const now = this.audioCtx.currentTime;
                    const noise = this.audioCtx.createBufferSource();
                    noise.buffer = this.noiseBuffer;

                    const filter = this.audioCtx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1800, now);
                    filter.Q.setValueAtTime(1.2, now);

                    const gain = this.audioCtx.createGain();
                    gain.gain.setValueAtTime(volume * 0.4, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.weatherGain);

                    noise.start(now);
                    noise.stop(now + 0.5);
                } catch (e) {}
            }

            /**
             * Эмбиент дождя (Heavy Rain loop)
             */
            startRainSynthLoop() {
                if (!this.audioCtx || !this.noiseBuffer) return;
                try {
                    this.rainSourceNode = this.audioCtx.createBufferSource();
                    this.rainSourceNode.buffer = this.noiseBuffer;
                    this.rainSourceNode.loop = true;

                    const filterLow = this.audioCtx.createBiquadFilter();
                    filterLow.type = 'lowpass';
                    filterLow.frequency.setValueAtTime(2200, this.audioCtx.currentTime);

                    this.rainSourceNode.connect(filterLow);
                    filterLow.connect(this.weatherGain);
                    this.rainSourceNode.start(0);
                } catch (e) {}
            }

            /**
             * Эмбиент ночного стрекота сверчков (Twilight/Crickets loop)
             */
            startNightCricketsSynth() {
                if (!this.audioCtx) return;
                try {
                    const freqs = [4850, 5200];
                    for (const f of freqs) {
                        const osc = this.audioCtx.createOscillator();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);

                        const tremolo = this.audioCtx.createOscillator();
                        tremolo.type = 'square';
                        tremolo.frequency.setValueAtTime(18.0 + (f === 5200 ? 3.0 : 0.0), this.audioCtx.currentTime);

                        const tremoloGain = this.audioCtx.createGain();
                        tremoloGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);

                        const mainGain = this.audioCtx.createGain();
                        mainGain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);

                        tremolo.connect(tremoloGain.gain);
                        osc.connect(mainGain);
                        mainGain.connect(this.nightAmbienceGain);

                        osc.start(0);
                        tremolo.start(0);
                        this.cricketsOscs.push(osc, tremolo);
                    }
                } catch (e) {}
            }

            /**
             * Плавное обновление громкости погоды и ночного эмбиента (с приглушением дождя в зданиях)
             */
            updateWeatherAndAmbience(deltaTime, weatherType, nightFactor, isIndoor = false) {
                if (!this.audioCtx || !this.isInitialized) return;

                // 1. Громкость дождя (Rain Volume с затуханием в интерьерах)
                if (weatherType === 'RAIN') {
                    this.targetRainVolume = isIndoor ? 0.06 : 0.38;
                } else if (weatherType === 'DRIZZLE') {
                    this.targetRainVolume = isIndoor ? 0.025 : 0.16;
                } else {
                    this.targetRainVolume = 0.0001;
                }

                this.currentRainVolume += (this.targetRainVolume - this.currentRainVolume) * Math.min(deltaTime * 2.0, 1.0);
                if (this.weatherGain) {
                    this.weatherGain.gain.setValueAtTime(Math.max(0.0001, this.currentRainVolume), this.audioCtx.currentTime);
                }

                // 2. Ночной эмбиент сверчков (Twilight/Night Crickets)
                const nightPresence = Math.max(0.0, (nightFactor - 0.15) / 0.85);
                this.targetNightVolume = Math.pow(nightPresence, 1.4) * (isIndoor ? 0.08 : 0.32);

                this.currentNightVolume += (this.targetNightVolume - this.currentNightVolume) * Math.min(deltaTime * 1.5, 1.0);
                if (this.nightAmbienceGain) {
                    this.nightAmbienceGain.gain.setValueAtTime(Math.max(0.0001, this.currentNightVolume), this.audioCtx.currentTime);
                }
            }

            /**
             * STEP 39: Запуск генераторов уникального районного эмбиента (фабрики, пение птиц, вой ветра в пустыне)
             */
            startDistrictAmbienceSynths() {
                if (!this.audioCtx) return;
                try {
                    // 1. Индустриальный гул фабрик и заводов (Heavy Machinery Drone)
                    this.industrialGain = this.audioCtx.createGain();
                    this.industrialGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
                    this.industrialGain.connect(this.masterGain);

                    const factoryOsc = this.audioCtx.createOscillator();
                    factoryOsc.type = 'sawtooth';
                    factoryOsc.frequency.setValueAtTime(68.0, this.audioCtx.currentTime);

                    const factorySub = this.audioCtx.createOscillator();
                    factorySub.type = 'sine';
                    factorySub.frequency.setValueAtTime(34.0, this.audioCtx.currentTime);

                    const factoryFilter = this.audioCtx.createBiquadFilter();
                    factoryFilter.type = 'lowpass';
                    factoryFilter.frequency.setValueAtTime(160.0, this.audioCtx.currentTime);

                    factoryOsc.connect(factoryFilter);
                    factorySub.connect(factoryFilter);
                    factoryFilter.connect(this.industrialGain);
                    factoryOsc.start(0);
                    factorySub.start(0);

                    // 2. Пение птиц и шелест крон в богатых холмах и сельской местности (Birds & Gentle Breeze)
                    this.countryGain = this.audioCtx.createGain();
                    this.countryGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
                    this.countryGain.connect(this.masterGain);

                    this.birdChirpTimer = 0.0;

                    // 3. Вой ветра в пустыне и на горных пиках (Desert & Mountain Canyon Wind)
                    this.desertGain = this.audioCtx.createGain();
                    this.desertGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
                    this.desertGain.connect(this.masterGain);

                    if (this.noiseBuffer) {
                        const desertSource = this.audioCtx.createBufferSource();
                        desertSource.buffer = this.noiseBuffer;
                        desertSource.loop = true;

                        const desertFilter = this.audioCtx.createBiquadFilter();
                        desertFilter.type = 'bandpass';
                        desertFilter.frequency.setValueAtTime(380.0, this.audioCtx.currentTime);
                        desertFilter.Q.setValueAtTime(2.2, this.audioCtx.currentTime);

                        desertSource.connect(desertFilter);
                        desertFilter.connect(this.desertGain);
                        desertSource.start(0);
                    }
                } catch (e) {}
            }

            /**
             * STEP 39: Обновление районных аудиодорожек в реальном времени с плавным кроссфейдом
             */
            updateDistrictAmbience(deltaTime, currentDistrictId, isIndoor = false) {
                if (!this.audioCtx || !this.isInitialized) return;
                if (!this.industrialGain) {
                    this.startDistrictAmbienceSynths();
                }

                const dId = currentDistrictId || 'downtown';
                const isIndustrial = (dId === 'lapuerta' || dId === 'cypress');
                const isCountry = (dId === 'richman' || dId === 'grapeseed' || dId === 'palomino');
                const isDesertMountain = (dId === 'senora' || dId === 'chiliad' || dId === 'vinewood');

                const targetInd = isIndustrial ? (isIndoor ? 0.08 : 0.28) : 0.0001;
                const targetCtry = isCountry ? (isIndoor ? 0.04 : 0.24) : 0.0001;
                const targetDes = isDesertMountain ? (isIndoor ? 0.04 : 0.22) : 0.0001;

                const dt = Math.min(deltaTime, 0.1);

                if (this.industrialGain) {
                    const cur = this.industrialGain.gain.value;
                    this.industrialGain.gain.setValueAtTime(cur + (targetInd - cur) * dt * 1.5, this.audioCtx.currentTime);
                }
                if (this.countryGain) {
                    const cur = this.countryGain.gain.value;
                    this.countryGain.gain.setValueAtTime(cur + (targetCtry - cur) * dt * 1.5, this.audioCtx.currentTime);

                    // Случайное чириканье птиц в сельской местности и Richman Hills
                    if (isCountry && !isIndoor) {
                        this.birdChirpTimer = (this.birdChirpTimer || 0) + dt;
                        if (this.birdChirpTimer >= 2.8 + Math.random() * 3.5) {
                            this.birdChirpTimer = 0.0;
                            this.playBirdChirp();
                        }
                    }
                }
                if (this.desertGain) {
                    const cur = this.desertGain.gain.value;
                    this.desertGain.gain.setValueAtTime(cur + (targetDes - cur) * dt * 1.5, this.audioCtx.currentTime);
                }
            }

            playBirdChirp() {
                if (!this.audioCtx || !this.isInitialized) return;
                try {
                    const now = this.audioCtx.currentTime;
                    const osc = this.audioCtx.createOscillator();
                    osc.type = 'sine';
                    const baseF = 3200 + Math.random() * 800;
                    osc.frequency.setValueAtTime(baseF, now);
                    osc.frequency.exponentialRampToValueAtTime(baseF + 600, now + 0.06);
                    osc.frequency.exponentialRampToValueAtTime(baseF - 200, now + 0.14);

                    const g = this.audioCtx.createGain();
                    g.gain.setValueAtTime(0.08, now);
                    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

                    osc.connect(g);
                    g.connect(this.countryGain);
                    osc.start(now);
                    osc.stop(now + 0.18);
                } catch (e) {}
            }
        }
