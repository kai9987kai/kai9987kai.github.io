Champion Chat Static Web (GitHub Pages)

What this is
- A web chat UI (`index.html`) with two modes:
  - `Static Metadata` (browser-only retrieval from metadata JSON; works on GitHub Pages)
  - `Full Model API` (calls a Flask/PyTorch backend that runs the real `.pth` model)

Important limitation
- PyTorch `.pth` model weights do NOT run in GitHub Pages / browser JS directly.
- GitHub Pages can host the interface, but the full model must run on a separate Python backend.

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
- You can switch to `Full Model API` mode and point the interface to a Flask backend URL.

Full Model API mode (real `.pth` model)
1. Run `chat_web_app.py` on a machine that has the `.pth` weights and full metadata JSON.
2. In the web UI, switch `Run Mode` to `Full Model API`.
3. Set the backend API URL and backend file paths, then click `Load Full Model`.
4. Chat normally; requests go to `/api/chat` on the Flask backend.

If you need the real neural `.pth` model in web
- Convert the model to ONNX / WebGPU-compatible format and port the feature + ranking pipeline to browser JS.
- That is a different deployment target than GitHub Pages static hosting.
