/**
         * Океанский менеджер (отключен внутри игрового города во избежание затопления камеры)
         */
        class InfiniteOceanManager {
            constructor(scene) {
                this.scene = scene;
                this.oceanMesh = null;
            }

            update(deltaTime, sunPosition, sunColor, fogColor, nightFactor) {}
        }

window.InfiniteOceanManager = InfiniteOceanManager;
