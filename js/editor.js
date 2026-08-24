// js/editor.js

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
        });
    }

    // State
    let currentSong = null;
    let currentSongSha = null;
    let activeWordInfo = null; // { si, li, wi, slotEl }

    // Elements
    const settingsPanel = document.getElementById('settings-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsStatus = document.getElementById('settings-status');

    const viewList = document.getElementById('editor-song-list');
    const viewEditor = document.getElementById('editor-view');
    const songListContainer = document.getElementById('song-list-container');
    const newSongBtn = document.getElementById('new-song-btn');

    const songTitleInput = document.getElementById('song-title');
    const songKeyInput = document.getElementById('song-key');
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

    function saveSettings() {
        const s = getSettings();
        localStorage.setItem('redram-editor-settings', JSON.stringify(s));
        settingsStatus.textContent = 'Settings saved!';
        settingsStatus.style.color = '#27ae60';
        setTimeout(() => settingsStatus.textContent = '', 3000);
        // Reload songs after changing settings
        loadSongList();
    }

    toggleSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    // GitHub API Helper
    async function githubApi(method, path, body = null) {
        const s = getSettings();
        if (!s.pat) {
            throw new Error("GitHub PAT not configured in settings.");
        }
        
        const url = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${path}`;
        const headers = {
            'Authorization': `Bearer ${s.pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const config = { method, headers };
        if (body) {
            body.branch = s.branch;
            config.body = JSON.stringify(body);
        } else if (method === 'GET' || method === 'DELETE') {
            const urlObj = new URL(url);
            urlObj.searchParams.append('ref', s.branch);
            config.url = urlObj.toString();
        }

        const fetchUrl = config.url || url;
        const res = await fetch(fetchUrl, config);
        
        if (!res.ok) {
            if (res.status === 404) return null;
            const errText = await res.text();
            throw new Error(`GitHub API Error (${res.status}): ${errText}`);
        }
        
        return await res.json();
    }

    // Load Index (tries local/static fetch first, then GitHub API if needed)
    async function getIndexJson() {
        // 1. Try direct fetch (works on local server and GitHub Pages without PAT)
        try {
            const res = await fetch('songs/index.json?t=' + Date.now());
            if (res.ok) {
                const parsed = await res.json();
                const songs = Array.isArray(parsed) ? parsed : (parsed.songs || []);
                return { songs, sha: null };
            }
        } catch (e) {
            console.log('Local fetch songs/index.json failed, falling back to GitHub API:', e);
        }

        // 2. Fallback to GitHub API if PAT is configured
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
            const songs = indexData.songs || [];
            
            document.getElementById('loading-songs').classList.add('hidden');
            if (songs.length === 0) {
                songListContainer.innerHTML = '<p class="empty-msg">No songs found yet. Click "New Song" to add one!</p>';
                return;
            }

            songs.forEach(s => {
                const card = document.createElement('div');
                card.className = 'song-card';
                card.innerHTML = `
                    <div class="song-info">
                        <strong>${s.title}</strong>
                        ${s.key ? `<span class="badge">Key: ${s.key}</span>` : ''}
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
        } catch (e) {
            document.getElementById('loading-songs').classList.add('hidden');
            songListContainer.innerHTML = `<p style="color:#c0392b">Error loading songs: ${e.message}</p>`;
        }
    }

    async function editSong(slug) {
        try {
            let songData = null;
            let sha = null;

            // 1. Try local/static fetch first
            try {
                const res = await fetch(`songs/${slug}.json?t=` + Date.now());
                if (res.ok) {
                    songData = await res.json();
                }
            } catch (e) {
                console.log('Local fetch failed for song:', slug);
            }

            // 2. If not found or if PAT is set, try GitHub API to get data and SHA
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
            
            showEditorView();
            songTitleInput.value = currentSong.title || '';
            songKeyInput.value = currentSong.key || 'auto';
            updateKeyDropdownDisplay();
            
            switchTab('edit-mode');
            renderCurrentSong();
        } catch (e) {
            alert(`Failed to load song: ${e.message}`);
        }
    }

    async function deleteSongFromList(slug) {
        const s = getSettings();
        if (!s.pat) {
            alert('To delete directly from GitHub, please configure your GitHub PAT in ⚙️ Settings.');
            settingsPanel.classList.remove('hidden');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${slug}"?`)) return;
        
        try {
            // Get file SHA first
            const fileData = await githubApi('GET', `songs/${slug}.json`);
            if (fileData) {
                await githubApi('DELETE', `songs/${slug}.json`, {
                    message: `Delete song ${slug}`,
                    sha: fileData.sha
                });
            }

            // Update index
            const indexData = await getIndexJson();
            const updatedSongs = indexData.songs.filter(item => item.slug !== slug);
            const indexContent = JSON.stringify({ songs: updatedSongs }, null, 2);
            await githubApi('PUT', 'songs/index.json', {
                message: `Update index after deleting ${slug}`,
                content: btoa(unescape(encodeURIComponent(indexContent))),
                sha: indexData.sha
            });

            loadSongList();
        } catch (e) {
            alert(`Failed to delete song: ${e.message}`);
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
    });

    function downloadCurrentSongJson() {
        if (!currentSong) return;
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
    }

    async function saveCurrentSong() {
        if (!currentSong) return;
        
        currentSong.title = songTitleInput.value.trim() || 'Untitled';
        const selectedKey = songKeyInput.value;
        currentSong.key = (selectedKey === 'auto' || !selectedKey) 
            ? (ChordUtils.detectKey(currentSong) || '') 
            : selectedKey;

        const slug = ChordUtils.slugify(currentSong.title);

        const s = getSettings();
        if (!s.pat) {
            saveStatus.innerHTML = '<span style="color:#c0392b">⚠️ PAT not set. Configure in ⚙️ Settings, or use "Download JSON".</span>';
            settingsPanel.classList.remove('hidden');
            return;
        }
        
        saveStatus.textContent = 'Saving to GitHub...';
        saveStatus.style.color = '#666';
        saveSongBtn.disabled = true;

        try {
            const songContent = JSON.stringify(currentSong, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(songContent)));
            
            // Check current sha on GitHub if we don't have it
            if (!currentSongSha) {
                const existing = await githubApi('GET', `songs/${slug}.json`);
                if (existing) {
                    currentSongSha = existing.sha;
                }
            }

            // Save file
            const saveRes = await githubApi('PUT', `songs/${slug}.json`, {
                message: `Update song ${currentSong.title}`,
                content: encodedContent,
                sha: currentSongSha
            });
            if (saveRes && saveRes.content) {
                currentSongSha = saveRes.content.sha;
            }

            // Update index
            const indexData = await getIndexJson();
            let indexSongs = indexData.songs || [];
            
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
            await githubApi('PUT', 'songs/index.json', {
                message: `Update index for ${currentSong.title}`,
                content: btoa(unescape(encodeURIComponent(indexPayload))),
                sha: indexData.sha
            });

            saveStatus.textContent = '✅ Saved to GitHub successfully!';
            saveStatus.style.color = '#27ae60';
            setTimeout(() => saveStatus.textContent = '', 4000);
        } catch (e) {
            saveStatus.textContent = `Error: ${e.message}`;
            saveStatus.style.color = '#c0392b';
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
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
        tabContents.forEach(c => {
            if (c.id === targetId) {
                c.classList.add('active-tab');
            } else {
                c.classList.remove('active-tab');
            }
        });
        
        if (targetId === 'input-mode' && currentSong) {
            // Populate textarea with current song text & chords
            lyricsInput.value = ChordUtils.songToText(currentSong, true);
        } else if (targetId === 'edit-mode' && currentSong) {
            renderCurrentSong();
        }
    }

    // Lyrics Input
    formatLyricsBtn.addEventListener('click', () => {
        const text = lyricsInput.value.trim();
        if (!text) {
            alert("Please enter some lyrics first.");
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
        
        switchTab('edit-mode');
    });

    const addSectionBtn = document.getElementById('add-section-btn');
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', () => {
            if (!currentSong) currentSong = ChordUtils.createSong('', 'C');
            if (!currentSong.sections) currentSong.sections = [];
            currentSong.sections.push({
                label: 'Chorus',
                lines: [{ lyrics: 'New lyrics line', chords: [] }]
            });
            renderCurrentSong();
        });
    }

    const mergeSectionsBtn = document.getElementById('merge-sections-btn');
    if (mergeSectionsBtn) {
        mergeSectionsBtn.addEventListener('click', () => {
            if (!currentSong || !currentSong.sections || currentSong.sections.length <= 1) {
                alert('Song is already a single continuous section.');
                return;
            }
            if (confirm('Merge all sections into one continuous block? (All lyrics and chords will be kept)')) {
                ChordUtils.mergeAllSections(currentSong);
                renderCurrentSong();
            }
        });
    }

    // Editor Rendering
    function renderCurrentSong() {
        if (!currentSong) return;
        songRenderContainer.innerHTML = '';
        ChordUtils.renderSong(currentSong, songRenderContainer, {
            editable: true,
            onWordClick: handleWordClick,
            onSongChanged: () => {
                // song object is modified in place
            }
        });
    }

    // Chord Picker Logic
    function handleWordClick(si, li, wi, slotEl) {
        activeWordInfo = { si, li, wi, slotEl };
        
        // Remove active class from all
        document.querySelectorAll('.chord-word').forEach(el => el.classList.remove('active-word'));
        // Find the word element and add active
        const wordEl = slotEl.closest('.chord-word');
        if (wordEl) wordEl.classList.add('active-word');

        // Check if there is an existing chord
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

        // Position picker
        const rect = slotEl.getBoundingClientRect();
        chordPicker.style.top = `${window.scrollY + rect.bottom + 10}px`;
        // Keep picker within screen bounds
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
        
        // Check 2-char roots first (sharps/flats)
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
            
            // Auto-apply if root is selected
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
        if (!activeWordInfo) return;
        const { si, li, wi } = activeWordInfo;
        const line = currentSong.sections[si].lines[li];
        if (!line.chords) line.chords = [];
        
        const existingIdx = line.chords.findIndex(c => c.wordIndex === wi);
        if (existingIdx >= 0) {
            line.chords[existingIdx].chord = chordStr;
        } else {
            line.chords.push({ wordIndex: wi, chord: chordStr });
        }
        
        closePicker();
        updateKeyDropdownDisplay();
        renderCurrentSong();
    }

    removeChordBtn.addEventListener('click', () => {
        if (!activeWordInfo) return;
        const { si, li, wi } = activeWordInfo;
        let chords = currentSong.sections[si].lines[li].chords;
        currentSong.sections[si].lines[li].chords = chords.filter(c => c.wordIndex !== wi);
        
        closePicker();
        updateKeyDropdownDisplay();
        renderCurrentSong();
    });

    closePickerBtn.addEventListener('click', closePicker);

    function closePicker() {
        chordPicker.classList.add('hidden');
        document.querySelectorAll('.chord-word').forEach(el => el.classList.remove('active-word'));
        activeWordInfo = null;
    }

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!chordPicker.classList.contains('hidden') && 
            !chordPicker.contains(e.target) && 
            !e.target.closest('.chord-word')) {
            closePicker();
        }
    });

    // Init
    checkAuth();
});
