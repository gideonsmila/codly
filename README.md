# Codly

Codly is a Chrome Manifest V3 extension that adds AI-assisted code review tools to GitHub pull request pages. Select code in a PR diff, then ask Codly to explain it, suggest improvements, find bugs, or simplify it.

## Features

- Works on GitHub pull request pages.
- Opens from selected text with a floating action button or the browser context menu.
- Streams AI responses into a draggable side panel.
- Supports Explain, Improve, Find Bugs, and Simplify actions.
- Can include the visible PR diff for richer context.
- Supports either KeylessAI without an API key or OpenAI with your own API key.
- Includes optional local hot reload for extension development.

## Install Locally

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this repository folder, the folder that contains `manifest.json`.
6. Pin Codly from the Chrome extensions menu if you want quick access to settings.

After loading the extension, Codly runs on URLs that match:

```text
https://github.com/*/pull/*
```

## Configure

1. Click the Codly extension icon.
2. Choose a provider:
   - `KeylessAI`: no API key required.
   - `OpenAI`: requires an OpenAI API key.
3. Choose a model.
4. Optional: turn on `Include PR context` to send the current PR diff with selected text.
5. Optional: turn on `Hot Reload` when developing locally.
6. Click `Save Settings`.

OpenAI API keys are stored in Chrome local extension storage. Do not paste keys into GitHub issues, commits, screenshots, or shared logs.

## Use

1. Open any GitHub pull request.
2. Select code or text in the PR diff.
3. Click the Codly sparkle button that appears near the selection.
4. Read the streamed response in the Codly panel.
5. Use the quick action buttons to switch between:
   - `Explain`
   - `Improve`
   - `Find Bugs`
   - `Simplify`
6. Use the copy button in the panel header to copy the generated response.
7. Press `Escape` or click the close button to dismiss the panel.

You can also right-click selected text on a GitHub PR page and choose `Explain with Codly`.

## PR Context

When `Include PR context` is enabled, Codly scrapes the visible PR diff from the page and sends it with the selected code. This can improve answers for code that depends on surrounding changes.

The extension limits the sent diff context to keep requests manageable. If GitHub has collapsed files or hidden large diffs, expand the relevant sections before asking Codly.

## Development

There is no build step and no package install required for the current extension. Chrome loads the source files directly.

For local hot reload while editing:

```sh
node dev-server.js
```

Then open the Codly popup and enable `Hot Reload`. The background service worker polls `http://localhost:9876/timestamp` and reloads GitHub PR tabs plus the extension when watched files change.

Watched file types are:

```text
.js, .html, .css, .json
```

## File Overview

- `manifest.json`: Chrome extension manifest, permissions, content script registration, and icons.
- `background.js`: context menu, navigation handling, provider requests, streaming, key validation, and hot reload polling.
- `content.js`: GitHub page integration, text selection, floating action button, Codly panel, markdown rendering, and PR diff scraping.
- `popup.html`, `popup.css`, `popup.js`: settings popup UI.
- `styles.css`: shadow-DOM panel styles injected into GitHub pages.
- `dev-server.js`: local hot reload timestamp server.
- `icons/`: extension icons.

## Troubleshooting

- If Codly does not appear, confirm the page URL is a GitHub pull request URL and reload the tab.
- If the context menu item is missing, reload the extension from `chrome://extensions`.
- If OpenAI requests fail, reopen the popup and validate that the API key starts with `sk-`.
- If answers lack PR context, expand hidden diff sections in GitHub and enable `Include PR context`.
- If hot reload does nothing, make sure `node dev-server.js` is running and `Hot Reload` is enabled in the popup.
