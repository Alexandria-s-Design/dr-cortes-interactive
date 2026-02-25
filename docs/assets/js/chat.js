/**
 * Dr. Cortes Chat Module — Photo + Voice (No Video)
 *
 * Handles:
 * - WebSocket chat with backend
 * - ElevenLabs TTS audio playback (via HTML Audio element)
 * - Prompt chip click handlers
 * - Lazy-init via IntersectionObserver
 * - Language switching (EN/ES/PT) — synced to server via WebSocket
 * - Pauses background narration when chatbot speaks
 */

// Elements
const ttsAudio = document.getElementById('tts-audio');
const statusText = document.getElementById('status-text');
const audioIndicator = document.getElementById('audio-indicator');
const messagesEl = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const connectBtn = document.getElementById('connect-btn');
const promptChips = document.getElementById('prompt-chips');

// Audio amplifier (Web Audio API GainNode for volume boost)
let chatAmplifier = null;
function getChatAmplifier() {
    if (!chatAmplifier && window.AudioAmplifier) {
        chatAmplifier = new window.AudioAmplifier(ttsAudio, 'chatbot-volume', 1.5);
        // Wire up volume slider
        const volSlider = document.getElementById('chatbot-vol-slider');
        if (volSlider) {
            volSlider.value = Math.round(chatAmplifier.getGain() * 100);
            volSlider.addEventListener('input', (e) => {
                chatAmplifier.setGain(parseInt(e.target.value) / 100);
            });
        }
    }
    return chatAmplifier;
}

// State
let ws = null;
let isConnected = false;
let hasInitialized = false;
let currentLang = 'en';

// Preload state
let retryCount = 0;
const MAX_RETRIES = 3;

// ============================================
// WebSocket for Chat
// ============================================

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        isConnected = true;
        retryCount = 0;
        connectBtn.classList.add('hidden');
        enableChat();

        // Warmup backend
        ws.send(JSON.stringify({ type: 'warmup' }));

        // Send current language to server if not English
        if (currentLang !== 'en') {
            ws.send(JSON.stringify({ type: 'language', lang: currentLang }));
        }
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'complete') {
            addMessage('assistant', data.text);
            await speakResponse(data.text);
        } else if (data.type === 'error') {
            addMessage('system', 'Error: ' + data.message);
        } else if (data.type === 'warmup_ack') {
            console.log('AI backend warmed up');
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        isConnected = false;

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = 2000 * retryCount;
            setTimeout(connectWebSocket, delay);
        } else {
            connectBtn.classList.remove('hidden');
            statusText.textContent = 'Disconnected';
        }
    };

    ws.onerror = () => {
        console.log('WebSocket error');
    };
}

// ============================================
// Pause Background Narration
// ============================================

function pauseNarrator() {
    if (window.narrator) {
        window.narrator.audio.pause();
        window.narrator.audio.currentTime = 0;
        window.narrator.isPlaying = false;
        window.narrator.queue = [];
        window.narrator.indicator?.classList.remove('active');
    }
}

// ============================================
// TTS Audio Playback (no Simli — direct audio)
// ============================================

async function speakResponse(text) {
    try {
        if (!text || text.trim() === '') return;

        // Stop background narration while chatbot speaks
        pauseNarrator();

        // Initialize audio amplifier on first use (needs user gesture)
        const amp = getChatAmplifier();
        if (amp) amp.ensureReady();

        // Show speaking indicators
        audioIndicator?.classList.add('speaking');
        const speakingWave = document.getElementById('avatar-speaking-wave');
        speakingWave?.classList.add('speaking');

        const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang: currentLang })
        });

        if (!ttsRes.ok) {
            console.error('TTS error:', ttsRes.status);
            audioIndicator?.classList.remove('speaking');
            speakingWave?.classList.remove('speaking');
            return;
        }

        // Create blob URL and play via audio element
        const audioBlob = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        ttsAudio.src = audioUrl;
        ttsAudio.play().catch(err => console.log('Autoplay blocked:', err));

        ttsAudio.onended = () => {
            audioIndicator?.classList.remove('speaking');
            speakingWave?.classList.remove('speaking');
            URL.revokeObjectURL(audioUrl);
        };

    } catch (error) {
        console.error('TTS error:', error);
        audioIndicator?.classList.remove('speaking');
        document.getElementById('avatar-speaking-wave')?.classList.remove('speaking');
    }
}

// ============================================
// Send Message
// ============================================

function sendMessage(text) {
    const msg = text || userInput.value.trim();
    if (!msg || !ws || ws.readyState !== WebSocket.OPEN) return;

    addMessage('user', msg);
    userInput.value = '';
    sendBtn.disabled = true;

    ws.send(JSON.stringify({ type: 'chat', text: msg, lang: currentLang }));

    setTimeout(() => { sendBtn.disabled = false; }, 1000);
}

// ============================================
// Add Message to Chat
// ============================================

function addMessage(role, text) {
    const welcome = messagesEl.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ============================================
// Enable Chat Input
// ============================================

function enableChat() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    statusText.textContent = currentLang === 'es' ? 'Conectado. Pregúntame.' :
                             currentLang === 'pt' ? 'Conectado. Pergunte-me.' :
                             'Connected. Ask me anything.';
}

// ============================================
// Language Switching — syncs to server
// ============================================

window.setChatLanguage = function(lang) {
    currentLang = lang;
    // Send language change to server so GPT responds in correct language
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'language', lang }));
    }
    if (isConnected) {
        enableChat();
    }
};

// ============================================
// Lazy Init via IntersectionObserver
// ============================================

const askSection = document.getElementById('ask');
if (askSection) {
    const askObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !hasInitialized) {
            hasInitialized = true;
            console.log('Ask section visible — connecting WebSocket');
            connectWebSocket();
        }
    }, { threshold: 0.3 });

    askObserver.observe(askSection);
}

// ============================================
// Event Listeners
// ============================================

connectBtn.addEventListener('click', () => {
    retryCount = 0;
    connectWebSocket();
});

sendBtn.addEventListener('click', () => sendMessage());

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

if (promptChips) {
    promptChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.prompt-chip');
        if (!chip) return;
        const prompt = chip.dataset.prompt;
        if (prompt) {
            userInput.value = prompt;
            sendMessage(prompt);
        }
    });
}

// Preload WebSocket on page load
connectWebSocket();

console.log('Chat module loaded (photo + voice mode)');
