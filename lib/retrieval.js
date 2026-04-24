/**
 * In-memory RAG retrieval for Dr. Cortés chatbot.
 *
 * On load: reads corpus-embeddings.json and keeps vectors in RAM.
 * Per query: embeds the query (one OpenAI call), cosine-similarity
 * against all chunks, returns top-k above similarity threshold.
 */
const fs = require('fs');
const path = require('path');

const EMBED_PATH = path.join(__dirname, '..', 'corpus-embeddings.json');
const EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_TOP_K = 6;
const DEFAULT_MIN_SIM = 0.32; // below this, consider "no relevant context"

let _corpus = null; // { model, dim, chunks: [{source, chunk_index, text, embedding}] }

function loadCorpus() {
    if (_corpus) return _corpus;
    if (!fs.existsSync(EMBED_PATH)) {
        throw new Error(`corpus-embeddings.json not found at ${EMBED_PATH}. Run: node scripts/embed-corpus.js`);
    }
    const raw = fs.readFileSync(EMBED_PATH, 'utf-8');
    _corpus = JSON.parse(raw);
    // Pre-compute norms to speed up cosine similarity
    for (const c of _corpus.chunks) {
        let sum = 0;
        for (const v of c.embedding) sum += v * v;
        c._norm = Math.sqrt(sum) || 1;
    }
    console.log(`[retrieval] Loaded ${_corpus.chunks.length} chunks (model=${_corpus.model}, dim=${_corpus.dim})`);
    return _corpus;
}

function dot(a, b) {
    let s = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
}

function cosine(queryVec, chunk, qNorm) {
    return dot(queryVec, chunk.embedding) / (qNorm * chunk._norm);
}

async function embedQuery(text, openaiApiKey) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: text })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embed query failed ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.data[0].embedding;
}

/**
 * Retrieve top-k chunks for a query.
 * Returns { chunks: [...top k], contextBlock: string, maxSim: number }
 */
async function retrieve(query, options = {}) {
    const {
        openaiApiKey,
        topK = DEFAULT_TOP_K,
        minSim = DEFAULT_MIN_SIM
    } = options;

    const corpus = loadCorpus();
    const qVec = await embedQuery(query, openaiApiKey);

    let qNorm = 0;
    for (const v of qVec) qNorm += v * v;
    qNorm = Math.sqrt(qNorm) || 1;

    const scored = corpus.chunks.map(c => ({
        source: c.source,
        text: c.text,
        sim: cosine(qVec, c, qNorm)
    }));
    scored.sort((a, b) => b.sim - a.sim);

    const top = scored.slice(0, topK).filter(c => c.sim >= minSim);

    const contextBlock = top.length > 0
        ? top.map((c, i) => `[${i + 1}] (source: ${c.source}, similarity: ${c.sim.toFixed(2)})\n${c.text}`).join('\n\n---\n\n')
        : '';

    return {
        chunks: top,
        contextBlock,
        maxSim: scored[0]?.sim ?? 0,
        retrieved: top.length
    };
}

module.exports = { retrieve, loadCorpus };
