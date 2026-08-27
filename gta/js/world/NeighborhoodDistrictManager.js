/**
         * STEP 38: Менеджер районов и триггерных зон карты (Neighborhood District Manager)
         * - Делит гигантскую карту на 12 уникальных поименованных районов и биомов.
         * - При пересечении игроком границы района триггерит анимацию в правом нижнем углу:
         *   название плавно выезжает, отображается 4 секунды и затем мягко исчезает.
         */
        class NeighborhoodDistrictManager {
            constructor() {
                this.bannerElement = document.getElementById('district-hud-banner');
                this.nameElement = document.getElementById('district-hud-name');
                this.subElement = document.getElementById('district-hud-sub');

                this.currentDistrictId = null;
                this.hideTimeout = null;

                // База данных районов карты с русскими названиями и триггерными зонами
                this.districts = [
                    { id: 'pillbox', name: 'МЕДИЦИНСКИЙ КВАРТАЛ', sub: 'Центральный Госпиталь & Парк', minX: 30, maxX: 180, minZ: 30, maxZ: 180, priority: 12 },
                    { id: 'mission_row', name: 'ПОЛИЦЕЙСКИЙ ОКРУГ', sub: 'Главное Управление LSPD', minX: -180, maxX: -30, minZ: 30, maxZ: 180, priority: 12 },
                    { id: 'downtown', name: 'ДЕЛОВОЙ СИТИ', sub: 'Финансовый Центр & Башня Мейз-Банк', minX: -100, maxX: 100, minZ: -100, maxZ: 100, priority: 10 },

                    { id: 'richman', name: 'ТИХИЙ ПРИГОРОД', sub: 'Элитный Жилой Массив & Сады', minX: -200, maxX: -60, minZ: -200, maxZ: -60, priority: 8 },
                    { id: 'vinewood', name: 'СЕВЕРНЫЕ ХОЛМЫ', sub: 'Горный Серпантин & Сосновый Бор', minX: -60, maxX: 200, minZ: -200, maxZ: -60, priority: 8 },
                    { id: 'lapuerta', name: 'ЗАПАДНЫЕ ДОКИ', sub: 'Грузовой Порт & Терминалы', minX: -200, maxX: -30, minZ: 90, maxZ: 200, priority: 8 },
                    { id: 'cypress', name: 'ЗАВОДСКАЯ ПРОМЗОНА', sub: 'Фабричный Район & Склады', minX: 30, maxX: 200, minZ: 90, maxZ: 200, priority: 8 },

                    { id: 'open_ocean', name: 'ЛАЗУРНЫЙ ЗАЛИВ', sub: 'Территориальные Воды & Побережье', minX: -3000, maxX: 3000, minZ: -3000, maxZ: 3000, priority: 1 }
                ];
            }

            getDistrictAt(posX, posZ) {
                let bestMatch = null;
                for (let i = 0; i < this.districts.length; i++) {
                    const d = this.districts[i];
                    if (posX >= d.minX && posX <= d.maxX && posZ >= d.minZ && posZ <= d.maxZ) {
                        if (!bestMatch || d.priority > bestMatch.priority) {
                            bestMatch = d;
                        }
                    }
                }
                return bestMatch || this.districts[this.districts.length - 1];
            }

            showDistrictNotification(district) {
                if (!this.bannerElement || !this.nameElement || !this.subElement) return;

                this.nameElement.innerText = district.name;
                this.subElement.innerText = district.sub;

                if (this.hideTimeout) {
                    clearTimeout(this.hideTimeout);
                    this.hideTimeout = null;
                }

                // Включаем баннер
                this.bannerElement.classList.add('visible');

                // Оставляем видимым на 4 секунды, затем плавно скрываем
                this.hideTimeout = setTimeout(() => {
                    this.bannerElement.classList.remove('visible');
                    this.hideTimeout = null;
                }, 4000);
            }

            update(deltaTime, playerPosition) {
                if (!playerPosition) return;

                const currentDistrict = this.getDistrictAt(playerPosition.x, playerPosition.z);
                if (currentDistrict && currentDistrict.id !== this.currentDistrictId) {
                    this.currentDistrictId = currentDistrict.id;
                    this.showDistrictNotification(currentDistrict);
                }
            }
        }

window.NeighborhoodDistrictManager = NeighborhoodDistrictManager;
