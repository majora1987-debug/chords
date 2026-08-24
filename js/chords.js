/**
 * ChordUtils — Shared chord utilities for The Red Ram chord chart site.
 * Used by both the viewer and editor.
 */
window.ChordUtils = (() => {
  // Chromatic scale with sharps and flats
  const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // All root notes for the chord picker (display-friendly)
  const ROOT_NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

  // Common chord qualities for the picker
  const CHORD_QUALITIES = [
    { suffix: '',      label: 'Major' },
    { suffix: 'm',     label: 'Minor' },
    { suffix: '7',     label: '7' },
    { suffix: 'maj7',  label: 'maj7' },
    { suffix: 'm7',    label: 'm7' },
    { suffix: 'sus2',  label: 'sus2' },
    { suffix: 'sus4',  label: 'sus4' },
    { suffix: 'dim',   label: 'dim' },
    { suffix: 'aug',   label: 'aug' },
    { suffix: 'add9',  label: 'add9' },
    { suffix: '6',     label: '6' },
    { suffix: 'm6',    label: 'm6' },
    { suffix: '9',     label: '9' },
    { suffix: 'm9',    label: 'm9' },
    { suffix: '5',     label: '5' },
    { suffix: '7sus4', label: '7sus4' },
    { suffix: 'dim7',  label: 'dim7' },
    { suffix: 'm7b5',  label: 'm7♭5' },
  ];

  /**
   * Parse a chord string into its components.
   * e.g. "G#m7/B" → { root: "G#", quality: "m7", bass: "B" }
   */
  function parseChord(str) {
    if (!str) return null;
    const clean = str.trim();
    if (clean === 'N.C.' || clean === 'NC' || clean === '-') {
      return { root: 'N.C.', quality: '', bass: null };
    }
    const m = clean.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
    if (!m) return null;
    return { root: m[1], quality: m[2] || '', bass: m[3] || null };
  }

  /**
   * Get the chromatic index of a note (0-11).
   */
  function noteIndex(note) {
    let i = NOTES_SHARP.indexOf(note);
    if (i === -1) i = NOTES_FLAT.indexOf(note);
    return i;
  }

  /**
   * Transpose a single note by semitones.
   */
  function transposeNote(note, semitones, useFlats = false) {
    const i = noteIndex(note);
    if (i === -1) return note;
    const arr = useFlats ? NOTES_FLAT : NOTES_SHARP;
    return arr[((i + semitones) % 12 + 12) % 12];
  }

  /**
   * Transpose a full chord string by semitones.
   * e.g. transposeChord("G", 2) → "A"
   */
  function transposeChord(str, semitones) {
    if (!semitones || !str) return str;
    if (str === 'N.C.' || str === 'NC' || str === '-') return str;
    const p = parseChord(str);
    if (!p) return str;
    const useFlats = p.root.includes('b') || (p.bass && p.bass.includes('b'));
    let result = transposeNote(p.root, semitones, useFlats) + p.quality;
    if (p.bass) result += '/' + transposeNote(p.bass, semitones, useFlats);
    return result;
  }

  /**
   * Slugify a string for use as a filename.
   * e.g. "Amazing Grace" → "amazing-grace"
   */
  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /**
   * Auto-detect the musical key of a song based on its chords.
   */
  function detectKey(song) {
    if (!song || !song.sections) return '';
    
    // Extract all chords in the song in chronological order
    const chords = [];
    song.sections.forEach(sec => {
      (sec.lines || []).forEach(line => {
        (line.chords || []).forEach(c => {
          if (c.chord && c.chord.trim() && c.chord !== 'N.C.' && c.chord !== '-') {
            chords.push(c.chord.trim());
          }
        });
      });
    });

    if (chords.length === 0) return '';

    const MAJOR_KEYS = [
      { name: 'C', root: 0 }, { name: 'Db', root: 1 }, { name: 'D', root: 2 },
      { name: 'Eb', root: 3 }, { name: 'E', root: 4 }, { name: 'F', root: 5 },
      { name: 'F#', root: 6 }, { name: 'G', root: 7 }, { name: 'Ab', root: 8 },
      { name: 'A', root: 9 }, { name: 'Bb', root: 10 }, { name: 'B', root: 11 }
    ];

    const MINOR_KEYS = [
      { name: 'Am', root: 9 }, { name: 'Bbm', root: 10 }, { name: 'Bm', root: 11 },
      { name: 'Cm', root: 0 }, { name: 'C#m', root: 1 }, { name: 'Dm', root: 2 },
      { name: 'Ebm', root: 3 }, { name: 'Em', root: 4 }, { name: 'Fm', root: 5 },
      { name: 'F#m', root: 6 }, { name: 'Gm', root: 7 }, { name: 'G#m', root: 8 }
    ];

    const firstChordParsed = parseChord(chords[0]);
    const lastChordParsed = parseChord(chords[chords.length - 1]);

    let bestKey = '';
    let highestScore = -999;

    function evaluateCandidate(candName, candRoot, isMinor) {
      let score = 0;
      
      if (firstChordParsed && firstChordParsed.root !== 'N.C.') {
        const firstRootIdx = noteIndex(firstChordParsed.root);
        const firstIsMin = firstChordParsed.quality.startsWith('m') && !firstChordParsed.quality.startsWith('maj');
        if (firstRootIdx === candRoot && firstIsMin === isMinor) {
          score += 4;
        }
      }

      if (lastChordParsed && lastChordParsed.root !== 'N.C.') {
        const lastRootIdx = noteIndex(lastChordParsed.root);
        const lastIsMin = lastChordParsed.quality.startsWith('m') && !lastChordParsed.quality.startsWith('maj');
        if (lastRootIdx === candRoot && lastIsMin === isMinor) {
          score += 3;
        }
      }

      chords.forEach(cStr => {
        const p = parseChord(cStr);
        if (!p || p.root === 'N.C.') return;
        const rIdx = noteIndex(p.root);
        if (rIdx === -1) return;
        
        const interval = ((rIdx - candRoot) % 12 + 12) % 12;
        const isMin = p.quality.startsWith('m') && !p.quality.startsWith('maj');

        if (!isMinor) {
          if (interval === 0 && !isMin) score += 3;      // I
          else if (interval === 5 && !isMin) score += 2; // IV
          else if (interval === 7) score += 2.5;         // V
          else if (interval === 9 && isMin) score += 1.5;// vi
          else if (interval === 2 && isMin) score += 1.2;// ii
          else if (interval === 4 && isMin) score += 1;  // iii
          else if (interval === 11) score += 0.5;        // vii°
          else score -= 1;
        } else {
          if (interval === 0 && isMin) score += 3;       // i
          else if (interval === 5 && isMin) score += 2;  // iv
          else if (interval === 7) score += 2.5;         // v / V7
          else if (interval === 3 && !isMin) score += 2; // III
          else if (interval === 8 && !isMin) score += 1.5;// VI
          else if (interval === 10 && !isMin) score += 1;// VII
          else score -= 1;
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestKey = candName;
      }
    }

    MAJOR_KEYS.forEach(k => evaluateCandidate(k.name, k.root, false));
    MINOR_KEYS.forEach(k => evaluateCandidate(k.name, k.root, true));

    return bestKey || (firstChordParsed ? firstChordParsed.root + (firstChordParsed.quality.startsWith('m') && !firstChordParsed.quality.startsWith('maj') ? 'm' : '') : 'C');
  }

  /**
   * Helper: check if a raw line represents an instrumental chord progression (e.g. "| G | Em | C | D | (x2)" or "G Em C D")
   */
  function tryParseInstrumentalLine(lineStr) {
    if (!lineStr || !lineStr.trim()) return null;
    let s = lineStr.trim();

    // Check if there is a comment/repeat tag e.g. (x2), (x4), (solo), (repeat 3x), or after // or #
    let comment = '';
    const commentMatch = s.match(/(\([^\)]+\)|\[x\d+\]|x\d+|#.+|\/\/.+)$/i);
    if (commentMatch) {
      comment = commentMatch[0].trim();
      s = s.substring(0, commentMatch.index).trim();
    }

    // Split by bar lines | or dashes or whitespace
    const tokens = s
      .split(/[|/\\,]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t !== '-');

    if (tokens.length === 0) {
      if (comment && lineStr.includes('|')) {
        return { type: 'chords', chords: [{ chord: 'G' }], comment, lyrics: '' };
      }
      return null;
    }

    // Subdivide any space-separated tokens
    const chordTokens = [];
    tokens.forEach(t => {
      const parts = t.split(/\s+/).filter(p => p.length > 0);
      chordTokens.push(...parts);
    });

    if (chordTokens.length === 0) return null;

    // Check if ALL tokens are valid chords or music symbols
    const validChords = [];
    for (const tok of chordTokens) {
      const cleanTok = tok.replace(/^\[|\]$/g, '').trim();
      if (cleanTok === '%' || cleanTok === 'N.C.' || cleanTok === 'NC' || cleanTok === '-') {
        validChords.push(cleanTok);
        continue;
      }
      const parsed = parseChord(cleanTok);
      if (parsed) {
        validChords.push(cleanTok);
      } else {
        // Contains regular words -> not a pure instrumental line
        return null;
      }
    }

    if (validChords.length > 0) {
      return {
        type: 'chords',
        chords: validChords.map(c => ({ chord: c })),
        comment: comment,
        lyrics: ''
      };
    }

    return null;
  }

  /**
   * Parse lyrics text into structured song sections.
   * Supports plain lyrics, section headers [Verse 1], bracketed chords [G], and instrumental lines "| G | Em | C | D |".
   */
  function parseLyrics(text) {
    if (!text || !text.trim()) return [];
    
    const blocks = text.trim().split(/\n\s*\n/);
    
    return blocks
      .filter(b => b.trim().length > 0)
      .map((block, i) => {
        const rawLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let label = '';
        let linesToProcess = rawLines;

        if (rawLines.length > 0) {
          const firstLine = rawLines[0];
          const isBracketedHeader = firstLine.startsWith('[') && firstLine.endsWith(']') && !firstLine.includes(' ');
          const isStandardHeader = /^(verse\s*\d*|chorus\s*\d*|bridge\s*\d*|intro\s*\d*|outro\s*\d*|solo\s*\d*|break\s*\d*|pre-chorus\s*\d*|hook\s*\d*|verse|chorus|intro|outro|bridge|solo|interlude|instrumental|riff)$/i.test(firstLine);
          
          if (isBracketedHeader || isStandardHeader) {
            label = firstLine.replace(/^\[|\]$/g, '').trim();
            linesToProcess = rawLines.slice(1);
          }
        }

        const parsedLines = linesToProcess.map(lineStr => {
          // 1. Try instrumental chord line detection
          const inst = tryParseInstrumentalLine(lineStr);
          if (inst) return inst;

          // 2. Bracketed lyrics line
          if (lineStr.includes('[') && lineStr.includes(']')) {
            const chords = [];
            let cleanLine = '';
            let currentWordIdx = 0;
            let pendingChord = null;
            let i = 0;

            while (i < lineStr.length) {
              if (lineStr[i] === '[') {
                const end = lineStr.indexOf(']', i);
                if (end !== -1) {
                  pendingChord = lineStr.substring(i + 1, end).trim();
                  i = end + 1;
                  continue;
                }
              }

              const char = lineStr[i];
              if (char === ' ') {
                if (cleanLine.length > 0 && !cleanLine.endsWith(' ')) {
                  currentWordIdx++;
                }
                cleanLine += ' ';
              } else {
                if (pendingChord !== null) {
                  chords.push({ wordIndex: currentWordIdx, chord: pendingChord });
                  pendingChord = null;
                }
                cleanLine += char;
              }
              i++;
            }

            return {
              lyrics: cleanLine.trim(),
              chords: chords
            };
          } else {
            return {
              lyrics: lineStr,
              chords: []
            };
          }
        }).filter(l => (l.type === 'chords' && l.chords.length > 0) || (l.lyrics && l.lyrics.length > 0));

        return {
          label: label,
          lines: parsedLines.length > 0 ? parsedLines : [{ lyrics: 'Lyrics line', chords: [] }]
        };
      });
  }

  /**
   * Convert a structured song back to text (plain lyrics or ChordPro with chords & instrumental blocks).
   */
  function songToText(song, includeChords = true) {
    if (!song || !song.sections || song.sections.length === 0) return '';

    return song.sections.map(sec => {
      let secStr = '';
      if (sec.label && sec.label.trim()) {
        secStr += `[${sec.label.trim()}]\n`;
      }
      const linesStr = (sec.lines || []).map(line => {
        if (line.type === 'chords') {
          if (!includeChords) return '';
          const chordList = (line.chords || []).map(c => c.chord || '-').filter(Boolean);
          if (chordList.length === 0) return '| - |';
          return '| ' + chordList.join(' | ') + ' |' + (line.comment ? ` ${line.comment}` : '');
        }

        if (!includeChords || !line.chords || line.chords.length === 0) {
          return line.lyrics || '';
        }
        const words = (line.lyrics || '').split(/\s+/).filter(w => w.length > 0);
        return words.map((w, wi) => {
          const chordObj = line.chords.find(c => c.wordIndex === wi);
          return (chordObj ? `[${chordObj.chord}]` : '') + w;
        }).join(' ');
      }).filter(Boolean).join('\n');

      return secStr + linesStr;
    }).join('\n\n');
  }

  /**
   * Create a new empty song object.
   */
  function createSong(title = '', key = 'C') {
    return {
      title,
      artist: 'The Red Ram',
      key,
      sections: [
        {
          label: 'Verse 1',
          lines: [
            { lyrics: 'Type your lyrics here', chords: [] }
          ]
        }
      ],
    };
  }

  /**
   * Move a section header (boundary) dynamically to a specific global line index.
   */
  function moveSectionHeaderToLine(song, fromSectionIndex, targetGlobalLineIndex) {
    if (!song || !song.sections || song.sections.length === 0) return;
    
    const allLines = [];
    const headers = [];
    
    let currentLineCount = 0;
    song.sections.forEach((sec, idx) => {
      headers.push({
        label: sec.label || '',
        originalSecIdx: idx,
        startLineIndex: currentLineCount
      });
      if (sec.lines && sec.lines.length > 0) {
        allLines.push(...sec.lines);
        currentLineCount += sec.lines.length;
      }
    });

    const movedHeader = headers.find(h => h.originalSecIdx === fromSectionIndex);
    if (!movedHeader) return;
    
    const newIndex = Math.max(0, Math.min(targetGlobalLineIndex, allLines.length));
    movedHeader.startLineIndex = newIndex;

    headers.sort((a, b) => {
      if (a.startLineIndex !== b.startLineIndex) {
        return a.startLineIndex - b.startLineIndex;
      }
      return a.originalSecIdx - b.originalSecIdx;
    });

    const newSections = [];
    
    if (headers[0].startLineIndex > 0) {
      newSections.push({
        label: '',
        lines: allLines.slice(0, headers[0].startLineIndex)
      });
    }

    for (let i = 0; i < headers.length; i++) {
      const start = headers[i].startLineIndex;
      const end = (i < headers.length - 1) ? headers[i + 1].startLineIndex : allLines.length;
      const secLines = allLines.slice(start, end);
      newSections.push({
        label: headers[i].label,
        lines: secLines
      });
    }

    song.sections = newSections;
  }

  /**
   * Merge all sections into a single continuous block (keeping all lyrics and chords).
   */
  function mergeAllSections(song) {
    if (!song || !song.sections || song.sections.length <= 1) return;
    const allLines = [];
    song.sections.forEach(sec => {
      if (sec.lines) {
        allLines.push(...sec.lines);
      }
    });
    song.sections = [
      {
        label: '',
        lines: allLines
      }
    ];
  }

  /**
   * Move an individual line (instrumental chord bar or lyric line) to a specific global line index.
   */
  function moveLineToPosition(song, fromSecIdx, fromLineIdx, targetGlobalLineIdx) {
    if (!song || !song.sections || song.sections.length === 0) return;

    const sourceSec = song.sections[fromSecIdx];
    if (!sourceSec || !sourceSec.lines || !sourceSec.lines[fromLineIdx]) return;

    const [movedLine] = sourceSec.lines.splice(fromLineIdx, 1);

    let currentGlobalCount = 0;
    let targetSecIdx = song.sections.length - 1;
    let targetLineIdx = (song.sections[targetSecIdx].lines || []).length;

    for (let si = 0; si < song.sections.length; si++) {
      const secLines = song.sections[si].lines || [];
      if (targetGlobalLineIdx <= currentGlobalCount + secLines.length) {
        targetSecIdx = si;
        targetLineIdx = Math.max(0, targetGlobalLineIdx - currentGlobalCount);
        break;
      }
      currentGlobalCount += secLines.length;
    }

    if (!song.sections[targetSecIdx].lines) song.sections[targetSecIdx].lines = [];
    song.sections[targetSecIdx].lines.splice(targetLineIdx, 0, movedLine);

    // Clean up empty unlabelled sections
    song.sections = song.sections.filter(sec => (sec.label && sec.label.trim()) || (sec.lines && sec.lines.length > 0));
    if (song.sections.length === 0) {
      song.sections = [{ label: '', lines: [movedLine] }];
    }
  }

  /**
   * Render a song into a container DOM element.
   *
   * Options:
   *   transpose           — semitones to transpose (default 0)
   *   editable            — if true, enables interactive editing
   *   onWordClick         — callback(sectionIndex, lineIndex, wordIndex, slotElement)
   *   onMeasureChordClick — callback(sectionIndex, lineIndex, chordIndex, boxElement)
   *   onSongChanged       — callback() called whenever sections/lines/labels are modified
   *   justDroppedSecIdx   — optional index of section that was just dropped for settle animation
   */
  function renderSong(song, container, options = {}) {
    const {
      transpose = 0,
      editable = false,
      onWordClick = null,
      onMeasureChordClick = null,
      onSongChanged = null,
      justDroppedSecIdx = null,
    } = options;

    container.innerHTML = '';

    if (!song || !song.sections || song.sections.length === 0) {
      if (editable) {
        const emptySec = document.createElement('div');
        emptySec.className = 'empty-sections-notice';
        emptySec.innerHTML = `<p>No lyrics or chords found. <button class="btn btn-sm btn-primary" id="add-first-sec-btn">+ Add Line</button></p>`;
        emptySec.querySelector('#add-first-sec-btn').addEventListener('click', () => {
          song.sections = [{ label: '', lines: [{ lyrics: 'Lyrics line here', chords: [] }] }];
          renderSong(song, container, options);
          if (onSongChanged) onSongChanged();
        });
        container.appendChild(emptySec);
      }
      return;
    }

    let globalLineCounter = 0;

    song.sections.forEach((section, si) => {
      const secEl = document.createElement('div');
      secEl.className = 'song-section';
      secEl.dataset.sectionIndex = si;

      const hasLabel = section.label && section.label.trim().length > 0;

      if (editable) {
        secEl.classList.add('editable-section');
      }

      // Section Header Row (only shown in viewer if hasLabel, always shown in editor)
      if (hasLabel || editable) {
        const headerRow = document.createElement('div');
        headerRow.className = 'section-header-row';
        if (justDroppedSecIdx === si) {
          headerRow.classList.add('just-dropped');
        }
        if (!hasLabel) headerRow.classList.add('unlabelled-section-header');

        if (editable) {
          // Trello-style Ultra-Smooth Pointer Events Drag Handle
          const dragHandle = document.createElement('span');
          dragHandle.className = 'section-drag-handle';
          dragHandle.innerHTML = '&#x283F;'; // ⠿ symbol
          dragHandle.title = 'Drag to reposition section boundary';

          dragHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // Left click only
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            let isDraggingActive = false;
            let currentTargetLineIdx = null;
            let placeholderEl = null;

            const labelText = section.label || `Section ${si + 1}`;
            const lineCount = (section.lines || []).length;

            const floatingCard = document.createElement('div');
            floatingCard.className = 'trello-drag-card';
            floatingCard.innerHTML = `
              <div class="drag-card-header">
                <span class="drag-card-icon">&#x283F;</span>
                <span class="drag-card-title">${labelText}</span>
              </div>
              <span class="drag-card-badge">${lineCount} line${lineCount === 1 ? '' : 's'}</span>
            `;
            floatingCard.style.display = 'none';
            document.body.appendChild(floatingCard);

            function createPlaceholder() {
              if (placeholderEl) return placeholderEl;
              placeholderEl = document.createElement('div');
              placeholderEl.className = 'trello-drop-placeholder';
              placeholderEl.innerHTML = `
                <span class="placeholder-icon">➔</span>
                <span class="placeholder-text">Place <strong>${labelText}</strong> Here</span>
              `;
              return placeholderEl;
            }

            let rafId = null;
            let lastX = startX;
            let lastY = startY;

            function updateFloatingPosition() {
              floatingCard.style.transform = `translate3d(${lastX}px, ${lastY}px, 0) translate(-50%, -50%) rotate(3deg) scale(1.04)`;
              rafId = null;
            }

            function onPointerMove(moveEvent) {
              moveEvent.preventDefault();
              lastX = moveEvent.clientX;
              lastY = moveEvent.clientY;

              if (!isDraggingActive) {
                const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                if (dist > 3) {
                  isDraggingActive = true;
                  floatingCard.style.display = 'flex';
                  headerRow.classList.add('is-dragging');
                  secEl.classList.add('is-dragging-source');
                  document.body.classList.add('is-dragging-active');
                  createPlaceholder();
                }
              }

              if (!isDraggingActive) return;

              if (!rafId) {
                rafId = requestAnimationFrame(updateFloatingPosition);
              }

              floatingCard.style.display = 'none';
              const elemBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
              floatingCard.style.display = 'flex';

              if (elemBelow) {
                const lineEl = elemBelow.closest('.song-line');
                if (lineEl && container.contains(lineEl)) {
                  const gIdx = parseInt(lineEl.dataset.globalLineIndex, 10);
                  const rect = lineEl.getBoundingClientRect();
                  const isTopHalf = (moveEvent.clientY - rect.top) < (rect.height / 2);

                  const ph = createPlaceholder();

                  if (isTopHalf) {
                    if (ph.nextSibling !== lineEl) {
                      lineEl.parentNode.insertBefore(ph, lineEl);
                    }
                    currentTargetLineIdx = gIdx;
                  } else {
                    if (ph.previousSibling !== lineEl) {
                      lineEl.parentNode.insertBefore(ph, lineEl.nextSibling);
                    }
                    currentTargetLineIdx = gIdx + 1;
                  }
                } else {
                  const headerEl = elemBelow.closest('.section-header-row');
                  if (headerEl && container.contains(headerEl) && headerEl !== headerRow) {
                    const sec = headerEl.closest('.song-section');
                    if (sec) {
                      const firstLine = sec.querySelector('.song-line');
                      if (firstLine) {
                        const gIdx = parseInt(firstLine.dataset.globalLineIndex, 10);
                        const ph = createPlaceholder();
                        sec.insertBefore(ph, headerEl.nextSibling);
                        currentTargetLineIdx = gIdx;
                      }
                    }
                  }
                }
              }
            }

            function onPointerUp(upEvent) {
              document.removeEventListener('pointermove', onPointerMove);
              document.removeEventListener('pointerup', onPointerUp);
              document.removeEventListener('pointercancel', onPointerUp);

              if (rafId) cancelAnimationFrame(rafId);
              document.body.classList.remove('is-dragging-active');

              if (floatingCard && floatingCard.parentNode) {
                floatingCard.parentNode.removeChild(floatingCard);
              }
              if (placeholderEl && placeholderEl.parentNode) {
                placeholderEl.parentNode.removeChild(placeholderEl);
              }

              if (isDraggingActive && currentTargetLineIdx !== null && !isNaN(currentTargetLineIdx)) {
                moveSectionHeaderToLine(song, si, currentTargetLineIdx);
                renderSong(song, container, { ...options, justDroppedSecIdx: si });
                if (onSongChanged) onSongChanged();
              } else {
                headerRow.classList.remove('is-dragging');
                secEl.classList.remove('is-dragging-source');
              }
            }

            document.addEventListener('pointermove', onPointerMove, { passive: false });
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
          });

          headerRow.appendChild(dragHandle);
        }

        // Section label element
        const labelEl = document.createElement('div');
        labelEl.className = 'section-label';
        labelEl.textContent = hasLabel ? section.label : (editable ? '+ Add Section Label' : '');

        if (editable) {
          labelEl.contentEditable = 'true';
          labelEl.classList.add('editable-label');
          if (!hasLabel) labelEl.classList.add('placeholder-label');
          labelEl.spellcheck = false;
          labelEl.title = 'Click to edit section name (e.g. Intro, Verse 1, Chorus, Solo)';
          
          labelEl.addEventListener('focus', () => {
            if (!hasLabel) {
              labelEl.textContent = '';
              labelEl.classList.remove('placeholder-label');
            }
          });

          labelEl.addEventListener('blur', () => {
            const val = labelEl.textContent.trim();
            section.label = val;
            if (!val) {
              labelEl.textContent = '+ Add Section Label';
              labelEl.classList.add('placeholder-label');
            }
            if (onSongChanged) onSongChanged();
          });

          labelEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              labelEl.blur();
            }
          });
        }
        headerRow.appendChild(labelEl);

        if (editable) {
          // Section Controls Toolbar
          const controls = document.createElement('div');
          controls.className = 'section-controls';

          // Move Up 1 line
          const upBtn = document.createElement('button');
          upBtn.className = 'sec-ctrl-btn';
          upBtn.innerHTML = '▲';
          upBtn.title = 'Move section up 1 line';
          upBtn.addEventListener('click', () => {
            let myStartLine = 0;
            for (let i = 0; i < si; i++) {
              myStartLine += (song.sections[i].lines || []).length;
            }
            if (myStartLine > 0) {
              moveSectionHeaderToLine(song, si, myStartLine - 1);
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            }
          });
          controls.appendChild(upBtn);

          // Move Down 1 line
          const downBtn = document.createElement('button');
          downBtn.className = 'sec-ctrl-btn';
          downBtn.innerHTML = '▼';
          downBtn.title = 'Move section down 1 line';
          downBtn.addEventListener('click', () => {
            let myStartLine = 0;
            for (let i = 0; i < si; i++) {
              myStartLine += (song.sections[i].lines || []).length;
            }
            moveSectionHeaderToLine(song, si, myStartLine + 1);
            renderSong(song, container, options);
            if (onSongChanged) onSongChanged();
          });
          controls.appendChild(downBtn);

          // Add Instrumental Chord Progression Bar
          const addChordBarBtn = document.createElement('button');
          addChordBarBtn.className = 'sec-ctrl-btn sec-add-bar-btn';
          addChordBarBtn.innerHTML = '+ Chord Bar';
          addChordBarBtn.title = 'Add an instrumental chord bar/progression (no lyrics)';
          addChordBarBtn.addEventListener('click', () => {
            if (!section.lines) section.lines = [];
            section.lines.push({
              type: 'chords',
              chords: [{ chord: 'G' }, { chord: 'C' }],
              comment: '',
              lyrics: ''
            });
            renderSong(song, container, options);
            if (onSongChanged) onSongChanged();
          });
          controls.appendChild(addChordBarBtn);

          // Add Lyrics Line
          const addLineBtn = document.createElement('button');
          addLineBtn.className = 'sec-ctrl-btn';
          addLineBtn.innerHTML = '+ Lyrics';
          addLineBtn.title = 'Add lyrics line to this section';
          addLineBtn.addEventListener('click', () => {
            if (!section.lines) section.lines = [];
            section.lines.push({ lyrics: 'New lyrics line', chords: [] });
            renderSong(song, container, options);
            if (onSongChanged) onSongChanged();
          });
          controls.appendChild(addLineBtn);

          // Remove Section Header (Preserving all lyrics & chords)
          if (hasLabel) {
            const removeLabelBtn = document.createElement('button');
            removeLabelBtn.className = 'sec-ctrl-btn';
            removeLabelBtn.innerHTML = '✕ Label';
            removeLabelBtn.title = 'Remove section header (keeps all lines intact)';
            removeLabelBtn.addEventListener('click', () => {
              section.label = '';
              if (si > 0) {
                song.sections[si - 1].lines.push(...section.lines);
                song.sections.splice(si, 1);
              }
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            });
            controls.appendChild(removeLabelBtn);
          }

          // Delete Section (prompt)
          const delBtn = document.createElement('button');
          delBtn.className = 'sec-ctrl-btn sec-delete-btn';
          delBtn.innerHTML = '🗑️';
          delBtn.title = 'Delete section and all its lines';
          delBtn.addEventListener('click', () => {
            if (confirm(`Delete section "${section.label || 'Section ' + (si + 1)}" and its lines?`)) {
              song.sections.splice(si, 1);
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            }
          });
          controls.appendChild(delBtn);

          headerRow.appendChild(controls);
        }

        secEl.appendChild(headerRow);
      }

      // Render Lines
      (section.lines || []).forEach((line, li) => {
        const currentGlobalLineIdx = globalLineCounter++;

        // Case A: Instrumental Chord Bar Line
        if (line.type === 'chords' || (!line.lyrics && line.chords && line.chords.length > 0)) {
          const instLineEl = document.createElement('div');
          instLineEl.className = 'song-line instrumental-line';
          instLineEl.dataset.sectionIndex = si;
          instLineEl.dataset.lineIndex = li;
          instLineEl.dataset.globalLineIndex = currentGlobalLineIdx;

          const grid = document.createElement('div');
          grid.className = 'instrumental-grid';

          const startDivider = document.createElement('span');
          startDivider.className = 'bar-divider';
          startDivider.textContent = '|';
          grid.appendChild(startDivider);

          const chordsList = line.chords || [];

          chordsList.forEach((chordObj, ci) => {
            const rawChord = chordObj.chord || 'C';
            const displayChord = transpose
              ? transposeChord(rawChord, transpose)
              : rawChord;

            const box = document.createElement('div');
            box.className = 'chord-measure-box';
            box.dataset.chordIndex = ci;

            const chordSpan = document.createElement('span');
            chordSpan.className = 'measure-chord';
            chordSpan.textContent = displayChord;
            box.appendChild(chordSpan);

            if (editable) {
              box.classList.add('editable');
              box.title = 'Click to change chord';
              box.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onMeasureChordClick) {
                  onMeasureChordClick(si, li, ci, box);
                }
              });
            }

            grid.appendChild(box);

            const div = document.createElement('span');
            div.className = 'bar-divider';
            div.textContent = '|';
            grid.appendChild(div);
          });

          // Add Chord Button in editable mode
          if (editable) {
            const addChordBtn = document.createElement('button');
            addChordBtn.className = 'add-measure-chord-btn';
            addChordBtn.innerHTML = '+';
            addChordBtn.title = 'Add another chord to this bar';
            addChordBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              line.chords.push({ chord: 'G' });
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            });
            grid.appendChild(addChordBtn);
          }

          // Optional comment / repeat tag e.g. "(x2)", "(Solo)", "(Fade)"
          if (line.comment || editable) {
            const commentSpan = document.createElement('span');
            commentSpan.className = 'measure-comment';
            commentSpan.textContent = line.comment || (editable ? '+ tag (e.g. x2)' : '');
            if (!line.comment && editable) commentSpan.classList.add('placeholder-tag');

            if (editable) {
              commentSpan.contentEditable = 'true';
              commentSpan.classList.add('editable');
              commentSpan.title = 'Click to edit repeat tag/comment';

              commentSpan.addEventListener('focus', () => {
                if (!line.comment) {
                  commentSpan.textContent = '';
                  commentSpan.classList.remove('placeholder-tag');
                }
              });

              commentSpan.addEventListener('blur', () => {
                const val = commentSpan.textContent.trim();
                line.comment = val;
                if (!val) {
                  commentSpan.textContent = '+ tag (e.g. x2)';
                  commentSpan.classList.add('placeholder-tag');
                }
                if (onSongChanged) onSongChanged();
              });

              commentSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commentSpan.blur();
                }
              });
            }

            grid.appendChild(commentSpan);
          }

          instLineEl.appendChild(grid);

          // Line actions & Drag Handle
          if (editable) {
            const lineDragHandle = document.createElement('span');
            lineDragHandle.className = 'line-drag-handle';
            lineDragHandle.innerHTML = '&#x283F;'; // ⠿ symbol
            lineDragHandle.title = 'Drag to reposition this chord bar anywhere in the song';

            lineDragHandle.addEventListener('pointerdown', (e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();

              const startX = e.clientX;
              const startY = e.clientY;
              let isDraggingActive = false;
              let currentTargetLineIdx = null;
              let placeholderEl = null;

              const chordsSummary = (line.chords || []).map(c => c.chord || '-').join(' | ');
              const barText = `| ${chordsSummary} |` + (line.comment ? ` ${line.comment}` : '');

              const floatingCard = document.createElement('div');
              floatingCard.className = 'trello-drag-card';
              floatingCard.innerHTML = `
                <div class="drag-card-header">
                  <span class="drag-card-icon">&#x283F;</span>
                  <span class="drag-card-title">${barText}</span>
                </div>
                <span class="drag-card-badge">Chord Bar</span>
              `;
              floatingCard.style.display = 'none';
              document.body.appendChild(floatingCard);

              function createPlaceholder() {
                if (placeholderEl) return placeholderEl;
                placeholderEl = document.createElement('div');
                placeholderEl.className = 'trello-drop-placeholder';
                placeholderEl.innerHTML = `
                  <span class="placeholder-icon">➔</span>
                  <span class="placeholder-text">Place Chord Bar <strong>${barText}</strong> Here</span>
                `;
                return placeholderEl;
              }

              let rafId = null;
              let lastX = startX;
              let lastY = startY;

              function updateFloatingPosition() {
                floatingCard.style.transform = `translate3d(${lastX}px, ${lastY}px, 0) translate(-50%, -50%) rotate(2.5deg) scale(1.04)`;
                rafId = null;
              }

              function onPointerMove(moveEvent) {
                moveEvent.preventDefault();
                lastX = moveEvent.clientX;
                lastY = moveEvent.clientY;

                if (!isDraggingActive) {
                  const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                  if (dist > 3) {
                    isDraggingActive = true;
                    floatingCard.style.display = 'flex';
                    instLineEl.classList.add('is-dragging-source');
                    document.body.classList.add('is-dragging-active');
                    createPlaceholder();
                  }
                }

                if (!isDraggingActive) return;

                if (!rafId) {
                  rafId = requestAnimationFrame(updateFloatingPosition);
                }

                floatingCard.style.display = 'none';
                const elemBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                floatingCard.style.display = 'flex';

                if (elemBelow) {
                  const targetLine = elemBelow.closest('.song-line');
                  if (targetLine && container.contains(targetLine)) {
                    const gIdx = parseInt(targetLine.dataset.globalLineIndex, 10);
                    const rect = targetLine.getBoundingClientRect();
                    const isTopHalf = (moveEvent.clientY - rect.top) < (rect.height / 2);

                    const ph = createPlaceholder();

                    if (isTopHalf) {
                      if (ph.nextSibling !== targetLine) {
                        targetLine.parentNode.insertBefore(ph, targetLine);
                      }
                      currentTargetLineIdx = gIdx;
                    } else {
                      if (ph.previousSibling !== targetLine) {
                        targetLine.parentNode.insertBefore(ph, targetLine.nextSibling);
                      }
                      currentTargetLineIdx = gIdx + 1;
                    }
                  } else {
                    const headerEl = elemBelow.closest('.section-header-row');
                    if (headerEl && container.contains(headerEl)) {
                      const sec = headerEl.closest('.song-section');
                      if (sec) {
                        const firstLine = sec.querySelector('.song-line');
                        if (firstLine) {
                          const gIdx = parseInt(firstLine.dataset.globalLineIndex, 10);
                          const ph = createPlaceholder();
                          sec.insertBefore(ph, headerEl.nextSibling);
                          currentTargetLineIdx = gIdx;
                        }
                      }
                    }
                  }
                }
              }

              function onPointerUp(upEvent) {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('pointercancel', onPointerUp);

                if (rafId) cancelAnimationFrame(rafId);
                document.body.classList.remove('is-dragging-active');

                if (floatingCard && floatingCard.parentNode) {
                  floatingCard.parentNode.removeChild(floatingCard);
                }
                if (placeholderEl && placeholderEl.parentNode) {
                  placeholderEl.parentNode.removeChild(placeholderEl);
                }

                if (isDraggingActive && currentTargetLineIdx !== null && !isNaN(currentTargetLineIdx)) {
                  moveLineToPosition(song, si, li, currentTargetLineIdx);
                  renderSong(song, container, options);
                  if (onSongChanged) onSongChanged();
                } else {
                  instLineEl.classList.remove('is-dragging-source');
                }
              }

              document.addEventListener('pointermove', onPointerMove, { passive: false });
              document.addEventListener('pointerup', onPointerUp);
              document.addEventListener('pointercancel', onPointerUp);
            });

            instLineEl.prepend(lineDragHandle);

            const lineActions = document.createElement('span');
            lineActions.className = 'line-actions';

            const delLineBtn = document.createElement('button');
            delLineBtn.className = 'line-action-btn';
            delLineBtn.innerHTML = '✕';
            delLineBtn.title = 'Delete chord bar line';
            delLineBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              section.lines.splice(li, 1);
              if (section.lines.length === 0 && song.sections.length > 1) {
                song.sections.splice(si, 1);
              }
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            });
            lineActions.appendChild(delLineBtn);
            instLineEl.appendChild(lineActions);
          }

          secEl.appendChild(instLineEl);
          return;
        }

        // Case B: Regular Lyrics Line
        const lineEl = document.createElement('div');
        lineEl.className = 'song-line';
        lineEl.dataset.sectionIndex = si;
        lineEl.dataset.lineIndex = li;
        lineEl.dataset.globalLineIndex = currentGlobalLineIdx;

        const words = (line.lyrics || '').split(/\s+/).filter(w => w.length > 0);

        if (words.length === 0 && editable) {
          const emptyWord = document.createElement('span');
          emptyWord.className = 'chord-word empty-line-placeholder';
          emptyWord.innerHTML = '<span class="word-text text-muted">[Empty line - click ✏️ to add lyrics]</span>';
          lineEl.appendChild(emptyWord);
        }

        words.forEach((word, wi) => {
          const wrap = document.createElement('span');
          wrap.className = 'chord-word';
          wrap.dataset.wordIndex = wi;

          const chordData = (line.chords || []).find(c => c.wordIndex === wi);

          const slot = document.createElement('span');
          slot.className = 'chord-slot';
          if (chordData) {
            const displayChord = transpose
              ? transposeChord(chordData.chord, transpose)
              : chordData.chord;
            slot.textContent = displayChord;
            slot.classList.add('has-chord');
          }

          if (editable) {
            slot.classList.add('editable');
            slot.title = 'Click to set chord';
            slot.addEventListener('click', (e) => {
              e.stopPropagation();
              if (onWordClick) {
                onWordClick(si, li, wi, slot);
              }
            });
          }

          const wordEl = document.createElement('span');
          wordEl.className = 'word-text';
          wordEl.textContent = word;

          if (editable) {
            wordEl.title = 'Double-click to edit line lyrics';
            wordEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              startEditLine(lineEl, line, section, si, li);
            });
          }

          wrap.appendChild(slot);
          wrap.appendChild(wordEl);
          lineEl.appendChild(wrap);
        });

        // Editable line action buttons
        if (editable) {
          const lineActions = document.createElement('span');
          lineActions.className = 'line-actions';

          // Edit line text
          const editLyricsBtn = document.createElement('button');
          editLyricsBtn.className = 'line-action-btn';
          editLyricsBtn.innerHTML = '✏️';
          editLyricsBtn.title = 'Edit line lyrics text';
          editLyricsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startEditLine(lineEl, line, section, si, li);
          });
          lineActions.appendChild(editLyricsBtn);

          // Split section at this line
          const splitSecBtn = document.createElement('button');
          splitSecBtn.className = 'line-action-btn';
          splitSecBtn.innerHTML = '+§';
          splitSecBtn.title = 'Split into new section from here';
          splitSecBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const linesRemaining = section.lines.slice(0, li + 1);
            const linesForNewSec = section.lines.slice(li + 1);
            if (linesForNewSec.length > 0) {
              section.lines = linesRemaining;
              song.sections.splice(si + 1, 0, {
                label: 'Section',
                lines: linesForNewSec
              });
              renderSong(song, container, options);
              if (onSongChanged) onSongChanged();
            }
          });
          lineActions.appendChild(splitSecBtn);

          // Delete line
          const delLineBtn = document.createElement('button');
          delLineBtn.className = 'line-action-btn';
          delLineBtn.innerHTML = '✕';
          delLineBtn.title = 'Delete line';
          delLineBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            section.lines.splice(li, 1);
            if (section.lines.length === 0 && song.sections.length > 1) {
              song.sections.splice(si, 1);
            }
            renderSong(song, container, options);
            if (onSongChanged) onSongChanged();
          });
          lineActions.appendChild(delLineBtn);

          lineEl.appendChild(lineActions);
        }

        secEl.appendChild(lineEl);
      });

      container.appendChild(secEl);
    });

    function startEditLine(lineEl, line, section, si, li) {
      const currentLyrics = line.lyrics || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'inline-line-input';
      input.value = currentLyrics;

      const saveEdit = () => {
        const newVal = input.value.trim();
        if (newVal) {
          line.lyrics = newVal;
        }
        renderSong(song, container, options);
        if (onSongChanged) onSongChanged();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEdit();
        } else if (e.key === 'Escape') {
          renderSong(song, container, options);
        }
      });

      input.addEventListener('blur', saveEdit);

      lineEl.innerHTML = '';
      lineEl.appendChild(input);
      input.focus();
      input.select();
    }
  }

  // Public API
  return {
    NOTES_SHARP,
    NOTES_FLAT,
    ROOT_NOTES,
    CHORD_QUALITIES,
    parseChord,
    noteIndex,
    transposeNote,
    transposeChord,
    slugify,
    parseLyrics,
    songToText,
    createSong,
    detectKey,
    moveSectionHeaderToLine,
    mergeAllSections,
    renderSong,
  };
})();
