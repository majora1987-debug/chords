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
    const m = str.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
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
    if (!semitones) return str;
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
          if (c.chord && c.chord.trim()) {
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
      
      if (firstChordParsed) {
        const firstRootIdx = noteIndex(firstChordParsed.root);
        const firstIsMin = firstChordParsed.quality.startsWith('m') && !firstChordParsed.quality.startsWith('maj');
        if (firstRootIdx === candRoot && firstIsMin === isMinor) {
          score += 4;
        }
      }

      if (lastChordParsed) {
        const lastRootIdx = noteIndex(lastChordParsed.root);
        const lastIsMin = lastChordParsed.quality.startsWith('m') && !lastChordParsed.quality.startsWith('maj');
        if (lastRootIdx === candRoot && lastIsMin === isMinor) {
          score += 3;
        }
      }

      chords.forEach(cStr => {
        const p = parseChord(cStr);
        if (!p) return;
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
   * Parse lyrics text into structured song sections.
   * Supports plain lyrics, section headers [Verse 1], and bracketed chords [G]
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
          const isStandardHeader = /^(verse\s*\d*|chorus\s*\d*|bridge\s*\d*|intro|outro|solo|pre-chorus|hook|verse|chorus)$/i.test(firstLine);
          
          if (isBracketedHeader || isStandardHeader) {
            label = firstLine.replace(/^\[|\]$/g, '').trim();
            linesToProcess = rawLines.slice(1);
          }
        }

        const parsedLines = linesToProcess.map(lineStr => {
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
        }).filter(l => l.lyrics.length > 0);

        return {
          label: label,
          lines: parsedLines.length > 0 ? parsedLines : [{ lyrics: 'Lyrics line', chords: [] }]
        };
      });
  }

  /**
   * Convert a structured song back to text (plain lyrics or ChordPro with chords).
   */
  function songToText(song, includeChords = true) {
    if (!song || !song.sections || song.sections.length === 0) return '';

    return song.sections.map(sec => {
      let secStr = '';
      if (sec.label && sec.label.trim()) {
        secStr += `[${sec.label.trim()}]\n`;
      }
      const linesStr = (sec.lines || []).map(line => {
        if (!includeChords || !line.chords || line.chords.length === 0) {
          return line.lyrics || '';
        }
        const words = (line.lyrics || '').split(/\s+/).filter(w => w.length > 0);
        return words.map((w, wi) => {
          const chordObj = line.chords.find(c => c.wordIndex === wi);
          return (chordObj ? `[${chordObj.chord}]` : '') + w;
        }).join(' ');
      }).join('\n');

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
   * All lines before the target index go above the section header,
   * and lines from the target index onwards remain below/inside it.
   */
  function moveSectionHeaderToLine(song, fromSectionIndex, targetGlobalLineIndex) {
    if (!song || !song.sections || song.sections.length === 0) return;
    
    // 1. Flatten all lines and record initial header line boundaries
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

    // 2. Find the header that is being moved
    const movedHeader = headers.find(h => h.originalSecIdx === fromSectionIndex);
    if (!movedHeader) return;
    
    // Bound target index
    const newIndex = Math.max(0, Math.min(targetGlobalLineIndex, allLines.length));
    movedHeader.startLineIndex = newIndex;

    // 3. Sort headers by startLineIndex (stable sort preserving relative original order)
    headers.sort((a, b) => {
      if (a.startLineIndex !== b.startLineIndex) {
        return a.startLineIndex - b.startLineIndex;
      }
      return a.originalSecIdx - b.originalSecIdx;
    });

    // 4. Reconstruct song.sections
    const newSections = [];
    
    // If lines exist before the first header, create an unlabelled top section
    if (headers[0].startLineIndex > 0) {
      newSections.push({
        label: '',
        lines: allLines.slice(0, headers[0].startLineIndex)
      });
    }

    // Build each section between its header and the next
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
   * Merge all sections into a single continuous lyrics block (keeping all lyrics and chords).
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
   * Render a song into a container DOM element.
   *
   * Options:
   *   transpose         — semitones to transpose (default 0)
   *   editable          — if true, enables interactive editing
   *   onWordClick       — callback(sectionIndex, lineIndex, wordIndex, slotElement)
   *   onSongChanged     — callback() called whenever sections/lines/labels are modified
   *   justDroppedSecIdx — optional index of section that was just dropped for settle animation
   */
  function renderSong(song, container, options = {}) {
    const {
      transpose = 0,
      editable = false,
      onWordClick = null,
      onSongChanged = null,
      justDroppedSecIdx = null,
    } = options;

    container.innerHTML = '';

    if (!song || !song.sections || song.sections.length === 0) {
      if (editable) {
        const emptySec = document.createElement('div');
        emptySec.className = 'empty-sections-notice';
        emptySec.innerHTML = `<p>No lyrics found. <button class="btn btn-sm btn-primary" id="add-first-sec-btn">+ Add Line</button></p>`;
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

            // Create smooth Trello-style floating card
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

              // Activate drag after 3px movement threshold
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

              // Raycast to find target line under cursor
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
                  // If hovering directly over a section header
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
          labelEl.title = 'Click to edit section name';
          
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

          // Add Line
          const addLineBtn = document.createElement('button');
          addLineBtn.className = 'sec-ctrl-btn';
          addLineBtn.innerHTML = '+ Line';
          addLineBtn.title = 'Add line to this section';
          addLineBtn.addEventListener('click', () => {
            if (!section.lines) section.lines = [];
            section.lines.push({ lyrics: 'New lyrics line', chords: [] });
            renderSong(song, container, options);
            if (onSongChanged) onSongChanged();
          });
          controls.appendChild(addLineBtn);

          // Remove Section Header (Preserving all lyrics)
          if (hasLabel) {
            const removeLabelBtn = document.createElement('button');
            removeLabelBtn.className = 'sec-ctrl-btn';
            removeLabelBtn.innerHTML = '✕ Label';
            removeLabelBtn.title = 'Remove section header (keeps all lyrics intact)';
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
          delBtn.title = 'Delete section and its lines';
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
