/**
 * Dr. Cortes Real-Time Avatar Server
 *
 * Handles:
 * - OpenAI GPT-5.5 chat with hosted vector-store retrieval
 * - ElevenLabs TTS with PCM16 output
 * - Simli WebRTC session management
 */

require('dotenv').config();

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const {
    DR_CORTES_PERSONA,
    LANGUAGE_INSTRUCTIONS,
    classifyInput,
    validateOutput,
    pickRefusal
} = require('./lib/guardrails');
const { answerFromCorpus, DEFAULT_MODEL, DEFAULT_VECTOR_STORE_ID } = require('./lib/openai-vector-store');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// API Keys (from .env)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const SIMLI_API_KEY = process.env.SIMLI_API_KEY;
const SIMLI_FACE_ID = process.env.SIMLI_FACE_ID;
const OPENAI_MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;
const OPENAI_VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || DEFAULT_VECTOR_STORE_ID;
const PREVIEW_PASSWORD = process.env.PREVIEW_PASSWORD || 'Carlos1234';
const PREVIEW_COOKIE = 'dr_cortes_preview';

console.log(`[startup] OpenAI model=${OPENAI_MODEL} vector_store=${OPENAI_VECTOR_STORE_ID}`);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function hasPreviewAccess(req) {
    const cookieHeader = req.headers.cookie || '';
    return cookieHeader
        .split(';')
        .map(cookie => cookie.trim())
        .includes(`${PREVIEW_COOKIE}=1`);
}

function previewCookie(req) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const parts = [`${PREVIEW_COOKIE}=1`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=86400'];
    if (secure) {
        parts.push('Secure');
    }
    return parts.join('; ');
}

app.get(['/', '/index.html'], (req, res) => {
    if (hasPreviewAccess(req)) {
        res.redirect('/timeline');
        return;
    }

    const hasError = req.query.error === '1';
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dr. Carlos E. Cortes - Coming Soon</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #0b111c;
            --panel: #121b2a;
            --text: #f4f1ea;
            --muted: #aab3c2;
            --accent: #d6af2f;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 32px;
            font-family: Georgia, "Times New Roman", serif;
            background: var(--bg);
            color: var(--text);
        }

        main {
            width: min(680px, 100%);
            padding: 48px 40px;
            border: 1px solid rgba(214, 175, 47, 0.28);
            background: var(--panel);
            text-align: center;
        }

        p {
            margin: 0;
            color: var(--muted);
            font: 18px/1.6 Arial, sans-serif;
        }

        form {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 28px;
        }

        input,
        button {
            min-height: 44px;
            border: 1px solid rgba(244, 241, 234, 0.22);
            font: 16px/1 Arial, sans-serif;
        }

        input {
            width: min(280px, 100%);
            padding: 0 14px;
            background: #0b111c;
            color: var(--text);
        }

        button {
            padding: 0 18px;
            background: var(--accent);
            color: #0b111c;
            cursor: pointer;
            font-weight: 700;
        }

        h1 {
            margin: 12px 0 18px;
            font-size: clamp(42px, 8vw, 78px);
            line-height: 0.95;
            font-weight: 700;
        }

        .eyebrow {
            color: var(--accent);
            font: 700 13px/1 Arial, sans-serif;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        .error {
            margin-top: 14px;
            color: #ffb4a8;
            font-size: 15px;
        }

        @media (max-width: 560px) {
            main {
                padding: 40px 24px;
            }

            form {
                flex-direction: column;
            }

            input,
            button {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <main>
        <p class="eyebrow">Dr. Carlos E. Cortes</p>
        <h1>Coming Soon</h1>
        <p>We are preparing the interactive timeline and archive. Please check back soon.</p>
        <form method="post" action="/preview-access">
            <input type="password" name="password" aria-label="Preview password" placeholder="Preview password" autocomplete="current-password">
            <button type="submit">Enter</button>
        </form>
        ${hasError ? '<p class="error">Incorrect password.</p>' : ''}
    </main>
</body>
</html>`);
});

app.post('/preview-access', (req, res) => {
    if (req.body.password === PREVIEW_PASSWORD) {
        res.setHeader('Set-Cookie', previewCookie(req));
        res.redirect('/timeline');
        return;
    }

    res.redirect('/?error=1');
});

app.get('/timeline', (req, res) => {
    if (!hasPreviewAccess(req)) {
        res.redirect('/');
        return;
    }

    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.use(express.static('docs'));

// Client config endpoint (serves Simli credentials securely)
app.get('/api/config', (req, res) => {
    res.json({
        simliApiKey: SIMLI_API_KEY,
        simliFaceId: SIMLI_FACE_ID
    });
});

// Get Simli session token
app.post('/api/simli-session', async (req, res) => {
    try {
        const response = await fetch('https://api.simli.ai/startAudioToVideoSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: SIMLI_API_KEY,
                faceId: SIMLI_FACE_ID,
                syncAudio: true,
                handleSilence: true,
            })
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Simli session error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get ElevenLabs TTS as PCM16
app.post('/api/tts', async (req, res) => {
    const { text } = req.body;

    try {
        // output_format must be query param, not body
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.88, similarity_boost: 0.80, style: 0.08 }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('ElevenLabs error:', response.status, errText);
            throw new Error(`ElevenLabs error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`TTS generated: ${audioBuffer.byteLength} bytes MP3`);
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// WebSocket for real-time chat
wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentLang = 'en';
    let conversationHistory = [
        { role: 'system', content: DR_CORTES_PERSONA }
    ];

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            // Handle warmup ping (preload connection)
            if (data.type === 'warmup') {
                console.log('Warmup ping received - backend ready');
                ws.send(JSON.stringify({ type: 'warmup_ack' }));
                return;
            }

            // Handle language change
            if (data.type === 'language') {
                currentLang = data.lang || 'en';
                const langInstruction = LANGUAGE_INSTRUCTIONS[currentLang] || '';
                conversationHistory[0] = { role: 'system', content: DR_CORTES_PERSONA + langInstruction };
                console.log(`Language set to: ${currentLang}`);
                ws.send(JSON.stringify({ type: 'language_ack', lang: currentLang }));
                return;
            }

            if (data.type === 'chat') {
                const userMessage = data.text;
                console.log(`User: ${userMessage}`);

                // --- Stage 1: input classification (jailbreak, living-person, harm, politics, advice, identity) ---
                const blockCategory = classifyInput(userMessage);
                if (blockCategory) {
                    const refusal = pickRefusal(blockCategory, currentLang);
                    console.log(`[refuse:input] ${blockCategory} -> ${refusal}`);
                    conversationHistory.push({ role: 'user', content: userMessage });
                    conversationHistory.push({ role: 'assistant', content: refusal });
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                // --- Stage 2: OpenAI hosted vector-store retrieval + GPT-5.5 generation ---
                let groundedAnswer;
                try {
                    groundedAnswer = await answerFromCorpus({
                        query: userMessage,
                        instructions: conversationHistory[0].content,
                        openaiApiKey: OPENAI_API_KEY
                    });
                    console.log(`[openai-rag] model=${groundedAnswer.model} retrieved=${groundedAnswer.retrieved} maxScore=${groundedAnswer.maxScore.toFixed(2)} fileSearchResults=${groundedAnswer.fileSearchResults}`);
                } catch (err) {
                    console.error('[openai-rag] failed:', err.message);
                    const refusal = pickRefusal('R-SPEC', currentLang);
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                if (groundedAnswer.retrieved === 0 || !groundedAnswer.text) {
                    // No grounded context -> refuse rather than hallucinate
                    const refusal = pickRefusal('R-SPEC', currentLang);
                    console.log(`[refuse:no-context] maxScore=${groundedAnswer.maxScore.toFixed(2)} -> ${refusal}`);
                    conversationHistory.push({ role: 'user', content: userMessage });
                    conversationHistory.push({ role: 'assistant', content: refusal });
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                let fullResponse = groundedAnswer.text;

                // --- Stage 3: validate output ---
                const validation = validateOutput(fullResponse);
                if (!validation.ok) {
                    console.log(`[refuse:output] ${validation.reason} -> swapping in refusal`);
                    fullResponse = validation.refusal;
                } else if (validation.cleaned) {
                    fullResponse = validation.cleaned;
                }

                console.log(`Dr. Cortes: ${fullResponse}`);
                conversationHistory.push({ role: 'user', content: userMessage });
                conversationHistory.push({ role: 'assistant', content: fullResponse });

                await delay(200);
                ws.send(JSON.stringify({ type: 'complete', text: fullResponse }));
            }
        } catch (error) {
            console.error('WebSocket error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 9802;
server.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log('Dr. Cortes Real-Time Avatar');
    console.log('='.repeat(50));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('='.repeat(50));
});
