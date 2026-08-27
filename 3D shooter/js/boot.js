const urlParams = new URLSearchParams(window.location.search);
const modeParam = urlParams.get('mode');
const storedMode = localStorage.getItem('gamehub_device_mode');
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (modeParam === 'mobile' || storedMode === 'mobile') isMobile = true;
if (modeParam === 'pc' || storedMode === 'pc') {
    if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        isMobile = false;
    }
}
if (isMobile) {
    document.body.classList.add('is-mobile');
}

let splashHidden = false;

function hideSplashScreen() {
    if (splashHidden) return;
    splashHidden = true;
    const splash = document.getElementById('br-splash-screen');
    if (splash) {
        splash.style.transition = 'opacity 0.25s ease';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 250);
    }
}
window.hideSplashScreen = hideSplashScreen;

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

    if (statusText) statusText.innerText = 'Загрузка...';
    if (percentText) percentText.innerText = '100%';
    if (progressBar) progressBar.style.width = '100%';

    // Start initializing immediately
    renderAppVersionInfo();
    initApp();

    // Fallback: hide splash screen after max 3 seconds if not already hidden
    setTimeout(() => {
        hideSplashScreen();
    }, 3000);
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

if (!window.mainMenuManager && typeof MainMenuManager === 'function') {
    window.mainMenuManager = new MainMenuManager();
}

