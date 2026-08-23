/**
         * Календарная система
         */
        class CalendarAndSeasonSystem {
            constructor() {
                this.latitudeRad = 34.05 * (Math.PI / 180.0);
                this.dayOfYear = 172;
                this.year = 2026;
            }

            advanceDay() { this.dayOfYear = (this.dayOfYear % 365) + 1; }
            nextSeason() { this.dayOfYear = (this.dayOfYear + 90) % 365; }

            calculateSolarVector(timeHours) {
                const decl = 23.44 * Math.sin((2 * Math.PI / 365) * (this.dayOfYear - 81)) * (Math.PI / 180.0);
                const H = (timeHours - 12.0) * 15.0 * (Math.PI / 180.0);
                const y = Math.sin(this.latitudeRad) * Math.sin(decl) + Math.cos(this.latitudeRad) * Math.cos(decl) * Math.cos(H);
                const x = -Math.cos(decl) * Math.sin(H);
                const z = (y * Math.sin(this.latitudeRad) - Math.sin(decl)) / Math.cos(this.latitudeRad);
                return new THREE.Vector3(x, y, z).normalize();
            }
        }
