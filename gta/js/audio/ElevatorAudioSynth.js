/**
         * STEP 28: Синтезатор звуков лифта (механический гул мотора и перезвон 'Ding' по прибытии)
         */
        class ElevatorAudioSynth {
            constructor() {
                this.audioCtx = null;
                this.motorGain = null;
                this.motorOsc = null;
                this.motorSubOsc = null;
                this.isHumming = false;
            }

            init() {
                if (!this.audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        this.audioCtx = new AudioContext();
                    }
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            }

            startHum() {
                this.init();
                if (!this.audioCtx || this.isHumming) return;
                try {
                    const now = this.audioCtx.currentTime;
                    this.motorOsc = this.audioCtx.createOscillator();
                    this.motorSubOsc = this.audioCtx.createOscillator();
                    this.motorGain = this.audioCtx.createGain();

                    const filter = this.audioCtx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(190, now);

                    this.motorOsc.type = 'sawtooth';
                    this.motorOsc.frequency.setValueAtTime(64, now);

                    this.motorSubOsc.type = 'sine';
                    this.motorSubOsc.frequency.setValueAtTime(32, now);

                    this.motorGain.gain.setValueAtTime(0.001, now);
                    this.motorGain.gain.linearRampToValueAtTime(0.12, now + 0.45);

                    this.motorOsc.connect(filter);
                    this.motorSubOsc.connect(filter);
                    filter.connect(this.motorGain);
                    this.motorGain.connect(this.audioCtx.destination);

                    this.motorOsc.start(now);
                    this.motorSubOsc.start(now);
                    this.isHumming = true;
                } catch (e) {
                    console.warn('Audio hum error', e);
                }
            }

            stopHum() {
                if (!this.audioCtx || !this.isHumming) return;
                try {
                    const now = this.audioCtx.currentTime;
                    if (this.motorGain) {
                        this.motorGain.gain.linearRampToValueAtTime(0.001, now + 0.35);
                    }
                    setTimeout(() => {
                        if (this.motorOsc) { try { this.motorOsc.stop(); } catch(e){} this.motorOsc = null; }
                        if (this.motorSubOsc) { try { this.motorSubOsc.stop(); } catch(e){} this.motorSubOsc = null; }
                        this.isHumming = false;
                    }, 400);
                } catch (e) {
                    this.isHumming = false;
                }
            }

            playDing() {
                this.init();
                if (!this.audioCtx) return;
                try {
                    const now = this.audioCtx.currentTime;
                    // Двухтональный аккорд прибытия лифта (C6 = 1046.5 Гц, E6 = 1318.5 Гц)
                    const osc1 = this.audioCtx.createOscillator();
                    const osc2 = this.audioCtx.createOscillator();
                    const gain1 = this.audioCtx.createGain();
                    const gain2 = this.audioCtx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(1046.5, now);
                    gain1.gain.setValueAtTime(0.24, now);
                    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1318.5, now + 0.035);
                    gain2.gain.setValueAtTime(0.001, now);
                    gain2.gain.setValueAtTime(0.20, now + 0.035);
                    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

                    osc1.connect(gain1);
                    gain1.connect(this.audioCtx.destination);
                    osc2.connect(gain2);
                    gain2.connect(this.audioCtx.destination);

                    osc1.start(now);
                    osc1.stop(now + 1.7);
                    osc2.start(now + 0.035);
                    osc2.stop(now + 1.9);
                } catch (e) {
                    console.warn('Audio ding error', e);
                }
            }
        }
