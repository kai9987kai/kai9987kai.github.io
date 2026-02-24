Champion Chat Static Web (GitHub Pages)

What this is
- A web chat UI (`index.html`) with three modes:
  - `Static Metadata` (browser-only retrieval from metadata JSON; works on GitHub Pages)
  - `Browser ONNX` (runs exported full model weights on the user's device with `onnxruntime-web`)
  - `Full Model API` (calls a Flask/PyTorch backend that runs the real `.pth` model)

Important limitation
- PyTorch `.pth` model weights do NOT run in GitHub Pages / browser JS directly.
- For browser-side full-model compute, the `.pth` model must be exported to ONNX first.
- GitHub Pages can host the interface and ONNX files, but not execute Python.

Files
- `index.html` -> static chat UI
- `chat_model_meta_supermix_v27_500k.browser.json` -> lightweight browser metadata (recommended)
- `champion_model_chat_supermix_v27_500k_ft.onnx` -> exported chat model for browser inference
- `chat_model_meta_supermix_v27_500k.json` -> full metadata JSON (needed for Browser ONNX mode)
- `chat_feature_ctxv2.generated.js` -> generated JS feature encoder (matches `context_v2`)

How to publish on GitHub Pages
1. Create a repo (or folder in an existing repo) for the site.
2. Upload `index.html` and `chat_model_meta_supermix_v27_500k.browser.json` to the published folder.
3. Enable GitHub Pages for that branch/folder.
4. Open the site URL and click `Load Metadata` (default file name already matches).

Optional
- You can also point the Metadata URL box to a different `chat_model_meta_*.browser.json`.
- You can switch to `Browser ONNX` mode and load:
  - the exported `.onnx` model file
  - the full metadata JSON file (with buckets)
- You can switch to `Full Model API` mode and point the interface to a Flask backend URL.

Browser ONNX mode (full model on the user's device)
1. Keep `index.html`, `champion_model_chat_supermix_v27_500k_ft.onnx`, `chat_model_meta_supermix_v27_500k.json`, and `chat_feature_ctxv2.generated.js` in the same folder.
2. Open the page and switch `Run Mode` to `Browser ONNX`.
3. Click `Load Browser ONNX`.
4. Chat normally. Inference runs client-side in the browser using `onnxruntime-web` (WASM).

Full Model API mode (real `.pth` model)
1. Run `chat_web_app.py` on a machine that has the `.pth` weights and full metadata JSON.
2. In the web UI, switch `Run Mode` to `Full Model API`.
3. Set the backend API URL and backend file paths, then click `Load Full Model`.
4. Chat normally; requests go to `/api/chat` on the Flask backend.

If you need the real neural `.pth` model in web
- Convert the model to ONNX / WebGPU-compatible format and port the feature + ranking pipeline to browser JS.
- That is a different deployment target than GitHub Pages static hosting.
