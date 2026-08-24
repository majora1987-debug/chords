// js/editor.js
// Comprehensive Studio Editor Logic for The Red Ram chords application.
// Undo/Redo, P0 Bug Fix, Modal Settings, Soft-Delete, Smart Chord Picker & Toast Notifications.

document.addEventListener('DOMContentLoaded', () => {
    // Security & Auth Gate (Salted SHA-256)
    const AUTH_SALT = 'redram-band-chords-2026';
    const EXPECTED_HASH = '014fb5c871aaf2685432bbab86d9a165fc06ec3d427d5e85f64af7fd8051bdba';

    const authGate = document.getElementById('auth-gate');
    const editorApp = document.getElementById('editor-app');
    const authForm = document.getElementById('auth-form');
    const adminPasswordInput = document.getElementById('admin-password-input');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const lockEditorBtn = document.getElementById('lock-editor-btn');

    async function hashPasscode(pwd) {
        const encoder = new TextEncoder();
        const data = encoder.encode(AUTH_SALT + pwd);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function checkAuth() {
        const currentToken = localStorage.getItem('redram-auth');
        if (currentToken === EXPECTED_HASH) {
            authGate.classList.add('hidden');
            editorApp.classList.remove('hidden');
            loadSettings();
            updateConnectionStatus();
            loadSongList();
        } else {
            authGate.classList.remove('hidden');
            editorApp.classList.add('hidden');
            if (adminPasswordInput) {
                adminPasswordInput.value = '';
                adminPasswordInput.focus();
            }
        }
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            authErrorMsg.classList.add('hidden');
            const inputVal = adminPasswordInput.value;
            const computedHash = await hashPasscode(inputVal);

            if (computedHash === EXPECTED_HASH) {
                localStorage.setItem('redram-auth', computedHash);
                checkAuth();
                if (window.UI) window.UI.toast('Welcome to The Red Ram Studio Editor', { type: 'success' });
            } else {
                authErrorMsg.classList.remove('hidden');
                adminPasswordInput.value = '';
                adminPasswordInput.focus();
            }
        });
    }

    if (lockEditorBtn) {
        lockEditorBtn.addEventListener('click', () => {
            localStorage.removeItem('redram-auth');
            checkAuth();
            if (window.UI) window.UI.toast('Editor locked', { type: 'info' });
        });
    }

    // State & History Stack
    let rawSongList = [];
    let currentSong = null;
    let currentSongSha = null;
    let activeChordTarget = null; // { type: 'word' | 'measure', si, li, wi/ci, el }

    // Undo / Redo History
    let historyStack = [];
    let historyIndex = -1;
    const MAX_HISTORY = 40;

    function pushHistoryState() {
        if (!currentSong) return;
        // Prune future if we branched
        if (historyIndex < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyIndex + 1);
        }
        historyStack.push(ChordUtils.cloneSong(currentSong));
        if (historyStack.length > MAX_HISTORY) {
            historyStack.shift();
        } else {
            historyIndex++;
        }
        updateHistoryButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            currentSong = ChordUtils.cloneSong(historyStack[historyIndex]);
            songTitleInput.value = currentSong.title || '';
            songKeyInput.value = currentSong.key || 'auto';
            updateKeyDropdownDisplay();
            renderCurrentSong(false);
            updateHistoryButtons();
            if (window.UI) window.UI.toast('Undo', { type: 'info', duration: 1500 });
        }
    }

    function redo() {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            currentSong = ChordUtils.cloneSong(historyStack[historyIndex]);
            songTitleInput.value = currentSong.title || '';
            songKeyInput.value = currentSong.key || 'auto';
            updateKeyDropdownDisplay();
            renderCurrentSong(false);
            updateHistoryButtons();
            if (window.UI) window.UI.toast('Redo', { type: 'info', duration: 1500 });
        }
    }

    function updateHistoryButtons() {
        if (undoBtn) undoBtn.disabled = historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
    }

    // Elements
    const ghConnStatus = document.getElementById('gh-conn-status');
    const settingsModal = document.getElementById('settings-modal');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    const viewList = document.getElementById('editor-song-list');
    const viewEditor = document.getElementById('editor-view');
    const songListContainer = document.getElementById('song-list-container');
    const editorSearchInput = document.getElementById('editor-search');
    const editorSortSelect = document.getElementById('editor-sort-select');
    const editorSongCount = document.getElementById('editor-song-count');
    const newSongBtn = document.getElementById('new-song-btn');

    const songTitleInput = document.getElementById('song-title');
    const songKeyInput = document.getElementById('song-key');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    const lyricsInput = document.getElementById('lyrics-input');
    const formatLyricsBtn = document.getElementById('format-lyrics-btn');
    const songRenderContainer = document.getElementById('song-render-container');
    
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveSongBtn = document.getElementById('save-song-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const saveStatus = document.getElementById('save-status');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const chordPicker = document.getElementById('chord-picker');
    const closePickerBtn = document.getElementById('close-picker-btn');
    const chordPreview = document.getElementById('chord-preview');
    const applyPickerBtn = document.getElementById('apply-picker-btn');
    const removeChordBtn = document.getElementById('remove-chord-btn');
    const rootBtns = document.querySelectorAll('.root-btn');
    const qualityBtns = document.querySelectorAll('.quality-btn');
    const customChordInput = document.getElementById('custom-chord-input');
    const applyCustomBtn = document.getElementById('apply-custom-btn');

    let selectedRoot = '';
    let selectedQuality = '';

    // Populate SVG Icon Slots
    if (window.UI && typeof window.UI.icon === 'function') {
        const backIcon = document.querySelector('.back-icon-slot');
        if (backIcon) backIcon.innerHTML = window.UI.icon('back');

        const settingsIcon = document.querySelector('.settings-icon-slot');
        if (settingsIcon) settingsIcon.innerHTML = window.UI.icon('settings');

        const lockIcon = document.querySelector('.lock-icon-slot');
        if (lockIcon) lockIcon.innerHTML = window.UI.icon('lock');

        const closeSettings = document.getElementById('close-settings-btn');
        if (closeSettings) closeSettings.innerHTML = window.UI.icon('close');

        const plusIcon = document.querySelector('.plus-icon-slot');
        if (plusIcon) plusIcon.innerHTML = window.UI.icon('plus');

        const searchIcon = document.querySelector('.search-icon-slot');
        if (searchIcon) searchIcon.innerHTML = window.UI.icon('search');

        const undoIcon = document.querySelector('.undo-icon-slot');
        if (undoIcon) undoIcon.innerHTML = window.UI.icon('undo');

        const redoIcon = document.querySelector('.redo-icon-slot');
        if (redoIcon) redoIcon.innerHTML = window.UI.icon('redo');

        const tabLyrics = document.querySelector('.tab-icon-lyrics');
        if (tabLyrics) tabLyrics.innerHTML = window.UI.icon('note');

        const tabGuitar = document.querySelector('.tab-icon-guitar');
        if (tabGuitar) tabGuitar.innerHTML = window.UI.icon('guitar');

        if (closePickerBtn) closePickerBtn.innerHTML = window.UI.icon('close');
    }

    // Settings Management
    function loadSettings() {
        const stored = localStorage.getItem('redram-editor-settings');
        if (stored) {
            const s = JSON.parse(stored);
            document.getElementById('gh-pat').value = s.pat || '';
            document.getElementById('gh-owner').value = s.owner || 'majora1987-debug';
            document.getElementById('gh-repo').value = s.repo || 'chords';
            document.getElementById('gh-branch').value = s.branch || 'main';
        }
    }

    function getSettings() {
        return {
            pat: (document.getElementById('gh-pat').value || '').trim(),
            owner: (document.getElementById('gh-owner').value || 'majora1987-debug').trim(),
            repo: (document.getElementById('gh-repo').value || 'chords').trim(),
            branch: (document.getElementById('gh-branch').value || 'main').trim(),
        };
    }

    function updateConnectionStatus() {
        const s = getSettings();
        if (ghConnStatus) {
            const dot = ghConnStatus.querySelector('.status-dot');
            const text = ghConnStatus.querySelector('.status-text');
            if (s.pat) {
                dot.className = 'status-dot connected';
                text.textContent = 'GitHub Connected';
            } else {
                dot.className = 'status-dot disconnected';
                text.textContent = 'PAT Not Set';
            }
        }
    }

    function saveSettings() {
        const s = getSettings();
        localStorage.setItem('redram-editor-settings', JSON.stringify(s));
        updateConnectionStatus();
        settingsModal.classList.add('hidden');
        if (window.UI) window.UI.toast('GitHub settings saved!', { type: 'success' });
        loadSongList();
    }

    toggleSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    // GitHub API Helper with Cache-Busting
    async function githubApi(method, path, body = null) {
        const s = getSettings();
        const cleanPat = (s.pat || '').trim().replace(/^['"]|['"]$/g, '');
        if (!cleanPat) {
            throw new Error("GitHub PAT not configured. Click ⚙️ Settings at the top to configure your Personal Access Token.");
        }
        
        const url = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${path}`;
        const headers = {
            'Authorization': `Bearer ${cleanPat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        };

        const config = { method, headers };
        if (body) {
            body.branch = s.branch;
            Object.keys(body).forEach(key => {
                if (body[key] === null || body[key] === undefined) {
                    delete body[key];
                }
            });
            config.body = JSON.stringify(body);
        } else if (method === 'GET' || method === 'DELETE') {
            const urlObj = new URL(url);
            urlObj.searchParams.append('ref', s.branch);
            urlObj.searchParams.append('_t', Date.now().toString());
            config.url = urlObj.toString();
        }

        const fetchUrl = config.url || url;
        const res = await fetch(fetchUrl, config);
        
        if (!res.ok) {
            if (res.status === 404) return null;
            if (res.status === 401) {
                throw new Error("GitHub Authentication Failed (401 Bad Credentials): Please verify your PAT in Settings.");
            }
            const errText = await res.text();
            const err = new Error(`GitHub API Error (${res.status}): ${errText}`);
            err.status = res.status;
            throw err;
        }
        
        return await res.json();
    }

    // Load Index
    async function getIndexJson() {
        try {
            const res = await fetch('songs/index.json?t=' + Date.now());
            if (res.ok) {
                const parsed = await res.json();
                const songs = Array.isArray(parsed) ? parsed : (parsed.songs || []);
                return { songs, sha: null };
            }
        } catch (e) {
            console.log('Local fetch songs/index.json failed:', e);
        }

        const s = getSettings();
        if (s.pat) {
            const data = await githubApi('GET', 'songs/index.json');
            if (data) {
                const content = decodeURIComponent(escape(atob(data.content)));
                const parsed = JSON.parse(content);
                const songs = Array.isArray(parsed) ? parsed : (parsed.songs || []);
                return { songs, sha: data.sha };
            }
        }

        return { songs: [], sha: null };
    }

    async function loadSongList() {
        songListContainer.innerHTML = '';
        document.getElementById('loading-songs').classList.remove('hidden');
        try {
            const indexData = await getIndexJson();
            rawSongList = indexData.songs || [];
            document.getElementById('loading-songs').classList.add('hidden');
            renderEditorSongGrid();
        } catch (e) {
            document.getElementById('loading-songs').classList.add('hidden');
            songListContainer.innerHTML = `<p style="color:#c0392b">Error loading repertoire: ${e.message}</p>`;
        }
    }

    function renderEditorSongGrid() {
        const query = (editorSearchInput ? editorSearchInput.value : '').toLowerCase().trim();
        const sortMode = editorSortSelect ? editorSortSelect.value : 'title-asc';

        let filtered = rawSongList.filter(s => 
            s.title.toLowerCase().includes(query) || 
            (s.key && s.key.toLowerCase().includes(query))
        );

        if (sortMode === 'title-asc') {
            filtered.sort((a,b) => a.title.localeCompare(b.title));
        } else if (sortMode === 'title-desc') {
            filtered.sort((a,b) => b.title.localeCompare(a.title));
        } else if (sortMode === 'key') {
            filtered.sort((a,b) => (a.key || 'Z').localeCompare(b.key || 'Z'));
        }

        if (editorSongCount) {
            editorSongCount.textContent = `${filtered.length} song${filtered.length === 1 ? '' : 's'}`;
        }

        songListContainer.innerHTML = '';
        if (filtered.length === 0) {
            songListContainer.innerHTML = '<p class="empty-msg">No songs match your search. Click "New Song" to add one!</p>';
            return;
        }

        filtered.forEach(s => {
            const card = document.createElement('div');
            card.className = 'song-card';
            
            const highlightedTitle = window.UI && typeof window.UI.highlightMatches === 'function'
                ? window.UI.highlightMatches(s.title, query)
                : s.title;

            card.innerHTML = `
                <div class="song-info">
                    <strong>${highlightedTitle}</strong>
                    ${s.key ? `<span class="badge badge-key">Key: ${s.key}</span>` : '<span class="badge badge-lyrics">Key not set</span>'}
                </div>
                <div class="song-card-actions">
                    <button class="btn btn-sm secondary-btn edit-btn" data-slug="${s.slug}">Edit</button>
                    <button class="btn btn-sm danger-btn delete-btn" data-slug="${s.slug}">Delete</button>
                </div>
            `;
            songListContainer.appendChild(card);
        });

        // Bind events
        songListContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => editSong(e.currentTarget.dataset.slug));
        });
        songListContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSongFromList(e.currentTarget.dataset.slug));
        });
    }

    if (editorSearchInput) {
        editorSearchInput.addEventListener('input', renderEditorSongGrid);
    }
    if (editorSortSelect) {
        editorSortSelect.addEventListener('change', renderEditorSongGrid);
    }

    async function editSong(slug) {
        try {
            let songData = null;
            let sha = null;

            try {
                const res = await fetch(`songs/${slug}.json?t=` + Date.now());
                if (res.ok) {
                    songData = await res.json();
                }
            } catch (e) {
                console.log('Local fetch failed for song:', slug);
            }

            const s = getSettings();
            if (!songData && s.pat) {
                const data = await githubApi('GET', `songs/${slug}.json`);
                if (data) {
                    const content = decodeURIComponent(escape(atob(data.content)));
                    songData = JSON.parse(content);
                    sha = data.sha;
                }
            }

            if (!songData) {
                throw new Error("Song file could not be loaded.");
            }
            
            currentSong = songData;
            currentSongSha = sha;

            // Reset history
            historyStack = [ChordUtils.cloneSong(currentSong)];
            historyIndex = 0;
            updateHistoryButtons();
            
            showEditorView();
            songTitleInput.value = currentSong.title || '';
            songKeyInput.value = currentSong.key || 'auto';
            updateKeyDropdownDisplay();
            
            switchTab('edit-mode');
            renderCurrentSong(false);
        } catch (e) {
            if (window.UI) window.UI.toast(`Failed to load song: ${e.message}`, { type: 'error' });
            else alert(`Failed to load song: ${e.message}`);
        }
    }

    async function deleteSongFromList(slug) {
        const s = getSettings();
        if (!s.pat) {
            if (window.UI) {
                window.UI.toast('Please configure your GitHub PAT in Settings to delete from repo.', { type: 'warning' });
            }
            settingsModal.classList.remove('hidden');
            return;
        }

        let confirmed = false;
        if (window.UI && typeof window.UI.confirm === 'function') {
            confirmed = await window.UI.confirm('Delete Song', `Are you sure you want to delete "${slug}"? This removes the chart from GitHub.`, true);
        } else {
            confirmed = confirm(`Are you sure you want to delete "${slug}"?`);
        }

        if (!confirmed) return;
        
        try {
            const fileData = await githubApi('GET', `songs/${slug}.json`);
            if (fileData && fileData.sha) {
                await githubApi('DELETE', `songs/${slug}.json`, {
                    message: `Delete song ${slug}`,
                    sha: fileData.sha
                });
            }

            let indexSongs = [];
            let indexSha = null;
            try {
                const liveIndexData = await githubApi('GET', 'songs/index.json');
                if (liveIndexData) {
                    indexSha = liveIndexData.sha;
                    if (liveIndexData.content) {
                        const raw = decodeURIComponent(escape(atob(liveIndexData.content.replace(/\s/g, ''))));
                        const parsed = JSON.parse(raw);
                        indexSongs = Array.isArray(parsed) ? parsed : (parsed.songs || []);
                    }
                }
            } catch (err) {
                const localIndex = await getIndexJson();
                indexSongs = localIndex.songs || [];
            }

            const updatedSongs = indexSongs.filter(item => item.slug !== slug);
            const indexContent = JSON.stringify({ songs: updatedSongs }, null, 2);
            const indexPutBody = {
                message: `Update index after deleting ${slug}`,
                content: btoa(unescape(encodeURIComponent(indexContent)))
            };
            if (indexSha) {
                indexPutBody.sha = indexSha;
            }

            await githubApi('PUT', 'songs/index.json', indexPutBody);
            if (window.UI) window.UI.toast(`Deleted "${slug}" from GitHub`, { type: 'success' });
            loadSongList();
        } catch (e) {
            if (window.UI) window.UI.toast(`Delete error: ${e.message}`, { type: 'error' });
            else alert(`Failed to delete song: ${e.message}`);
        }
    }

    function updateKeyDropdownDisplay() {
        if (!currentSong) return;
        const detected = ChordUtils.detectKey(currentSong);
        const autoOption = songKeyInput.querySelector('option[value="auto"]');
        if (autoOption) {
            autoOption.textContent = detected ? `✨ Auto-detect (${detected})` : '✨ Auto-detect from chords';
        }
        if (songKeyInput.value === 'auto' || !songKeyInput.value) {
            currentSong.key = detected || '';
        } else {
            currentSong.key = songKeyInput.value;
        }
    }

    songKeyInput.addEventListener('change', () => {
        updateKeyDropdownDisplay();
        pushHistoryState();
    });

    songTitleInput.addEventListener('input', () => {
        if (currentSong) {
            currentSong.title = songTitleInput.value;
        }
    });

    // Undo / Redo Click Handlers & Keyboard Shortcuts
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
                e.preventDefault();
                redo();
            } else {
                e.preventDefault();
                undo();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        } else if (e.key === 'Escape') {
            closePicker();
            settingsModal.classList.add('hidden');
        }
    });

    function syncLyricsInputToSong() {
        if (!currentSong) return;
        const text = (lyricsInput ? lyricsInput.value : '').trim();
        if (text) {
            currentSong.sections = ChordUtils.parseLyrics(text);
        }
    }

    function downloadCurrentSongJson() {
        if (!currentSong) return;
        const isInputTab = document.getElementById('input-mode') && document.getElementById('input-mode').classList.contains('active-tab');
        if (isInputTab || (lyricsInput && lyricsInput.value.trim())) {
            syncLyricsInputToSong();
        }

        currentSong.title = songTitleInput.value.trim() || 'Untitled';
        
        const selectedKey = songKeyInput.value;
        currentSong.key = (selectedKey === 'auto' || !selectedKey) 
            ? (ChordUtils.detectKey(currentSong) || '') 
            : selectedKey;
            
        const slug = ChordUtils.slugify(currentSong.title);
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSong, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `${slug}.json`);
        dlAnchorElem.click();
        if (window.UI) window.UI.toast(`Downloaded ${slug}.json`, { type: 'success' });
    }

    async function saveCurrentSong() {
        if (!currentSong) return;
        
        // Auto-sync from Text Mode textarea if lyrics were typed
        const isInputTab = document.getElementById('input-mode') && document.getElementById('input-mode').classList.contains('active-tab');
        if (isInputTab || (lyricsInput && lyricsInput.value.trim())) {
            syncLyricsInputToSong();
        }

        currentSong.title = songTitleInput.value.trim() || 'Untitled';
        const selectedKey = songKeyInput.value;
        currentSong.key = (selectedKey === 'auto' || !selectedKey) 
            ? (ChordUtils.detectKey(currentSong) || '') 
            : selectedKey;

        const slug = ChordUtils.slugify(currentSong.title);

        const s = getSettings();
        if (!s.pat) {
            saveStatus.innerHTML = '<span style="color:#c0392b">⚠️ PAT not set. Configure in ⚙️ Settings, or use "Download JSON".</span>';
            settingsModal.classList.remove('hidden');
            return;
        }
        
        saveStatus.textContent = 'Saving to GitHub...';
        saveStatus.style.color = '#666';
        saveSongBtn.disabled = true;

        try {
            const songContent = JSON.stringify(currentSong, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(songContent)));
            
            // 1. Save Song File with automatic conflict retry
            let songSaved = false;
            let songAttempts = 0;
            const maxAttempts = 3;

            while (!songSaved && songAttempts < maxAttempts) {
                songAttempts++;
                try {
                    let fileSha = currentSongSha;
                    try {
                        const existing = await githubApi('GET', `songs/${slug}.json`);
                        if (existing && existing.sha) {
                            fileSha = existing.sha;
                        }
                    } catch (err) {
                        console.log('No existing song file on GitHub:', err);
                    }

                    const putBody = {
                        message: `Update song ${currentSong.title}`,
                        content: encodedContent
                    };
                    if (fileSha) {
                        putBody.sha = fileSha;
                    }

                    const saveRes = await githubApi('PUT', `songs/${slug}.json`, putBody);
                    if (saveRes && saveRes.content && saveRes.content.sha) {
                        currentSongSha = saveRes.content.sha;
                    }
                    songSaved = true;
                } catch (songErr) {
                    if (songErr.status === 409 && songAttempts < maxAttempts) {
                        console.log(`Song file conflict (409), retrying attempt ${songAttempts + 1}...`);
                        await new Promise(r => setTimeout(r, 400));
                    } else {
                        throw songErr;
                    }
                }
            }

            // 2. Resilient Index Update with 409 Conflict Retry
            let indexSaved = false;
            let indexAttempts = 0;

            while (!indexSaved && indexAttempts < maxAttempts) {
                indexAttempts++;
                try {
                    let indexSongs = [];
                    let indexSha = null;

                    const liveIndexData = await githubApi('GET', 'songs/index.json');
                    if (liveIndexData) {
                        indexSha = liveIndexData.sha;
                        if (liveIndexData.content) {
                            const raw = decodeURIComponent(escape(atob(liveIndexData.content.replace(/\s/g, ''))));
                            const parsed = JSON.parse(raw);
                            indexSongs = Array.isArray(parsed) ? parsed : (parsed.songs || []);
                        }
                    } else {
                        const localIndex = await getIndexJson();
                        indexSongs = localIndex.songs || [];
                    }

                    const indexEntry = {
                        title: currentSong.title,
                        slug: slug,
                        key: currentSong.key,
                        file: `songs/${slug}.json`,
                        artist: currentSong.artist || 'The Red Ram'
                    };

                    const existingIdx = indexSongs.findIndex(item => item.slug === slug);
                    if (existingIdx >= 0) {
                        indexSongs[existingIdx] = indexEntry;
                    } else {
                        indexSongs.push(indexEntry);
                        indexSongs.sort((a,b) => a.title.localeCompare(b.title));
                    }

                    const indexPayload = JSON.stringify({ songs: indexSongs }, null, 2);
                    const indexPutBody = {
                        message: `Update index for ${currentSong.title}`,
                        content: btoa(unescape(encodeURIComponent(indexPayload)))
                    };
                    if (indexSha) {
                        indexPutBody.sha = indexSha;
                    }

                    await githubApi('PUT', 'songs/index.json', indexPutBody);
                    indexSaved = true;
                } catch (indexErr) {
                    if (indexErr.status === 409 && indexAttempts < maxAttempts) {
                        console.log(`Index update conflict (409), retrying attempt ${indexAttempts + 1}...`);
                        await new Promise(r => setTimeout(r, 400));
                    } else {
                        throw indexErr;
                    }
                }
            }

            saveStatus.textContent = '✅ Saved to GitHub successfully!';
            saveStatus.style.color = '#27ae60';
            if (window.UI) window.UI.toast(`Saved "${currentSong.title}" to GitHub`, { type: 'success' });
            setTimeout(() => saveStatus.textContent = '', 4000);
        } catch (e) {
            saveStatus.textContent = `Error: ${e.message}`;
            saveStatus.style.color = '#c0392b';
            if (window.UI) window.UI.toast(`Save error: ${e.message}`, { type: 'error' });
        } finally {
            saveSongBtn.disabled = false;
        }
    }

    // Views
    function showListView() {
        viewList.classList.remove('hidden');
        viewEditor.classList.add('hidden');
        loadSongList();
    }

    function showEditorView() {
        viewList.classList.add('hidden');
        viewEditor.classList.remove('hidden');
        saveStatus.textContent = '';
    }

    newSongBtn.addEventListener('click', () => {
        currentSong = ChordUtils.createSong('', '');
        currentSongSha = null;
        historyStack = [ChordUtils.cloneSong(currentSong)];
        historyIndex = 0;
        updateHistoryButtons();

        songTitleInput.value = '';
        songKeyInput.value = 'auto';
        updateKeyDropdownDisplay();
        lyricsInput.value = '';
        songRenderContainer.innerHTML = '';
        showEditorView();
        switchTab('input-mode');
    });

    cancelEditBtn.addEventListener('click', showListView);
    saveSongBtn.addEventListener('click', saveCurrentSong);
    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', downloadCurrentSongJson);
    }

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.target);
        });
    });

    function switchTab(targetId) {
        const wasInputMode = document.getElementById('input-mode') && document.getElementById('input-mode').classList.contains('active-tab');
        
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
        tabContents.forEach(c => {
            if (c.id === targetId) {
                c.classList.add('active-tab');
            } else {
                c.classList.remove('active-tab');
            }
        });
        
        if (targetId === 'input-mode' && currentSong) {
            lyricsInput.value = ChordUtils.songToText(currentSong, true);
        } else if (targetId === 'edit-mode' && currentSong) {
            if (wasInputMode && lyricsInput.value.trim()) {
                syncLyricsInputToSong();
            }
            renderCurrentSong(false);
        }
    }

    // Lyrics Input Mode Format Action
    formatLyricsBtn.addEventListener('click', () => {
        const text = lyricsInput.value.trim();
        if (!text) {
            if (window.UI) window.UI.toast("Please enter lyrics or ChordPro text first.", { type: 'warning' });
            else alert("Please enter some lyrics first.");
            return;
        }
        
        const title = songTitleInput.value.trim() || (currentSong ? currentSong.title : 'Untitled');
        const key = songKeyInput.value;
        
        if (!currentSong) {
            currentSong = ChordUtils.createSong(title, key);
        }
        currentSong.title = title;
        currentSong.key = key;
        currentSong.sections = ChordUtils.parseLyrics(text);
        
        pushHistoryState();
        switchTab('edit-mode');
        if (window.UI) window.UI.toast('Formatted lyrics into Visual Chord Editor', { type: 'success' });
    });

    // Top Insert Controls
    const addTopChordBarBtn = document.getElementById('add-top-chord-bar-btn');
    if (addTopChordBarBtn) {
        addTopChordBarBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections || currentSong.sections.length === 0) {
                currentSong.sections = [{ label: 'Intro', lines: [] }];
            }
            if (!currentSong.sections[0].lines) currentSong.sections[0].lines = [];
            currentSong.sections[0].lines.unshift({
                type: 'chords',
                chords: [{ chord: 'G' }, { chord: 'Em' }, { chord: 'C' }, { chord: 'D' }],
                comment: '(x2)',
                lyrics: ''
            });
            pushHistoryState();
            renderCurrentSong(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const addTopLyricsBtn = document.getElementById('add-top-lyrics-btn');
    if (addTopLyricsBtn) {
        addTopLyricsBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections || currentSong.sections.length === 0) {
                currentSong.sections = [{ label: 'Verse 1', lines: [] }];
            }
            if (!currentSong.sections[0].lines) currentSong.sections[0].lines = [];
            currentSong.sections[0].lines.unshift({
                lyrics: 'New lyrics line',
                chords: []
            });
            pushHistoryState();
            renderCurrentSong(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const addTopSecBtn = document.getElementById('add-top-sec-btn');
    if (addTopSecBtn) {
        addTopSecBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections) currentSong.sections = [];
            currentSong.sections.unshift({
                label: 'Intro',
                lines: [{
                    type: 'chords',
                    chords: [{ chord: 'G' }, { chord: 'C' }],
                    comment: '',
                    lyrics: ''
                }]
            });
            pushHistoryState();
            renderCurrentSong(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // P0 BUG FIX: Bottom "+ Add Section" & "+ Add Instrumental Block" buttons APPEND (push) to end of song!
    const addSectionBtn = document.getElementById('add-section-btn');
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections) currentSong.sections = [];
            currentSong.sections.push({
                label: 'Chorus',
                lines: [{ lyrics: 'New lyrics line', chords: [] }]
            });
            pushHistoryState();
            renderCurrentSong(false);
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        });
    }

    const addInstSecBtn = document.getElementById('add-instrumental-sec-btn');
    if (addInstSecBtn) {
        addInstSecBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections) currentSong.sections = [];
            currentSong.sections.push({
                label: 'Solo',
                lines: [{
                    type: 'chords',
                    chords: [{ chord: 'G' }, { chord: 'Em' }, { chord: 'C' }, { chord: 'D' }],
                    comment: '(x2)',
                    lyrics: ''
                }]
            });
            pushHistoryState();
            renderCurrentSong(false);
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        });
    }

    const mergeSectionsBtn = document.getElementById('merge-sections-btn');
    if (mergeSectionsBtn) {
        mergeSectionsBtn.addEventListener('click', async () => {
            if (!currentSong || !currentSong.sections || currentSong.sections.length <= 1) {
                if (window.UI) window.UI.toast('Song is already a single continuous section.', { type: 'info' });
                return;
            }
            let confirmed = false;
            if (window.UI && typeof window.UI.confirm === 'function') {
                confirmed = await window.UI.confirm('Merge All Sections', 'Combine all sections into one continuous block? (All lyrics and chords will be kept)', false);
            } else {
                confirmed = confirm('Merge all sections into one continuous block?');
            }
            if (confirmed) {
                ChordUtils.mergeAllSections(currentSong);
                pushHistoryState();
                renderCurrentSong(false);
            }
        });
    }

    // Editor Rendering
    function renderCurrentSong(recordHistory = true) {
        if (!currentSong) return;
        if (recordHistory) {
            pushHistoryState();
        }
        songRenderContainer.innerHTML = '';
        ChordUtils.renderSong(currentSong, songRenderContainer, {
            editable: true,
            onWordClick: handleWordClick,
            onMeasureChordClick: handleMeasureChordClick,
            onSongChanged: () => {
                updateKeyDropdownDisplay();
                pushHistoryState();
            }
        });
    }

    // Chord Picker Interactions
    function handleWordClick(si, li, wi, slotEl) {
        activeChordTarget = { type: 'word', si, li, wi, el: slotEl };
        
        document.querySelectorAll('.chord-word, .chord-measure-box').forEach(el => el.classList.remove('active-word', 'active-measure'));
        const wordEl = slotEl.closest('.chord-word');
        if (wordEl) wordEl.classList.add('active-word');

        const section = currentSong.sections[si];
        if (!section || !section.lines || !section.lines[li]) return;
        if (!section.lines[li].chords) section.lines[li].chords = [];

        const existingChordObj = section.lines[li].chords.find(c => c.wordIndex === wi);
        
        if (existingChordObj) {
            parseExistingChord(existingChordObj.chord);
            removeChordBtn.classList.remove('hidden');
        } else {
            selectedRoot = '';
            selectedQuality = '';
            customChordInput.value = '';
            removeChordBtn.classList.add('hidden');
        }
        
        updatePickerUI();
        positionPicker(slotEl);
    }

    function handleMeasureChordClick(si, li, ci, boxEl) {
        activeChordTarget = { type: 'measure', si, li, ci, el: boxEl };

        document.querySelectorAll('.chord-word, .chord-measure-box').forEach(el => el.classList.remove('active-word', 'active-measure'));
        boxEl.classList.add('active-measure');

        const section = currentSong.sections[si];
        if (!section || !section.lines || !section.lines[li]) return;
        const line = section.lines[li];
        if (!line.chords) line.chords = [];

        const chordObj = line.chords[ci];
        if (chordObj && chordObj.chord) {
            parseExistingChord(chordObj.chord);
            removeChordBtn.classList.remove('hidden');
        } else {
            selectedRoot = '';
            selectedQuality = '';
            customChordInput.value = '';
            removeChordBtn.classList.add('hidden');
        }

        updatePickerUI();
        positionPicker(boxEl);
    }

    // Smart Viewport Positioning with Bottom-Overflow Detection
    function positionPicker(targetEl) {
        if (window.innerWidth <= 600) {
            chordPicker.classList.remove('hidden');
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const pickerHeight = 360;
        let top = window.scrollY + rect.bottom + 10;
        
        // Flip above if overflowing bottom
        if (rect.bottom + pickerHeight > window.innerHeight && rect.top > pickerHeight) {
            top = window.scrollY + rect.top - pickerHeight - 10;
        }

        chordPicker.style.top = `${Math.max(10, top)}px`;
        let left = rect.left;
        if (left + 330 > window.innerWidth) {
            left = window.innerWidth - 340;
        }
        chordPicker.style.left = `${Math.max(10, left)}px`;
        chordPicker.classList.remove('hidden');
    }

    function parseExistingChord(chordStr) {
        let foundRoot = '';
        let foundQuality = '';
        
        if (chordStr.length >= 2 && ['#','b'].includes(chordStr[1])) {
            foundRoot = chordStr.substring(0, 2);
            foundQuality = chordStr.substring(2);
        } else {
            foundRoot = chordStr.substring(0, 1);
            foundQuality = chordStr.substring(1);
        }

        let isStandard = false;
        rootBtns.forEach(btn => {
            if (btn.dataset.val === foundRoot) isStandard = true;
        });

        if (isStandard) {
            selectedRoot = foundRoot;
            selectedQuality = foundQuality;
            customChordInput.value = '';
        } else {
            selectedRoot = '';
            selectedQuality = '';
            customChordInput.value = chordStr;
        }
    }

    function updatePickerUI() {
        rootBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.val === selectedRoot));
        qualityBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.val === selectedQuality));
        
        if (selectedRoot) {
            chordPreview.textContent = selectedRoot + selectedQuality;
        } else if (customChordInput.value) {
            chordPreview.textContent = customChordInput.value;
        } else {
            chordPreview.textContent = 'Select Chord';
        }
    }

    rootBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRoot = btn.dataset.val;
            if (selectedQuality === '') selectedQuality = ''; // Default Major
            customChordInput.value = '';
            updatePickerUI();
        });
    });

    qualityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedQuality = btn.dataset.val;
            customChordInput.value = '';
            updatePickerUI();
            
            if (selectedRoot) {
                applyChord(selectedRoot + selectedQuality);
            }
        });
    });

    applyCustomBtn.addEventListener('click', () => {
        const val = customChordInput.value.trim();
        if (val) applyChord(val);
    });
    
    applyPickerBtn.addEventListener('click', () => {
        const chord = selectedRoot ? selectedRoot + selectedQuality : customChordInput.value.trim();
        if (chord) applyChord(chord);
    });

    function applyChord(chordStr) {
        if (!activeChordTarget) return;
        const { type, si, li } = activeChordTarget;
        const section = currentSong.sections[si];
        if (!section || !section.lines || !section.lines[li]) return;
        const line = section.lines[li];
        if (!line.chords) line.chords = [];

        if (type === 'word') {
            const wi = activeChordTarget.wi;
            const existingIdx = line.chords.findIndex(c => c.wordIndex === wi);
            if (existingIdx >= 0) {
                line.chords[existingIdx].chord = chordStr;
            } else {
                line.chords.push({ wordIndex: wi, chord: chordStr });
            }
        } else if (type === 'measure') {
            const ci = activeChordTarget.ci;
            if (line.chords[ci]) {
                line.chords[ci].chord = chordStr;
            } else {
                line.chords.push({ chord: chordStr });
            }
        }
        
        closePicker();
        updateKeyDropdownDisplay();
        renderCurrentSong(true);
    }

    removeChordBtn.addEventListener('click', () => {
        if (!activeChordTarget) return;
        const { type, si, li } = activeChordTarget;
        const section = currentSong.sections[si];
        if (!section || !section.lines || !section.lines[li]) return;
        const line = section.lines[li];

        if (type === 'word') {
            const wi = activeChordTarget.wi;
            line.chords = (line.chords || []).filter(c => c.wordIndex !== wi);
        } else if (type === 'measure') {
            const ci = activeChordTarget.ci;
            if (line.chords) {
                line.chords.splice(ci, 1);
                if (line.chords.length === 0) {
                    section.lines.splice(li, 1);
                    if (section.lines.length === 0 && currentSong.sections.length > 1) {
                        currentSong.sections.splice(si, 1);
                    }
                }
            }
        }
        
        closePicker();
        updateKeyDropdownDisplay();
        renderCurrentSong(true);
    });

    closePickerBtn.addEventListener('click', closePicker);

    function closePicker() {
        chordPicker.classList.add('hidden');
        document.querySelectorAll('.chord-word, .chord-measure-box').forEach(el => el.classList.remove('active-word', 'active-measure'));
        activeChordTarget = null;
    }

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!chordPicker.classList.contains('hidden') && 
            !chordPicker.contains(e.target) && 
            !e.target.closest('.chord-word') &&
            !e.target.closest('.chord-measure-box')) {
            closePicker();
        }
    });

    // Start
    checkAuth();
});
