chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'codly-explain',
    title: 'Explain with Codly',
    contexts: ['selection'],
    documentUrlPatterns: ['https://github.com/*/pull/*']
  });

  chrome.storage.local.set({ includeContext: false });
});

// --- Hot Reload (development) ---
const HOT_RELOAD_INTERVAL_MS = 1500;
const HOT_RELOAD_SERVER = 'http://localhost:9876';
let hotReloadTimer = null;
let hotReloadLastTimestamp = null;

async function hotReloadCheck() {
  try {
    const res = await fetch(`${HOT_RELOAD_SERVER}/timestamp`, { cache: 'no-store' });
    if (!res.ok) return;
    const { timestamp } = await res.json();
    if (hotReloadLastTimestamp !== null && timestamp !== hotReloadLastTimestamp) {
      console.log('[Codly] File change detected, reloading...');
      const tabs = await chrome.tabs.query({ url: 'https://github.com/*/pull/*' });
      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
      chrome.runtime.reload();
    }
    hotReloadLastTimestamp = timestamp;
  } catch {
    // Dev server not running — silently ignore
  }
}

function startHotReload() {
  if (hotReloadTimer) return;
  hotReloadLastTimestamp = null;
  hotReloadTimer = setInterval(hotReloadCheck, HOT_RELOAD_INTERVAL_MS);
  hotReloadCheck();
  console.log('[Codly] Hot reload enabled — polling localhost:9876');
}

function stopHotReload() {
  if (hotReloadTimer) {
    clearInterval(hotReloadTimer);
    hotReloadTimer = null;
  }
  console.log('[Codly] Hot reload disabled');
}

chrome.storage.local.get(['hotReload'], (result) => {
  if (result.hotReload) startHotReload();
});

chrome.storage.onChanged.addListener((changes) => {
  if ('hotReload' in changes) {
    if (changes.hotReload.newValue) startHotReload();
    else stopHotReload();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'codly-explain' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_MENU_EXPLAIN',
      selectedText: info.selectionText
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.url.match(/github\.com\/[^/]+\/[^/]+\/pull\//)) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['content.js']
      }).catch(() => {});
    }
  },
  { url: [{ hostSuffix: 'github.com' }] }
);

function buildSystemPrompt(includeContext, prDiff, intent) {
  const intentInstructions = {
    explain: 'Explain what the selected code does, why it exists, and any patterns or concepts it uses.',
    suggest: 'Suggest concrete improvements to the selected code. Focus on readability, performance, best practices, and potential edge cases. Show improved code when applicable.',
    bugs: 'Analyze the selected code for potential bugs, vulnerabilities, race conditions, off-by-one errors, null/undefined risks, and security issues. Be specific about what could go wrong and how to fix it.',
    simplify: 'Simplify the selected code. Show a cleaner, more readable version while preserving behavior. Explain what you changed and why it is simpler.',
    ask: 'Answer the reviewer\'s custom question about the selected code. Use the selected code, any previous Codly answer, and any PR diff context to give a direct, actionable answer.'
  };

  const task = intentInstructions[intent] || intentInstructions.explain;

  const contextNote = (includeContext && prDiff)
    ? 'You have access to the full PR diff for context. Use it to understand the broader changes.'
    : 'You do NOT have the full PR context, so give a general explanation based on your programming knowledge.';

  return `You are Codly, an expert code review assistant. The user is reviewing a GitHub pull request.

${contextNote}

${task}

IMPORTANT: At the very beginning of your response, output a single JSON metadata line in this exact format, then a blank line, then your explanation in markdown:
{"language":"<detected language>","version":"<version or null>","framework":"<framework or null>"}

For the metadata:
- "language": the programming language of the selected code (e.g. "TypeScript", "Python", "Go", "Rust", "CSS", "YAML"). Use the canonical name.
- "version": if you can confidently identify the language/runtime version from syntax features (e.g. "ES2022", "Python 3.10+", "C++20", "Java 17+"), include it. Otherwise null.
- "framework": if you recognize a specific framework or library being used (e.g. "React", "Express", "Django", "Spring Boot"), include it. Otherwise null.

Then write your explanation in clean markdown. Be concise but thorough.`;
}

function buildUserMessage(selectedText, prDiff, includeContext, customQuestion, previousResponse) {
  const previousAnswerSection = previousResponse
    ? `\n\nPrevious Codly answer for this selected code:\n\n\`\`\`markdown\n${previousResponse.slice(0, 8000)}\n\`\`\``
    : '';
  const questionSection = customQuestion
    ? `\n\nReviewer question:\n\n${customQuestion}`
    : '';

  if (includeContext && prDiff) {
    return `Here is the full PR diff for context:\n\n\`\`\`diff\n${prDiff.slice(0, 30000)}\n\`\`\`\n\nNow, analyze this selected code/text:\n\n\`\`\`\n${selectedText}\n\`\`\`${previousAnswerSection}${questionSection}`;
  }
  return `Analyze this code/text from a GitHub pull request:\n\n\`\`\`\n${selectedText}\n\`\`\`${previousAnswerSection}${questionSection}`;
}

const PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o'
  },
  keylessai: {
    baseUrl: 'https://keylessai.thryx.workers.dev/v1',
    defaultModel: 'gpt-4o'
  }
};

async function streamLLM(provider, apiKey, model, selectedText, prDiff, includeContext, intent, customQuestion, previousResponse, tabId) {
  const config = PROVIDERS[provider] || PROVIDERS.keylessai;
  const systemPrompt = buildSystemPrompt(includeContext, prDiff, intent);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserMessage(selectedText, prDiff, includeContext, customQuestion, previousResponse) }
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['Authorization'] = 'Bearer keyless';
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages,
      max_tokens: 2000,
      temperature: 0.3,
      stream: true
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          chrome.tabs.sendMessage(tabId, {
            type: 'STREAM_CHUNK',
            chunk: delta,
            fullText
          }).catch(() => {});
        }
      } catch {}
    }
  }

  chrome.tabs.sendMessage(tabId, {
    type: 'STREAM_DONE',
    fullText
  }).catch(() => {});

  return fullText;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXPLAIN_CODE') {
    const tabId = sender.tab?.id;
    chrome.storage.local.get(['apiKey', 'model', 'provider'], async (settings) => {
      const provider = settings.provider || 'keylessai';
      if (provider === 'openai' && !settings.apiKey) {
        sendResponse({ error: 'No API key configured. Click the Codly extension icon to set your OpenAI API key.' });
        return;
      }
      try {
        await streamLLM(
          provider,
          settings.apiKey,
          settings.model,
          message.selectedText,
          message.prDiff,
          message.includeContext,
          message.intent || 'explain',
          message.customQuestion || '',
          message.previousResponse || '',
          tabId
        );
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'VALIDATE_KEY') {
    fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${message.apiKey}` }
    })
      .then(res => sendResponse({ valid: res.ok }))
      .catch(() => sendResponse({ valid: false }));
    return true;
  }
});
