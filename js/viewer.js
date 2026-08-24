/**
 * js/viewer.js
 * Comprehensive Viewer Logic for The Red Ram chords application.
 * Ultra-modern, responsive, teleprompter, stage mode & accessibility.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize PWA
    if (window.UI && typeof window.UI.initPWA === 'function') {
        window.UI.initPWA();
    }

    // Set current year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    // DOM Elements
    const elements = {
        appMain: document.querySelector('.app-main'),
        songListView: document.getElementById('song-list-view'),
        welcomeView: document.getElementById('welcome-view'),
        songDetailView: document.getElementById('song-detail-view'),
        songListContainer: document.getElementById('song-list-container'),
        searchInput: document.getElementById('song-search'),
        searchCount: document.getElementById('search-count'),
        searchIconSlot: document.querySelector('.search-icon-slot'),
        emptyState: document.getElementById('empty-state'),
        
        // Detail View Elements
        backBtn: document.getElementById('back-btn'),
        backIconSlot: document.querySelector('.back-icon-slot'),
        detailTitle: document.getElementById('detail-title'),
        detailKey: document.getElementById('detail-key'),
        resetTransposeBtn: document.getElementById('reset-transpose-btn'),
        chordChart: document.getElementById('chord-chart'),
        noChordsNotice: document.getElementById('no-chords-notice'),
        editThisSongBtn: document.getElementById('edit-this-song-btn'),

        // Transpose
        transposeUpBtn: document.getElementById('transpose-up'),
        transposeDownBtn: document.getElementById('transpose-down'),
        transposeIndicator: document.getElementById('transpose-indicator'),

        // Text Size
        fontSizeDownBtn: document.getElementById('font-size-down'),
        fontSizeUpBtn: document.getElementById('font-size-up'),
        fontSizeResetBtn: document.getElementById('font-size-reset'),
        fontSizeIndicator: document.getElementById('font-size-indicator'),

        // Performance Mode
        perfModeBtn: document.getElementById('perf-mode-btn'),
        perfModeExitBtn: document.getElementById('perf-mode-exit-btn'),
        perfIconSlot: document.querySelector('.perf-icon-slot'),

        // Teleprompter / Auto-Scroll
        teleprompterDock: document.getElementById('teleprompter-dock'),
        teleprompterPlayBtn: document.getElementById('teleprompter-play-btn'),
        teleprompterSpeed: document.getElementById('teleprompter-speed'),
        speedIndicator: document.getElementById('speed-indicator'),
        teleprompterTopBtn: document.getElementById('teleprompter-top-btn'),

        // Song Navigation
        prevSongBtn: document.getElementById('prev-song-btn'),
        nextSongBtn: document.getElementById('next-song-btn'),
        prevSongTitle: document.getElementById('prev-song-title'),
        nextSongTitle: document.getElementById('next-song-title'),
        navIconPrev: document.querySelector('.nav-icon-prev'),
        navIconNext: document.querySelector('.nav-icon-next')
    };

    // Populate static SVG Icons
    if (window.UI && typeof window.UI.icon === 'function') {
        if (elements.searchIconSlot) elements.searchIconSlot.innerHTML = window.UI.icon('search');
        if (elements.backIconSlot) elements.backIconSlot.innerHTML = window.UI.icon('back');
        if (elements.resetTransposeBtn) elements.resetTransposeBtn.innerHTML = window.UI.icon('reset');
        if (elements.fontSizeResetBtn) elements.fontSizeResetBtn.innerHTML = window.UI.icon('reset');
        if (elements.perfIconSlot) elements.perfIconSlot.innerHTML = window.UI.icon('fullscreen');
        if (elements.teleprompterPlayBtn) elements.teleprompterPlayBtn.innerHTML = window.UI.icon('play');
        if (elements.teleprompterTopBtn) elements.teleprompterTopBtn.innerHTML = window.UI.icon('arrowUp');
        if (elements.navIconPrev) elements.navIconPrev.innerHTML = window.UI.icon('back');
        if (elements.navIconNext) elements.navIconNext.innerHTML = window.UI.icon('next');
    }

    // State
    const state = {
        songs: [],
        currentSong: null,
        currentSlug: null,
        currentTranspose: 0,
        originalKey: null,
        fontScale: parseFloat(localStorage.getItem('redram-font-scale')) || 1.0,
        isAutoScrolling: false,
        scrollSpeed: 1.0,
        scrollRafId: null,
        isPerformanceMode: false
    };

    // Apply text size scale to chord chart
    function applyFontScale() {
        if (elements.chordChart) {
            elements.chordChart.style.setProperty('--chord-font-scale', state.fontScale);
        }
        if (elements.fontSizeIndicator) {
            elements.fontSizeIndicator.textContent = Math.round(state.fontScale * 100) + '%';
        }
        if (elements.fontSizeDownBtn) {
            elements.fontSizeDownBtn.disabled = state.fontScale <= 0.6;
        }
        if (elements.fontSizeUpBtn) {
            elements.fontSizeUpBtn.disabled = state.fontScale >= 1.8;
        }
        localStorage.setItem('redram-font-scale', state.fontScale);
    }

    // Initialization
    async function init() {
        applyFontScale();
        setupEventListeners();
        await loadSongs();
        handleRoute();
    }

    // Event Listeners
    function setupEventListeners() {
        // Search Input with real-time substring filtering
        elements.searchInput.addEventListener('input', (e) => {
            renderSongList(e.target.value);
        });

        window.addEventListener('hashchange', handleRoute);

        elements.backBtn.addEventListener('click', () => {
            window.location.hash = '#/';
        });

        // Transpose Controls
        elements.transposeUpBtn.addEventListener('click', () => {
            if (state.currentSong) {
                state.currentTranspose++;
                updateDetailView();
            }
        });

        elements.transposeDownBtn.addEventListener('click', () => {
            if (state.currentSong) {
                state.currentTranspose--;
                updateDetailView();
            }
        });

        elements.resetTransposeBtn.addEventListener('click', () => {
            if (state.currentSong && state.currentTranspose !== 0) {
                state.currentTranspose = 0;
                updateDetailView();
                if (window.UI) window.UI.toast('Key reset to original', { type: 'info', duration: 2000 });
            }
        });

        // Font Size Controls
        elements.fontSizeUpBtn.addEventListener('click', () => {
            if (state.fontScale < 1.8) {
                state.fontScale = Math.round((state.fontScale + 0.1) * 10) / 10;
                applyFontScale();
            }
        });

        elements.fontSizeDownBtn.addEventListener('click', () => {
            if (state.fontScale > 0.6) {
                state.fontScale = Math.round((state.fontScale - 0.1) * 10) / 10;
                applyFontScale();
            }
        });

        elements.fontSizeResetBtn.addEventListener('click', () => {
            state.fontScale = 1.0;
            applyFontScale();
            if (window.UI) window.UI.toast('Text size reset to 100%', { type: 'info', duration: 2000 });
        });

        // Teleprompter / Auto-Scroll Controls
        elements.teleprompterPlayBtn.addEventListener('click', toggleAutoScroll);
        
        elements.teleprompterSpeed.addEventListener('input', (e) => {
            state.scrollSpeed = parseFloat(e.target.value);
            elements.speedIndicator.textContent = state.scrollSpeed.toFixed(1) + 'x';
        });

        elements.teleprompterTopBtn.addEventListener('click', () => {
            stopAutoScroll();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Pause auto-scroll when user manually wheels or touches screen
        window.addEventListener('wheel', (e) => {
            if (state.isAutoScrolling && Math.abs(e.deltaY) > 5) {
                stopAutoScroll();
            }
        }, { passive: true });

        // Performance / Stage Mode
        elements.perfModeBtn.addEventListener('click', togglePerformanceMode);
        elements.perfModeExitBtn.addEventListener('click', togglePerformanceMode);

        // Song Navigation Buttons
        elements.prevSongBtn.addEventListener('click', () => navigateSong(-1));
        elements.nextSongBtn.addEventListener('click', () => navigateSong(1));

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ignore when typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (e.code === 'Space' && state.currentSong) {
                e.preventDefault();
                toggleAutoScroll();
            } else if (e.key === 'Escape' && state.isPerformanceMode) {
                togglePerformanceMode();
            } else if (e.key === 'ArrowRight' && state.currentSong && !e.altKey && !e.metaKey) {
                navigateSong(1);
            } else if (e.key === 'ArrowLeft' && state.currentSong && !e.altKey && !e.metaKey) {
                navigateSong(-1);
            }
        });
    }

    // Load Songs from index.json
    async function loadSongs() {
        try {
            const response = await fetch('songs/index.json?t=' + Date.now());
            if (!response.ok) {
                throw new Error('No songs found or index missing');
            }
            const data = await response.json();
            state.songs = data.songs || [];
            renderSongList();
        } catch (error) {
            console.error('Error loading songs:', error);
            elements.songListContainer.innerHTML = '';
            elements.emptyState.style.display = 'block';
            elements.emptyState.innerHTML = '<p>No songs available yet.</p>';
        }
    }

    // Render Song List with match highlights and completeness badges
    function renderSongList(searchQuery = '') {
        const query = searchQuery.toLowerCase().trim();
        
        const filteredSongs = state.songs.filter(song => 
            song.title.toLowerCase().includes(query) || 
            (song.key && song.key.toLowerCase().includes(query))
        );

        elements.songListContainer.innerHTML = '';

        if (elements.searchCount) {
            elements.searchCount.textContent = searchQuery ? `${filteredSongs.length} match${filteredSongs.length === 1 ? '' : 'es'}` : `${state.songs.length} song${state.songs.length === 1 ? '' : 's'}`;
        }

        if (filteredSongs.length === 0) {
            elements.emptyState.style.display = 'block';
            if (state.songs.length > 0) {
                elements.emptyState.innerHTML = '<p>No songs match your search.</p>';
            }
        } else {
            elements.emptyState.style.display = 'none';
            filteredSongs.forEach(song => {
                const card = document.createElement('div');
                card.className = 'song-card';
                if (state.currentSlug === song.slug) {
                    card.classList.add('active-card');
                }

                const highlightedTitle = window.UI && typeof window.UI.highlightMatches === 'function'
                    ? window.UI.highlightMatches(song.title, searchQuery)
                    : song.title;

                const hasKey = song.key && song.key.trim().length > 0;
                const keyBadgeHtml = hasKey
                    ? `<span class="badge badge-key">Key: ${song.key}</span>`
                    : `<span class="badge badge-lyrics">Lyrics Only</span>`;

                card.innerHTML = `
                    <div class="song-card-title-group">
                        <h3 class="song-title">${highlightedTitle}</h3>
                    </div>
                    <div class="song-card-badges">
                        ${keyBadgeHtml}
                    </div>
                `;

                card.addEventListener('click', () => {
                    window.location.hash = `#/song/${song.slug}`;
                });
                elements.songListContainer.appendChild(card);
            });
        }
    }

    // Route Handler
    function handleRoute() {
        const hash = window.location.hash || '#/';
        
        if (hash.startsWith('#/song/')) {
            const slug = hash.replace('#/song/', '');
            state.currentSlug = slug;
            loadSongDetail(slug);
        } else {
            state.currentSlug = null;
            showListView();
        }
        renderSongList(elements.searchInput.value);
    }

    function showListView() {
        stopAutoScroll();
        state.currentSong = null;
        state.currentTranspose = 0;
        
        elements.appMain.classList.remove('detail-active');
        elements.teleprompterDock.classList.add('hidden');
        
        if (window.innerWidth > 860) {
            elements.songListView.style.display = 'flex';
            elements.welcomeView.style.display = 'flex';
            elements.songDetailView.style.display = 'none';
        } else {
            elements.songListView.style.display = '';
            elements.welcomeView.style.display = 'none';
            elements.songDetailView.style.display = 'none';
        }
    }

    async function loadSongDetail(slug) {
        const songMeta = state.songs.find(s => s.slug === slug);
        if (!songMeta) {
            await loadSongs();
            const recheck = state.songs.find(s => s.slug === slug);
            if (!recheck) {
                window.location.hash = '#/';
                return;
            }
            return loadSongDetail(slug);
        }

        try {
            const response = await fetch(`${songMeta.file}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Song file not found');
            const songData = await response.json();
            
            state.currentSong = songData;
            state.originalKey = songData.key || (window.ChordUtils ? window.ChordUtils.detectKey(songData) : '') || songMeta.key || '';
            state.currentTranspose = 0;
            
            showDetailView();
            updateDetailView();
            updateSongNavigation();
            
            // Scroll to top of song
            window.scrollTo({ top: 0, behavior: 'instant' });
            
        } catch (error) {
            console.error('Failed to load song detail', error);
            if (window.UI) {
                window.UI.toast('Failed to load song details.', { type: 'error' });
            } else {
                alert('Failed to load song details.');
            }
            window.location.hash = '#/';
        }
    }

    function showDetailView() {
        elements.appMain.classList.add('detail-active');
        elements.teleprompterDock.classList.remove('hidden');
        
        if (window.innerWidth > 860) {
            elements.songListView.style.display = 'flex';
            elements.welcomeView.style.display = 'none';
            elements.songDetailView.style.display = 'flex';
        } else {
            elements.songListView.style.display = '';
            elements.welcomeView.style.display = 'none';
            elements.songDetailView.style.display = 'flex';
        }
    }

    function updateDetailView() {
        if (!state.currentSong) return;

        elements.detailTitle.textContent = state.currentSong.title;
        
        // Key Calculation and Prominent Display
        let effectiveKey = state.originalKey;
        if (!effectiveKey && window.ChordUtils) {
            effectiveKey = window.ChordUtils.detectKey(state.currentSong);
        }

        if (effectiveKey) {
            let displayKey = effectiveKey;
            if (window.ChordUtils && state.currentTranspose !== 0) {
                displayKey = window.ChordUtils.transposeChord(effectiveKey, state.currentTranspose);
                elements.detailKey.textContent = `Key: ${displayKey} (${state.currentTranspose > 0 ? '+' : ''}${state.currentTranspose})`;
                elements.resetTransposeBtn.classList.remove('hidden');
            } else {
                elements.detailKey.textContent = `Key: ${displayKey}`;
                elements.resetTransposeBtn.classList.add('hidden');
            }
            elements.detailKey.style.display = '';
        } else {
            elements.detailKey.style.display = 'none';
            elements.resetTransposeBtn.classList.add('hidden');
        }
        
        elements.transposeIndicator.textContent = state.currentTranspose > 0 ? `+${state.currentTranspose}` : state.currentTranspose;

        // Check if song has chords
        const stats = window.ChordUtils ? window.ChordUtils.getSongStats(state.currentSong) : null;
        if (stats && !stats.hasChords) {
            elements.noChordsNotice.classList.remove('hidden');
            if (elements.editThisSongBtn) {
                elements.editThisSongBtn.href = `editor.html`;
            }
        } else {
            elements.noChordsNotice.classList.add('hidden');
        }

        // Render Chart
        if (window.ChordUtils && typeof window.ChordUtils.renderSong === 'function') {
            elements.chordChart.innerHTML = '';
            window.ChordUtils.renderSong(state.currentSong, elements.chordChart, {
                transpose: state.currentTranspose,
                editable: false
            });
            applyFontScale();
        }
    }

    // Prev / Next Navigation Logic
    function updateSongNavigation() {
        if (!state.songs || state.songs.length === 0 || !state.currentSlug) return;
        const currentIndex = state.songs.findIndex(s => s.slug === state.currentSlug);
        
        if (currentIndex > 0) {
            elements.prevSongBtn.disabled = false;
            elements.prevSongTitle.textContent = state.songs[currentIndex - 1].title;
        } else {
            elements.prevSongBtn.disabled = true;
            elements.prevSongTitle.textContent = 'Start of List';
        }

        if (currentIndex < state.songs.length - 1 && currentIndex >= 0) {
            elements.nextSongBtn.disabled = false;
            elements.nextSongTitle.textContent = state.songs[currentIndex + 1].title;
        } else {
            elements.nextSongBtn.disabled = true;
            elements.nextSongTitle.textContent = 'End of List';
        }
    }

    function navigateSong(direction) {
        if (!state.songs || state.songs.length === 0 || !state.currentSlug) return;
        const currentIndex = state.songs.findIndex(s => s.slug === state.currentSlug);
        const targetIndex = currentIndex + direction;
        if (targetIndex >= 0 && targetIndex < state.songs.length) {
            window.location.hash = `#/song/${state.songs[targetIndex].slug}`;
        }
    }

    // Teleprompter Auto-Scroll Engine
    function toggleAutoScroll() {
        if (state.isAutoScrolling) {
            stopAutoScroll();
        } else {
            startAutoScroll();
        }
    }

    function startAutoScroll() {
        state.isAutoScrolling = true;
        if (window.UI && typeof window.UI.icon === 'function') {
            elements.teleprompterPlayBtn.innerHTML = window.UI.icon('pause');
        }
        elements.teleprompterPlayBtn.title = "Pause Auto-Scroll (Spacebar)";

        let lastTimestamp = performance.now();

        function scrollStep(now) {
            if (!state.isAutoScrolling) return;

            const elapsed = now - lastTimestamp;
            lastTimestamp = now;

            // Pixels per second: base 35px/s * multiplier
            const pixelsToScroll = (35 * state.scrollSpeed) * (elapsed / 1000);
            window.scrollBy({ top: pixelsToScroll, behavior: 'instant' });

            // Stop when reaching page bottom
            if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 5)) {
                stopAutoScroll();
                if (window.UI) window.UI.toast('Reached end of song chart', { type: 'info', duration: 2500 });
                return;
            }

            state.scrollRafId = requestAnimationFrame(scrollStep);
        }

        state.scrollRafId = requestAnimationFrame(scrollStep);
    }

    function stopAutoScroll() {
        state.isAutoScrolling = false;
        if (state.scrollRafId) {
            cancelAnimationFrame(state.scrollRafId);
            state.scrollRafId = null;
        }
        if (window.UI && typeof window.UI.icon === 'function') {
            elements.teleprompterPlayBtn.innerHTML = window.UI.icon('play');
        }
        elements.teleprompterPlayBtn.title = "Start Auto-Scroll (Spacebar)";
    }

    // Performance / Stage Mode
    function togglePerformanceMode() {
        state.isPerformanceMode = !state.isPerformanceMode;
        document.body.classList.toggle('performance-mode', state.isPerformanceMode);
        
        if (state.isPerformanceMode) {
            elements.perfModeExitBtn.classList.remove('hidden');
            if (window.UI) {
                window.UI.toast('Entered Stage Performance Mode (Press ESC to exit)', { type: 'info', duration: 3000 });
            }
        } else {
            elements.perfModeExitBtn.classList.add('hidden');
        }
    }

    // Responsive Window Resize Handler
    window.addEventListener('resize', () => {
        if (window.innerWidth > 860) {
            elements.songListView.style.display = 'flex';
            if (state.currentSong) {
                elements.welcomeView.style.display = 'none';
                elements.songDetailView.style.display = 'flex';
            } else {
                elements.welcomeView.style.display = 'flex';
                elements.songDetailView.style.display = 'none';
            }
        } else {
            elements.songListView.style.display = '';
            elements.welcomeView.style.display = 'none';
            elements.songDetailView.style.display = '';
        }
    });

    // Run
    init();
});
