// =======================================================================
// ASTRAL PRESENT - Core Logic Engine (Dashboard + PDF Edition)
// =======================================================================

// --- DOM Elements ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
let slides = document.querySelectorAll('.slide'); 
const slideContainer = document.getElementById('slide-container');
const slideCounter = document.getElementById('slide-counter');

// UI & Telemetry Elements
const activeGestureText = document.getElementById('active-gesture-text');
const activeGestureIcon = document.getElementById('active-gesture-icon');
const feedbackWidget = document.getElementById('feedback-widget');
const confidenceText = document.getElementById('confidence-text');
const confidenceBar = document.getElementById('confidence-bar');
const fpsText = document.getElementById('fps-text');

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
let isSystemPaused = false; 
const COOLDOWN_TIME = 800; // ⏳ DEBOUNCE DELAY
const synth = window.speechSynthesis;

// --- Configurable Gesture System ---
const availableActions = {
    'nextSlide': { label: 'Next Slide', icon: 'navigate_next', text: 'Forward' },
    'prevSlide': { label: 'Previous Slide', icon: 'navigate_before', text: 'Previous' },
    'togglePause': { label: 'Pause/Play', icon: 'pause_circle', text: 'Paused' },
    'none': { label: 'Do Nothing', icon: 'block', text: 'Ignored' }
};

let userConfig = {
    'thumbUp': 'nextSlide',      
    'closedFist': 'prevSlide',   
    'openPalm': 'togglePause',   
};

const dropdowns = {
    'thumbUp': document.getElementById('map-thumb-up'),
    'closedFist': document.getElementById('map-closed-fist'),
    'openPalm': document.getElementById('map-open-palm')
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
        <div class="flex flex-col items-center gap-4 p-6 bg-surface-container-high/40 rounded-xl hover:bg-surface-container-high transition-colors">
            <span class="material-symbols-outlined text-primary-container text-4xl">thumb_up</span>
            <div class="text-center">
                <p class="font-headline font-bold text-sm">${availableActions[userConfig.thumbUp].label}</p>
                <p class="font-body text-[10px] text-on-surface-variant">Thumb Up</p>
            </div>
        </div>
        <div class="flex flex-col items-center gap-4 p-6 bg-surface-container-high/40 rounded-xl hover:bg-surface-container-high transition-colors">
            <span class="material-symbols-outlined text-primary-container text-4xl">do_not_touch</span>
            <div class="text-center">
                <p class="font-headline font-bold text-sm">${availableActions[userConfig.closedFist].label}</p>
                <p class="font-body text-[10px] text-on-surface-variant">Closed Fist</p>
            </div>
        </div>
        <div class="flex flex-col items-center gap-4 p-6 bg-surface-container-high/40 rounded-xl hover:bg-surface-container-high transition-colors">
            <span class="material-symbols-outlined text-secondary-container text-4xl">front_hand</span>
            <div class="text-center">
                <p class="font-headline font-bold text-sm">${availableActions[userConfig.openPalm].label}</p>
                <p class="font-body text-[10px] text-on-surface-variant">Open Palm</p>
            </div>
        </div>
    `;
}

// Settings Bindings
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
        updateInstructionsUI();
        closeSettingsBtn.click();
        showFeedback("Settings Updated", "settings");
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

function showFeedback(text, iconName) {
    if(activeGestureText) activeGestureText.innerText = text;
    if(activeGestureIcon) activeGestureIcon.innerText = iconName;
    
    if(feedbackWidget && typeof gsap !== 'undefined') {
        gsap.fromTo(feedbackWidget, 
            { scale: 1.05, borderColor: "rgba(0,240,255,0.8)" }, 
            { scale: 1, borderColor: "rgba(0,240,255,0.2)", duration: 0.5 }
        );
    }
}

// Function for on-screen physical buttons
window.triggerManualAction = function(actionKey) {
    if (actionKey === 'none') return;
    if (isSystemPaused && actionKey !== 'togglePause') return; 

    executeAction[actionKey]();
    const actionData = availableActions[actionKey];
    if(actionData) {
        showFeedback("Manual Override", "touch_app");
        if(actionKey !== 'togglePause') speak(actionData.text);
    }
    
    setTimeout(() => { showFeedback("Standby", "waving_hand"); }, 1000);
};

// AI Gesture Trigger
function triggerGesture(physicalGestureName) {
    const actionKey = userConfig[physicalGestureName];
    if (actionKey === 'none') return; 
    if (isSystemPaused && actionKey !== 'togglePause') return; 

    isCooldown = true; 
    executeAction[actionKey]();
    
    const actionData = availableActions[actionKey];
    if(actionData) {
        showFeedback(actionData.label, actionData.icon);
        if(actionKey !== 'togglePause') speak(actionData.text);
    }
    
    setTimeout(() => { isCooldown = false; showFeedback("Standby", "waving_hand"); }, COOLDOWN_TIME);
}

function triggerVoice(actionKey) {
    if (actionKey === 'none') return;
    executeAction[actionKey]();
    const actionData = availableActions[actionKey];
    showFeedback("Voice: " + actionData.text, "mic");
    speak(actionData.label);
    
    isCooldown = true;
    setTimeout(() => { isCooldown = false; showFeedback("Standby", "waving_hand"); }, COOLDOWN_TIME);
}

// --- Voice Recognition ---
function initVoiceCommands() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Web Speech API not supported. Use Chrome.");
        return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    recognition.onstart = () => { if(voiceIndicator) voiceIndicator.classList.remove('hidden'); };

    recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if ((command.includes('next') || command.includes('forward')) && !isCooldown && !isSystemPaused) triggerVoice('nextSlide'); 
        else if ((command.includes('previous') || command.includes('back')) && !isCooldown && !isSystemPaused) triggerVoice('prevSlide');
        else if ((command.includes('pause') || command.includes('resume')) && !isCooldown) triggerVoice('togglePause');
    };

    recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
            showFeedback("Mic Denied", "mic_off");
            if(voiceIndicator) voiceIndicator.classList.add('hidden');
        }
    };
    
    recognition.onend = () => { try { recognition.start(); } catch(e){} }; 
    try { recognition.start(); } catch(e) {}
}


// --- 📄 DYNAMIC PDF & IMAGE UPLOAD LOGIC ---
if(slideUpload) {
    slideUpload.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if(files.length === 0) return;
        
        document.querySelectorAll('.slide').forEach(s => s.remove());
        showFeedback("Processing...", "sync");
        speak("Processing file.");

        // Handing PDF Files
        if (files[0].type === 'application/pdf') {
            const fileReader = new FileReader();
            fileReader.onload = async function(event) {
                const typedarray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 }); // High res scaling
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    
                    const slideDiv = document.createElement('div');
                    slideDiv.className = `slide absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-transparent ${i === 1 ? 'active-slide' : ''}`;
                    slideDiv.innerHTML = `<img src="${canvas.toDataURL('image/jpeg', 0.8)}" />`;
                    slideContainer.appendChild(slideDiv);
                }
                finishLoading();
            };
            fileReader.readAsArrayBuffer(files[0]);
        } 
        // Handling Image Files
        else {
            let loadedCount = 0;
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const slideDiv = document.createElement('div');
                    slideDiv.className = `slide absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-transparent ${index === 0 ? 'active-slide' : ''}`;
                    slideDiv.innerHTML = `<img src="${event.target.result}" />`;
                    slideContainer.appendChild(slideDiv); 
                    
                    loadedCount++;
                    if (loadedCount === files.length) finishLoading();
                };
                reader.readAsDataURL(file);
            });
        }
    });
}

function finishLoading() {
    slides = document.querySelectorAll('.slide');
    currentSlide = 0; 
    updateSlideUI();
    showFeedback("Slides Ready", "check_circle");
    speak("Presentation Ready.");
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

// Fullscreen
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

// --- Custom Camera Router & FPS Counter ---
let activeStream = null;
let isProcessingFrame = false; 

let lastFrameTime = performance.now();
let frameCount = 0;

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
    } catch(err) { console.warn("Camera enumeration failed"); }
}

async function startCustomCamera(deviceId = null) {
    if (activeStream) activeStream.getTracks().forEach(track => track.stop());
    const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } }, audio: false };

    try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = activeStream;
        await videoElement.play();
        
        videoElement.addEventListener('loadedmetadata', () => {
            canvasElement.width = videoElement.videoWidth; 
            canvasElement.height = videoElement.videoHeight;
        });

        processVideoFrame();
    } catch (err) { console.error("Camera access error:", err); }
}

async function processVideoFrame() {
    if (videoElement.readyState >= 2 && !isProcessingFrame) {
        
        const now = performance.now();
        frameCount++;
        if (now - lastFrameTime >= 1000) {
            if(fpsText) fpsText.innerText = `FPS: ${frameCount} | Engine V2`;
            frameCount = 0;
            lastFrameTime = now;
        }

        isProcessingFrame = true;
        await hands.send({ image: videoElement });
        isProcessingFrame = false;
    }
    requestAnimationFrame(processVideoFrame);
}

// --- 🧠 STATIC GESTURE RECOGNITION ENGINE ---
function getPalmSize(landmarks) {
    return Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
}

function detectStaticHandPosture(landmarks, palmSize) {
    const wrist = landmarks[0];
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const mcps = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    let curledCount = 0; 
    let openCount = 0;
    
    for (let i = 0; i < 4; i++) {
        const tipDist = Math.hypot(tips[i].x - wrist.x, tips[i].y - wrist.y);
        const mcpDist = Math.hypot(mcps[i].x - wrist.x, mcps[i].y - wrist.y);
        if (tipDist < mcpDist * 1.3) curledCount++; 
        if (tipDist > mcpDist * 1.5) openCount++; 
    }
    
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const indexMcp = landmarks[5];
    
    const isThumbExtended = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > (palmSize * 1.2);
    const isThumbPointingUp = thumbTip.y < thumbMcp.y && thumbTip.y < indexMcp.y;

    if (curledCount >= 3 && isThumbExtended && isThumbPointingUp) return 'thumbUp';
    if (curledCount >= 4) return 'closedFist';
    if (openCount >= 4 && isThumbExtended) return 'openPalm';
    return 'none';
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });

hands.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        
        // --- ✅ UPDATE LIVE TELEMETRY CONFIDENCE ---
        const confidenceScore = results.multiHandedness[0].score;
        const confidencePercent = Math.round(confidenceScore * 100);
        if(confidenceText) confidenceText.innerText = `> ${confidencePercent}%`;
        if(confidenceBar) confidenceBar.style.width = `${confidencePercent}%`;

        // ✅ 0.8 CONFIDENCE THRESHOLD CHECK
        if (confidenceScore < 0.8) {
            canvasCtx.restore();
            return; 
        }

        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00eefc', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        if (!isCooldown) {
            const palmSize = getPalmSize(landmarks);
            const staticPosture = detectStaticHandPosture(landmarks, palmSize);
            
            if (staticPosture !== 'none') {
                triggerGesture(staticPosture);
            } 
        }
    } else {
        if(confidenceText) confidenceText.innerText = `0%`;
        if(confidenceBar) confidenceBar.style.width = `0%`;
    }
    canvasCtx.restore();
});

// --- Initialization & Setup ---
if(startBtn) {
    startBtn.addEventListener('click', async () => {
        if(initOverlay && typeof gsap !== 'undefined') {
            gsap.to(initOverlay, { opacity: 0, duration: 0.7, onComplete: () => initOverlay.style.display = 'none' });
            gsap.from("header", { y: -50, opacity: 0, duration: 1, delay: 0.2, ease: "power3.out" });
            gsap.from("aside", { x: -50, opacity: 0, duration: 1, delay: 0.3, ease: "power3.out" });
            gsap.from("#presentation-frame", { scale: 0.95, opacity: 0, duration: 1, delay: 0.4, ease: "power3.out" });
        } else if (initOverlay) initOverlay.style.display = 'none';
    
        await startCustomCamera();
        await populateCameras(); 
        initVoiceCommands(); 
        
        speak("System Online.");
    });
}
