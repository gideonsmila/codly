(() => {
  if (window.__codlyInitialized) return;
  window.__codlyInitialized = true;

  const ICONS = {
    sparkle: `<svg viewBox="0 0 24 24"><path d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8Z"/><circle cx="19" cy="5" r="1.5" fill="currentColor"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    codly: `<svg viewBox="0 0 24 24"><polyline points="8,4 3,12 8,20"/><polyline points="16,4 21,12 16,20"/><circle cx="12" cy="12" r="2" fill="#bb9af7" stroke="none"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    lightbulb: `<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>`,
    bug: `<svg viewBox="0 0 24 24"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`,
    wand: `<svg viewBox="0 0 24 24"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5"/><line x1="2" y1="22" x2="15" y2="9"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
  };

  const LANG_COLORS = {
    javascript: '#f1e05a', typescript: '#3178c6', python: '#3572a5',
    java: '#b07219', go: '#00add8', rust: '#dea584', ruby: '#701516',
    php: '#4f5d95', c: '#555555', 'c++': '#f34b7d', 'c#': '#178600',
    swift: '#f05138', kotlin: '#a97bff', scala: '#c22d40', dart: '#00b4ab',
    html: '#e34c26', css: '#563d7c', scss: '#c6538c', sql: '#e38c00',
    shell: '#89e051', bash: '#89e051', yaml: '#cb171e', json: '#292929',
    markdown: '#083fa1', dockerfile: '#384d54', terraform: '#5c4ee5',
    graphql: '#e10098', vue: '#41b883', svelte: '#ff3e00', react: '#61dafb',
    angular: '#dd0031', elixir: '#6e4a7e', haskell: '#5e5086', lua: '#000080',
    perl: '#0298c3', r: '#198ce7', julia: '#9558b2', zig: '#ec915c',
  };

  let shadowHost = null;
  let shadowRoot = null;
  let fab = null;
  let panel = null;
  let includeContext = false;
  let currentSelection = '';
  let currentFileInfo = null;
  let currentIntent = 'explain';
  let customQuestion = '';
  let previousResponse = '';
  let streamedText = '';
  let isStreaming = false;

  function initShadowDOM() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.id = 'codly-shadow-host';
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    shadowRoot.appendChild(link);
  }

  // Detect which file the selected text belongs to
  function detectFileFromSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let node = selection.anchorNode;
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // GitHub wraps each file diff in a div with data-tagsearch-path or similar
        const fileContainer = node.closest?.('[data-tagsearch-path], .file, [id^="diff-"]');
        if (fileContainer) {
          const pathEl = fileContainer.querySelector(
            '.file-header [title], .file-header a[title], .file-info a, ' +
            'a.Link--primary[title], .Truncate a, [data-tagsearch-path]'
          );
          if (pathEl) {
            const filename = pathEl.getAttribute('title') ||
                             pathEl.getAttribute('data-tagsearch-path') ||
                             pathEl.textContent.trim();
            if (filename) {
              return {
                filename,
                extension: filename.split('.').pop()?.toLowerCase() || '',
                language: extToLanguage(filename.split('.').pop()?.toLowerCase() || '')
              };
            }
          }
          // Fallback: try the file header text
          const header = fileContainer.querySelector('.file-header, .file-info');
          if (header) {
            const text = header.textContent.trim().split('\n')[0].trim();
            if (text.includes('.')) {
              return {
                filename: text,
                extension: text.split('.').pop()?.toLowerCase() || '',
                language: extToLanguage(text.split('.').pop()?.toLowerCase() || '')
              };
            }
          }
        }
      }
      node = node.parentNode;
    }
    return null;
  }

  function extToLanguage(ext) {
    const map = {
      js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
      ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript',
      py: 'Python', pyw: 'Python', pyi: 'Python',
      rb: 'Ruby', java: 'Java', kt: 'Kotlin', kts: 'Kotlin',
      go: 'Go', rs: 'Rust', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++',
      cs: 'C#', swift: 'Swift', m: 'Objective-C',
      php: 'PHP', scala: 'Scala', dart: 'Dart', lua: 'Lua',
      r: 'R', jl: 'Julia', ex: 'Elixir', exs: 'Elixir', erl: 'Erlang',
      hs: 'Haskell', pl: 'Perl', zig: 'Zig',
      html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
      vue: 'Vue', svelte: 'Svelte',
      sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
      sh: 'Shell', bash: 'Bash', zsh: 'Shell', fish: 'Shell',
      yml: 'YAML', yaml: 'YAML', json: 'JSON', toml: 'TOML', xml: 'XML',
      md: 'Markdown', mdx: 'MDX', rst: 'reStructuredText',
      dockerfile: 'Dockerfile', tf: 'Terraform', hcl: 'Terraform',
      proto: 'Protocol Buffers', sol: 'Solidity',
    };
    return map[ext] || null;
  }

  function scrapePRDiff() {
    const diffLines = [];

    document.querySelectorAll('.diff-table .blob-code-inner').forEach(el => {
      diffLines.push(el.textContent);
    });
    if (diffLines.length > 0) return diffLines.join('\n');

    document.querySelectorAll('[data-diff-anchor]').forEach(block => {
      const codeEls = block.querySelectorAll('.blob-code-inner, .blob-code');
      codeEls.forEach(el => diffLines.push(el.textContent));
    });
    if (diffLines.length > 0) return diffLines.join('\n');

    document.querySelectorAll('.file .blob-wrapper code, .file .blob-wrapper .blob-code-inner').forEach(el => {
      diffLines.push(el.textContent);
    });
    if (diffLines.length > 0) return diffLines.join('\n');

    const prBody = document.querySelector('.comment-body');
    if (prBody) return prBody.textContent;

    return '';
  }

  function showFab(clientX, clientY) {
    removeFab();
    initShadowDOM();

    fab = document.createElement('div');
    fab.className = 'codly-fab';
    fab.innerHTML = ICONS.sparkle;
    fab.title = 'Explain with Codly';

    let left = clientX + 8;
    let top = clientY - 44;
    if (left + 44 > window.innerWidth) left = clientX - 44;
    if (top < 0) top = clientY + 8;

    fab.style.left = `${left}px`;
    fab.style.top = `${top}px`;

    fab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentIntent = 'explain';
      triggerExplanation(currentSelection);
    });

    shadowRoot.appendChild(fab);
  }

  function removeFab() {
    if (fab && fab.parentNode) {
      fab.remove();
      fab = null;
    }
  }

  function removePanel() {
    if (panel && panel.parentNode) {
      panel.remove();
      panel = null;
    }
    isStreaming = false;
  }

  function renderMarkdown(text) {
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      codeBlocks.push(`<pre><code>${escaped}</code></pre>`);
      return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
    });

    const inlineCodes = [];
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      inlineCodes.push(`<code>${escaped}</code>`);
      return `%%INLINE_${inlineCodes.length - 1}%%`;
    });

    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    codeBlocks.forEach((block, i) => {
      text = text.replace(`%%CODEBLOCK_${i}%%`, block);
    });
    inlineCodes.forEach((code, i) => {
      text = text.replace(`%%INLINE_${i}%%`, code);
    });

    return text;
  }

  function truncateText(text, maxLen = 200) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  function escapeHTML(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Parse the JSON metadata line from the AI response
  function parseMetadataAndContent(fullText) {
    const lines = fullText.split('\n');
    let metadata = null;
    let contentStart = 0;

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.language !== undefined) {
            metadata = parsed;
            contentStart = i + 1;
            // Skip blank line after metadata
            if (lines[contentStart]?.trim() === '') contentStart++;
            break;
          }
        } catch {}
      }
    }

    const content = lines.slice(contentStart).join('\n').trim();
    return { metadata, content };
  }

  function buildBadgesHTML(fileInfo, aiMetadata) {
    const badges = [];

    // File name badge with extension
    if (fileInfo?.filename) {
      const shortName = fileInfo.filename.split('/').pop();
      const ext = fileInfo.extension ? `.${fileInfo.extension}` : '';
      badges.push(`<span class="codly-badge codly-badge-file" title="${fileInfo.filename}">${ICONS.file}<span>${shortName}</span></span>`);
      if (ext) {
        badges.push(`<span class="codly-badge codly-badge-ext">${ext}</span>`);
      }
    }

    // Language badge with color dot
    const lang = aiMetadata?.language || fileInfo?.language;
    if (lang) {
      const colorKey = lang.toLowerCase();
      const color = LANG_COLORS[colorKey] || '#7aa2f7';
      badges.push(`<span class="codly-badge codly-badge-lang"><span class="codly-lang-dot" style="background:${color}"></span>${lang}</span>`);
    }

    // Version badge
    if (aiMetadata?.version) {
      badges.push(`<span class="codly-badge codly-badge-version">${aiMetadata.version}</span>`);
    }

    // Framework badge
    if (aiMetadata?.framework) {
      badges.push(`<span class="codly-badge codly-badge-framework">${aiMetadata.framework}</span>`);
    }

    if (badges.length === 0) return '';
    return `<div class="codly-badges">${badges.join('')}</div>`;
  }

  function showPanel(selectedText) {
    removePanel();
    initShadowDOM();
    streamedText = '';
    isStreaming = true;

    currentFileInfo = detectFileFromSelection();

    panel = document.createElement('div');
    panel.className = 'codly-panel';

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const panelW = Math.min(460, viewW - 32);

    panel.style.right = '16px';
    panel.style.top = `${Math.max(16, (viewH - 560) / 2)}px`;
    panel.style.width = `${panelW}px`;

    const fileBadgeHTML = currentFileInfo
      ? `<span class="codly-header-file" title="${currentFileInfo.filename}">${ICONS.file}<span>${currentFileInfo.filename.split('/').pop()}</span></span>`
      : '';

    panel.innerHTML = `
      <div class="codly-panel-header">
        <div class="codly-panel-title">
          ${ICONS.codly}
          <span>Codly</span>
          ${fileBadgeHTML}
        </div>
        <div class="codly-panel-actions">
          <button class="codly-copy-btn" aria-label="Copy explanation" title="Copy to clipboard">
            ${ICONS.copy}
          </button>
          <button class="codly-close-btn" aria-label="Close" title="Close">
            ${ICONS.close}
          </button>
        </div>
      </div>
      <div class="codly-context-bar">
        <span class="codly-context-label">Include PR context</span>
        <label class="codly-toggle">
          <input type="checkbox" ${includeContext ? 'checked' : ''}>
          <span class="codly-toggle-track"></span>
          <span class="codly-toggle-thumb"></span>
        </label>
      </div>
      <div class="codly-selected-preview">
        <code>${escapeHTML(truncateText(selectedText))}</code>
      </div>
      <div class="codly-badges-container"></div>
      <div class="codly-panel-content">
        <div class="codly-loading">
          <div class="codly-spinner"></div>
          <span>Analyzing code...</span>
        </div>
      </div>
      <div class="codly-quick-actions">
        <button class="codly-action-btn ${currentIntent === 'explain' ? 'active' : ''}" data-intent="explain" title="Explain this code">
          ${ICONS.sparkle}<span>Explain</span>
        </button>
        <button class="codly-action-btn ${currentIntent === 'suggest' ? 'active' : ''}" data-intent="suggest" title="Suggest improvements">
          ${ICONS.lightbulb}<span>Improve</span>
        </button>
        <button class="codly-action-btn ${currentIntent === 'bugs' ? 'active' : ''}" data-intent="bugs" title="Find potential bugs">
          ${ICONS.bug}<span>Find Bugs</span>
        </button>
        <button class="codly-action-btn ${currentIntent === 'simplify' ? 'active' : ''}" data-intent="simplify" title="Simplify this code">
          ${ICONS.wand}<span>Simplify</span>
        </button>
      </div>
      <form class="codly-ask-form">
        <input class="codly-ask-input" type="text" placeholder="Ask a follow-up about this code..." value="${escapeHTML(customQuestion)}">
        <button class="codly-ask-submit" type="submit" title="Ask Codly" aria-label="Ask Codly">
          ${ICONS.send}
        </button>
        <div class="codly-ask-error" aria-live="polite"></div>
      </form>
      <div class="codly-panel-footer">
        <span>Powered by OpenAI</span>
      </div>
    `;

    // Close button
    panel.querySelector('.codly-close-btn').addEventListener('click', () => {
      removePanel();
    });

    // Copy button
    panel.querySelector('.codly-copy-btn').addEventListener('click', () => {
      const { content } = parseMetadataAndContent(streamedText);
      if (!content) return;
      navigator.clipboard.writeText(content).then(() => {
        const btn = panel.querySelector('.codly-copy-btn');
        btn.innerHTML = ICONS.check;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = ICONS.copy;
          btn.classList.remove('copied');
        }, 1500);
      });
    });

    // Context toggle
    const toggle = panel.querySelector('.codly-toggle input');
    toggle.addEventListener('change', () => {
      includeContext = toggle.checked;
      requestExplanation(selectedText);
    });

    // Quick action buttons
    panel.querySelectorAll('.codly-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const intent = btn.dataset.intent;
        currentIntent = intent;
        panel.querySelectorAll('.codly-action-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        requestExplanation(selectedText);
      });
    });

    const askForm = panel.querySelector('.codly-ask-form');
    const askInput = panel.querySelector('.codly-ask-input');
    askForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const question = askInput.value.trim();
      const errorEl = panel.querySelector('.codly-ask-error');
      if (!question) {
        errorEl.textContent = 'Enter a question first.';
        askInput.focus();
        return;
      }
      errorEl.textContent = '';
      customQuestion = question;
      requestExplanation(selectedText, 'ask');
    });

    // Show file badges immediately
    if (currentFileInfo) {
      const badgesContainer = panel.querySelector('.codly-badges-container');
      badgesContainer.innerHTML = buildBadgesHTML(currentFileInfo, null);
    }

    shadowRoot.appendChild(panel);
    makeDraggable(panel);
    requestExplanation(selectedText);
  }

  function makeDraggable(el) {
    const header = el.querySelector('.codly-panel-header');
    let isDragging = false;
    let startX, startY, origX, origY;

    header.style.cursor = 'grab';

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.codly-close-btn') || e.target.closest('.codly-copy-btn')) return;
      isDragging = true;
      header.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.right = 'auto';
      el.style.left = `${origX + dx}px`;
      el.style.top = `${origY + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });
  }

  function updatePanelContent(fullText, done) {
    const contentEl = panel?.querySelector('.codly-panel-content');
    if (!contentEl) return;

    const { metadata, content } = parseMetadataAndContent(fullText);

    // Update badges with AI metadata (language/version/framework) once detected
    if (metadata) {
      const badgesContainer = panel?.querySelector('.codly-badges-container');
      if (badgesContainer && !badgesContainer.dataset.aiFilled) {
        badgesContainer.innerHTML = buildBadgesHTML(currentFileInfo, metadata);
        badgesContainer.dataset.aiFilled = 'true';
      }
    }

    const displayText = content || fullText;
    if (!displayText.trim()) {
      contentEl.innerHTML = `
        <div class="codly-loading">
          <div class="codly-spinner"></div>
          <span>Analyzing code...</span>
        </div>
      `;
      return;
    }

    const cursorHTML = done ? '' : '<span class="codly-cursor"></span>';
    contentEl.innerHTML = `<div class="codly-markdown">${renderMarkdown(displayText)}${cursorHTML}</div>`;

    contentEl.scrollTop = contentEl.scrollHeight;
  }

  function requestExplanation(selectedText, intentOverride = currentIntent) {
    const contentEl = panel?.querySelector('.codly-panel-content');
    if (!contentEl) return;

    streamedText = '';
    isStreaming = true;

    // Reset AI metadata badges but keep file info
    const badgesContainer = panel?.querySelector('.codly-badges-container');
    if (badgesContainer) {
      badgesContainer.innerHTML = buildBadgesHTML(currentFileInfo, null);
      delete badgesContainer.dataset.aiFilled;
    }

    contentEl.innerHTML = `
      <div class="codly-loading">
        <div class="codly-spinner"></div>
        <span>Analyzing code...</span>
      </div>
    `;

    const prDiff = includeContext ? scrapePRDiff() : '';

    chrome.runtime.sendMessage(
      {
        type: 'EXPLAIN_CODE',
        selectedText,
        prDiff,
        includeContext,
        intent: intentOverride,
        customQuestion: intentOverride === 'ask' ? customQuestion : '',
        previousResponse
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showError(contentEl, 'Connection error. Please try again.');
          isStreaming = false;
          return;
        }
        if (response?.error) {
          showError(contentEl, response.error);
          isStreaming = false;
        }
      }
    );
  }

  function showError(container, message) {
    container.innerHTML = `<div class="codly-error">${message.replace(/</g, '&lt;')}</div>`;
  }

  function triggerExplanation(text) {
    removeFab();
    showPanel(text);
  }

  // Streaming message handlers
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STREAM_CHUNK') {
      streamedText = message.fullText;
      updatePanelContent(streamedText, false);
    }

    if (message.type === 'STREAM_DONE') {
      streamedText = message.fullText;
      previousResponse = message.fullText;
      isStreaming = false;
      updatePanelContent(streamedText, true);
    }

    if (message.type === 'CONTEXT_MENU_EXPLAIN' && message.selectedText) {
      currentSelection = message.selectedText;
      currentIntent = 'explain';
      customQuestion = '';
      previousResponse = '';
      triggerExplanation(message.selectedText);
    }
  });

  // Text selection handler
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest?.('#codly-shadow-host')) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 2) {
        currentSelection = text;
        currentIntent = 'explain';
        customQuestion = '';
        previousResponse = '';
        currentFileInfo = detectFileFromSelection();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFab(rect.right, rect.top);
      } else {
        removeFab();
      }
    }, 10);
  });

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removePanel();
      removeFab();
    }
  });

  // Load user preference
  chrome.storage.local.get(['includeContext'], (result) => {
    if (result.includeContext !== undefined) {
      includeContext = result.includeContext;
    }
  });
})();
