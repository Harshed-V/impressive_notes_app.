// Impressive Notes App JavaScript
// All logic for the app, previously in <script>...</script> in index.html

// --- Data Model ---
const defaultColors = {
  "Work": "#fffbe7",
  "Personal": "#ffe7f7",
  "Study": "#e7f7ff",
  "": "#fffbe7"
};
let notes = [];
let editingNoteId = null;
let searchKeyword = "";
let tagFilter = "";
let darkMode = false;
let lockNoteId = null;
let unlockCallback = null;
let showArchive = false;
let sortBy = "created-desc";
let fontSize = "1em";
let bulkSelected = new Set();
let lastDeletedNote = null;
let lastDeletedIndex = null;
let snackbarTimeout = null;
let draft = null;
let archiveMode = false;

// --- DOM Elements ---
const notesList = document.getElementById('notesList');
const addNoteBtn = document.getElementById('addNoteBtn');
const modalBg = document.getElementById('modalBg');
const modal = document.getElementById('modal');
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const noteTag = document.getElementById('noteTag');
const noteColor = document.getElementById('noteColor');
const charCount = document.getElementById('charCount');
const cancelBtn = document.getElementById('cancelBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const searchInput = document.getElementById('searchInput');
const tagFilterSelect = document.getElementById('tagFilter');
const darkModeBtn = document.getElementById('darkModeBtn');
const modalTitle = document.getElementById('modalTitle');
const sortSelect = document.getElementById('sortSelect');
const fontSizeSelect = document.getElementById('fontSizeSelect');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const bulkDownloadBtn = document.getElementById('bulkDownloadBtn');
const archiveToggleBtn = document.getElementById('archiveToggleBtn');
const archiveLabel = document.getElementById('archiveLabel');
// Snackbar
const snackbar = document.getElementById('snackbar');
const snackbarMsg = document.getElementById('snackbarMsg');
const undoBtn = document.getElementById('undoBtn');
// Lock modal
const lockModalBg = document.getElementById('lockModalBg');
const lockModal = document.getElementById('lockModal');
const lockForm = document.getElementById('lockForm');
const lockPinInput = document.getElementById('lockPinInput');
const lockModalTitle = document.getElementById('lockModalTitle');
const lockCancelBtn = document.getElementById('lockCancelBtn');
// Emoji picker
const emojiPicker = document.getElementById('emojiPicker');
// Stats Dashboard
const statsDashboard = document.getElementById('statsDashboard');
const folderFilterSelect = document.getElementById('folderFilter');
// Markdown preview
const markdownPreview = document.getElementById('markdownPreview');

// --- Utility Functions ---
function saveNotes() {
  localStorage.setItem('notes', JSON.stringify(notes));
}
function loadNotes() {
  notes = JSON.parse(localStorage.getItem('notes') || '[]');
}
function saveTheme() {
  localStorage.setItem('darkMode', darkMode ? '1' : '0');
}
function loadTheme() {
  darkMode = localStorage.getItem('darkMode') === '1';
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
  darkModeBtn.textContent = darkMode ? '☀️' : '🌙';
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
function getCharCount(text) {
  return text.length;
}
function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function updateTagFilterOptions() {
  const tags = Array.from(new Set(notes.map(n => n.tag).filter(Boolean)));
  tagFilterSelect.innerHTML = `<option value="">All Tags</option>`;
  tags.forEach(tag => {
    tagFilterSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
  });
}
function showModal(editing = false, note = null) {
  modalBg.style.display = 'flex';
  modalTitle.textContent = editing ? 'Edit Note' : 'Add Note';
  if (editing && note) {
    noteTitle.value = note.title;
    noteContent.value = note.content;
    noteTag.value = note.tag;
    noteColor.value = note.color || defaultColors[note.tag] || "#fffbe7";
    editingNoteId = note.id;
    updateCharCount();
    updateMarkdownPreview(); // Update preview on edit
  } else {
    // Restore draft if available
    const draftStr = localStorage.getItem('noteDraft');
    if (draftStr) {
      if (confirm('Restore unsaved draft?')) {
        const d = JSON.parse(draftStr);
        noteTitle.value = d.title || '';
        noteContent.value = d.content || '';
        noteTag.value = d.tag || '';
        noteColor.value = d.color || defaultColors[d.tag] || "#fffbe7";
      } else {
        noteTitle.value = '';
        noteContent.value = '';
        noteTag.value = '';
        noteColor.value = "#fffbe7";
      }
    } else {
      noteTitle.value = '';
      noteContent.value = '';
      noteTag.value = '';
      noteColor.value = "#fffbe7";
    }
    editingNoteId = null;
    updateCharCount();
    updateMarkdownPreview(); // Update preview on new note
  }
  noteTitle.focus();
}
function hideModal() {
  modalBg.style.display = 'none';
  editingNoteId = null;
  // Save draft if not saved
  if (!noteForm.checkValidity() || !noteContent.value.trim()) {
    localStorage.setItem('noteDraft', JSON.stringify({
      title: noteTitle.value,
      content: noteContent.value,
      tag: noteTag.value,
      color: noteColor.value
    }));
  } else {
    localStorage.removeItem('noteDraft');
  }
}
function showLockModal(noteId, unlockFn) {
  lockModalBg.style.display = 'flex';
  lockPinInput.value = '';
  lockPinInput.focus();
  lockNoteId = noteId;
  unlockCallback = unlockFn;
}
function hideLockModal() {
  lockModalBg.style.display = 'none';
  lockNoteId = null;
  unlockCallback = null;
}
function downloadNote(note) {
  const blob = new Blob([`Title: ${note.title}\nTag: ${note.tag}\nCreated: ${formatDate(note.created)}\n\n${note.content}`], {type: "text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title || 'note'}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
function downloadNotesBulk(ids) {
  ids.forEach(id => {
    const note = notes.find(n => n.id === id);
    if (note) downloadNote(note);
  });
}
function getFilteredNotes() {
  let filtered = notes.filter(note => {
    if (archiveMode ? !note.archived : note.archived) return false;
    const matchesKeyword = note.title.toLowerCase().includes(searchKeyword) ||
                          note.content.toLowerCase().includes(searchKeyword);
    const matchesTag = !tagFilter || note.tag === tagFilter;
    return matchesKeyword && matchesTag;
  });
  // Sort
  filtered = filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    switch (sortBy) {
      case 'created-desc': return b.created - a.created;
      case 'created-asc': return a.created - b.created;
      case 'title-asc': return a.title.localeCompare(b.title);
      case 'title-desc': return b.title.localeCompare(a.title);
      case 'tag-asc': return (a.tag||'').localeCompare(b.tag||'');
      case 'tag-desc': return (b.tag||'').localeCompare(a.tag||'');
      default: return b.created - a.created;
    }
  });
  return filtered;
}
function updateCharCount() {
  const chars = getCharCount(noteContent.value);
  const words = getWordCount(noteContent.value);
  charCount.textContent = `${chars} chars, ${words} words`;
}
function animateNoteDelete(noteElem) {
  noteElem.style.transition = 'opacity 0.4s, transform 0.4s';
  noteElem.style.opacity = '0';
  noteElem.style.transform = 'translateY(30px) scale(0.95)';
  setTimeout(() => {
    noteElem.remove();
  }, 400);
}
function showSnackbar(msg, undoFn) {
  snackbarMsg.textContent = msg;
  snackbar.classList.add('show');
  snackbar.style.opacity = '1';
  snackbar.style.pointerEvents = 'all';
  undoBtn.onclick = () => {
    snackbar.classList.remove('show');
    snackbar.style.opacity = '0';
    snackbar.style.pointerEvents = 'none';
    if (undoFn) undoFn();
  };
  clearTimeout(snackbarTimeout);
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('show');
    snackbar.style.opacity = '0';
    snackbar.style.pointerEvents = 'none';
  }, 5000);
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m];
  });
}
function deleteNote(id, noteElem, showUndo = true) {
  const idx = notes.findIndex(n => n.id === id);
  if (idx !== -1) {
    lastDeletedNote = {...notes[idx]};
    lastDeletedIndex = idx;
    notes.splice(idx, 1);
    saveNotes();
    animateNoteDelete(noteElem);
    setTimeout(() => {
      renderNotes();
      updateTagFilterOptions();
    }, 420);
    if (showUndo) {
      showSnackbar('Note deleted', () => {
        notes.splice(lastDeletedIndex, 0, lastDeletedNote);
        saveNotes();
        renderNotes();
        updateTagFilterOptions();
      });
    }
  }
}
function toggleLock(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.locked = false;
    note.pin = '';
    saveNotes();
    renderNotes();
  }
}
function lockNotePrompt(id) {
  const pin = prompt("Set a 4-6 digit PIN to lock this note:");
  if (pin && /^\d{4,6}$/.test(pin)) {
    const note = notes.find(n => n.id === id);
    if (note) {
      note.locked = true;
      note.pin = pin;
      saveNotes();
      renderNotes();
    }
  } else if (pin !== null) {
    alert("PIN must be 4-6 digits.");
  }
}
function togglePin(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.pinned = !note.pinned;
    saveNotes();
    renderNotes();
  }
}
function toggleArchiveMode() {
  archiveMode = !archiveMode;
  archiveToggleBtn.classList.toggle('active', archiveMode);
  archiveLabel.style.display = archiveMode ? '' : 'none';
  renderNotes();
}
function archiveNote(id, noteElem) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.archived = true;
    saveNotes();
    animateNoteDelete(noteElem);
    setTimeout(() => {
      renderNotes();
    }, 420);
    showSnackbar('Note archived', () => {
      note.archived = false;
      saveNotes();
      renderNotes();
    });
  }
}
function restoreNote(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.archived = false;
    saveNotes();
    renderNotes();
  }
}
function deleteNotePermanent(id, noteElem) {
  deleteNote(id, noteElem, false);
  showSnackbar('Note permanently deleted');
}
function updateBulkButtons() {
  bulkDeleteBtn.disabled = bulkSelected.size === 0;
  bulkDownloadBtn.disabled = bulkSelected.size === 0;
}
function clearBulkSelection() {
  bulkSelected.clear();
  updateBulkButtons();
  renderNotes();
}
function insertEmoji(emoji) {
  const start = noteContent.selectionStart;
  const end = noteContent.selectionEnd;
  const text = noteContent.value;
  noteContent.value = text.slice(0, start) + emoji + text.slice(end);
  noteContent.focus();
  noteContent.selectionStart = noteContent.selectionEnd = start + emoji.length;
  updateCharCount();
  updateMarkdownPreview(); // Update preview after emoji insertion
}
function renderEmojiPicker() {
  // A small emoji set for demo
  const emojis = ['😀','😂','😍','😎','👍','🔥','🎉','💡','📚','📝','✅','❗','❓','💖','😃','😢','😡','😱','🤔','🙌','👏','🙏','🌟','📌','📍'];
  emojiPicker.innerHTML = '';
  emojis.forEach(e => {
    const span = document.createElement('span');
    span.textContent = e;
    span.title = e;
    span.onclick = () => insertEmoji(e);
    emojiPicker.appendChild(span);
  });
}
function updateMarkdownPreview() {
  const raw = noteContent.value;
  markdownPreview.innerHTML = marked.parse(raw || '');
}

// --- Render Functions ---
function renderNotes() {
  notesList.innerHTML = '';
  const filtered = getFilteredNotes();
  if (filtered.length === 0) {
    if (!archiveMode) {
      notesList.innerHTML = `
        <div style="text-align:center; color:#888; grid-column:1/-1; padding: 48px 0 32px 0;">
          <div style="font-size:3em;">🗒️</div>
          <div style="font-size:1.25em; margin: 12px 0 8px 0; color:var(--text); font-weight:600;">No notes yet</div>
          <div style="margin-bottom:18px; color:#888;">Start by adding your first note to capture your thoughts, ideas, or tasks!</div>
          <button id="firstNoteBtn" style="background:var(--accent);color:#fff;font-size:1.1em;padding:10px 28px;border:none;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);cursor:pointer;font-weight:700;transition:background 0.2s;">+ Add your first note</button>
        </div>
      `;
      // Add event listener for the button
      setTimeout(() => {
        const firstBtn = document.getElementById('firstNoteBtn');
        if (firstBtn) firstBtn.onclick = () => showModal(false);
      }, 0);
    } else {
      notesList.innerHTML = `<div style="text-align:center; color:#888; grid-column:1/-1;">No notes found.</div>`;
    }
    return;
  }
  filtered.forEach(note => {
    const noteElem = document.createElement('div');
    noteElem.className = 'note' + (note.locked ? ' locked' : '') + (editingNoteId === note.id ? ' editing' : '') + (note.pinned ? ' pinned' : '');
    noteElem.style.background = note.color || defaultColors[note.tag] || "#fffbe7";
    noteElem.style.fontSize = fontSize;
    // Bulk checkbox
    const bulkBox = document.createElement('input');
    bulkBox.type = 'checkbox';
    bulkBox.className = 'bulk-checkbox';
    bulkBox.checked = bulkSelected.has(note.id);
    bulkBox.onclick = e => {
      e.stopPropagation();
      if (bulkBox.checked) bulkSelected.add(note.id);
      else bulkSelected.delete(note.id);
      updateBulkButtons();
    };
    noteElem.appendChild(bulkBox);
    // Note content
    noteElem.innerHTML += `
      <div class="color-indicator" style="background:${note.color || defaultColors[note.tag] || "#fffbe7"}"></div>
      <div class="note-title">${note.title ? escapeHtml(note.title) : '<i>(No Title)</i>'}
        <span class="note-tooltip">${escapeHtml(note.content.slice(0, 120))}${note.content.length > 120 ? '...' : ''}</span>
      </div>
      <div class="note-tags">${note.tag ? '🏷️ ' + escapeHtml(note.tag) : ''}</div>
      <div class="note-timestamp">Created on: ${formatDate(note.created)}</div>
      <div class="note-content markdown-preview">${marked.parse(note.content)}</div>
      <div class="char-count">${getCharCount(note.content)} chars, ${getWordCount(note.content)} words</div>
      <div class="note-actions">
        <button title="Pin/Unpin" data-action="pin">${note.pinned ? '📍' : '📌'}</button>
        <button title="Edit" data-action="edit">✏️</button>
        <button title="Delete" data-action="delete">🗑️</button>
        <button title="Download" data-action="download">💾</button>
        <button title="${note.locked ? 'Unlock' : 'Lock'}" data-action="lock">${note.locked ? '🔓' : '🔒'}</button>
        <button title="${archiveMode ? 'Restore' : 'Archive'}" data-action="archive">${archiveMode ? '↩️' : '📁'}</button>
        ${archiveMode ? '<button title="Delete Permanently" data-action="delete-perm">❌</button>' : ''}
      </div>
    `;
    // Lock overlay
    if (note.locked) {
      const lockedMsg = document.createElement('div');
      lockedMsg.className = 'locked-msg';
      lockedMsg.textContent = 'Locked';
      noteElem.appendChild(lockedMsg);
    }
    // Actions
    noteElem.querySelectorAll('.note-actions button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        if (action === 'edit') {
          if (note.locked) {
            showLockModal(note.id, () => {
              showModal(true, note);
            });
          } else {
            showModal(true, note);
          }
        } else if (action === 'delete') {
          if (note.locked) {
            showLockModal(note.id, () => {
              deleteNote(note.id, noteElem);
            });
          } else {
            deleteNote(note.id, noteElem);
          }
        } else if (action === 'download') {
          if (note.locked) {
            showLockModal(note.id, () => {
              downloadNote(note);
            });
          } else {
            downloadNote(note);
          }
        } else if (action === 'lock') {
          if (note.locked) {
            showLockModal(note.id, () => {
              toggleLock(note.id);
            });
          } else {
            lockNotePrompt(note.id);
          }
        } else if (action === 'pin') {
          togglePin(note.id);
        } else if (action === 'archive') {
          if (archiveMode) {
            restoreNote(note.id);
          } else {
            archiveNote(note.id, noteElem);
          }
        } else if (action === 'delete-perm') {
          deleteNotePermanent(note.id, noteElem);
        }
      });
    });
    // Tooltip for preview
    noteElem.querySelector('.note-title').addEventListener('mouseenter', function(e) {
      const tooltip = this.querySelector('.note-tooltip');
      tooltip.style.display = 'block';
    });
    noteElem.querySelector('.note-title').addEventListener('mouseleave', function(e) {
      const tooltip = this.querySelector('.note-tooltip');
      tooltip.style.display = 'none';
    });
    notesList.appendChild(noteElem);
  });
}

// --- Event Listeners ---
addNoteBtn.addEventListener('click', () => {
  showModal(false);
});
cancelBtn.addEventListener('click', e => {
  e.preventDefault();
  hideModal();
});
noteForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();
  const tag = noteTag.value;
  const color = noteColor.value;
  if (!content) {
    alert("Content cannot be empty.");
    return;
  }
  if (editingNoteId) {
    // Edit
    const note = notes.find(n => n.id === editingNoteId);
    if (note) {
      note.title = title;
      note.content = content;
      note.tag = tag;
      note.color = color;
      note.edited = Date.now();
    }
  } else {
    // Add
    notes.unshift({
      id: 'n' + Date.now() + Math.random().toString(36).slice(2,7),
      title,
      content,
      tag,
      color,
      created: Date.now(),
      locked: false,
      pin: '',
      pinned: false,
      archived: false
    });
  }
  saveNotes();
  localStorage.removeItem('noteDraft');
  hideModal();
  renderNotes();
  updateTagFilterOptions();
});
noteContent.addEventListener('input', () => {
  updateCharCount();
  updateMarkdownPreview();
});
noteTitle.addEventListener('input', updateCharCount);
searchInput.addEventListener('input', e => {
  searchKeyword = e.target.value.trim().toLowerCase();
  renderNotes();
});
tagFilterSelect.addEventListener('change', e => {
  tagFilter = e.target.value;
  renderNotes();
});
noteTag.addEventListener('change', e => {
  noteColor.value = defaultColors[e.target.value] || "#fffbe7";
});
darkModeBtn.addEventListener('click', () => {
  darkMode = !darkMode;
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
  darkModeBtn.textContent = darkMode ? '☀️' : '🌙';
  saveTheme();
});
sortSelect.addEventListener('change', e => {
  sortBy = e.target.value;
  renderNotes();
});
fontSizeSelect.addEventListener('change', e => {
  fontSize = e.target.value;
  renderNotes();
});
bulkDeleteBtn.addEventListener('click', () => {
  if (bulkSelected.size === 0) return;
  if (!confirm('Delete selected notes?')) return;
  const ids = Array.from(bulkSelected);
  ids.forEach(id => {
    const noteElem = document.querySelector('.note input.bulk-checkbox[value="'+id+'"]')?.parentElement;
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) notes.splice(idx, 1);
  });
  saveNotes();
  clearBulkSelection();
  renderNotes();
  updateTagFilterOptions();
  showSnackbar('Bulk delete completed');
});
bulkDownloadBtn.addEventListener('click', () => {
  if (bulkSelected.size === 0) return;
  downloadNotesBulk(Array.from(bulkSelected));
  showSnackbar('Bulk download started');
});
archiveToggleBtn.addEventListener('click', toggleArchiveMode);

// Lock Modal
document.getElementById('lockForm').addEventListener('submit', e => {
  e.preventDefault();
  const pin = lockPinInput.value;
  const note = notes.find(n => n.id === lockNoteId);
  if (note && note.pin === pin) {
    note.locked = false;
    note.pin = '';
    saveNotes();
    renderNotes();
    hideLockModal();
    if (typeof unlockCallback === 'function') unlockCallback();
  } else {
    alert("Incorrect PIN.");
    lockPinInput.value = '';
    lockPinInput.focus();
  }
});
lockCancelBtn.addEventListener('click', e => {
  e.preventDefault();
  hideLockModal();
});
lockModalBg.addEventListener('click', e => {
  if (e.target === lockModalBg) hideLockModal();
});

// Modal close on background click
modalBg.addEventListener('click', e => {
  if (e.target === modalBg) hideModal();
});

// Draft auto-save
[noteTitle, noteContent, noteTag, noteColor].forEach(el => {
  el.addEventListener('input', () => {
    localStorage.setItem('noteDraft', JSON.stringify({
      title: noteTitle.value,
      content: noteContent.value,
      tag: noteTag.value,
      color: noteColor.value
    }));
  });
});

// --- Initialization ---
function init() {
  loadNotes();
  loadTheme();
  updateTagFilterOptions();
  renderNotes();
  updateCharCount();
  renderEmojiPicker();
  fontSize = fontSizeSelect.value;
}
window.addEventListener('DOMContentLoaded', init); 