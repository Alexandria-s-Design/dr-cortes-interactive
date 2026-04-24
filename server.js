/**
 * Dr. Cortes Real-Time Avatar Server
 *
 * Handles:
 * - OpenAI GPT-5.2 chat
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
const { retrieve, loadCorpus } = require('./lib/retrieval');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// API Keys (from .env)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const SIMLI_API_KEY = process.env.SIMLI_API_KEY;
const SIMLI_FACE_ID = process.env.SIMLI_FACE_ID;

// Warm up retrieval corpus at startup so first request is fast.
try {
    loadCorpus();
} catch (err) {
    console.error('[startup] Failed to load corpus-embeddings.json:', err.message);
    console.error('[startup] Run: node scripts/embed-corpus.js to generate it.');
}

app.use(express.json());
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

                // --- Stage 2: retrieve grounded context ---
                let retrieval;
                try {
                    retrieval = await retrieve(userMessage, { openaiApiKey: OPENAI_API_KEY });
                    console.log(`[retrieval] retrieved=${retrieval.retrieved}  maxSim=${retrieval.maxSim.toFixed(2)}`);
                } catch (err) {
                    console.error('[retrieval] failed:', err.message);
                    const refusal = pickRefusal('R-SPEC', currentLang);
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                if (retrieval.retrieved === 0) {
                    // No grounded context -> refuse rather than hallucinate
                    const refusal = pickRefusal('R-SPEC', currentLang);
                    console.log(`[refuse:no-context] -> ${refusal}`);
                    conversationHistory.push({ role: 'user', content: userMessage });
                    conversationHistory.push({ role: 'assistant', content: refusal });
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                // --- Stage 3: generate with retrieved context injected ---
                const groundedUserMessage = `RETRIEVED CONTEXT (from your own writings — answer ONLY from this, in your own voice):

${retrieval.contextBlock}

---

USER QUESTION: ${userMessage}

Answer in first person as Dr. Cortés, grounded strictly in the retrieved context above. If the context does not clearly answer the question, refuse warmly and redirect. Under 40 words. No markdown.`;

                // Keep a clean history (persona + this turn only — we don't accumulate RAG context across turns)
                const turnMessages = [
                    conversationHistory[0], // system: persona + language
                    { role: 'user', content: groundedUserMessage }
                ];

                await delay(300); // helps Simli stabilize

                console.log('Calling GPT-5.2...');
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-5.2-chat-latest',
                        messages: turnMessages,
                        max_completion_tokens: 200
                    })
                });

                const gptData = await response.json();

                if (gptData.error) {
                    console.error('GPT Error:', gptData.error);
                    ws.send(JSON.stringify({ type: 'error', message: gptData.error.message }));
                    return;
                }

                let fullResponse = gptData.choices?.[0]?.message?.content || '';

                if (!fullResponse) {
                    console.error('Empty response from GPT. Full data:', JSON.stringify(gptData));
                    const refusal = pickRefusal('R-SPEC', currentLang);
                    ws.send(JSON.stringify({ type: 'complete', text: refusal }));
                    return;
                }

                // --- Stage 4: validate output ---
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
