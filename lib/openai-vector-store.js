const DEFAULT_VECTOR_STORE_ID = 'vs_6a0bf01988608191ac5580691f00f5ba';
const DEFAULT_MODEL = 'gpt-5.5';
const DEFAULT_TOP_K = 6;
const DEFAULT_MIN_SCORE = 0.15;

function requireConfig(openaiApiKey) {
    if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required');
    }

    return {
        apiKey: openaiApiKey,
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || DEFAULT_VECTOR_STORE_ID
    };
}

async function openaiJson(url, apiKey, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
        const message = data.error?.message || `${res.status} ${res.statusText}`;
        throw new Error(message);
    }
    return data;
}

function extractContent(result) {
    return (result.content || [])
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text)
        .join('\n')
        .trim();
}

function formatContext(results) {
    return results.map((result, index) => {
        const text = extractContent(result);
        return `[${index + 1}] (source: ${result.filename}, score: ${result.score.toFixed(2)})\n${text}`;
    }).join('\n\n---\n\n');
}

function extractResponseText(data) {
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
        return data.output_text.trim();
    }

    const parts = [];
    for (const item of data.output || []) {
        if (item.type !== 'message') continue;
        for (const content of item.content || []) {
            if (content.type === 'output_text' && content.text) {
                parts.push(content.text);
            }
        }
    }
    return parts.join('\n').trim();
}

function countFileSearchResults(data) {
    let count = 0;
    for (const item of data.output || []) {
        if (item.type === 'file_search_call' && Array.isArray(item.results)) {
            count += item.results.length;
        }
    }
    return count;
}

async function searchCorpus(query, options = {}) {
    const { apiKey, vectorStoreId } = requireConfig(options.openaiApiKey);
    const topK = options.topK || DEFAULT_TOP_K;
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

    const data = await openaiJson(
        `https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`,
        apiKey,
        {
            query,
            max_num_results: topK
        }
    );

    const scored = data.data || [];
    const top = scored.filter(result => result.score >= minScore);

    return {
        results: top,
        contextBlock: top.length ? formatContext(top) : '',
        retrieved: top.length,
        maxScore: scored[0]?.score ?? 0,
        vectorStoreId
    };
}

async function answerFromCorpus({ query, instructions, openaiApiKey, topK = DEFAULT_TOP_K, minScore = DEFAULT_MIN_SCORE }) {
    const { apiKey, model, vectorStoreId } = requireConfig(openaiApiKey);
    const retrieval = await searchCorpus(query, { openaiApiKey, topK, minScore });

    if (retrieval.retrieved === 0) {
        return {
            ...retrieval,
            model,
            text: '',
            fileSearchResults: 0
        };
    }

    const input = `PRECHECKED VECTOR STORE RESULTS:

${retrieval.contextBlock}

---

USER QUESTION: ${query}

Use the OpenAI file_search tool and the prechecked vector-store results above. Answer in first person as Dr. Cortés, grounded strictly in these materials. If the materials do not clearly answer the question, refuse warmly and redirect. Under 40 words. No markdown.`;

    const requestBody = {
        model,
        instructions,
        input,
        tools: [{
            type: 'file_search',
            vector_store_ids: [vectorStoreId],
            max_num_results: topK
        }],
        include: ['file_search_call.results'],
        max_output_tokens: 500,
        store: false
    };

    let data = await openaiJson(
        'https://api.openai.com/v1/responses',
        apiKey,
        requestBody
    );

    let text = extractResponseText(data);

    if (!text) {
        data = await openaiJson(
            'https://api.openai.com/v1/responses',
            apiKey,
            {
                ...requestBody,
                input: `${input}\n\nPrevious attempt returned no final text. Return a concise spoken answer now.`
            }
        );
        text = extractResponseText(data);
    }

    return {
        ...retrieval,
        model,
        text,
        fileSearchResults: countFileSearchResults(data),
        responseId: data.id
    };
}

module.exports = {
    answerFromCorpus,
    searchCorpus,
    DEFAULT_MODEL,
    DEFAULT_VECTOR_STORE_ID
};
