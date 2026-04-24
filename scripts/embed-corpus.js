#!/usr/bin/env node
/**
 * Embed Dr. Cortés corpus into a JSON file for in-memory RAG.
 *
 * Walks corpus/ -> chunks each .txt file (skips binary PDFs/DOCs/CSVs for now —
 *   those are loaded as whole-file context where they fit) -> embeds each chunk
 *   via OpenAI text-embedding-3-small -> writes corpus-embeddings.json.
 *
 * Run once after staging corpus, or whenever corpus changes.
 *   node scripts/embed-corpus.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const OUT_PATH = path.join(ROOT, 'corpus-embeddings.json');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'text-embedding-3-small'; // 1536 dim, cheap
const CHUNK_SIZE = 1200;   // ~300 tokens
const CHUNK_OVERLAP = 200; // 50 tokens
const BATCH_SIZE = 64;

if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing in .env');
    process.exit(1);
}

/** Chunk text into overlapping windows, breaking on paragraph where possible. */
function chunkText(text) {
    const clean = text.replace(/\r\n/g, '\n').trim();
    if (clean.length <= CHUNK_SIZE) return [clean];
    const chunks = [];
    let i = 0;
    while (i < clean.length) {
        let end = Math.min(i + CHUNK_SIZE, clean.length);
        // try to extend to next paragraph break if close
        if (end < clean.length) {
            const lookAhead = clean.slice(end, Math.min(end + 200, clean.length));
            const para = lookAhead.indexOf('\n\n');
            if (para >= 0) end += para;
        }
        const piece = clean.slice(i, end).trim();
        if (piece.length > 100) chunks.push(piece);
        if (end >= clean.length) break;
        i = end - CHUNK_OVERLAP;
    }
    return chunks;
}

/** Walk corpus dir, collect readable text files. */
function collectFiles() {
    const out = [];
    function walk(dir) {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) { walk(full); continue; }
            const ext = path.extname(name).toLowerCase();
            if (['.txt', '.md', '.csv'].includes(ext)) {
                out.push(full);
            }
            // skip .pdf, .doc — can add PDF text extraction later if needed
        }
    }
    walk(CORPUS_DIR);
    return out.sort();
}

async function embedBatch(inputs) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: MODEL, input: inputs })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding API ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.data.map(d => d.embedding);
}

async function main() {
    const files = collectFiles();
    console.log(`Found ${files.length} readable files in corpus/`);

    const chunks = [];
    for (const filePath of files) {
        const rel = path.relative(CORPUS_DIR, filePath).replace(/\\/g, '/');
        const text = fs.readFileSync(filePath, 'utf-8');
        const pieces = chunkText(text);
        for (let idx = 0; idx < pieces.length; idx++) {
            chunks.push({
                source: rel,
                chunk_index: idx,
                text: pieces[idx]
            });
        }
    }
    console.log(`Total chunks: ${chunks.length}`);

    // Embed in batches
    const withEmbeddings = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const inputs = batch.map(c => c.text);
        console.log(`  Embedding batch ${i/BATCH_SIZE + 1}/${Math.ceil(chunks.length/BATCH_SIZE)} (${batch.length} chunks)`);
        const vectors = await embedBatch(inputs);
        for (let j = 0; j < batch.length; j++) {
            withEmbeddings.push({ ...batch[j], embedding: vectors[j] });
        }
    }

    const payload = {
        model: MODEL,
        dim: withEmbeddings[0]?.embedding?.length || 0,
        chunk_size: CHUNK_SIZE,
        chunk_overlap: CHUNK_OVERLAP,
        built_at: new Date().toISOString(),
        count: withEmbeddings.length,
        chunks: withEmbeddings
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
    const bytes = fs.statSync(OUT_PATH).size;
    console.log(`\nWrote ${OUT_PATH}`);
    console.log(`  ${withEmbeddings.length} chunks, ${(bytes/1024/1024).toFixed(2)} MB`);
}

main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
