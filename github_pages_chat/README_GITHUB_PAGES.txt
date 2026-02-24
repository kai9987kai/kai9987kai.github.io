Champion Chat Static Web (GitHub Pages)

What this is
- A browser-only chat UI (`index.html`) that loads a Champion chat metadata JSON and runs retrieval in JavaScript.
- It works on GitHub Pages (no Python server).

Important limitation
- PyTorch `.pth` model weights do NOT run in GitHub Pages / browser JS directly.
- This static version uses the metadata JSON as the browser-readable model source.

Files
- `index.html` -> static chat UI
- `chat_model_meta_supermix_v27_500k.browser.json` -> lightweight browser metadata (recommended)

How to publish on GitHub Pages
1. Create a repo (or folder in an existing repo) for the site.
2. Upload `index.html` and `chat_model_meta_supermix_v27_500k.browser.json` to the published folder.
3. Enable GitHub Pages for that branch/folder.
4. Open the site URL and click `Load Metadata` (default file name already matches).

Optional
- You can also point the Metadata URL box to a different `chat_model_meta_*.browser.json`.

If you need the real neural `.pth` model in web
- Convert the model to ONNX / WebGPU-compatible format and port the feature + ranking pipeline to browser JS.
- That is a different deployment target than GitHub Pages static hosting.

