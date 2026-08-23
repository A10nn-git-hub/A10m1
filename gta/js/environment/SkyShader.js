/**
         * ============================================================================
         * GTA V Three.js + Cannon.js Game Engine
         * STEP 24: Dynamic Weather System (Rain Particle Effect, Fog, Wet Reflective Roads)
         * 1. Система динамической погоды DynamicWeatherManager: Ясно (CLEAR), Ливень (RAIN), Морось (DRIZZLE).
         * 2. Эффект дождя с помощью высокопроизводительной системы частиц (14000 капель с текстурой и скоростью падения).
         * 3. Динамическое изменение глобальной видимости: при дожде плотность тумана (Fog) увеличивается,
         *    создавая реалистичную штормовую дымку и перепад видимости.
         * 4. Зеркальный мокрый асфальт: шероховатость (roughness) снижается до 0.12, повышается металличность и
         *    интенсивность отражений карты окружения (envMapIntensity: 3.2), отражая фары, здания и фонари!
         * ============================================================================
         */

        if (typeof THREE.Sky === 'undefined') {
            THREE.Sky = function () {
                const shader = {
                    uniforms: {
                        turbidity: { value: 2 },
                        rayleigh: { value: 1.2 },
                        mieCoefficient: { value: 0.005 },
                        mieDirectionalG: { value: 0.8 },
                        sunPosition: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
                        up: { value: new THREE.Vector3(0, 1, 0) }
                    },
                    vertexShader: `
                        uniform vec3 sunPosition;
                        uniform float rayleigh;
                        uniform float turbidity;
                        uniform float mieCoefficient;
                        uniform vec3 up;
                        varying vec3 vWorldPosition;
                        varying vec3 vSunDirection;
                        varying float vSunfade;
                        varying vec3 vBetaR;
                        varying vec3 vBetaM;
                        varying float vSunE;
                        const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468820776E-5);
                        const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
                        const float ONE_OVER_FOURPI = 0.07957747154594767;
                        void main() {
                            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPosition.xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            gl_Position.z = gl_Position.w;
                            vSunDirection = length(sunPosition) > 0.0001 ? normalize(sunPosition) : vec3(0.0, 1.0, 0.0);
                            vSunE = 1000.0;
                            vSunfade = 1.0 - clamp(1.0 - exp(max(0.0, sunPosition.y) / 450000.0), 0.0, 1.0);
                            float rayleighCoef = rayleigh - (1.0 * (1.0 - vSunfade));
                            vBetaR = totalRayleigh * max(0.01, rayleighCoef);
                            vBetaM = totalRayleigh * 0.05 * turbidity * mieCoefficient;
                        }
                    `,
                    fragmentShader: `
                        varying vec3 vWorldPosition;
                        varying vec3 vSunDirection;
                        varying float vSunfade;
                        varying vec3 vBetaR;
                        varying vec3 vBetaM;
                        varying float vSunE;
                        uniform float mieDirectionalG;
                        uniform vec3 up;
                        const vec3 cameraPos = vec3(0.0, 0.0, 0.0);
                        const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
                        const float ONE_OVER_FOURPI = 0.07957747154594767;
                        const float rayleighZenithLength = 8.4E3;
                        const mieZenithLength = 1.25E3;
                        const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
                        float rayleighPhase(float cosTheta) { return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0)); }
                        float hgPhase(float cosTheta, float g) {
                            float g2 = pow(g, 2.0);
                            return ONE_OVER_FOURPI * ((1.0 - g2) / pow(max(0.001, 1.0 - 2.0 * g * cosTheta + g2), 1.5));
                        }
                        void main() {
                            vec3 direction = normalize(vWorldPosition - cameraPos);
                            float zenithAngle = acos(clamp(dot(up, direction), 0.0, 1.0));
                            float inverse = 1.0 / max(0.001, cos(zenithAngle) + 0.15 * pow(max(0.001, 93.885 - ((zenithAngle * 180.0) / 3.14159265)), -1.253));
                            float sR = rayleighZenithLength * inverse;
                            float sM = mieZenithLength * inverse;
                            vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));
                            float cosTheta = clamp(dot(direction, vSunDirection), -1.0, 1.0);
                            float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
                            vec3 betaRTheta = vBetaR * rPhase;
                            float mPhase = hgPhase(cosTheta, mieDirectionalG);
                            vec3 betaMTheta = vBetaM * mPhase;
                            vec3 Lin = pow(max(vec3(0.0), vSunE * ((betaRTheta + betaMTheta) / max(vec3(0.0001), vBetaR + vBetaM)) * (1.0 - Fex)), vec3(1.5));
                            Lin *= mix(vec3(1.0), pow(max(vec3(0.0), vSunE * ((betaRTheta + betaMTheta) / max(vec3(0.0001), vBetaR + vBetaM)) * Fex), vec3(0.5)), clamp(pow(max(0.0, 1.0 - dot(up, vSunDirection)), 5.0), 0.0, 1.0));
                            float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
                            vec3 L0 = vec3(0.1) * Fex + 12000.0 * Fex * sundisk;
                            vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
                            vec3 retColor = pow(max(vec3(0.0), texColor), vec3(1.0 / (1.2 + (1.2 * vSunfade))));
                            gl_FragColor = vec4(clamp(retColor, 0.0, 1.0), 1.0);
                        }
                    `
                };
                const material = new THREE.ShaderMaterial({
                    name: 'SkyShader',
                    fragmentShader: shader.fragmentShader,
                    vertexShader: shader.vertexShader,
                    uniforms: THREE.UniformsUtils.clone(shader.uniforms),
                    side: THREE.BackSide,
                    depthWrite: false
                });
                const skyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
                skyMesh.renderOrder = -1000;
                return skyMesh;
            };
        }
