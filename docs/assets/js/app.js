// ========================================
// Dr. Carlos E. Cortes — Storytelling Timeline
// Scroll-driven narrative experience
// ========================================

// Translation data (ES/PT entry translations)
import { ENTRIES_ES } from './timeline-entries-es.js';
import { ENTRIES_PT } from './timeline-entries-pt.js';

// Expose translations globally for chat.js and other modules
window.ENTRIES_ES = ENTRIES_ES;
window.ENTRIES_PT = ENTRIES_PT;

// ========== AUDIO AMPLIFIER (Web Audio API GainNode) ==========
class AudioAmplifier {
    constructor(audioElement, storageKey, defaultGain = 1.5) {
        this.audio = audioElement;
        this.storageKey = storageKey;
        this.defaultGain = defaultGain;
        this.ctx = null;
        this.gainNode = null;
        this.source = null;
        this.initialized = false;
        this.mutedGain = null; // stores gain before mute

        // Restore from localStorage
        const saved = localStorage.getItem(storageKey);
        this._pendingGain = saved !== null ? parseFloat(saved) : defaultGain;
    }

    _init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.source = this.ctx.createMediaElementSource(this.audio);
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = this._pendingGain;
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.initialized = true;
    }

    ensureReady() {
        if (!this.initialized) this._init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setGain(value) {
        this._pendingGain = value;
        localStorage.setItem(this.storageKey, value.toString());
        if (this.gainNode) {
            this.gainNode.gain.value = value;
        }
    }

    getGain() {
        return this.gainNode ? this.gainNode.gain.value : this._pendingGain;
    }

    mute() {
        this.mutedGain = this.getGain();
        this.setGain(0);
    }

    unmute() {
        if (this.mutedGain !== null) {
            this.setGain(this.mutedGain);
            this.mutedGain = null;
        }
    }

    isMuted() {
        return this.mutedGain !== null;
    }
}

// Expose globally for chat.js
window.AudioAmplifier = AudioAmplifier;

// Configuration
const CONFIG = {
    dataUrl: 'assets/data/timeline-data.json',
    markerRadius: 38,
    decades: [
        { key: '1950s', range: '1950-1961', theme: 'The Road to Riverside', color: '#1e3a5f' },
        { key: '1960s', range: '1962-1969', theme: 'Becoming a Historian', color: '#8b2942' },
        { key: '1970s', range: '1970-1979', theme: 'Lurching into K-12 Education', color: '#1e3a5f' },
        { key: '1980s', range: '1980-1989', theme: 'The All-Purpose Multiculturalist', color: '#8b2942' },
        { key: '1990s', range: '1990-1999', theme: "Everybody's Adjunct", color: '#1e3a5f' },
        { key: '2000s', range: '2000-2009', theme: 'Curtain Going Up', color: '#8b2942' },
        { key: '2010s', range: '2010-2019', theme: 'Winding Down', color: '#1e3a5f' },
        { key: '2020s', range: '2020-2026', theme: 'Zombie Time', color: '#8b2942' }
    ]
};

// Decade narrative intros (We → You → I voice progression)
const DECADE_INTROS = {
    '1950s': 'In post-war America, a young man from Kansas City set out on a path that would shape how a nation thinks about diversity. From UC Berkeley to Columbia Journalism, from Fort Gordon to a Phoenix newsroom — every step was preparation for the road ahead.',
    '1960s': 'You might say the sixties made Carlos Cort\u00e9s a historian. A Ford Foundation fellowship took him to Brazil. A Ph.D. from New Mexico gave him the tools. And in 1968, UC Riverside gave him a stage that would last fifty-seven years.',
    '1970s': 'The classroom expanded. A chapter in James Banks\u2019 Teaching Ethnic Studies launched a national speaking career. Three reprint series he edited preserved voices that textbooks ignored. And he introduced the concept of the "societal curriculum" — that society itself is a curriculum, teaching lessons no school ever planned.',
    '1980s': 'By now, the world was calling. PBS wanted documentaries. Harvard wanted lectures. Japan wanted perspective. The Distinguished California Humanist Award in 1980 signaled what everyone already knew: Carlos Cort\u00e9s had become an all-purpose multiculturalist.',
    '1990s': 'He took early retirement from UC in 1994 \u2014 and then the real work began. Harvard summer institutes, the Federal Executive Institute, Australian universities, and Riverside\u2019s own Multicultural Forum. Retirement was just a word.',
    '2000s': 'Children\u2019s television could reach millions. When Nickelodeon asked him to advise on Dora the Explorer, he saw an opportunity to shape how an entire generation understood cultural difference. The NAACP Image Award in 2009 confirmed that the work mattered.',
    '2010s': 'They called it \u201cWinding Down,\u201d but he wasn\u2019t finished. A memoir about growing up in a multi-ethnic family. A four-volume encyclopedia. A city naming an award in his honor. Poetry. A column on American diversity. The fourth quarter has its own rhythm.',
    '2020s': 'Zombie Time — because he refuses to stop. A pandemic vision statement for Riverside. A consulting role at the Cheech museum. Cultural work on Puss in Boots: The Last Wish. A debut novel at 91. And now, the Multilingual Educator Hall of Fame. The story continues.'
};

// (All works now shown — no filter needed)

// Global state
const state = {
    data: null,
    activeModal: null
};

// ========== DATA LOADER ==========
class DataLoader {
    async load() {
        try {
            const response = await fetch(CONFIG.dataUrl);
            if (!response.ok) throw new Error(`Failed to load data: ${response.statusText}`);
            const data = await response.json();
            state.data = data;
            return data;
        } catch (error) {
            console.error('Error loading data:', error);
            const mockData = this.getMockData();
            state.data = mockData;
            return mockData;
        }
    }

    getMockData() {
        return {
            biography: {
                name: "Dr. Carlos E. Cort\u00e9s",
                title: "Edward A. Dickson Emeritus Professor of History",
                institution: "University of California, Riverside",
                bio: "Pioneering figure in multicultural education, ethnic studies, and diversity scholarship with a career spanning seven decades.",
                careerStart: 1955,
                totalWorks: "85",
                awards: [
                    { year: 1974, award: "Hubert Herring Memorial Award", description: "For Ga\u00facho Politics in Brazil" },
                    { year: 2009, award: "NAACP Image Award", description: "Nickelodeon advisory work" },
                    { year: 2021, award: "Constantine Panunzio Distinguished Emeriti Award", description: "First from UCR" }
                ]
            },
            decades: {
                '1950s': { theme: 'The Road to Riverside', totalEntries: 7, entries: [
                    { title: "B.A., Communications and Public Policy, UC Berkeley", year: "1956", description: "Graduated Phi Beta Kappa from UC Berkeley." }
                ]},
                '1960s': { theme: 'Becoming a Historian', totalEntries: 6, entries: [
                    { title: "Began Career as History Professor at UCR", year: "1968", description: "Launched a 57-year association with UC Riverside." }
                ]},
                '1970s': { theme: 'Lurching into K-12 Education', totalEntries: 12, entries: [
                    { title: "Ga\u00facho Politics in Brazil", year: "1974", description: "Award-winning first book on Brazilian politics." }
                ]},
                '1980s': { theme: 'The All-Purpose Multiculturalist', totalEntries: 12, entries: [
                    { title: "Beyond Language", year: "1986", description: "Influential bilingual education publication." }
                ]},
                '1990s': { theme: "Everybody's Adjunct", totalEntries: 12, entries: [
                    { title: "Took Early Retirement from UC", year: "1994", description: "Post-retirement career proved most productive." }
                ]},
                '2000s': { theme: 'Curtain Going Up', totalEntries: 12, entries: [
                    { title: "The Children Are Watching", year: "2000", description: "Landmark book on media and diversity." }
                ]},
                '2010s': { theme: 'Winding Down', totalEntries: 12, entries: [
                    { title: "Rose Hill", year: "2012", description: "Memoir about growing up in an interracial family." }
                ]},
                '2020s': { theme: 'Zombie Time', totalEntries: 12, entries: [
                    { title: "Scouts\u2019 Honor", year: "2025", description: "Debut novel at age 91." }
                ]}
            }
        };
    }

    getAllWorks() {
        if (!state.data?.decades) return [];
        const works = [];
        for (const decade of Object.values(state.data.decades)) {
            if (decade.entries) {
                works.push(...decade.entries);
            } else if (decade.categories) {
                for (const category of Object.values(decade.categories)) {
                    works.push(...category);
                }
            }
        }
        return works;
    }

    searchWorks(query) {
        const allWorks = this.getAllWorks();
        const lowerQuery = query.toLowerCase();
        return allWorks.filter(work => {
            return (
                work.title.toLowerCase().includes(lowerQuery) ||
                (work.description || '').toLowerCase().includes(lowerQuery) ||
                work.year.toString().includes(query)
            );
        });
    }
}

// ========== TIMELINE RENDERER (Horizontal SVG — kept) ==========
class TimelineRenderer {
    constructor(svgElement) {
        this.svg = svgElement;
        this.width = 1200;
        this.height = 420;
    }

    render() {
        const padding = { left: 65, right: 65 };
        const timelineY = 200;
        const lineLength = this.width - padding.left - padding.right;
        const decadeSpacing = lineLength / (CONFIG.decades.length - 1);

        this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

        this.drawHorizontalLine(padding.left, timelineY, lineLength);

        CONFIG.decades.forEach((decade, index) => {
            const x = padding.left + (index * decadeSpacing);
            this.drawDecadeMarker(x, timelineY, decade, index);
        });
    }

    drawHorizontalLine(startX, y, length) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startX);
        line.setAttribute('y1', y);
        line.setAttribute('x2', startX + length);
        line.setAttribute('y2', y);
        line.classList.add('timeline-line');
        this.svg.appendChild(line);

        line.style.strokeDasharray = length;
        line.style.strokeDashoffset = length;

        gsap.to(line, {
            strokeDashoffset: 0,
            duration: 1.5,
            delay: 0.8,
            ease: 'power2.inOut'
        });
    }

    drawDecadeMarker(x, y, decade, index) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('decade-marker');
        group.setAttribute('data-decade', decade.key);

        const radius = CONFIG.markerRadius;

        const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerRing.setAttribute('cx', x);
        outerRing.setAttribute('cy', y);
        outerRing.setAttribute('r', radius + 6);
        outerRing.classList.add('decade-marker-ring');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', radius);
        circle.classList.add('decade-marker-circle');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + 5);
        text.classList.add('decade-marker-text');
        text.textContent = decade.key;

        const theme = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        theme.setAttribute('x', x);
        theme.setAttribute('y', y + radius + 30);
        theme.classList.add('decade-theme-text');
        theme.textContent = decade.theme;

        if (state.data?.decades?.[decade.key]) {
            const decadeData = state.data.decades[decade.key];
            const entryCount = decadeData.totalEntries || decadeData.totalWorks || 0;
            const count = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            count.setAttribute('x', x);
            count.setAttribute('y', y + radius + 50);
            count.classList.add('category-indicator');
            count.textContent = `${entryCount} entries`;
            group.appendChild(count);
        }

        group.appendChild(outerRing);
        group.appendChild(circle);
        group.appendChild(text);
        group.appendChild(theme);

        // Click scrolls to vertical narrative decade and narrates it
        group.addEventListener('click', () => {
            const target = document.getElementById(`decade-${decade.key}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Interrupt current narration and play clicked decade
                if (window.narrator && window.narrator.enabled) {
                    window.narrator.narrated.add(decade.key);
                    const intro = (currentLang !== 'en' && DECADE_INTROS_I18N[currentLang]?.[decade.key])
                        ? DECADE_INTROS_I18N[currentLang][decade.key]
                        : DECADE_INTROS[decade.key];
                    if (intro) {
                        window.narrator.stopCurrent();
                        window.narrator.playNarration(intro);
                    }
                }
            }
        });

        this.svg.appendChild(group);

        gsap.set(group, { opacity: 0 });
        gsap.to(group, {
            opacity: 1,
            duration: 0.5,
            delay: 1.4 + (index * 0.1),
            ease: 'back.out(1.7)'
        });
    }
}

// ========== NARRATIVE TIMELINE (new — vertical storytelling) ==========
class NarrativeTimeline {
    constructor(container) {
        this.container = container;
    }

    render(lang) {
        if (!state.data?.decades) return;
        lang = lang || 'en';
        const translations = getEntryTranslations(lang);

        const decades = state.data.decades;
        const html = [];

        for (const decadeConfig of CONFIG.decades) {
            const decadeData = decades[decadeConfig.key];
            if (!decadeData) continue;

            const entries = decadeData.entries || [];
            // Use translated intro/theme if available
            const intro = (lang !== 'en' && DECADE_INTROS_I18N[lang]?.[decadeConfig.key])
                ? DECADE_INTROS_I18N[lang][decadeConfig.key]
                : (DECADE_INTROS[decadeConfig.key] || '');
            const theme = (lang !== 'en' && DECADE_THEMES_I18N[lang]?.[decadeConfig.key])
                ? DECADE_THEMES_I18N[lang][decadeConfig.key]
                : decadeConfig.theme;

            html.push(`
                <div id="decade-${decadeConfig.key}" class="decade-block">
                    <div class="decade-header scroll-reveal">
                        <h2>${decadeConfig.key}</h2>
                        <p class="decade-theme">"${theme}"</p>
                        <p class="decade-intro">${intro}</p>
                    </div>
                    <div class="vertical-timeline">
                        ${entries.map(entry => {
                            const t = translations[entry.title];
                            const title = t?.title || entry.title;
                            const desc = t?.desc || entry.description || '';
                            return `
                            <div class="timeline-entry scroll-reveal">
                                <div class="entry-year">${entry.year}</div>
                                <div class="entry-card">
                                    <h3>${title}</h3>
                                    <p>${desc}</p>
                                </div>
                            </div>
                        `;}).join('')}
                    </div>
                </div>
            `);
        }

        this.container.innerHTML = html.join('');
    }
}

// ========== SCROLL MANAGER ==========
class ScrollManager {
    constructor() {
        this.sections = [];
        this.navLinks = [];
    }

    init() {
        this.sections = Array.from(document.querySelectorAll('.section'));
        this.navLinks = Array.from(document.querySelectorAll('.nav-link'));

        // Section highlighting
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    this.navLinks.forEach(link => {
                        link.classList.toggle('active', link.dataset.section === id);
                    });
                }
            });
        }, {
            rootMargin: '-40% 0px -60% 0px',
            threshold: 0
        });

        this.sections.forEach(section => sectionObserver.observe(section));

        // Scroll-reveal for entry cards
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -60px 0px',
            threshold: 0.1
        });

        document.querySelectorAll('.scroll-reveal').forEach(el => {
            revealObserver.observe(el);
        });
    }
}

// ========== TIMELINE NARRATOR (auto-voice on scroll) ==========
class TimelineNarrator {
    constructor() {
        this.narrated = new Set(); // decades already narrated
        this.isPlaying = false;
        this.queue = [];
        this.audio = new Audio();
        this.enabled = true;
        this.indicator = null; // will be created in init
    }

    init() {
        // Create audio amplifier
        this.amplifier = new AudioAmplifier(this.audio, 'narrator-volume', 1.5);

        // Create a floating narrator indicator
        this.indicator = document.createElement('div');
        this.indicator.className = 'narrator-indicator';
        const savedVol = this.amplifier.getGain();
        this.indicator.innerHTML = `
            <div class="narrator-wave"><span></span><span></span><span></span></div>
            <span class="narrator-label">Narrating...</span>
            <input type="range" class="vol-slider narrator-vol-slider" id="narrator-vol-slider" min="0" max="300" value="${Math.round(savedVol * 100)}" aria-label="Narrator volume">
            <button class="narrator-mute" aria-label="Mute narration" title="Mute narration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            </button>
        `;
        document.body.appendChild(this.indicator);

        // Volume slider
        const volSlider = this.indicator.querySelector('#narrator-vol-slider');
        volSlider.addEventListener('input', (e) => {
            const gain = parseInt(e.target.value) / 100;
            this.amplifier.setGain(gain);
        });

        // Mute button
        this.indicator.querySelector('.narrator-mute').addEventListener('click', () => {
            this.enabled = !this.enabled;
            this.indicator.classList.toggle('muted', !this.enabled);
            if (!this.enabled) {
                this.audio.pause();
                this.audio.currentTime = 0;
                this.isPlaying = false;
                this.queue = [];
                this.indicator.classList.remove('active');
            }
            // Update mute icon
            const svg = this.indicator.querySelector('.narrator-mute svg');
            if (!this.enabled) {
                svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
            } else {
                svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
            }
        });

        // Observe decade headers
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const decade = entry.target.closest('.decade-block')?.id?.replace('decade-', '');
                    if (decade && !this.narrated.has(decade) && this.enabled) {
                        this.narrated.add(decade);
                        const intro = (currentLang !== 'en' && DECADE_INTROS_I18N[currentLang]?.[decade])
                            ? DECADE_INTROS_I18N[currentLang][decade]
                            : DECADE_INTROS[decade];
                        if (intro) {
                            // Interrupt current narration and start the new one
                            this.stopCurrent();
                            this.playNarration(intro);
                        }
                    }
                }
            });
        }, {
            rootMargin: '0px 0px -30% 0px',
            threshold: 0.5
        });

        document.querySelectorAll('.decade-header').forEach(header => {
            observer.observe(header);
        });
    }

    stopCurrent() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.queue = [];
        this.indicator?.classList.remove('active');
    }

    // Find the decade header currently most visible and narrate it
    narrateVisibleDecade() {
        if (!this.enabled) return;
        const headers = document.querySelectorAll('.decade-header');
        let best = null;
        let bestRatio = 0;
        headers.forEach(header => {
            const rect = header.getBoundingClientRect();
            const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
            const ratio = visible / rect.height;
            if (ratio > bestRatio) {
                bestRatio = ratio;
                best = header;
            }
        });
        if (best && bestRatio > 0.2) {
            const decade = best.closest('.decade-block')?.id?.replace('decade-', '');
            if (decade) {
                this.narrated.add(decade);
                const intro = (currentLang !== 'en' && DECADE_INTROS_I18N[currentLang]?.[decade])
                    ? DECADE_INTROS_I18N[currentLang][decade]
                    : DECADE_INTROS[decade];
                if (intro) {
                    this.stopCurrent();
                    this.playNarration(intro);
                }
            }
        }
    }

    async playNarration(text) {
        if (!this.enabled) return;
        this.amplifier.ensureReady();
        this.isPlaying = true;
        this.indicator.classList.add('active');

        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang: currentLang })
            });

            if (!res.ok) {
                console.error('Narrator TTS error:', res.status);
                this.isPlaying = false;
                this.indicator.classList.remove('active');
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            this.audio.src = url;
            this.audio.play().catch(err => {
                console.log('Narrator autoplay blocked:', err);
                this.isPlaying = false;
                this.indicator.classList.remove('active');
            });

            this.audio.onended = () => {
                URL.revokeObjectURL(url);
                this.isPlaying = false;
                this.indicator.classList.remove('active');
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    this.playNarration(next);
                }
            };
        } catch (err) {
            console.error('Narrator error:', err);
            this.isPlaying = false;
            this.indicator.classList.remove('active');
        }
    }
}

// ========== SELECTED WORKS RENDERER ==========
class WorksRenderer {
    renderPublications(container, lang) {
        if (!state.data?.decades) return;
        lang = lang || 'en';
        const translations = getEntryTranslations(lang);

        const allWorks = dataLoader.getAllWorks();

        container.innerHTML = allWorks.map(work => {
            const t = translations[work.title];
            const title = t?.title || work.title;
            const desc = t?.desc || work.description || '';
            return `
            <div class="publication-card scroll-reveal">
                <div class="publication-year">${work.year}</div>
                <div class="publication-title">${title}</div>
                <div class="publication-desc">${desc}</div>
            </div>
        `;}).join('');
    }

    renderAwards(container, lang) {
        const awards = state.data?.biography?.awards;
        if (!awards) return;
        lang = lang || 'en';
        const translations = getEntryTranslations(lang);

        container.innerHTML = awards.map(award => {
            const t = translations[award.award];
            const name = t?.title || award.award;
            const desc = t?.desc || award.description;
            return `
            <div class="award-card scroll-reveal">
                <div class="award-card-year">${award.year}</div>
                <div class="award-card-name">${name}</div>
                <div class="award-card-desc">${desc}</div>
            </div>
        `;}).join('');
    }
}

// ========== SEARCH (kept from original) ==========
class SearchManager {
    constructor() {
        this.modal = document.getElementById('modal-search');
    }

    open() {
        if (!this.modal) return;
        this.modal.classList.add('active');
        state.activeModal = this.modal;
        document.body.style.overflow = 'hidden';

        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');
        input.value = '';
        results.innerHTML = '';
        setTimeout(() => input.focus(), 100);

        // Live search
        input.oninput = (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                results.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">Type at least 2 characters to search...</p>';
                return;
            }

            const matches = dataLoader.searchWorks(query);
            if (matches.length === 0) {
                results.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">No results found.</p>';
                return;
            }

            results.innerHTML = matches.map(work => `
                <div class="search-result-item" data-work-title="${work.title}">
                    <div class="search-result-title">${work.title}</div>
                    <div class="search-result-meta">${work.year}</div>
                </div>
            `).join('');

            results.querySelectorAll('.search-result-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    this.close();
                    // Find the entry in the vertical timeline and scroll to it
                    const entryCards = document.querySelectorAll('.entry-card h3');
                    for (const h3 of entryCards) {
                        if (h3.textContent === matches[index].title) {
                            h3.closest('.timeline-entry').scrollIntoView({ behavior: 'smooth', block: 'center' });
                            h3.closest('.entry-card').style.borderColor = 'var(--color-gold)';
                            setTimeout(() => {
                                h3.closest('.entry-card').style.borderColor = '';
                            }, 3000);
                            break;
                        }
                    }
                });
            });
        };
    }

    close() {
        if (state.activeModal) {
            state.activeModal.classList.remove('active');
            state.activeModal = null;
            document.body.style.overflow = '';
        }
    }
}

// ========== STATS COUNTER ==========
function animateStatsCounters() {
    const statNumbers = document.querySelectorAll('.hero-stat-number');
    statNumbers.forEach(stat => {
        const target = parseInt(stat.dataset.target);
        gsap.to(stat, {
            textContent: target,
            duration: 2,
            ease: 'power2.out',
            snap: { textContent: 1 },
            delay: 1
        });
    });
}

// ========== THEME TOGGLE ==========
function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Restore from localStorage
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.body.classList.add('light');
    }

    toggle.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// ========== INTERNATIONALIZATION ==========
const I18N = {
    en: {
        // Nav
        nav_home: 'Home', nav_timeline: 'Timeline', nav_story: 'Story', nav_ask: 'Ask', nav_works: 'Works',
        loading: 'Loading Timeline...',
        // Hero
        hero_hook: 'Every culture carries a curriculum — the question is whether we choose to learn from it.',
        hero_subtitle: 'This is the story of one man who spent seven decades building bridges.',
        stat_years: 'Years', stat_milestones: 'Milestones', stat_decades: 'Decades',
        scroll_explore: 'Scroll to explore',
        // Timeline
        timeline_intro: "You're about to travel through 70 years of scholarship, storytelling, and bridge-building.",
        // Ask
        ask_title: 'Ask Dr. Cort\u00e9s',
        ask_subtitle: "Have a question about equity, curriculum design, or ethnic studies? I've spent my career in conversation \u2014 let's continue it here.",
        chat_status: 'Ready to chat',
        chat_welcome: 'Start a conversation with Dr. Cort\u00e9s about his life\'s work in multicultural education.',
        chat_placeholder: 'Ask Dr. Cort\u00e9s a question...',
        reconnect: 'Reconnect',
        // Prompts
        prompt_1: 'What inspired your work?', prompt_1_full: 'What inspired your work in multicultural education?',
        prompt_2: 'Tell me about Dora', prompt_2_full: 'Tell me about your experience with Dora the Explorer at Nickelodeon.',
        prompt_3: 'Growing up interracial', prompt_3_full: 'What was it like growing up in an interracial family in the 1940s?',
        prompt_4: 'Societal curriculum', prompt_4_full: 'What is the societal curriculum and why does it matter?',
        // Works
        works_title: 'Complete Works & Recognition',
        works_intro: '85 milestones across seven decades of learning to live together.',
        awards_title: 'Awards & Honors',
        // Search
        search_placeholder: 'Search by title, category, year...',
        search_hint: 'Type at least 2 characters to search...',
        search_no_results: 'No results found.'
    },
    es: {
        nav_home: 'Inicio', nav_timeline: 'Cronolog\u00eda', nav_story: 'Historia', nav_ask: 'Preguntar', nav_works: 'Obras',
        loading: 'Cargando cronolog\u00eda...',
        hero_hook: 'Cada cultura lleva un currículo — la pregunta es si elegimos aprender de él.',
        hero_subtitle: 'Esta es la historia de un hombre que pas\u00f3 siete d\u00e9cadas construyendo puentes.',
        stat_years: 'A\u00f1os', stat_milestones: 'Hitos', stat_decades: 'D\u00e9cadas',
        scroll_explore: 'Despl\u00e1zate para explorar',
        timeline_intro: 'Est\u00e1s a punto de recorrer 70 a\u00f1os de erudici\u00f3n, narraci\u00f3n y construcci\u00f3n de puentes.',
        ask_title: 'Preg\u00fantale al Dr. Cort\u00e9s',
        ask_subtitle: '\u00bfTienes una pregunta sobre equidad, dise\u00f1o curricular o estudios \u00e9tnicos? He pasado mi carrera en conversaci\u00f3n \u2014 contin\u00faemosla aqu\u00ed.',
        chat_status: 'Listo para chatear',
        chat_welcome: 'Inicia una conversaci\u00f3n con el Dr. Cort\u00e9s sobre su obra en educaci\u00f3n multicultural.',
        chat_placeholder: 'Hazle una pregunta al Dr. Cort\u00e9s...',
        reconnect: 'Reconectar',
        prompt_1: '\u00bfQu\u00e9 inspir\u00f3 su trabajo?', prompt_1_full: '\u00bfQu\u00e9 inspir\u00f3 su trabajo en educaci\u00f3n multicultural?',
        prompt_2: 'Cu\u00e9nteme sobre Dora', prompt_2_full: 'Cu\u00e9nteme sobre su experiencia con Dora la Exploradora en Nickelodeon.',
        prompt_3: 'Crecer interracial', prompt_3_full: '\u00bfC\u00f3mo fue crecer en una familia interracial en los a\u00f1os 40?',
        prompt_4: 'Curr\u00edculo social', prompt_4_full: '\u00bfQu\u00e9 es el curr\u00edculo social y por qu\u00e9 es importante?',
        works_title: 'Obras Completas y Reconocimientos',
        works_intro: '85 hitos a lo largo de siete d\u00e9cadas de aprender a vivir juntos.',
        awards_title: 'Premios y Honores',
        search_placeholder: 'Buscar por t\u00edtulo, categor\u00eda, a\u00f1o...',
        search_hint: 'Escribe al menos 2 caracteres para buscar...',
        search_no_results: 'No se encontraron resultados.'
    },
    pt: {
        nav_home: 'In\u00edcio', nav_timeline: 'Cronologia', nav_story: 'Hist\u00f3ria', nav_ask: 'Perguntar', nav_works: 'Obras',
        loading: 'Carregando cronologia...',
        hero_hook: 'Toda cultura carrega um currículo — a questão é se escolhemos aprender com ele.',
        hero_subtitle: 'Esta \u00e9 a hist\u00f3ria de um homem que passou sete d\u00e9cadas construindo pontes.',
        stat_years: 'Anos', stat_milestones: 'Marcos', stat_decades: 'D\u00e9cadas',
        scroll_explore: 'Role para explorar',
        timeline_intro: 'Voc\u00ea est\u00e1 prestes a percorrer 70 anos de erudi\u00e7\u00e3o, narrativa e constru\u00e7\u00e3o de pontes.',
        ask_title: 'Pergunte ao Dr. Cort\u00e9s',
        ask_subtitle: 'Tem uma pergunta sobre equidade, design curricular ou estudos \u00e9tnicos? Passei minha carreira em conversa\u00e7\u00e3o \u2014 vamos continu\u00e1-la aqui.',
        chat_status: 'Pronto para conversar',
        chat_welcome: 'Inicie uma conversa com o Dr. Cort\u00e9s sobre sua obra em educa\u00e7\u00e3o multicultural.',
        chat_placeholder: 'Fa\u00e7a uma pergunta ao Dr. Cort\u00e9s...',
        reconnect: 'Reconectar',
        prompt_1: 'O que inspirou seu trabalho?', prompt_1_full: 'O que inspirou seu trabalho em educa\u00e7\u00e3o multicultural?',
        prompt_2: 'Conte-me sobre Dora', prompt_2_full: 'Conte-me sobre sua experi\u00eancia com Dora a Aventureira na Nickelodeon.',
        prompt_3: 'Crescer inter-racial', prompt_3_full: 'Como foi crescer em uma fam\u00edlia inter-racial nos anos 1940?',
        prompt_4: 'Curr\u00edculo social', prompt_4_full: 'O que \u00e9 o curr\u00edculo social e por que \u00e9 importante?',
        works_title: 'Obras Completas e Reconhecimento',
        works_intro: '85 marcos ao longo de sete d\u00e9cadas de aprendizado sobre viver juntos.',
        awards_title: 'Pr\u00eamios e Honras',
        search_placeholder: 'Buscar por t\u00edtulo, categoria, ano...',
        search_hint: 'Digite pelo menos 2 caracteres para buscar...',
        search_no_results: 'Nenhum resultado encontrado.'
    }
};

// Decade themes translated
const DECADE_THEMES_I18N = {
    es: {
        '1950s': 'El Camino a Riverside', '1960s': 'Convirti\u00e9ndose en Historiador',
        '1970s': 'Entrando en la Educaci\u00f3n K-12', '1980s': 'El Multiculturalista Todoterreno',
        '1990s': 'El Adjunto de Todos', '2000s': 'Se Levanta el Tel\u00f3n',
        '2010s': 'Cerrando Ciclos', '2020s': 'Tiempo Zombie'
    },
    pt: {
        '1950s': 'O Caminho para Riverside', '1960s': 'Tornando-se Historiador',
        '1970s': 'Entrando na Educa\u00e7\u00e3o K-12', '1980s': 'O Multiculturalista Vers\u00e1til',
        '1990s': 'O Adjunto de Todos', '2000s': 'Abre-se a Cortina',
        '2010s': 'Desacelerando', '2020s': 'Tempo Zumbi'
    }
};

// Decade intros translated
const DECADE_INTROS_I18N = {
    es: {
        '1950s': 'En la Am\u00e9rica de posguerra, un joven de Kansas City emprendi\u00f3 un camino que moldear\u00eda la forma en que una naci\u00f3n piensa sobre la diversidad. De UC Berkeley a la Escuela de Periodismo de Columbia, del servicio militar a una redacci\u00f3n en Phoenix \u2014 cada paso fue preparaci\u00f3n para el camino que ven\u00eda.',
        '1960s': 'Se podr\u00eda decir que los sesenta convirtieron a Carlos Cort\u00e9s en historiador. Una beca de la Fundaci\u00f3n Ford lo llev\u00f3 a Brasil. Un doctorado de Nuevo M\u00e9xico le dio las herramientas. Y en 1968, UC Riverside le dio un escenario que durar\u00eda cincuenta y siete a\u00f1os.',
        '1970s': 'El aula se expandi\u00f3. Un cap\u00edtulo en el libro de James Banks lanz\u00f3 una carrera como conferencista nacional. Tres series de reimpresiones que él editó preservaron voces que los libros de texto ignoraban. E introdujo el concepto del "curr\u00edculo societal" \u2014 que la sociedad misma es un curr\u00edculo, ense\u00f1ando lecciones que ninguna escuela planific\u00f3.',
        '1980s': 'Para entonces, el mundo llamaba. PBS quer\u00eda documentales. Harvard quer\u00eda conferencias. Jap\u00f3n quer\u00eda perspectiva. El Premio Distinguido Humanista de California en 1980 se\u00f1al\u00f3 lo que todos ya sab\u00edan: Carlos Cort\u00e9s se hab\u00eda convertido en un multiculturalista todoterreno.',
        '1990s': 'Se jubil\u00f3 anticipadamente de la UC en 1994 \u2014 y entonces comenz\u00f3 el verdadero trabajo. Institutos de verano en Harvard, el Instituto Federal Ejecutivo, universidades australianas y el Foro Multicultural del Alcalde de Riverside. La jubilaci\u00f3n era solo una palabra.',
        '2000s': 'La televisi\u00f3n infantil pod\u00eda llegar a millones. Cuando Nickelodeon le pidi\u00f3 asesorar en Dora la Exploradora, vio una oportunidad de moldear c\u00f3mo toda una generaci\u00f3n entend\u00eda la diferencia cultural. El Premio NAACP Image en 2009 confirm\u00f3 que el trabajo importaba.',
        '2010s': 'Lo llamaron "Cerrando Ciclos", pero \u00e9l no hab\u00eda terminado. Una memoria sobre crecer en una familia multiétnica. Una enciclopedia de cuatro vol\u00famenes. Una ciudad que nombr\u00f3 un premio en su honor. Poes\u00eda. Una columna sobre diversidad americana. El cuarto tiempo tiene su propio ritmo.',
        '2020s': 'Tiempo Zombie \u2014 porque \u00e9l se niega a parar. Una declaraci\u00f3n antirracista para Riverside. Un rol de consultor\u00eda en el museo Cheech. Trabajo cultural en El Gato con Botas: El \u00daltimo Deseo. Una novela debut a los 91. Y ahora, el Sal\u00f3n de la Fama del Educador Multiling\u00fce. La historia contin\u00faa.'
    },
    pt: {
        '1950s': 'Na Am\u00e9rica do p\u00f3s-guerra, um jovem de Kansas City embarcou em um caminho que moldaria como uma na\u00e7\u00e3o pensa sobre diversidade. De UC Berkeley \u00e0 Escola de Jornalismo de Columbia, do servi\u00e7o militar a uma reda\u00e7\u00e3o em Phoenix \u2014 cada passo foi prepara\u00e7\u00e3o para o caminho adiante.',
        '1960s': 'Pode-se dizer que os anos sessenta fizeram de Carlos Cort\u00e9s um historiador. Uma bolsa da Funda\u00e7\u00e3o Ford o levou ao Brasil. Um doutorado do Novo M\u00e9xico lhe deu as ferramentas. E em 1968, UC Riverside lhe deu um palco que duraria cinquenta e sete anos.',
        '1970s': 'A sala de aula se expandiu. Um cap\u00edtulo no livro de James Banks lan\u00e7ou uma carreira como palestrante nacional. Tr\u00eas s\u00e9ries de reimpress\u00e3o que ele editou preservaram vozes que os livros did\u00e1ticos ignoravam. E ele introduziu o conceito do "curr\u00edculo societal" \u2014 que a pr\u00f3pria sociedade \u00e9 um curr\u00edculo, ensinando li\u00e7\u00f5es que nenhuma escola jamais planejou.',
        '1980s': 'A essa altura, o mundo chamava. PBS queria document\u00e1rios. Harvard queria palestras. O Jap\u00e3o queria perspectiva. O Pr\u00eamio Distinto Humanista da Calif\u00f3rnia em 1980 sinalizou o que todos j\u00e1 sabiam: Carlos Cort\u00e9s havia se tornado um multiculturalista vers\u00e1til.',
        '1990s': 'Aposentou-se antecipadamente da UC em 1994 \u2014 e ent\u00e3o o verdadeiro trabalho come\u00e7ou. Institutos de ver\u00e3o em Harvard, o Instituto Executivo Federal, universidades australianas e o F\u00f3rum Multicultural do Prefeito de Riverside. Aposentadoria era apenas uma palavra.',
        '2000s': 'A televis\u00e3o infantil podia alcan\u00e7ar milh\u00f5es. Quando a Nickelodeon lhe pediu para assessorar Dora a Aventureira, ele viu uma oportunidade de moldar como toda uma gera\u00e7\u00e3o entendia a diferen\u00e7a cultural. O Pr\u00eamio NAACP Image em 2009 confirmou que o trabalho importava.',
        '2010s': 'Chamaram de "Desacelerando", mas ele n\u00e3o havia terminado. Uma mem\u00f3ria sobre crescer em uma fam\u00edlia multiétnica. Uma enciclop\u00e9dia de quatro volumes. Uma cidade que nomeou um pr\u00eamio em sua honra. Poesia. Uma coluna sobre diversidade americana. O quarto tempo tem seu pr\u00f3prio ritmo.',
        '2020s': 'Tempo Zumbi \u2014 porque ele se recusa a parar. Uma declara\u00e7\u00e3o antirracista para Riverside. Um papel de consultoria no museu Cheech. Trabalho cultural em Gato de Botas: O \u00daltimo Pedido. Um romance de estreia aos 91. E agora, o Hall da Fama do Educador Multil\u00edngue. A hist\u00f3ria continua.'
    }
};

function getEntryTranslations(lang) {
    if (lang === 'es') return ENTRIES_ES || {};
    if (lang === 'pt') return ENTRIES_PT || {};
    return {};
}

let currentLang = 'en';

function setLanguage(lang) {
    currentLang = lang;
    const strings = I18N[lang];
    if (!strings) return;

    // Update all data-i18n text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (strings[key]) {
            el.textContent = strings[key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (strings[key]) {
            el.placeholder = strings[key];
        }
    });

    // Update prompt chips (data-prompt attribute)
    document.querySelectorAll('[data-i18n-prompt]').forEach(el => {
        const key = el.dataset.i18nPrompt;
        if (strings[key]) {
            el.dataset.prompt = strings[key];
        }
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render narrative timeline and works with translations
    reRenderContent(lang);

    // Reset narrator and immediately narrate the visible decade in the new language
    if (window.narrator) {
        window.narrator.narrated.clear();
        window.narrator.stopCurrent();
        window.narrator.narrateVisibleDecade();
    }

    // Notify chat module
    if (typeof window.setChatLanguage === 'function') {
        window.setChatLanguage(lang);
    }
}

// Re-render dynamic content (narrative timeline, works, awards) in new language
function reRenderContent(lang) {
    const narrativeContainer = document.getElementById('narrative-timeline');
    const pubsGrid = document.getElementById('publications-grid');
    const awardsGrid = document.getElementById('awards-grid');

    if (narrativeContainer && state.data) {
        const nt = new NarrativeTimeline(narrativeContainer);
        nt.render(lang);
        // Re-observe scroll-reveal elements
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -60px 0px', threshold: 0.1 });
        narrativeContainer.querySelectorAll('.scroll-reveal').forEach(el => revealObserver.observe(el));
    }

    if (pubsGrid && state.data) {
        const wr = new WorksRenderer();
        wr.renderPublications(pubsGrid, lang);
    }

    if (awardsGrid && state.data) {
        const wr = new WorksRenderer();
        wr.renderAwards(awardsGrid, lang);
    }

    // Re-render SVG timeline theme labels
    document.querySelectorAll('.decade-theme-text').forEach(el => {
        const marker = el.closest('.decade-marker');
        if (!marker) return;
        const decade = marker.dataset.decade;
        if (lang === 'en') {
            const cfg = CONFIG.decades.find(d => d.key === decade);
            if (cfg) el.textContent = cfg.theme;
        } else if (DECADE_THEMES_I18N[lang]?.[decade]) {
            el.textContent = DECADE_THEMES_I18N[lang][decade];
        }
    });
}

function setupLanguageSwitcher() {
    const switcher = document.getElementById('lang-switcher');
    if (!switcher) return;

    switcher.addEventListener('click', (e) => {
        const btn = e.target.closest('.lang-btn');
        if (!btn) return;
        setLanguage(btn.dataset.lang);
    });
}

// ========== EVENT HANDLERS ==========
function setupEventHandlers() {
    // Search button
    document.getElementById('btn-search')?.addEventListener('click', () => {
        searchManager.open();
    });

    // Modal close buttons and overlays
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            searchManager.close();
        });
    });

    // Prevent modal container clicks from closing
    document.querySelectorAll('.modal-container').forEach(container => {
        container.addEventListener('click', (e) => e.stopPropagation());
    });

    // ESC closes search modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.activeModal) {
            searchManager.close();
        }
    });

    // Theme and language
    setupThemeToggle();
    setupLanguageSwitcher();
}

// ========== INITIALIZATION ==========
const dataLoader = new DataLoader();
const searchManager = new SearchManager();

async function init() {
    try {
        await dataLoader.load();

        // Render horizontal SVG timeline
        const timelineSvg = document.getElementById('timeline-svg');
        const timelineRenderer = new TimelineRenderer(timelineSvg);
        timelineRenderer.render();

        // Render vertical narrative timeline
        const narrativeContainer = document.getElementById('narrative-timeline');
        const narrativeTimeline = new NarrativeTimeline(narrativeContainer);
        narrativeTimeline.render();

        // Render selected works + awards
        const worksRenderer = new WorksRenderer();
        worksRenderer.renderPublications(document.getElementById('publications-grid'));
        worksRenderer.renderAwards(document.getElementById('awards-grid'));

        // Setup scroll manager (after DOM is populated)
        const scrollManager = new ScrollManager();
        scrollManager.init();

        // Setup timeline narrator (voice on scroll)
        const narrator = new TimelineNarrator();
        narrator.init();
        // Expose narrator globally so chat module can pause it
        window.narrator = narrator;

        // Setup event handlers
        setupEventHandlers();

        // Animate hero stats
        animateStatsCounters();

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1200);

    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
