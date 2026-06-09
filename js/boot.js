const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    document.body.classList.add('is-mobile');
}

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
    
    const startTime = Date.now();
    const duration = 15000; // 15 seconds
    
    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
            clearInterval(interval);
            splash.style.transition = 'opacity 0.5s ease';
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
            return;
        }
        
        // Progress: from 10% to 100% over 12 seconds, then hold at 100%
        let progress = 10;
        if (elapsed < 12000) {
            progress = 10 + (90 * (elapsed / 12000));
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
