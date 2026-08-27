/**
         * Генератор процедурных текстур и PBR карт
         */
        class ProceduralTextureFactory {
            static createEnvironmentMap(renderer) {
                const canvas = document.createElement('canvas');
                canvas.width = 1024; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
                skyGrad.addColorStop(0.0, '#154273');
                skyGrad.addColorStop(0.45, '#5c94d4');
                skyGrad.addColorStop(0.50, '#dceaf8');
                skyGrad.addColorStop(0.52, '#484d54');
                skyGrad.addColorStop(0.70, '#1c1f24');
                skyGrad.addColorStop(1.0, '#0c0d10');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, 1024, 512);

                const sunGrad = ctx.createRadialGradient(512, 140, 5, 512, 140, 100);
                sunGrad.addColorStop(0, '#ffffff');
                sunGrad.addColorStop(0.2, '#fff4cc');
                sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = sunGrad;
                ctx.fillRect(400, 40, 224, 200);

                const tex = new THREE.CanvasTexture(canvas);
                tex.mapping = THREE.EquirectangularReflectionMapping;

                if (renderer && THREE.PMREMGenerator) {
                    const pmrem = new THREE.PMREMGenerator(renderer);
                    pmrem.compileEquirectangularShader();
                    const envTarget = pmrem.fromEquirectangular(tex);
                    pmrem.dispose();
                    return envTarget.texture;
                }
                return tex;
            }

            static createSoccerBallTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 256);
                ctx.fillStyle = '#111111';
                
                const spots = [
                    { x: 60, y: 60 }, { x: 180, y: 60 }, { x: 300, y: 60 }, { x: 420, y: 60 },
                    { x: 120, y: 140 }, { x: 240, y: 140 }, { x: 360, y: 140 }, { x: 480, y: 140 },
                    { x: 60, y: 210 }, { x: 180, y: 210 }, { x: 300, y: 210 }, { x: 420, y: 210 }
                ];
                for (const s of spots) {
                    ctx.beginPath();
                    for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 5) {
                        const px = s.x + Math.cos(a) * 22;
                        const py = s.y + Math.sin(a) * 22;
                        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 2; ctx.stroke();
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createTireTreadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0, 0, 512, 128);
                ctx.fillStyle = '#0a0a0c';
                ctx.fillRect(0, 36, 512, 8); ctx.fillRect(0, 84, 512, 8);
                for (let x = 0; x < 512; x += 16) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0); ctx.lineTo(x + 10, 36); ctx.lineTo(x + 6, 36); ctx.lineTo(x - 4, 0);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(x + 8, 44); ctx.lineTo(x + 18, 84); ctx.lineTo(x + 14, 84); ctx.lineTo(x + 4, 44);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(x, 92); ctx.lineTo(x + 10, 128); ctx.lineTo(x + 6, 128); ctx.lineTo(x - 4, 92);
                    ctx.fill();
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 1);
                return texture;
            }

            static createBrakeDiscTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#7a8288'; ctx.fillRect(0, 0, 256, 256);
                const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
                grad.addColorStop(0, '#5a6066'); grad.addColorStop(0.35, '#8c969e'); grad.addColorStop(0.7, '#636b73'); grad.addColorStop(1, '#3b4045');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
                ctx.fillStyle = '#1c1e20';
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
                    ctx.beginPath(); ctx.arc(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(128 + Math.cos(a + 0.1) * 90, 128 + Math.sin(a + 0.1) * 90, 2.8, 0, Math.PI * 2); ctx.fill();
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createLicensePlateTexture(text = 'SAN ANDREAS', num = '7GTA500') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 128);
                ctx.strokeStyle = '#024080'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 244, 116);
                ctx.fillStyle = '#024080'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 128, 32);
                ctx.fillStyle = '#11151c'; ctx.font = '900 48px "Courier New", monospace'; ctx.fillText(num, 128, 86);
                return new THREE.CanvasTexture(canvas);
            }

            static createSunGlowTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
                grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
                grad.addColorStop(0.2, 'rgba(255, 220, 100, 0.85)');
                grad.addColorStop(0.5, 'rgba(255, 160, 40, 0.4)');
                grad.addColorStop(1.0, 'rgba(255, 100, 0, 0.0)');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
                return new THREE.CanvasTexture(canvas);
            }

            static createMoonTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#c5d0e0'; ctx.fillRect(0, 0, 512, 256);
                ctx.fillStyle = '#7a8494';
                const maria = [
                    { x: 170, y: 90, rx: 65, ry: 45 }, { x: 255, y: 125, rx: 55, ry: 38 },
                    { x: 325, y: 85, rx: 50, ry: 42 }, { x: 110, y: 145, rx: 40, ry: 28 }, { x: 380, y: 150, rx: 45, ry: 30 }
                ];
                for (const m of maria) {
                    ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2); ctx.fill();
                }
                for (let i = 0; i < 60; i++) {
                    const cx = Math.random() * 512; const cy = Math.random() * 256; const r = 3 + Math.random() * 14;
                    ctx.strokeStyle = '#edf3fc'; ctx.lineWidth = 1.6;
                    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#5c6473'; ctx.beginPath(); ctx.arc(cx + 1, cy + 1, r * 0.72, 0, Math.PI * 2); ctx.fill();
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createMoonHaloTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
                grad.addColorStop(0, 'rgba(180, 215, 255, 0.9)');
                grad.addColorStop(0.3, 'rgba(140, 185, 255, 0.4)');
                grad.addColorStop(1, 'rgba(80, 120, 255, 0.0)');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
                return new THREE.CanvasTexture(canvas);
            }

            static createSmokeTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
                grad.addColorStop(0.0, 'rgba(235, 240, 250, 0.85)');
                grad.addColorStop(0.3, 'rgba(205, 215, 230, 0.55)');
                grad.addColorStop(0.65, 'rgba(175, 185, 200, 0.22)');
                grad.addColorStop(1.0, 'rgba(150, 160, 175, 0.0)');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
                return new THREE.CanvasTexture(canvas);
            }

            static createVerticalRoadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1c1e22'; ctx.fillRect(0, 0, 512, 512);

                // Внешняя белая сплошная разметка обочины
                ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, 512); ctx.moveTo(472, 0); ctx.lineTo(472, 512); ctx.stroke();

                // Двойная сплошная желтая линия по центру
                ctx.strokeStyle = '#f5b027'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(252, 0); ctx.lineTo(252, 512); ctx.moveTo(260, 0); ctx.lineTo(260, 512); ctx.stroke();

                // Прерывистые белые линии полос движения
                ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 5; ctx.setLineDash([35, 25]);
                ctx.beginPath();
                ctx.moveTo(146, 10); ctx.lineTo(146, 95);
                ctx.moveTo(366, 10); ctx.lineTo(366, 95);
                ctx.moveTo(146, 185); ctx.lineTo(146, 325);
                ctx.moveTo(366, 185); ctx.lineTo(366, 325);
                ctx.moveTo(146, 417); ctx.lineTo(146, 502);
                ctx.moveTo(366, 417); ctx.lineTo(366, 502);
                ctx.stroke();
                ctx.setLineDash([]);

                // Пешеходные переходы «Зебра» от тротуара до тротуара (5х дальше от перекрестков)
                const spanStart = 40;
                const spanEnd = 472;
                const totalSpan = spanEnd - spanStart;
                const stripeCount = 14;
                const slotSize = totalSpan / stripeCount;
                const stripeW = 18.0;
                const stripeLen = 52.0;

                ctx.fillStyle = '#f8fafc';

                // Северный переход (Y: 110..162)
                for (let i = 0; i < stripeCount; i++) {
                    const offset = spanStart + i * slotSize + (slotSize - stripeW) / 2;
                    ctx.fillRect(offset, 110, stripeW, stripeLen);
                }
                // Стоп-линия перед северным переходом (для приближающегося транспорта: X 256..472, Y: 174)
                ctx.fillRect(256, 174, 216, 8.0);

                // Южный переход (Y: 350..402)
                for (let i = 0; i < stripeCount; i++) {
                    const offset = spanStart + i * slotSize + (slotSize - stripeW) / 2;
                    ctx.fillRect(offset, 350, stripeW, stripeLen);
                }
                // Стоп-линия перед южным переходом (для приближающегося транспорта: X 40..256, Y: 338)
                ctx.fillRect(40, 338, 216, 8.0);

                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.anisotropy = 8;
                texture.needsUpdate = true;
                return texture;
            }

            static createHorizontalRoadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1c1e22'; ctx.fillRect(0, 0, 512, 512);

                // Внешняя белая сплошная разметка обочины
                ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(512, 40); ctx.moveTo(0, 472); ctx.lineTo(512, 472); ctx.stroke();

                // Двойная сплошная желтая линия по центру
                ctx.strokeStyle = '#f5b027'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(0, 252); ctx.lineTo(512, 252); ctx.moveTo(0, 260); ctx.lineTo(512, 260); ctx.stroke();

                // Прерывистые белые линии полос движения
                ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 5; ctx.setLineDash([35, 25]);
                ctx.beginPath();
                ctx.moveTo(10, 146); ctx.lineTo(95, 146);
                ctx.moveTo(10, 366); ctx.lineTo(95, 366);
                ctx.moveTo(185, 146); ctx.lineTo(325, 146);
                ctx.moveTo(185, 366); ctx.lineTo(325, 366);
                ctx.moveTo(417, 146); ctx.lineTo(502, 146);
                ctx.moveTo(417, 366); ctx.lineTo(502, 366);
                ctx.stroke();
                ctx.setLineDash([]);

                // Пешеходные переходы «Зебра» от тротуара до тротуара (5х дальше от перекрестков)
                const spanStart = 40;
                const spanEnd = 472;
                const totalSpan = spanEnd - spanStart;
                const stripeCount = 14;
                const slotSize = totalSpan / stripeCount;
                const stripeW = 18.0;
                const stripeLen = 52.0;

                ctx.fillStyle = '#f8fafc';

                // Западный переход (X: 110..162)
                for (let i = 0; i < stripeCount; i++) {
                    const offset = spanStart + i * slotSize + (slotSize - stripeW) / 2;
                    ctx.fillRect(110, offset, stripeLen, stripeW);
                }
                // Стоп-линия перед западным переходом (для приближающегося транспорта: Y 40..256, X: 174)
                ctx.fillRect(174, 40, 8.0, 216);

                // Восточный переход (X: 350..402)
                for (let i = 0; i < stripeCount; i++) {
                    const offset = spanStart + i * slotSize + (slotSize - stripeW) / 2;
                    ctx.fillRect(350, offset, stripeLen, stripeW);
                }
                // Стоп-линия перед восточным переходом (для приближающегося транспорта: Y 256..472, X: 338)
                ctx.fillRect(338, 256, 8.0, 216);

                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.anisotropy = 8;
                texture.needsUpdate = true;
                return texture;
            }

            static createIntersectionTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // 1. Асфальтовое полотно перекрестка
                ctx.fillStyle = '#1c1e22';
                ctx.fillRect(0, 0, 512, 512);

                // Микро-текстура зернистости асфальта
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                for (let i = 0; i < 400; i++) {
                    const rx = (Math.random() * 512) | 0;
                    const ry = (Math.random() * 512) | 0;
                    ctx.fillRect(rx, ry, 2, 2);
                }

                // 2. Стыковочные двойные сплошные желтые линии до перекрестка
                ctx.strokeStyle = '#f5b027';
                ctx.lineWidth = 5;
                ctx.beginPath();
                // Сверху
                ctx.moveTo(252, 0); ctx.lineTo(252, 80);
                ctx.moveTo(260, 0); ctx.lineTo(260, 80);
                // Снизу
                ctx.moveTo(252, 432); ctx.lineTo(252, 512);
                ctx.moveTo(260, 432); ctx.lineTo(260, 512);
                // Слева
                ctx.moveTo(0, 252); ctx.lineTo(80, 252);
                ctx.moveTo(0, 260); ctx.lineTo(80, 260);
                // Справа
                ctx.moveTo(432, 252); ctx.lineTo(512, 252);
                ctx.moveTo(432, 260); ctx.lineTo(512, 260);
                ctx.stroke();

                // 3. Закругленные белые линии бордюров на 4 углах перекрестка
                ctx.strokeStyle = '#eaeaea';
                ctx.lineWidth = 6;
                // Верх-лево
                ctx.beginPath();
                ctx.moveTo(40, 0); ctx.lineTo(40, 40);
                ctx.moveTo(0, 40); ctx.lineTo(40, 40);
                ctx.stroke();
                // Верх-право
                ctx.beginPath();
                ctx.moveTo(472, 0); ctx.lineTo(472, 40);
                ctx.moveTo(512, 40); ctx.lineTo(472, 40);
                ctx.stroke();
                // Низ-лево
                ctx.beginPath();
                ctx.moveTo(40, 512); ctx.lineTo(40, 472);
                ctx.moveTo(0, 472); ctx.lineTo(40, 472);
                ctx.stroke();
                // Низ-право
                ctx.beginPath();
                ctx.moveTo(472, 512); ctx.lineTo(472, 472);
                ctx.moveTo(512, 472); ctx.lineTo(472, 472);
                ctx.stroke();

                const texture = new THREE.CanvasTexture(canvas);
                texture.anisotropy = 8;
                texture.needsUpdate = true;
                return texture;
            }

            static createSidewalkTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#8a9199'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 256; x += 32) {
                    for (let y = 0; y < 256; y += 32) {
                        const shade = Math.floor((Math.random() - 0.5) * 16);
                        ctx.fillStyle = `rgb(${138 + shade}, ${145 + shade}, ${153 + shade})`;
                        ctx.fillRect(x, y, 32, 32);
                        ctx.strokeStyle = '#4e5359'; ctx.strokeRect(x, y, 32, 32);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.needsUpdate = true;
                return texture;
            }

            static createCurbTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#7a8088'; ctx.fillRect(0, 0, 128, 32);
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.needsUpdate = true;
                return texture;
            }

            static createBrickTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#b5afa6'; ctx.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 14) {
                    for (let x = 0; x < 256; x += 34) {
                        ctx.fillStyle = '#9b3c2d'; ctx.fillRect(x, y, 32, 12);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                return texture;
            }

            static createSidingTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#e2d8c3'; ctx.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 16) {
                    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, y + 14, 256, 2);
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                return texture;
            }

            static createRoofShingleTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#2b2e34'; ctx.fillRect(0, 0, 256, 256);
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                return texture;
            }

            static createWindowTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1e2836'; ctx.fillRect(0, 0, 128, 128);
                ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 120, 120);
                return new THREE.CanvasTexture(canvas);
            }

            static createWindowEmissiveTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 128, 128);
                const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
                grad.addColorStop(0, '#fff4cc'); grad.addColorStop(0.5, '#ffba42'); grad.addColorStop(1, '#d87010');
                ctx.fillStyle = grad; ctx.fillRect(8, 8, 112, 112);
                return new THREE.CanvasTexture(canvas);
            }

            static createGrassTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#2d5a27'; ctx.fillRect(0, 0, 512, 512);
                for (let x = 0; x < 512; x += 16) {
                    for (let y = 0; y < 512; y += 16) {
                        const noise = Math.floor((Math.random() - 0.5) * 24);
                        ctx.fillStyle = `rgb(${42 + noise}, ${88 + noise}, ${36 + noise})`;
                        ctx.fillRect(x, y, 16, 16);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(32, 32);
                texture.needsUpdate = true;
                return texture;
            }

            static createCityGroundTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#222831'; ctx.fillRect(0, 0, 512, 512);
                for (let x = 0; x < 512; x += 32) {
                    for (let y = 0; y < 512; y += 32) {
                        const noise = Math.floor((Math.random() - 0.5) * 14);
                        ctx.fillStyle = `rgb(${34 + noise}, ${40 + noise}, ${49 + noise})`;
                        ctx.fillRect(x, y, 32, 32);
                        ctx.strokeStyle = '#181e25'; ctx.lineWidth = 1.5;
                        ctx.strokeRect(x, y, 32, 32);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(16, 16);
                texture.needsUpdate = true;
                return texture;
            }

            static createMazeBankSignTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#080811'; ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 116);

                // Логотип Maze Bank (Стилизованная красная буква 'M' со щитом)
                ctx.fillStyle = '#ff1744';
                ctx.beginPath();
                ctx.moveTo(35, 24); ctx.lineTo(85, 24); ctx.lineTo(85, 104); ctx.lineTo(60, 72); ctx.lineTo(35, 104); ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '900 52px "Arial Black", Arial, sans-serif';
                ctx.fillText('MAZE BANK', 115, 84);
                return new THREE.CanvasTexture(canvas);
            }

            static createMazeBankCrestTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#0f141c'; ctx.fillRect(0, 0, 512, 512);

                // Золотой внешний круг и окантовка
                ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 12;
                ctx.beginPath(); ctx.arc(256, 256, 220, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 6;
                ctx.beginPath(); ctx.arc(256, 256, 200, 0, Math.PI * 2); ctx.stroke();

                // Центральная эмблема
                ctx.fillStyle = '#ff1744';
                ctx.beginPath();
                ctx.moveTo(170, 140); ctx.lineTo(342, 140); ctx.lineTo(342, 320); ctx.lineTo(256, 240); ctx.lineTo(170, 320); ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = '900 42px "Arial Black", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('MAZE BANK', 256, 380);
                ctx.font = 'bold 22px Arial, sans-serif';
                ctx.fillStyle = '#d4af37';
                ctx.fillText('EST. 1928 // LOS SANTOS', 256, 420);
                return new THREE.CanvasTexture(canvas);
            }

            static createLuxuryBlackMarbleTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1e2530'; ctx.fillRect(0, 0, 512, 512);

                // Плитка с фасками
                for (let x = 0; x < 512; x += 128) {
                    for (let y = 0; y < 512; y += 128) {
                        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3;
                        ctx.strokeRect(x, y, 128, 128);
                    }
                }

                // Золотистые и белые мраморные прожилки
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.65)';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(20, 10); ctx.bezierCurveTo(120, 180, 340, 120, 490, 480);
                ctx.moveTo(400, 20); ctx.bezierCurveTo(280, 200, 200, 350, 50, 490);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(80, 0); ctx.bezierCurveTo(180, 250, 320, 280, 450, 512);
                ctx.stroke();

                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2, 2);
                return texture;
            }

            static createMazeBankGlassFacadeTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                // Насыщенный зеркальный сапфировый градиент
                const grad = ctx.createLinearGradient(0, 0, 0, 512);
                grad.addColorStop(0.0, '#153258');
                grad.addColorStop(0.5, '#1e4b82');
                grad.addColorStop(1.0, '#102847');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);

                // Оконные панели и алюминиевые шпросы (мюллионы)
                for (let x = 0; x < 8; x++) {
                    for (let y = 0; y < 16; y++) {
                        const isLit = Math.sin(x * 15.3 + y * 28.7) > 0.25;
                        ctx.fillStyle = isLit ? 'rgba(254, 240, 138, 0.92)' : (Math.random() > 0.5 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(30, 64, 110, 0.45)');
                        ctx.fillRect(x * 64 + 4, y * 32 + 4, 56, 24);
                        ctx.strokeStyle = '#0b192c'; ctx.lineWidth = 2.5;
                        ctx.strokeRect(x * 64 + 2, y * 32 + 2, 60, 28);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(4, 8);
                return texture;
            }

            static createStockTickerTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#050a14'; ctx.fillRect(0, 0, 512, 256);
                ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 248);

                ctx.fillStyle = '#00f0ff';
                ctx.font = 'bold 20px "Courier New", monospace';
                ctx.fillText('LOS SANTOS FINANCIAL EXCHANGE // LIVE', 18, 34);

                const stocks = [
                    { name: 'MAZE BANK (MAZ)', price: '$482.50', change: '+3.8%', up: true },
                    { name: 'FLYUS AIR (FLY)', price: '$128.15', change: '+1.2%', up: true },
                    { name: 'AMMU-NATION (AMU)', price: '$310.90', change: '-0.6%', up: false },
                    { name: 'VANGELICO (VNG)', price: '$785.40', change: '+5.4%', up: true },
                    { name: 'FLEECE BANK (FLC)', price: '$94.20', change: '-2.1%', up: false }
                ];

                for (let i = 0; i < stocks.length; i++) {
                    const s = stocks[i];
                    const y = 72 + i * 36;
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '16px "Courier New", monospace';
                    ctx.fillText(s.name, 18, y);
                    ctx.fillText(s.price, 280, y);
                    ctx.fillStyle = s.up ? '#22c55e' : '#ef4444';
                    ctx.fillText(s.change, 420, y);
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createLSPDSignTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#050a14'; ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 116);
                ctx.fillStyle = '#ffffff'; ctx.font = '900 38px Arial'; ctx.fillText('LOS SANTOS POLICE', 120, 78);
                return new THREE.CanvasTexture(canvas);
            }

            static createHospitalSignTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#08140e'; ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#00e676'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 116);
                ctx.fillStyle = '#ffffff'; ctx.font = '900 34px Arial'; ctx.fillText('PILLBOX HILL MEDICAL', 115, 75);
                return new THREE.CanvasTexture(canvas);
            }

            static createSkyscraperGlassTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#0c1b2a'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 8; x++) {
                    for (let y = 0; y < 16; y++) {
                        ctx.fillStyle = Math.random() > 0.6 ? '#1b344d' : '#0e2236';
                        ctx.fillRect(x * 32 + 2, y * 16 + 2, 28, 12);
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                return texture;
            }

            static createSkyscraperEmissiveTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 8; x++) {
                    for (let y = 0; y < 16; y++) {
                        if (Math.sin(x * 12.3 + y * 45.7) > 0.05) {
                            ctx.fillStyle = '#fff1c4';
                            ctx.fillRect(x * 32 + 2, y * 16 + 2, 28, 12);
                        }
                    }
                }
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
                return texture;
            }

            static createHelipadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#22252a'; ctx.fillRect(0, 0, 256, 256);
                ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(128, 128, 105, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#ffd700'; ctx.font = '900 120px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 128, 128);
                return new THREE.CanvasTexture(canvas);
            }

            // STEP 26: Текстуры интерьеров зданий
            static createComputerScreenTexture(title = 'LSPD DATABASE') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#0a192f'; ctx.fillRect(0, 0, 256, 128);
                ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 0, 256, 22);
                ctx.fillStyle = '#60a5fa'; ctx.font = 'bold 12px monospace'; ctx.fillText(title, 8, 16);
                ctx.fillStyle = '#38bdf8';
                for (let y = 32; y < 120; y += 14) {
                    ctx.fillRect(8, y, 40 + Math.sin(y * 12) * 30, 4);
                    ctx.fillRect(90, y, 80 + Math.cos(y * 8) * 40, 4);
                }
                const tex = new THREE.CanvasTexture(canvas);
                return tex;
            }

            static createECGScreenTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#05140b'; ctx.fillRect(0, 0, 256, 128);
                ctx.fillStyle = '#10b981'; ctx.font = 'bold 13px monospace'; ctx.fillText('HR: 78 BPM | SPO2: 99%', 8, 18);
                ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(0, 70); ctx.lineTo(40, 70); ctx.lineTo(55, 30); ctx.lineTo(70, 105);
                ctx.lineTo(85, 60); ctx.lineTo(100, 70); ctx.lineTo(160, 70); ctx.lineTo(175, 30);
                ctx.lineTo(190, 105); ctx.lineTo(205, 60); ctx.lineTo(220, 70); ctx.lineTo(256, 70);
                ctx.stroke();
                return new THREE.CanvasTexture(canvas);
            }

            static createVaultDoorTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#374151'; ctx.fillRect(0, 0, 512, 512);
                const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 250);
                grad.addColorStop(0, '#9ca3af'); grad.addColorStop(0.5, '#4b5563'); grad.addColorStop(0.8, '#1f2937'); grad.addColorStop(1, '#111827');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(256, 256, 240, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(256, 256, 200, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#d97706'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(256, 256, 90, 0, Math.PI * 2); ctx.stroke();
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    ctx.fillStyle = '#e5e7eb';
                    ctx.beginPath(); ctx.arc(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90, 14, 0, Math.PI * 2); ctx.fill();
                }
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                    ctx.fillStyle = '#9ca3af';
                    ctx.beginPath(); ctx.arc(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190, 8, 0, Math.PI * 2); ctx.fill();
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createSafeDepositBoxesTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#4b5563'; ctx.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 32) {
                    for (let x = 0; x < 256; x += 48) {
                        ctx.fillStyle = '#6b7280'; ctx.fillRect(x + 2, y + 2, 44, 28);
                        ctx.fillStyle = '#111827';
                        ctx.fillRect(x + 12, y + 15, 6, 2);
                        ctx.fillRect(x + 28, y + 15, 6, 2);
                    }
                }
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createMarbleFloorTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 256; x += 64) {
                    for (let y = 0; y < 256; y += 64) {
                        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 64, 64);
                    }
                }
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(8, 8);
                return tex;
            }

            static createHospitalFloorTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 256; x += 64) {
                    for (let y = 0; y < 256; y += 64) {
                        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 64, 64);
                    }
                }
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(8, 8);
                return tex;
            }

            static createPoliceFloorTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, 256, 256);
                for (let x = 0; x < 256; x += 64) {
                    for (let y = 0; y < 256; y += 64) {
                        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 64, 64);
                    }
                }
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(8, 8);
                return tex;
            }

            static createNewspaperTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 360;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, 512, 360);

                // Заголовок газеты Los Santos Chronicle
                ctx.fillStyle = '#111827';
                ctx.font = '900 32px "Times New Roman", serif';
                ctx.textAlign = 'center';
                ctx.fillText('LOS SANTOS CHRONICLE', 256, 42);
                ctx.strokeStyle = '#111827'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(20, 54); ctx.lineTo(492, 54); ctx.stroke();

                // 2 колонки текста и фото
                ctx.fillStyle = '#374151'; ctx.fillRect(35, 70, 195, 110);
                for (let y = 195; y < 335; y += 10) {
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(35, y, 195, 4);
                }

                // Правая колонка
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 18px "Times New Roman", serif';
                ctx.textAlign = 'left';
                ctx.fillText('FINANCIAL DISTRICT BOOM', 260, 80);
                for (let y = 98; y < 335; y += 10) {
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(260, y, 215, 4);
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createBookTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#831843'; ctx.fillRect(0, 0, 256, 256);
                ctx.fillStyle = '#fef3c7'; ctx.fillRect(24, 24, 208, 208);
                ctx.strokeStyle = '#92400e'; ctx.lineWidth = 4; ctx.strokeRect(20, 20, 216, 216);

                // Разворот страниц с текстом
                ctx.fillStyle = '#1c1917';
                for (let y = 45; y < 205; y += 12) {
                    ctx.fillRect(35, y, 80, 4);
                    ctx.fillRect(140, y, 80, 4);
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createCoffeeCupTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 128, 128);
                ctx.fillStyle = '#78350f'; ctx.fillRect(0, 36, 128, 56);
                ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(64, 64, 22, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 64, 64);
                return new THREE.CanvasTexture(canvas);
            }

            static createClipboardTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#78350f'; ctx.fillRect(0, 0, 256, 256);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(16, 32, 224, 208);
                ctx.fillStyle = '#475569'; ctx.fillRect(80, 12, 96, 24);
                ctx.fillStyle = '#1e293b';
                for (let y = 60; y < 220; y += 14) {
                    ctx.fillRect(32, y, 192, 4);
                }
                return new THREE.CanvasTexture(canvas);
            }

            // STEP 28: Текстуры для лифта Maze Bank
            static createElevatorPanelTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1e232a'; ctx.fillRect(0, 0, 128, 512);
                ctx.strokeStyle = '#d97706'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 120, 504);
                
                // Логотип Maze Bank
                ctx.fillStyle = '#ff1744'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('MAZE BANK', 64, 32);
                
                // Кнопки 1-10
                for (let i = 1; i <= 10; i++) {
                    const row = Math.floor((i - 1) / 2);
                    const col = (i - 1) % 2;
                    const bx = 36 + col * 56;
                    const by = 80 + row * 82;

                    ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5; ctx.stroke();
                    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px monospace'; ctx.textBaseline = 'middle';
                    ctx.fillText(i === 10 ? '10' : `${i}`, bx, by);
                }
                return new THREE.CanvasTexture(canvas);
            }

            static createElevatorDisplayTexture(floorNum = 1, arrow = '▲') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, 256, 64);
                ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 252, 60);

                ctx.fillStyle = '#ffd700'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`${arrow} FLOOR ${floorNum} ${arrow}`, 128, 32);
                return new THREE.CanvasTexture(canvas);
            }

            // STEP 32: Процедурные атласы текстур для разнообразных районов города
            static createSkyscraperAtlas(themeIndex = 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                const themes = [
                    { bg: '#081726', glass1: '#0e2b47', glass2: '#1b4a78', mullion: '#1e3245', accent: '#38bdf8' }, // Sapphire Blue
                    { bg: '#071d16', glass1: '#0e382b', glass2: '#1b5c47', mullion: '#194033', accent: '#34d399' }, // Emerald Green
                    { bg: '#1c150c', glass1: '#362817', glass2: '#574026', mullion: '#3b2f21', accent: '#fbbf24' }, // Bronze Corporate
                    { bg: '#0b0c10', glass1: '#161922', glass2: '#232836', mullion: '#2d3342', accent: '#94a3b8' }  // Obsidian Stealth
                ];
                const t = themes[themeIndex % themes.length];

                ctx.fillStyle = t.bg; ctx.fillRect(0, 0, 512, 512);

                const cols = 8; const rows = 16;
                const cw = 512 / cols; const rh = 512 / rows;

                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        const x = c * cw; const y = r * rh;
                        const rand = Math.sin(c * 19.3 + r * 37.1 + themeIndex * 5.7);

                        ctx.fillStyle = rand > 0.3 ? t.glass2 : t.glass1;
                        ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);

                        // Световые блики на стеклах
                        if (rand > 0.6) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                            ctx.beginPath();
                            ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + cw - 6, y + 3); ctx.lineTo(x + 3, y + rh - 6);
                            ctx.fill();
                        }

                        // Импосты и профили оконных рам
                        ctx.strokeStyle = t.mullion; ctx.lineWidth = 2;
                        ctx.strokeRect(x + 2, y + 2, cw - 4, rh - 4);
                    }
                }

                // Горизонтальные межэтажные пояса
                ctx.fillStyle = t.mullion;
                for (let r = 0; r < rows; r += 4) {
                    ctx.fillRect(0, r * rh, 512, 4);
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createSkyscraperEmissiveAtlas(themeIndex = 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 512, 512);

                const cols = 8; const rows = 16;
                const cw = 512 / cols; const rh = 512 / rows;

                const warmColors = ['#fff5d6', '#ffe08a', '#ffd255', '#ffbe33', '#e0f2fe'];

                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        const x = c * cw; const y = r * rh;
                        const seed = Math.sin(c * 23.7 + r * 41.3 + themeIndex * 13.9);

                        // Около 30% окон горят мягким светом
                        if (seed > 0.38) {
                            const cIdx = Math.floor(Math.abs(seed * 10)) % warmColors.length;
                            ctx.fillStyle = warmColors[cIdx];
                            ctx.fillRect(x + 4, y + 4, cw - 8, rh - 8);

                            // Силуэт жалюзи или мебели внутри офиса
                            if (seed > 0.7) {
                                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                                ctx.fillRect(x + 4, y + rh / 2, cw - 8, rh / 4);
                            }
                        }
                    }
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createIndustrialBrickAtlas() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // Кирпичный растворный фон
                ctx.fillStyle = '#6b665c'; ctx.fillRect(0, 0, 512, 512);

                const brickH = 14; const brickW = 32;
                let row = 0;
                for (let y = 0; y < 512; y += brickH) {
                    const offset = (row % 2 === 0) ? 0 : brickW / 2;
                    for (let x = -brickW; x < 512 + brickW; x += brickW) {
                        const rand = Math.sin(x * 17.1 + y * 29.3);
                        const r = Math.floor(130 + rand * 35);
                        const g = Math.floor(45 + rand * 15);
                        const b = Math.floor(35 + rand * 15);
                        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                        ctx.fillRect(x + offset + 1.5, y + 1.5, brickW - 3, brickH - 3);
                    }
                    row++;
                }

                // Индустриальные бетонные колонны и армирующие полосы
                ctx.fillStyle = '#474a51';
                ctx.fillRect(0, 0, 24, 512);
                ctx.fillRect(244, 0, 24, 512);
                ctx.fillRect(488, 0, 24, 512);
                ctx.fillRect(0, 480, 512, 32);

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createCorrugatedSteelTexture(tint = '#64748b') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = tint; ctx.fillRect(0, 0, 256, 256);

                // Рифленые ребра профнастила
                const ribWidth = 16;
                for (let x = 0; x < 256; x += ribWidth) {
                    const grad = ctx.createLinearGradient(x, 0, x + ribWidth, 0);
                    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.25)');
                    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)');
                    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.15)');
                    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.45)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, 0, ribWidth, 256);
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createChainLinkFenceTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');

                ctx.clearRect(0, 0, 128, 128);

                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2.5;
                const step = 16;
                for (let i = -128; i < 256; i += step) {
                    ctx.beginPath();
                    ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128);
                    ctx.moveTo(i + 128, 0); ctx.lineTo(i, 128);
                    ctx.stroke();
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(4, 2);
                return tex;
            }

            static createCommercialNeonAtlas(shopType = 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');

                const shops = [
                    { title: '24/7 SUPERMART', sub: 'OPEN ALL NIGHT • GROCERIES', primary: '#00e5ff', secondary: '#ff9100', border: '#00e5ff' },
                    { title: 'LS CUSTOMS', sub: 'AUTO REPAIR & TUNING SHOP', primary: '#ffd700', secondary: '#ff007f', border: '#ffd700' },
                    { title: 'GUNS & AMMO', sub: 'TACTICAL GEAR • SHOOTING RANGE', primary: '#ff1744', secondary: '#ffffff', border: '#ff1744' },
                    { title: 'NEON LOUNGE', sub: 'NIGHTCLUB • VIP COCKTAILS', primary: '#e040fb', secondary: '#00e5ff', border: '#e040fb' },
                    { title: 'ROUTE 68 DINER', sub: 'FRESH COFFEE • BURGERS & SHAKES', primary: '#ffab00', secondary: '#ff3d00', border: '#ffab00' },
                    { title: 'CITY PHARMACY +', sub: '24H PRESCRIPTIONS & HEALTH', primary: '#00e676', secondary: '#ffffff', border: '#00e676' },
                    { title: 'CYBER TECH ZONE', sub: 'GADGETS • PHONES • REPAIR', primary: '#2979ff', secondary: '#00e5ff', border: '#2979ff' }
                ];
                const s = shops[shopType % shops.length];

                // Темная металлическая вывеска-панель
                ctx.fillStyle = '#0a0d13'; ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 506, 122);

                // Неоновый светящийся контур
                ctx.strokeStyle = s.border; ctx.lineWidth = 4;
                ctx.strokeRect(10, 10, 492, 108);

                // Основное название
                ctx.fillStyle = s.primary;
                ctx.font = '900 36px Arial, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowColor = s.primary; ctx.shadowBlur = 16;
                ctx.fillText(s.title, 256, 48);

                // Дополнительный слоган
                ctx.shadowBlur = 8; ctx.shadowColor = s.secondary;
                ctx.fillStyle = s.secondary;
                ctx.font = 'bold 16px monospace';
                ctx.fillText(s.sub, 256, 88);

                ctx.shadowBlur = 0;

                const tex = new THREE.CanvasTexture(canvas);
                return tex;
            }

            static createStorefrontDisplayTexture(shopType = 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 256;
                const ctx = canvas.getContext('2d');

                // Темный интерьер
                ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 512, 256);

                // Витринные стекла и рамы
                ctx.strokeStyle = '#334155'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 244);
                ctx.beginPath(); ctx.moveTo(256, 6); ctx.lineTo(256, 250); ctx.stroke();

                // Полки и выкладка товаров
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(20, 160, 216, 80);
                ctx.fillRect(276, 160, 216, 80);

                // Разноцветные силуэты товаров на полках
                const palette = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                for (let i = 0; i < 6; i++) {
                    ctx.fillStyle = palette[(i + shopType) % palette.length];
                    ctx.fillRect(30 + i * 34, 130 + (i % 2) * 8, 24, 28);
                    ctx.fillRect(286 + i * 34, 130 + ((i + 1) % 2) * 8, 24, 28);
                }

                // Стеклянный блик на витрине
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.beginPath();
                ctx.moveTo(10, 10); ctx.lineTo(120, 10); ctx.lineTo(40, 240); ctx.lineTo(10, 240);
                ctx.fill();

                const tex = new THREE.CanvasTexture(canvas);
                return tex;
            }

            // STEP 33: Текстуры для скоростной автомагистрали (Highway), мостов и сельских грунтовых дорог
            static createHighwayRoadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // Темный скоростной асфальт
                ctx.fillStyle = '#15171a'; ctx.fillRect(0, 0, 512, 512);

                // Внешние сплошные белые линии обочины
                ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(32, 0); ctx.lineTo(32, 512);
                ctx.moveTo(480, 0); ctx.lineTo(480, 512);
                ctx.stroke();

                // Прерывистые белые разделители полос (2 полосы в каждую сторону)
                ctx.lineWidth = 4; ctx.setLineDash([32, 28]);
                ctx.beginPath();
                ctx.moveTo(144, 0); ctx.lineTo(144, 512);
                ctx.moveTo(368, 0); ctx.lineTo(368, 512);
                ctx.stroke();
                ctx.setLineDash([]);

                // Центральная двойная желтая сплошная полоса (или тень от бетонного разделителя)
                ctx.strokeStyle = '#eab308'; ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(250, 0); ctx.lineTo(250, 512);
                ctx.moveTo(262, 0); ctx.lineTo(262, 512);
                ctx.stroke();

                // Текстура зернистости асфальта
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                for (let i = 0; i < 400; i++) {
                    const rx = Math.random() * 512; const ry = Math.random() * 512;
                    ctx.fillRect(rx, ry, 2, 2);
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.anisotropy = 4;
                return tex;
            }

            static createHighwayBridgeTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#262930'; ctx.fillRect(0, 0, 512, 512);

                // Деформационные швы моста
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, 512, 8);
                ctx.fillRect(0, 252, 512, 8);

                // Боковые бетонные бордюры
                ctx.fillStyle = '#475569';
                ctx.fillRect(0, 0, 28, 512);
                ctx.fillRect(484, 0, 28, 512);

                // Разметка
                ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(40, 0); ctx.lineTo(40, 512);
                ctx.moveTo(472, 0); ctx.lineTo(472, 512);
                ctx.stroke();

                ctx.strokeStyle = '#eab308'; ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(252, 0); ctx.lineTo(252, 512);
                ctx.moveTo(260, 0); ctx.lineTo(260, 512);
                ctx.stroke();

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createDirtRoadTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // Землистый песчано-глиняный грунт
                ctx.fillStyle = '#5c4731'; ctx.fillRect(0, 0, 512, 512);

                // Неровная песчаная основа
                for (let y = 0; y < 512; y += 4) {
                    const grad = ctx.createLinearGradient(0, y, 512, y);
                    grad.addColorStop(0.0, '#423321');
                    grad.addColorStop(0.2, '#7a5f3f');
                    grad.addColorStop(0.5, '#5c4731');
                    grad.addColorStop(0.8, '#7a5f3f');
                    grad.addColorStop(1.0, '#423321');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y, 512, 4);
                }

                // Две накатанные колеи от колес (Ruts)
                ctx.fillStyle = '#3a2d1e';
                ctx.fillRect(110, 0, 80, 512);
                ctx.fillRect(322, 0, 80, 512);

                // Песок и гравийные камушки
                const pebbles = ['#9e815e', '#b89972', '#2c2217', '#876947'];
                for (let i = 0; i < 350; i++) {
                    const px = Math.random() * 512; const py = Math.random() * 512;
                    ctx.fillStyle = pebbles[i % pebbles.length];
                    ctx.fillRect(px, py, 2 + (i % 3), 2 + ((i + 1) % 3));
                }

                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                tex.anisotropy = 4;
                return tex;
            }

            static createHighwaySignTexture(title = 'LOS SANTOS FREEWAY', exit = 'EXIT 4B') {
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 160;
                const ctx = canvas.getContext('2d');

                // Автомагистральный зеленый фон
                ctx.fillStyle = '#065f46'; ctx.fillRect(0, 0, 512, 160);
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 500, 148);

                // Желтая плашка съезда
                ctx.fillStyle = '#eab308'; ctx.fillRect(320, 14, 175, 40);
                ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(exit, 407, 42);

                // Текст трассы
                ctx.fillStyle = '#ffffff'; ctx.font = '900 32px Arial'; ctx.textAlign = 'left';
                ctx.fillText(title, 24, 75);

                ctx.font = 'bold 22px Arial';
                ctx.fillText('▲ PALETO BAY • SANDY SHORES', 24, 120);

                const tex = new THREE.CanvasTexture(canvas);
                return tex;
            }
        }

window.ProceduralTextureFactory = ProceduralTextureFactory;
