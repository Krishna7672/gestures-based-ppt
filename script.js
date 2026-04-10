// --- DOM Elements ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
let slides = document.querySelectorAll('.slide'); 
const slideContainer = document.getElementById('slide-container');
const slideCounter = document.getElementById('slide-counter');

// UI & Modal Elements
const feedbackAlert = document.getElementById('feedback-alert');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackText = document.getElementById('feedback-text');
const startBtn = document.getElementById('start-btn');
const initOverlay = document.getElementById('init-overlay');
const slideUpload = document.getElementById('slide-upload');
const instructionList = document.getElementById('instruction-list');
const cameraSelect = document.getElementById('camera-select');
const voiceIndicator = document.getElementById('voice-indicator');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const settingsCard = document.getElementById('settings-card');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// --- Global State ---
let currentSlide = 0;
let isCooldown = false;
let currentScale = 1; 
const COOLDOWN_TIME = 600; // ⚡ REDUCED: Much faster sequential gestures
const synth = window.speechSynthesis;

// Smoothing Variables
let smoothedPinchRatio = null;
let xHistory = []; 

// --- Configurable Gesture System ---
const availableActions = {
    'nextSlide': { label: 'Next Slide', icon: 'keyboard_double_arrow_right', text: 'Forward' },
    'prevSlide': { label: 'Previous Slide', icon: 'keyboard_double_arrow_left', text: 'Previous' },
    'zoomIn': { label: 'Zoom In', icon: 'zoom_in', text: 'Zoom In' },
    'zoomOut': { label: 'Zoom Out', icon: 'zoom_out', text: 'Zoom Out' },
    'none': { label: 'Do Nothing', icon: 'block', text: 'Ignored' }
};

let userConfig = {
    'swipeRight': 'nextSlide',
    'swipeLeft': 'prevSlide',
    'lShape': 'zoomIn',
    'pinch': 'zoomOut',
    'openPalm': 'none',
    'closedFist': 'none'
};

const dropdowns = {
    'swipeRight': document.getElementById('map-swipe-right'),
    'swipeLeft': document.getElementById('map-swipe-left'),
    'lShape': document.getElementById('map-l-shape'),
    'pinch': document.getElementById('map-pinch'),
    'openPalm': document.getElementById('map-open-palm'),
    'closedFist': document.getElementById('map-closed-fist')
};

function initSettings() {
    for (const [gestureKey, selectEl] of Object.entries(dropdowns)) {
        selectEl.innerHTML = '';
        for (const [actionKey, actionData] of Object.entries(availableActions)) {
            const option = document.createElement('option');
            option.value = actionKey;
            option.innerText = actionData.label;
            if (userConfig[gestureKey] === actionKey) option.selected = true;
            selectEl.appendChild(option);
        }
    }
    updateInstructionsUI();
}

function updateInstructionsUI() {
    instructionList.innerHTML = `
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-swipe">swipe_right</span><span>Swipe R:</span></div> <span class="text-primary">${availableActions[userConfig.swipeRight].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-swipe" style="animation-direction: reverse;">swipe_left</span><span>Swipe L:</span></div> <span class="text-primary">${availableActions[userConfig.swipeLeft].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pulse">pan_zoom</span><span>L-Shape:</span></div> <span class="text-primary">${availableActions[userConfig.lShape].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pinch">pinch</span><span>Pinch:</span></div> <span class="text-primary">${availableActions[userConfig.pinch].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pulse">front_hand</span><span>Palm:</span></div> <span class="text-primary">${availableActions[userConfig.openPalm].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pinch">do_not_touch</span><span>Fist:</span></div> <span class="text-primary">${availableActions[userConfig.closedFist].label}</span></div>
    `;
}

// Settings Bindings
openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    setTimeout(() => {
        settingsModal.classList.remove('opacity-0');
        settingsCard.classList.remove('scale-95');
    }, 10);
});

function closeSettings() {
    settingsModal.classList.add('opacity-0');
    settingsCard.classList.add('scale-95');
    setTimeout(() => settingsModal.classList.add('hidden'), 300);
}

closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', () => {
    userConfig.swipeRight = dropdowns.swipeRight.value;
    userConfig.swipeLeft = dropdowns.swipeLeft.value;
    userConfig.lShape = dropdowns.lShape.value;
    userConfig.pinch = dropdowns.pinch.value;
    userConfig.openPalm = dropdowns.openPalm.value;
    userConfig.closedFist = dropdowns.closedFist.value;
    updateInstructionsUI();
    closeSettings();
    showFeedback("Config Saved", "settings_saved");
});

initSettings();


// --- Action Executions ---
function speak(text) {
    if (synth.speaking) synth.cancel();
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.rate = 1.1; // Slightly faster, robotic speech
    synth.speak(utterThis);
}

const executeAction = {
    'nextSlide': () => {
        if (currentSlide < slides.length - 1) { currentSlide++; currentScale = 1; updateSlideUI(); }
    },
    'prevSlide': () => {
        if (currentSlide > 0) { currentSlide--; currentScale = 1; updateSlideUI(); }
    },
    'zoomIn': () => { if(currentScale === 1) applyZoom(1.5); },
    'zoomOut': () => { if(currentScale > 1) applyZoom(1); },
    'none': () => {}
};

function triggerGesture(physicalGestureName) {
    const actionKey = userConfig[physicalGestureName];
    if (actionKey === 'none') return; 

    executeAction[actionKey]();
    const actionData = availableActions[actionKey];
    showFeedback(actionData.text, actionData.icon);
    speak(actionData.label);

    isCooldown = true; xHistory = []; smoothedPinchRatio = null; 
    setTimeout(() => { isCooldown = false; }, COOLDOWN_TIME);
}

function triggerVoice(actionKey) {
    if (actionKey === 'none') return;
    executeAction[actionKey]();
    const actionData = availableActions[actionKey];
    showFeedback("Voice: " + actionData.text, "mic");
    speak(actionData.label);
    
    isCooldown = true;
    setTimeout(() => { isCooldown = false; }, COOLDOWN_TIME);
}


// --- Voice Recognition Setup ---
function initVoiceCommands() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn("Web Speech API not supported in this browser. Please use Chrome.");
        return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
        if(voiceIndicator) voiceIndicator.classList.remove('hidden');
    };

    recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("🗣️ Voice Heard:", command);
        if ((command.includes('next') || command.includes('forward')) && !isCooldown) triggerVoice('nextSlide');
        else if ((command.includes('previous') || command.includes('back')) && !isCooldown) triggerVoice('prevSlide');
    };

    recognition.onerror = (event) => {
        console.error("🎤 Microphone Error:", event.error);
        if (event.error === 'not-allowed') {
            showFeedback("Mic Access Denied", "mic_off");
            if(voiceIndicator) voiceIndicator.classList.add('hidden');
        }
    };
    
    // Auto-restart if it drops out
    recognition.onend = () => { 
        try { recognition.start(); } catch(e){} 
    }; 
    
    try { recognition.start(); } catch(e) {}
}


// --- Dynamic PPT Upload Logic ---
slideUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if(files.length === 0) return;
    
    document.querySelectorAll('.slide').forEach(s => s.remove());
    
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const slideDiv = document.createElement('div');
            slideDiv.className = `slide absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-transparent ${index === 0 ? 'active-slide' : ''}`;
            slideDiv.innerHTML = `<img src="${event.target.result}" />`;
            slideContainer.appendChild(slideDiv); 
            
            if (index === files.length - 1) {
                slides = document.querySelectorAll('.slide');
                currentSlide = 0; currentScale = 1; updateSlideUI();
                showFeedback("Slides Loaded", "task_alt");
                speak("Ready.");
            }
        };
        reader.readAsDataURL(file);
    });
});

// ⚡ FASTER UI TRANSITIONS (Reduced duration from 0.6 to 0.4s)
function updateSlideUI() {
    slides.forEach((slide, index) => {
        if (index === currentSlide) {
            slide.classList.add('active-slide'); slide.style.zIndex = '10';
            gsap.to(slide, { opacity: 1, scale: currentScale, duration: 0.4, ease: "power3.out" });
        } else {
            slide.classList.remove('active-slide'); slide.style.zIndex = '0';
            gsap.to(slide, { opacity: 0, scale: 0.95, duration: 0.4, ease: "power3.out" });
        }
    });
    if(slideCounter) slideCounter.innerText = `Slide ${currentSlide + 1} of ${slides.length}`;
}

function showFeedback(text, iconName) {
    if(!feedbackText || !feedbackIcon || !feedbackAlert) return;
    feedbackText.innerText = text; feedbackIcon.innerText = iconName;
    feedbackAlert.classList.remove('opacity-0', 'translate-y-4');
    feedbackAlert.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        feedbackAlert.classList.add('opacity-0', 'translate-y-4');
        feedbackAlert.classList.remove('opacity-100', 'translate-y-0');
    }, 1500); // Dissolves faster
}

function applyZoom(scaleFactor) {
    currentScale = scaleFactor;
    if (slides[currentSlide]) {
        gsap.to(slides[currentSlide], { scale: currentScale, duration: 0.4, ease: "power3.out" });
    }
}

// --- True Fullscreen Logic ---
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) document.body.classList.add('is-fullscreen');
    else document.body.classList.remove('is-fullscreen');
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen(); 
    else if (document.exitFullscreen) document.exitFullscreen(); 
});


// --- Custom Native Camera Router ---
let activeStream = null;
let animationFrameId = null;
let isProcessingFrame = false; // ⚡ CPU lock to prevent bottlenecking

async function populateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if(!cameraSelect) return;
        cameraSelect.innerHTML = '';
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        cameraSelect.addEventListener('change', (e) => startCustomCamera(e.target.value));
    } catch(err) { console.warn("Camera enumeration failed", err); }
}

async function startCustomCamera(deviceId = null) {
    if (activeStream) activeStream.getTracks().forEach(track => track.stop());
    
    const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false
    };

    try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = activeStream;
        await videoElement.play();
        
        videoElement.addEventListener('loadedmetadata', () => {
            canvasElement.width = videoElement.videoWidth; 
            canvasElement.height = videoElement.videoHeight;
        });

        if (!animationFrameId) processVideoFrame();
    } catch (err) { console.error("Camera access error:", err); }
}

async function processVideoFrame() {
    if (videoElement.readyState >= 2 && !isProcessingFrame) {
        isProcessingFrame = true;
        await hands.send({ image: videoElement });
        isProcessingFrame = false;
    }
    animationFrameId = requestAnimationFrame(processVideoFrame);
}


// --- ⚡ LIGHTNING FAST PROPORTIONAL GESTURE ENGINE ---
function getPalmSize(landmarks) {
    return Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
}

function detectHandState(landmarks) {
    const wrist = landmarks[0];
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const mcps = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    let curledCount = 0; let openCount = 0;
    
    for (let i = 0; i < 4; i++) {
        const tipDist = Math.hypot(tips[i].x - wrist.x, tips[i].y - wrist.y);
        const mcpDist = Math.hypot(mcps[i].x - wrist.x, mcps[i].y - wrist.y);
        if (tipDist < mcpDist * 1.2) curledCount++; 
        if (tipDist > mcpDist * 1.5) openCount++; 
    }
    
    if (curledCount >= 3) return 'closedFist';
    if (openCount >= 4) return 'openPalm';
    return 'none';
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
// Lowered complexity and tracking for sheer speed and distance capability
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.4 });

hands.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00eefc', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        const palmSize = getPalmSize(landmarks);
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Pinch Logic (⚡ Speed Tuned EMA: 60% new data, 40% history - highly reactive)
        const rawPinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const pinchRatio = rawPinchDist / palmSize; 
        smoothedPinchRatio = smoothedPinchRatio === null ? pinchRatio : (smoothedPinchRatio * 0.4 + pinchRatio * 0.6);

        if (!isCooldown) {
            if (smoothedPinchRatio > 2.2 && currentScale === 1) triggerGesture('lShape');
            else if (smoothedPinchRatio < 0.6 && currentScale > 1) triggerGesture('pinch');
            else {
                const handState = detectHandState(landmarks);
                if (handState === 'closedFist') triggerGesture('closedFist');
                else if (handState === 'openPalm') triggerGesture('openPalm');
            }
        }

        // Swipe Logic (⚡ Snappier memory window - 250ms instead of 350ms)
        if (!isCooldown && currentScale === 1) {
            const now = performance.now();
            xHistory.push({ x: indexTip.x, y: indexTip.y, t: now });
            xHistory = xHistory.filter(h => now - h.t < 250); // Reacts to shorter "flicks"
            
            if (xHistory.length > 3) {
                const oldest = xHistory[0]; const newest = xHistory[xHistory.length - 1];
                const dx = newest.x - oldest.x; const dt = newest.t - oldest.t; 
                
                if (dt > 50) { // Require a tiny gap to calculate valid velocity
                    const velocity = dx / dt;
                    // Lowered velocity threshold slightly to make swiping easier
                    if (velocity < -0.00030) triggerGesture('swipeRight');
                    else if (velocity > 0.00030) triggerGesture('swipeLeft');
                }
            }
        }
    } else {
        xHistory = []; smoothedPinchRatio = null;
    }
    canvasCtx.restore();
});

// --- Initialization ---
startBtn.addEventListener('click', async () => {
    gsap.to(initOverlay, { opacity: 0, duration: 0.7, onComplete: () => initOverlay.style.display = 'none' });
    
    gsap.from("header", { y: -50, opacity: 0, duration: 1, delay: 0.2, ease: "power3.out" });
    gsap.from("nav", { x: -50, opacity: 0, duration: 1, delay: 0.3, ease: "power3.out" });
    gsap.from("#slide-container", { scale: 0.9, opacity: 0, duration: 1, delay: 0.4, ease: "back.out(1.2)" });

    await startCustomCamera();
    await populateCameras(); 
    initVoiceCommands(); 
    
    speak("System Online.");
});