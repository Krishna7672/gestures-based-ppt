// =======================================================================
// ASTRAL PRESENT - Core Logic Engine
// =======================================================================

// --- DOM Elements ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
let slides = document.querySelectorAll('.slide'); 
const slideContainer = document.getElementById('slide-container');
const slideCounter = document.getElementById('slide-counter');

// UI Elements
const feedbackAlert = document.getElementById('feedback-alert');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackText = document.getElementById('feedback-text');
const startBtn = document.getElementById('start-btn');
const initOverlay = document.getElementById('init-overlay');
const slideUpload = document.getElementById('slide-upload');
const instructionList = document.getElementById('instruction-list');
const cameraSelect = document.getElementById('camera-select');
const voiceIndicator = document.getElementById('voice-indicator');
const pauseOverlay = document.getElementById('pause-overlay');

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
let isSystemPaused = false; 

// ⏳ DEBOUNCE DELAY: Prevents double-triggers (800ms lock)
const COOLDOWN_TIME = 800; 
const synth = window.speechSynthesis;
let xHistory = []; 

// --- Configurable Gesture System ---
const availableActions = {
    'nextSlide': { label: 'Next Slide', icon: 'keyboard_double_arrow_right', text: 'Forward' },
    'prevSlide': { label: 'Previous Slide', icon: 'keyboard_double_arrow_left', text: 'Previous' },
    'togglePause': { label: 'Pause/Play', icon: 'pause_circle', text: 'Paused' },
    'none': { label: 'Do Nothing', icon: 'block', text: 'Ignored' }
};

// 👉 SIMPLE, FAST, & RELIABLE GESTURE DEFAULTS
let userConfig = {
    'thumbUp': 'nextSlide',      // 👍 Thumb up → Next slide
    'closedFist': 'prevSlide',   // 👊 Fist → Previous slide
    'openPalm': 'togglePause',   // ✋ Open palm → Pause
    'swipeRight': 'none',        // Disabled by default
    'swipeLeft': 'none'          // Disabled by default
};

const dropdowns = {
    'thumbUp': document.getElementById('map-thumb-up'),
    'closedFist': document.getElementById('map-closed-fist'),
    'openPalm': document.getElementById('map-open-palm'),
    'swipeRight': document.getElementById('map-swipe-right'),
    'swipeLeft': document.getElementById('map-swipe-left')
};

function initSettings() {
    for (const [gestureKey, selectEl] of Object.entries(dropdowns)) {
        if(!selectEl) continue;
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
    if(!instructionList) return;
    instructionList.innerHTML = `
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pulse">thumb_up</span><span>Thumb Up:</span></div> <span class="text-primary">${availableActions[userConfig.thumbUp].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pinch">do_not_touch</span><span>Fist:</span></div> <span class="text-primary">${availableActions[userConfig.closedFist].label}</span></div>
        <div class="flex justify-between items-center group"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[10px] anim-pulse">front_hand</span><span>Palm:</span></div> <span class="text-primary">${availableActions[userConfig.openPalm].label}</span></div>
    `;
}

// Settings Modal Triggers
if(openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        setTimeout(() => { settingsModal.classList.remove('opacity-0'); settingsCard.classList.remove('scale-95'); }, 10);
    });
}

if(closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('opacity-0'); settingsCard.classList.add('scale-95');
        setTimeout(() => settingsModal.classList.add('hidden'), 300);
    });
}

if(saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        userConfig.thumbUp = dropdowns.thumbUp.value;
        userConfig.closedFist = dropdowns.closedFist.value;
        userConfig.openPalm = dropdowns.openPalm.value;
        userConfig.swipeRight = dropdowns.swipeRight.value;
        userConfig.swipeLeft = dropdowns.swipeLeft.value;
        updateInstructionsUI();
        closeSettingsBtn.click();
        showFeedback("Config Saved", "settings_saved");
    });
}

initSettings();


// --- Action Executions ---
function speak(text) {
    if (synth.speaking) synth.cancel();
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.rate = 1.1;
    synth.speak(utterThis);
}

const executeAction = {
    'nextSlide': () => {
        if (currentSlide < slides.length - 1) { currentSlide++; updateSlideUI(); }
    },
    'prevSlide': () => {
        if (currentSlide > 0) { currentSlide--; updateSlideUI(); }
    },
    'togglePause': () => {
        isSystemPaused = !isSystemPaused;
        if(isSystemPaused) {
            if(pauseOverlay) pauseOverlay.classList.remove('opacity-0', 'pointer-events-none');
            speak("System Paused");
        } else {
            if(pauseOverlay) pauseOverlay.classList.add('opacity-0', 'pointer-events-none');
            speak("System Resumed");
        }
    },
    'none': () => {}
};

function triggerGesture(physicalGestureName) {
    const actionKey = userConfig[physicalGestureName];
    if (actionKey === 'none') return; 

    // STRICT CHECK: If paused, the ONLY action allowed is unpausing.
    if (isSystemPaused && actionKey !== 'togglePause') {
        return; // Block all other gestures while paused
    }

    // 1. ENGAGE DEBOUNCE DELAY
    isCooldown = true; 
    
    // 2. TRIGGER ACTION
    executeAction[actionKey]();
    
    // 3. UI FEEDBACK
    const actionData = availableActions[actionKey];
    showFeedback(actionData.text, actionData.icon);
    if(actionKey !== 'togglePause') speak(actionData.label);

    // 4. RESET COOLDOWN
    xHistory = []; 
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
    
    recognition.onstart = () => { if(voiceIndicator) voiceIndicator.classList.remove('hidden'); };

    recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if ((command.includes('next') || command.includes('forward')) && !isCooldown && !isSystemPaused) triggerGesture('thumbUp'); 
        else if ((command.includes('previous') || command.includes('back')) && !isCooldown && !isSystemPaused) triggerGesture('closedFist');
        else if ((command.includes('pause') || command.includes('resume')) && !isCooldown) triggerGesture('openPalm');
    };

    recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
            showFeedback("Mic Access Denied", "mic_off");
            if(voiceIndicator) voiceIndicator.classList.add('hidden');
        }
    };
    
    recognition.onend = () => { try { recognition.start(); } catch(e){} }; 
    try { recognition.start(); } catch(e) {}
}


// --- Dynamic PPT Upload Logic ---
if(slideUpload) {
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
                    currentSlide = 0; updateSlideUI();
                    showFeedback("Slides Loaded", "task_alt");
                    speak("Ready.");
                }
            };
            reader.readAsDataURL(file);
        });
    });
}

function updateSlideUI() {
    slides.forEach((slide, index) => {
        if (index === currentSlide) {
            slide.classList.add('active-slide'); slide.style.zIndex = '10';
            if (typeof gsap !== 'undefined') gsap.to(slide, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" });
            else { slide.style.opacity = 1; slide.style.transform = 'scale(1)'; }
        } else {
            slide.classList.remove('active-slide'); slide.style.zIndex = '0';
            if (typeof gsap !== 'undefined') gsap.to(slide, { opacity: 0, scale: 0.95, duration: 0.4, ease: "power3.out" });
            else { slide.style.opacity = 0; slide.style.transform = 'scale(0.95)'; }
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
    }, 1500); 
}


// Fullscreen Event Listeners
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) document.body.classList.add('is-fullscreen');
    else document.body.classList.remove('is-fullscreen');
});

if(document.getElementById('fullscreen-btn')) {
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen(); 
        else if (document.exitFullscreen) document.exitFullscreen(); 
    });
}


// --- Custom Native Camera Router (Phone / Webcam Support) ---
let activeStream = null;
let animationFrameId = null;
let isProcessingFrame = false; 

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


// --- 🧠 STATIC GESTURE RECOGNITION ENGINE ---
function getPalmSize(landmarks) {
    return Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
}

function detectStaticHandPosture(landmarks, palmSize) {
    const wrist = landmarks[0];
    
    // Arrays representing the tips and base joints of the Index, Middle, Ring, and Pinky fingers
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const mcps = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    let curledCount = 0; 
    let openCount = 0;
    
    // Check state of the 4 main fingers
    for (let i = 0; i < 4; i++) {
        const tipDist = Math.hypot(tips[i].x - wrist.x, tips[i].y - wrist.y);
        const mcpDist = Math.hypot(mcps[i].x - wrist.x, mcps[i].y - wrist.y);
        if (tipDist < mcpDist * 1.3) curledCount++; 
        if (tipDist > mcpDist * 1.5) openCount++; 
    }
    
    // Thumb specifics
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const indexMcp = landmarks[5];
    
    // Is thumb extended far from wrist?
    const isThumbExtended = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > (palmSize * 1.2);
    
    // Is thumb pointing UP? (In camera coordinates, lower Y value means higher on screen)
    const isThumbPointingUp = thumbTip.y < thumbMcp.y && thumbTip.y < indexMcp.y;

    // --- GESTURE LOGIC ---
    // 1. THUMB UP 👍: 3 or 4 fingers curled + Thumb extended and pointing up
    if (curledCount >= 3 && isThumbExtended && isThumbPointingUp) {
        return 'thumbUp';
    }
    
    // 2. FIST 👊: 4 fingers curled, thumb not significantly pointing up
    if (curledCount >= 4) {
        return 'closedFist';
    }
    
    // 3. OPEN PALM ✋: All fingers extended
    if (openCount >= 4 && isThumbExtended) {
        return 'openPalm';
    }
    
    return 'none';
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });

hands.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        
        // --- ✅ CONFIDENCE THRESHOLD CHECK ---
        // Only accept if AI is >= 80% confident it's seeing a hand. Prevents ghosts.
        if (results.multiHandedness && results.multiHandedness[0].score < 0.8) {
            canvasCtx.restore();
            return; 
        }

        const landmarks = results.multiHandLandmarks[0];
        
        // Draw Skeleton Tracking
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00eefc', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        const palmSize = getPalmSize(landmarks);

        // Process Gestures if not in Cooldown
        if (!isCooldown) {
            const staticPosture = detectStaticHandPosture(landmarks, palmSize);
            
            if (staticPosture !== 'none') {
                triggerGesture(staticPosture);
            } 
        }
    }
    canvasCtx.restore();
});

// --- Initialization & Setup ---
if(startBtn) {
    startBtn.addEventListener('click', async () => {
        if(initOverlay && typeof gsap !== 'undefined') {
            gsap.to(initOverlay, { opacity: 0, duration: 0.7, onComplete: () => initOverlay.style.display = 'none' });
            gsap.from("header", { y: -50, opacity: 0, duration: 1, delay: 0.2, ease: "power3.out" });
            gsap.from("nav", { x: -50, opacity: 0, duration: 1, delay: 0.3, ease: "power3.out" });
            gsap.from("#slide-container", { scale: 0.9, opacity: 0, duration: 1, delay: 0.4, ease: "back.out(1.2)" });
        } else if (initOverlay) {
            initOverlay.style.display = 'none';
        }
    
        await startCustomCamera();
        await populateCameras(); 
        initVoiceCommands(); 
        
        speak("System Online.");
    });
}
