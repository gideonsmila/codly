document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('provider');
  const apiKeySection = document.getElementById('apiKeySection');
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const includeContextToggle = document.getElementById('includeContext');
  const hotReloadToggle = document.getElementById('hotReload');
  const saveBtn = document.getElementById('saveBtn');
  const saveMessage = document.getElementById('saveMessage');
  const keyStatus = document.getElementById('keyStatus');
  const toggleVisibility = document.getElementById('toggleVisibility');

  const MODELS = {
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o (recommended)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (faster)' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (cheapest)' },
    ],
    keylessai: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'llama-4-maverick', label: 'Llama 4 Maverick' },
    ]
  };

  function updateUIForProvider(provider, savedModel) {
    const needsKey = provider === 'openai';
    apiKeySection.style.display = needsKey ? '' : 'none';

    if (!needsKey) {
      keyStatus.textContent = '';
      keyStatus.className = 'codly-status';
    }

    const models = MODELS[provider] || MODELS.keylessai;
    modelSelect.innerHTML = models
      .map(m => `<option value="${m.value}">${m.label}</option>`)
      .join('');

    if (savedModel && models.some(m => m.value === savedModel)) {
      modelSelect.value = savedModel;
    }
  }

  // Load saved settings
  chrome.storage.local.get(['apiKey', 'model', 'provider', 'includeContext', 'hotReload'], (result) => {
    const provider = result.provider || 'keylessai';
    providerSelect.value = provider;
    updateUIForProvider(provider, result.model);

    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      if (provider === 'openai') validateKey(result.apiKey);
    }
    if (result.includeContext !== undefined) {
      includeContextToggle.checked = result.includeContext;
    }
    if (result.hotReload !== undefined) {
      hotReloadToggle.checked = result.hotReload;
    }
  });

  providerSelect.addEventListener('change', () => {
    updateUIForProvider(providerSelect.value);
  });

  // Toggle API key visibility
  toggleVisibility.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleVisibility.querySelector('svg').innerHTML = isPassword
      ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });

  // Validate key on input (debounced)
  let validateTimeout;
  apiKeyInput.addEventListener('input', () => {
    clearTimeout(validateTimeout);
    const key = apiKeyInput.value.trim();
    if (!key) {
      keyStatus.textContent = '';
      keyStatus.className = 'codly-status';
      return;
    }
    keyStatus.textContent = 'Checking...';
    keyStatus.className = 'codly-status checking';
    validateTimeout = setTimeout(() => validateKey(key), 800);
  });

  function validateKey(key) {
    chrome.runtime.sendMessage({ type: 'VALIDATE_KEY', apiKey: key }, (response) => {
      if (chrome.runtime.lastError) {
        keyStatus.textContent = 'Could not validate';
        keyStatus.className = 'codly-status invalid';
        return;
      }
      if (response?.valid) {
        keyStatus.textContent = 'Valid API key';
        keyStatus.className = 'codly-status valid';
      } else {
        keyStatus.textContent = 'Invalid API key';
        keyStatus.className = 'codly-status invalid';
      }
    });
  }

  // Save settings
  saveBtn.addEventListener('click', () => {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const includeContext = includeContextToggle.checked;
    const hotReload = hotReloadToggle.checked;

    if (provider === 'openai') {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        showSaveMessage('Please enter an API key', 'error');
        return;
      }
      if (!apiKey.startsWith('sk-')) {
        showSaveMessage('API key should start with "sk-"', 'error');
        return;
      }
      chrome.storage.local.set({ provider, apiKey, model, includeContext, hotReload }, () => {
        showSaveMessage('Settings saved!', 'success');
      });
    } else {
      chrome.storage.local.set({ provider, model, includeContext, hotReload }, () => {
        showSaveMessage('Settings saved!', 'success');
      });
    }
  });

  function showSaveMessage(text, type) {
    saveMessage.textContent = text;
    saveMessage.className = `codly-save-msg ${type}`;
    setTimeout(() => {
      saveMessage.textContent = '';
      saveMessage.className = 'codly-save-msg';
    }, 2500);
  }
});
