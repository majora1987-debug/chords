/**
 * Viewer logic for The Red Ram chords application.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    // DOM Elements
    const elements = {
        songListContainer: document.getElementById('song-list-container'),
        searchInput: document.getElementById('song-search'),
        emptyState: document.getElementById('empty-state'),
        songListView: document.getElementById('song-list-view'),
        songDetailView: document.getElementById('song-detail-view'),
        appMain: document.querySelector('.app-main'),
        
        // Detail View Elements
        backBtn: document.getElementById('back-btn'),
        detailTitle: document.getElementById('detail-title'),
        detailKey: document.getElementById('detail-key'),
        chordChart: document.getElementById('chord-chart'),
        
        // Transpose
        transposeUpBtn: document.getElementById('transpose-up'),
        transposeDownBtn: document.getElementById('transpose-down'),
        transposeIndicator: document.getElementById('transpose-indicator'),

        // Text Size
        fontSizeDownBtn: document.getElementById('font-size-down'),
        fontSizeUpBtn: document.getElementById('font-size-up'),
        fontSizeIndicator: document.getElementById('font-size-indicator'),
    };

    // State
    const state = {
        songs: [],
        currentSong: null,
        currentTranspose: 0,
        originalKey: null,
        fontScale: parseFloat(localStorage.getItem('redram-font-scale')) || 1.0
    };

    // Apply text size scale to chord chart
    function applyFontScale() {
        if (elements.chordChart) {
            elements.chordChart.style.setProperty('--chord-font-scale', state.fontScale);
        }
        if (elements.fontSizeIndicator) {
            elements.fontSizeIndicator.textContent = Math.round(state.fontScale * 100) + '%';
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
        elements.searchInput.addEventListener('input', (e) => {
            renderSongList(e.target.value);
        });

        window.addEventListener('hashchange', handleRoute);

        elements.backBtn.addEventListener('click', () => {
            window.location.hash = '#/';
        });

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

        if (elements.fontSizeUpBtn) {
            elements.fontSizeUpBtn.addEventListener('click', () => {
                if (state.fontScale < 1.8) {
                    state.fontScale = Math.round((state.fontScale + 0.1) * 10) / 10;
                    applyFontScale();
                }
            });
        }

        if (elements.fontSizeDownBtn) {
            elements.fontSizeDownBtn.addEventListener('click', () => {
                if (state.fontScale > 0.6) {
                    state.fontScale = Math.round((state.fontScale - 0.1) * 10) / 10;
                    applyFontScale();
                }
            });
        }
    }

    // Fetch Songs
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

    // Render Song List
    function renderSongList(searchQuery = '') {
        const query = searchQuery.toLowerCase().trim();
        
        const filteredSongs = state.songs.filter(song => 
            song.title.toLowerCase().includes(query)
        );

        elements.songListContainer.innerHTML = '';

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
                card.innerHTML = `
                    <h3 class="song-title">${song.title}</h3>
                    <span class="badge">${song.key ? 'Key: ' + song.key : ''}</span>
                `;
                card.addEventListener('click', () => {
                    window.location.hash = `#/song/${song.slug}`;
                });
                elements.songListContainer.appendChild(card);
            });
        }
    }

    // Routing
    function handleRoute() {
        const hash = window.location.hash || '#/';
        
        if (hash.startsWith('#/song/')) {
            const slug = hash.replace('#/song/', '');
            loadSongDetail(slug);
        } else {
            showListView();
            loadSongs();
        }
    }

    function showListView() {
        state.currentSong = null;
        state.currentTranspose = 0;
        
        elements.appMain.classList.remove('detail-active');
        
        if (window.innerWidth > 768) {
            elements.songDetailView.style.display = 'none';
            elements.songListView.style.display = 'flex';
        } else {
            elements.songDetailView.style.display = '';
            elements.songListView.style.display = '';
        }
    }

    async function loadSongDetail(slug) {
        const songMeta = state.songs.find(s => s.slug === slug);
        if (!songMeta) {
            // Try loading fresh songs index if not found yet
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
            
        } catch (error) {
            console.error('Failed to load song detail', error);
            alert('Failed to load song details.');
            window.location.hash = '#/';
        }
    }

    function showDetailView() {
        elements.appMain.classList.add('detail-active');
        
        if (window.innerWidth > 768) {
            elements.songDetailView.style.display = 'flex';
            elements.songListView.style.display = 'flex'; 
        } else {
            elements.songDetailView.style.display = '';
            elements.songListView.style.display = '';
        }
    }

    function updateDetailView() {
        if (!state.currentSong) return;

        elements.detailTitle.textContent = state.currentSong.title;
        
        if (state.originalKey) {
            let displayKey = state.originalKey;
            if (window.ChordUtils && state.currentTranspose !== 0) {
                displayKey = window.ChordUtils.transposeChord(state.originalKey, state.currentTranspose);
            }
            elements.detailKey.style.display = '';
            elements.detailKey.textContent = `Key: ${displayKey}`;
        } else {
            // Check if chords were added dynamically
            const detected = window.ChordUtils ? window.ChordUtils.detectKey(state.currentSong) : '';
            if (detected) {
                state.originalKey = detected;
                let displayKey = detected;
                if (window.ChordUtils && state.currentTranspose !== 0) {
                    displayKey = window.ChordUtils.transposeChord(detected, state.currentTranspose);
                }
                elements.detailKey.style.display = '';
                elements.detailKey.textContent = `Key: ${displayKey}`;
            } else {
                elements.detailKey.style.display = 'none';
            }
        }
        
        elements.transposeIndicator.textContent = state.currentTranspose > 0 ? `+${state.currentTranspose}` : state.currentTranspose;

        if (window.ChordUtils && typeof window.ChordUtils.renderSong === 'function') {
            elements.chordChart.innerHTML = '';
            window.ChordUtils.renderSong(state.currentSong, elements.chordChart, {
                transpose: state.currentTranspose,
                editable: false
            });
            applyFontScale();
        } else {
            elements.chordChart.innerHTML = '<p>Error: ChordUtils not found or missing renderSong function.</p>';
        }
    }

    // Resize handler to fix display states if resizing between mobile and desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            elements.songListView.style.display = 'flex';
            if (state.currentSong) {
                elements.songDetailView.style.display = 'flex';
            } else {
                elements.songDetailView.style.display = 'none';
            }
        } else {
            elements.songListView.style.display = '';
            elements.songDetailView.style.display = '';
        }
    });

    // Start
    init();
});
