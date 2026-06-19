const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    document.body.classList.add('is-mobile');
}

let splashInterval = null;

function runSplashScreen() {
    const splash = document.getElementById('br-splash-screen');
    const statusText = document.getElementById('splash-status-text');
    const percentText = document.getElementById('splash-percentage-text');
    const progressBar = document.getElementById('splash-progress-bar');
    
    if (!splash) {
        renderAppVersionInfo();
        initApp();
        return;
    }

    // Task 1.2: Dev mode Easter Egg setup
    function setupDevEasterEgg() {
        const logo = splash.querySelector('.splash-logo');
        const title = splash.querySelector('.splash-title');
        if (!logo || !title) return;

        let lastTap = 0;
        let targetDoubleTapped = false;
        let resetTimeout = null;

        function handleDoubleTap(e) {
            e.preventDefault();
            const now = Date.now();
            if (now - lastTap < 300) {
                targetDoubleTapped = true;
                if (resetTimeout) clearTimeout(resetTimeout);
                resetTimeout = setTimeout(() => {
                    targetDoubleTapped = false;
                }, 5000); // Reset status after 5s
            }
            lastTap = now;
        }

        logo.addEventListener('click', handleDoubleTap);
        logo.addEventListener('touchstart', handleDoubleTap, { passive: false });

        let startX = 0;
        let isSwiping = false;

        function startSwipe(e) {
            if (!targetDoubleTapped) return;
            isSwiping = true;
            startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        }

        function moveSwipe(e) {
            if (!isSwiping || !targetDoubleTapped) return;
            const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const diffX = currentX - startX;
            if (diffX > 85) { // Left-to-right swipe of 85px or more
                triggerFastStart();
            }
        }

        function endSwipe() {
            isSwiping = false;
        }

        function triggerFastStart() {
            if (splashInterval) {
                clearInterval(splashInterval);
                splashInterval = null;
            }
            splash.style.transition = 'none';
            splash.style.opacity = '0';
            splash.style.display = 'none';
            targetDoubleTapped = false;
            isSwiping = false;
        }

        title.addEventListener('mousedown', startSwipe);
        title.addEventListener('touchstart', startSwipe, { passive: true });

        title.addEventListener('mousemove', moveSwipe);
        title.addEventListener('touchmove', moveSwipe, { passive: true });

        title.addEventListener('mouseup', endSwipe);
        title.addEventListener('touchend', endSwipe);
        title.addEventListener('mouseleave', endSwipe);
        title.addEventListener('touchcancel', endSwipe);
    }

    setupDevEasterEgg();
    
    const startTime = Date.now();
    const duration = 15000; // 15 seconds
    
    splashInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
            clearInterval(splashInterval);
            splashInterval = null;
            splash.style.transition = 'opacity 0.5s ease';
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
            return;
        }
        
        // Task 1.1: Progress holds 0% for first 2 seconds, then smoothly scales to 100% over the next 10 seconds
        let progress = 0;
        if (elapsed < 2000) {
            progress = 0;
        } else if (elapsed < 12000) {
            progress = 100 * ((elapsed - 2000) / 10000);
        } else {
            progress = 100;
        }
        
        if (percentText) percentText.innerText = progress.toFixed(1) + '%';
        if (progressBar) progressBar.style.width = progress + '%';
        
        // Status text logic
        if (statusText) {
            if (elapsed < 2000) {
                statusText.innerText = 'Checking for data update';
            } else if (elapsed < 6000) {
                statusText.innerText = 'Connection';
            } else if (elapsed < 8000) {
                statusText.innerText = 'Checking application integrity';
            } else if (elapsed < 12000) {
                statusText.innerText = 'Loading user data';
            } else {
                statusText.innerText = 'Loading...';
            }
        }
    }, 50);
    
    // Start initializing in background
    renderAppVersionInfo();
    initApp();
}

function checkOrientationAndRun() {
    const splash = document.getElementById('br-splash-screen');
    const needsOrientationAdjustment = isMobile && (window.innerHeight > window.innerWidth);
    
    if (needsOrientationAdjustment) {
        if (splash) splash.style.display = 'none';
        window.addEventListener('resize', onResizeCheck);
        window.addEventListener('orientationchange', onResizeCheck);
    } else {
        if (splash) splash.style.display = 'flex';
        runSplashScreen();
    }
}

let checkCalled = false;
function onResizeCheck() {
    if (checkCalled) return;
    const needsOrientationAdjustment = isMobile && (window.innerHeight > window.innerWidth);
    if (!needsOrientationAdjustment) {
        checkCalled = true;
        window.removeEventListener('resize', onResizeCheck);
        window.removeEventListener('orientationchange', onResizeCheck);
        checkOrientationAndRun();
    }
}

// Start checks
checkOrientationAndRun();

document.getElementById('chat-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
});
