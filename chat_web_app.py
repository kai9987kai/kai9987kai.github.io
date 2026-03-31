import argparse
import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, jsonify, request
import torch

import chat_app
from device_utils import configure_torch_runtime, resolve_device


HTML = """<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Champion AI • Premium Chat</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
    --bg: #050810;
    --glass: rgba(18, 28, 48, 0.6);
    --glass-border: rgba(255, 255, 255, 0.08);
    --text: #e5edf7;
    --text-dim: #9fb1d1;
    --accent: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.4);
    --user-bg: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    --bot-bg: rgba(255, 255, 255, 0.05);
}
body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    background-image: radial-gradient(circle at 50% 0%, #1e293b 0%, var(--bg) 70%);
    min-height: 100vh;
}
.wrap {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
}
.card {
    background: var(--glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.side { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.chat { display: flex; flex-direction: column; height: 85vh; }
.row { display: flex; flex-direction: column; gap: 8px; }
.row label {
    font-size: 0.7rem;
    color: var(--text-dim);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}
input, select, textarea {
    background: rgba(0, 0, 0, 0.2);
    color: var(--text);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 12px;
    font-size: 0.9rem;
    transition: all 0.2s ease;
}
input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
}
button {
    background: var(--accent);
    color: white;
    border: 0;
    border-radius: 12px;
    padding: 12px 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}
button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--accent-glow);
}
button.alt { background: rgba(255, 255, 255, 0.05); }
button.alt:hover { background: rgba(255, 255, 255, 0.1); }
.status {
    font-size: 0.8rem;
    color: var(--text-dim);
    padding: 12px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    min-height: 80px;
    white-space: pre-wrap;
    font-family: monospace;
}
.head {
    padding: 20px 24px;
    border-bottom: 1px solid var(--glass-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.head h2 { margin: 0; font-size: 1.25rem; }
.msgs {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--glass-border) transparent;
}
.msg {
    max-width: 80%;
    padding: 14px 18px;
    border-radius: 18px;
    line-height: 1.5;
    font-size: 0.95rem;
    position: relative;
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.msg.user {
    align-self: flex-end;
    background: var(--user-bg);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 4px 15px rgba(29, 78, 216, 0.3);
}
.msg.bot {
    align-self: flex-start;
    background: var(--bot-bg);
    border: 1px solid var(--glass-border);
    border-bottom-left-radius: 4px;
}
.who { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; opacity: 0.8; letter-spacing: 0.05em; }
.tim { margin-top: 10px; font-size: 0.7rem; color: var(--text-dim); opacity: 0.7; }
.comp {
    padding: 20px 24px;
    border-top: 1px solid var(--glass-border);
    display: flex;
    gap: 12px;
}
textarea { flex: 1; min-height: 50px; }
@media (max-width: 900px){ .wrap { grid-template-columns: 1fr; } .chat { height: 70vh; } }
</style></head><body>
<div class='wrap'>
  <div class='card side'>
    <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 12px; height: 12px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--accent);"></div>
        <h3 style='margin:0'>Champion AI</h3>
    </div>
    <p style='color:var(--text-dim);font-size:0.85rem;margin:0'>Premium retrieval interface with Gated Experts.</p>
    <div class='row'><label>Weights</label><input id='weights' placeholder="Path to .pth"></div>
    <div class='row'><label>Metadata</label><input id='meta' placeholder="Path to .json"></div>
    <div class='row'><label>Personality</label><select id='style'><option>auto</option><option>balanced</option><option>creative</option><option>concise</option><option>analyst</option></select></div>
    <div class='row'><label>Creativity (Temp)</label><input id='rt' type='number' min='0' max='1' step='0.01' value='0.08'></div>
    <div class='btns' style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button id='loadBtn' style="grid-column: span 2">Load Model</button>
        <button class='alt' id='statusBtn'>Status</button>
        <button class='alt' id='clearBtn'>Reset</button>
    </div>
    <div class='status' id='statusBox'>Ready...</div>
  </div>
  <div class='card chat'>
    <div class='head'>
        <div><h2>Chat Session</h2><small id='metaLine' style="color:var(--text-dim)">Initializing...</small></div>
        <div id='session' style="font-size:0.7rem; color:var(--text-dim); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px;"></div>
    </div>
    <div class='msgs' id='msgs'></div>
    <div class='comp'>
        <textarea id='prompt' placeholder='Ask something...'></textarea>
        <button id='sendBtn' style="height: 50px; width: 60px;">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
        </button>
    </div>
  </div>
</div>
<script>
const el=(id)=>document.getElementById(id), msgs=el('msgs');
let sid=localStorage.getItem('champion-web-sid'); if(!sid){{sid=(crypto.randomUUID?crypto.randomUUID():String(Date.now())); localStorage.setItem('champion-web-sid',sid);}} el('session').textContent='ID: '+sid.slice(0,8);
function add(kind,text,timing,top){{const d=document.createElement('div'); d.className='msg '+kind; d.innerHTML=`<div class='who'>${{kind==='user'?'You':'Champion AI'}}</div>`; const b=document.createElement('div'); b.textContent=text; d.appendChild(b); if(timing){{const t=document.createElement('div'); t.className='tim'; t.textContent=`${{timing.total}}ms • ${{timing.infer}}ms latency`; d.appendChild(t);}} if(top&&top.length){{const x=document.createElement('div'); x.className='tim'; x.style.borderTop="1px solid var(--glass-border)"; x.style.marginTop="8px"; x.style.paddingTop="8px"; x.innerHTML='<span style="font-weight:600">Candidates:</span><br>'+top.map((c,i)=>`${{i+1}}. ${{c.text.slice(0,80)}}...`).join('<br>'); d.appendChild(x);}} msgs.appendChild(d); msgs.scrollTo({{top: msgs.scrollHeight, behavior: 'smooth'}}); }}
async function jget(path){{const r=await fetch(path); const d=await r.json(); if(!r.ok||d.ok===false) throw new Error(d.error||`HTTP ${{r.status}}`); return d;}}
async function jpost(path,p){{const r=await fetch(path,{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(p||{{}})}}); const d=await r.json(); if(!r.ok||d.ok===false) throw new Error(d.error||`HTTP ${{r.status}}`); return d;}}
async function refresh(){{try{{const d=await jget('/api/status'); el('statusBox').textContent=d.status.loaded?'Model active. Ready to chat.':'No model active.'; el('metaLine').textContent=d.status.loaded?`${{d.status.model_size}} architecture • ${{d.status.feature_mode}}`:'Choose model files and click Load'; if(!el('weights').value&&d.status.weights) el('weights').value=d.status.weights; if(!el('meta').value&&d.status.meta) el('meta').value=d.status.meta; }}catch(e){{el('statusBox').textContent='Status error: '+e.message;}}}}
async function loadModel(){{el('statusBox').textContent='Warming up system...'; try{{const d=await jpost('/api/load',{{weights:el('weights').value.trim(),meta:el('meta').value.trim()}}); el('statusBox').textContent='Model strategy loaded successfully.'; refresh();}}catch(e){{el('statusBox').textContent='Error: '+e.message;}}}}
async function send(){{const text=el('prompt').value.trim(); if(!text) return; add('user',text); el('prompt').value=''; try{{const d=await jpost('/api/chat',{{session_id:sid,message:text,style_mode:el('style').value,response_temperature:Number(el('rt').value),show_top_responses:0}}); add('bot',d.response,d.timing_ms,d.top_candidates);}}catch(e){{add('bot','Encountered an issue: '+e.message);}}}}
async function clearSess(){{try{{await jpost('/api/clear',{{session_id:sid}}); msgs.innerHTML=''; add('bot','New session started.');}}catch(e){{add('bot','Error: '+e.message);}}}}
el('loadBtn').onclick=loadModel; el('statusBtn').onclick=refresh; el('clearBtn').onclick=clearSess; el('sendBtn').onclick=send; el('prompt').addEventListener('keydown',e=>{{if(e.key==='Enter'&&!e.shiftKey){{e.preventDefault();send();}}}}); refresh(); 
</script></body></html>"""



class Engine:
    def __init__(self, device: Any, device_info: Dict[str, Any], defaults: Dict[str, Any]):
        self.device = device
        self.device_info = dict(device_info or {})
        self.defaults = dict(defaults)
        self.lock = threading.RLock()
        self.model = None
        self.weights_path: Optional[str] = None
        self.meta_path: Optional[str] = None
        self.feature_mode = "legacy"
        self.model_size = "base"
        self.buckets: Dict[int, List[Dict[str, Any]]] = {}
        self.available_labels: List[int] = list(range(chat_app.MODEL_CLASSES))
        self.sessions: Dict[str, List[Tuple[str, str]]] = {}
        self.recent: Dict[str, List[str]] = {}

    def status(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "loaded": self.model is not None,
                "weights": self.weights_path,
                "meta": self.meta_path,
                "feature_mode": self.feature_mode,
                "model_size": self.model_size,
                "available_labels": len(self.available_labels),
                "device": self.device_info.get("resolved", str(self.device)),
                "sessions": len(self.sessions),
            }

    def _parse_buckets(self, meta: Dict[str, Any]) -> None:
        buckets: Dict[int, List[Dict[str, Any]]] = {}
        raw = meta.get("buckets", {})
        if isinstance(raw, dict):
            for k, v in raw.items():
                try:
                    label = int(k)
                except Exception:
                    continue
                if isinstance(v, list) and v:
                    buckets[label] = v
        self.buckets = buckets
        self.available_labels = sorted(buckets.keys()) or list(range(chat_app.MODEL_CLASSES))

    def load(self, weights: str, meta_path: str) -> Dict[str, Any]:
        t0 = time.perf_counter()
        weights = str(Path(weights))
        meta_path = str(Path(meta_path))
        if not Path(weights).exists():
            raise FileNotFoundError(f"Weights not found: {weights}")
        if not Path(meta_path).exists():
            raise FileNotFoundError(f"Metadata not found: {meta_path}")

        meta = chat_app.load_metadata(meta_path)
        feature_mode = str(meta.get("feature_mode", "legacy")).strip().lower()
        if feature_mode not in {"legacy", "context_v2", "context_v3", "context_v4", "context_mix_v1", "context_mix_v2_mm"}:
            feature_mode = "legacy"

        sd = chat_app.safe_load_state_dict(weights)
        inferred = chat_app.detect_model_size_from_state_dict(sd)
        resolved_model_size = self.defaults.get("model_size", "auto")
        if resolved_model_size == "auto":
            resolved_model_size = inferred

        expansion_dim = chat_app._resolve_expansion_dim(None, meta, "expansion_dim", 1024 if resolved_model_size in {"xxlarge","xxxlarge","ultralarge","megalarge"} else (768 if resolved_model_size == "xlarge" else 512), inferred, {"large","xlarge","xxlarge","xxxlarge","ultralarge","megalarge"}, chat_app.detect_large_head_expansion_dim, sd)
        extra_expansion_dim = chat_app._resolve_expansion_dim(None, meta, "extra_expansion_dim", max(2048 if resolved_model_size in {"xxlarge","xxxlarge","ultralarge","megalarge"} else 1024, expansion_dim * 2), inferred, {"xlarge","xxlarge","xxxlarge","ultralarge","megalarge"}, chat_app.detect_xlarge_aux_expansion_dim, sd)
        third_expansion_dim = chat_app._resolve_expansion_dim(None, meta, "third_expansion_dim", max(3072, extra_expansion_dim + expansion_dim), inferred, {"xxlarge","xxxlarge","ultralarge","megalarge"}, chat_app.detect_xxlarge_third_expansion_dim, sd)
        fourth_expansion_dim = chat_app._resolve_expansion_dim(None, meta, "fourth_expansion_dim", max(4096, third_expansion_dim + expansion_dim), inferred, {"xxxlarge","ultralarge","megalarge"}, chat_app.detect_xxxlarge_fourth_expansion_dim, sd)
        fifth_expansion_dim = chat_app._resolve_expansion_dim(None, meta, "fifth_expansion_dim", max(6144, fourth_expansion_dim + expansion_dim), inferred, {"ultralarge","megalarge"}, chat_app.detect_ultralarge_fifth_expansion_dim, sd)
        sixth_expansion_dim = chat_app._resolve_expansion_dim(None, meta, "sixth_expansion_dim", max(8192, fifth_expansion_dim + expansion_dim), inferred, {"megalarge"}, chat_app.detect_megalarge_sixth_expansion_dim, sd)
        adapter_dropout = float(meta.get("adapter_dropout", 0.1))

        model = chat_app.build_model(
            model_size=resolved_model_size,
            expansion_dim=expansion_dim,
            dropout=adapter_dropout,
            extra_expansion_dim=extra_expansion_dim,
            third_expansion_dim=third_expansion_dim,
            fourth_expansion_dim=fourth_expansion_dim,
            fifth_expansion_dim=fifth_expansion_dim,
            sixth_expansion_dim=sixth_expansion_dim,
        ).to(self.device).eval()
        missing, unexpected = chat_app.load_weights_for_model(model, sd, model_size=resolved_model_size)
        if missing or unexpected:
            raise RuntimeError(f"State dict mismatch. Missing={missing}, Unexpected={unexpected}")

        with self.lock:
            self.model = model
            self.weights_path = weights
            self.meta_path = meta_path
            self.feature_mode = feature_mode
            self.model_size = resolved_model_size
            self._parse_buckets(meta)
            self.sessions.clear()
            self.recent.clear()

        return {"ok": True, "load_ms": round((time.perf_counter()-t0)*1000,1), **self.status()}

    def clear(self, session_id: str) -> None:
        with self.lock:
            self.sessions.pop(session_id, None)
            self.recent.pop(session_id, None)

    def chat(self, session_id: str, user_text: str, style_mode: Optional[str] = None, response_temperature: Optional[float] = None, show_top_responses: int = 0) -> Dict[str, Any]:
        if not user_text.strip():
            raise ValueError("Empty message")
        with self.lock:
            if self.model is None:
                raise RuntimeError("No model loaded")
            model = self.model
            feature_mode = self.feature_mode
            buckets = self.buckets
            labels = list(self.available_labels)
            history = list(self.sessions.get(session_id, []))
            recent_msgs = list(self.recent.get(session_id, []))
        t0 = time.perf_counter()
        t_infer = 0.0
        t_rank = 0.0

        context = chat_app.build_context(history, user_text=user_text, max_turns=int(self.defaults.get("max_turns", 2)))
        tt = time.perf_counter()
        x = chat_app.text_to_model_input(context, feature_mode=feature_mode).to(self.device)
        with torch.no_grad():
            logits = model(x)[0, 0]
        t_infer += time.perf_counter() - tt

        idx = torch.tensor(labels, dtype=torch.long, device=logits.device)
        avail_logits = logits.index_select(0, idx)
        probs = torch.softmax(avail_logits, dim=0)
        pool_mode = str(self.defaults.get("pool_mode", "all"))
        if pool_mode == "all":
            top_pos = list(range(len(labels)))
        else:
            k = max(1, min(int(self.defaults.get("top_labels", 3)), len(labels)))
            top_pos = torch.topk(avail_logits, k=k).indices.tolist()

        pooled: List[Dict[str, Any]] = []
        for pos in top_pos:
            label = labels[int(pos)]
            bucket_score = float(probs[int(pos)].item())
            for row in buckets.get(label, []):
                m = dict(row)
                m["bucket_score"] = bucket_score
                m["_source"] = "model"
                pooled.append(m)
        if (not pooled) and buckets:
            label = chat_app.choose_bucket_from_logits(logits, labels, temperature=float(self.defaults.get("temperature", 0.0)))
            pooled = list(buckets.get(label, []))

        dedup: Dict[str, Dict[str, Any]] = {}
        for row in pooled:
            text = str(row.get("text", "")).strip()
            if not text:
                continue
            prev = dedup.get(text)
            if prev is None:
                d = dict(row)
                d["_sources_set"] = {row.get("_source", "unknown")}
                dedup[text] = d
                continue
            src = row.get("_source", "unknown")
            base = max(float(prev.get("bucket_score", 0.0)), float(row.get("bucket_score", 0.0)))
            if src not in prev["_sources_set"]:
                base *= 1.10
                prev["_sources_set"].add(src)
            prev["bucket_score"] = base
            prev["count"] = int(prev.get("count", 1)) + int(row.get("count", 1))
        for k in list(dedup):
            dedup[k].pop("_sources_set", None)
            dedup[k].pop("_source", None)
        pooled = list(dedup.values())

        resolved_style = chat_app.infer_style_mode(user_text, requested_mode=style_mode or str(self.defaults.get("style_mode", "auto")))
        top_candidates: List[Dict[str, Any]] = []
        show_n = max(0, int(show_top_responses))
        if show_n > 0 and pooled:
            tt = time.perf_counter()
            ranked, scores = chat_app.rank_response_candidates(pooled, query_text=user_text, recent_assistant_messages=recent_msgs, style_mode=resolved_style)
            t_rank += time.perf_counter() - tt
            shown = 0
            for ridx in ranked:
                txt = str(pooled[ridx].get("text", "")).strip()
                if not txt:
                    continue
                top_candidates.append({"score": float(scores[ridx].item()), "text": txt})
                shown += 1
                if shown >= show_n:
                    break

        tt = time.perf_counter()
        resp = chat_app.pick_response(
            pooled,
            query_text=user_text,
            recent_assistant_messages=recent_msgs,
            response_temperature=float(self.defaults.get("response_temperature", 0.08) if response_temperature is None else response_temperature),
            style_mode=resolved_style,
            creativity=max(0.0, min(1.0, float(self.defaults.get("creativity", 0.2)))),
        )
        t_rank += time.perf_counter() - tt
        resp = chat_app.cleanup_response_text(resp) or "I do not have a trained response for that yet."

        with self.lock:
            hist = self.sessions.setdefault(session_id, [])
            hist.append((user_text, resp))
            if len(hist) > 40:
                del hist[:-40]
            recent = self.recent.setdefault(session_id, [])
            recent.append(resp)
            if len(recent) > 24:
                del recent[:-24]

        return {
            "ok": True,
            "session_id": session_id,
            "response": resp,
            "style_mode": resolved_style,
            "timing_ms": {
                "infer": round(t_infer * 1000, 1),
                "rank_pick": round(t_rank * 1000, 1),
                "total": round((time.perf_counter() - t0) * 1000, 1),
            },
            "top_candidates": top_candidates,
        }


def build_app(engine: Engine, default_weights: str, default_meta: str):
    app = Flask(__name__)

    @app.get('/')
    def index():
        html = HTML.replace("<input id='weights'></div>", f"<input id='weights' value='{default_weights}'></div>")
        html = html.replace("<input id='meta'></div>", f"<input id='meta' value='{default_meta}'></div>")
        return html

    @app.get('/api/status')
    def api_status():
        return jsonify({"ok": True, "status": engine.status()})

    @app.post('/api/load')
    def api_load():
        p = request.get_json(force=True, silent=True) or {}
        try:
            return jsonify(engine.load(str(p.get('weights') or '').strip(), str(p.get('meta') or '').strip()))
        except FileNotFoundError as e:
            return jsonify({"ok": False, "error": str(e)}), 404
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    @app.post('/api/chat')
    def api_chat():
        p = request.get_json(force=True, silent=True) or {}
        sid = str(p.get('session_id') or '').strip() or str(uuid.uuid4())
        msg = str(p.get('message') or '').strip()
        try:
            return jsonify(engine.chat(
                session_id=sid,
                user_text=msg,
                style_mode=p.get('style_mode'),
                response_temperature=p.get('response_temperature'),
                show_top_responses=int(p.get('show_top_responses') or 0),
            ))
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    @app.post('/api/clear')
    def api_clear():
        p = request.get_json(force=True, silent=True) or {}
        sid = str(p.get('session_id') or '').strip()
        if not sid:
            return jsonify({"ok": False, "error": "session_id required"}), 400
        engine.clear(sid)
        return jsonify({"ok": True, "cleared": True, "session_id": sid})

    return app


def main() -> None:
    ap = argparse.ArgumentParser(description='Web interface for Champion chat model (loads local weights + metadata).')
    ap.add_argument('--weights', default='champion_model_chat_supermix_v27_500k_ft.pth')
    ap.add_argument('--meta', default='chat_model_meta_supermix_v27_500k.json')
    ap.add_argument('--autoload', action='store_true')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8000)
    ap.add_argument('--device', default='auto')
    ap.add_argument('--device_preference', default='cuda,npu,xpu,dml,mps,cpu')
    ap.add_argument('--torch_num_threads', type=int, default=0)
    ap.add_argument('--torch_interop_threads', type=int, default=0)
    ap.add_argument('--matmul_precision', choices=['highest', 'high', 'medium'], default='high')
    ap.add_argument('--disable_tf32', action='store_true')
    ap.add_argument('--model_size', choices=['auto','base','large','xlarge','xxlarge','xxxlarge','ultralarge','megalarge'], default='auto')
    ap.add_argument('--max_turns', type=int, default=2)
    ap.add_argument('--top_labels', type=int, default=3)
    ap.add_argument('--pool_mode', choices=['all','topk'], default='all')
    ap.add_argument('--response_temperature', type=float, default=0.08)
    ap.add_argument('--temperature', type=float, default=0.0)
    ap.add_argument('--style_mode', choices=['auto','balanced','creative','concise','analyst'], default='auto')
    ap.add_argument('--creativity', type=float, default=0.2)
    args = ap.parse_args()

    configure_torch_runtime(
        torch_num_threads=int(args.torch_num_threads),
        torch_interop_threads=int(args.torch_interop_threads),
        allow_tf32=not bool(args.disable_tf32),
        matmul_precision=str(args.matmul_precision),
    )
    device, device_info = resolve_device(args.device, preference=args.device_preference)
    engine = Engine(device, device_info, {
        'model_size': args.model_size,
        'max_turns': int(args.max_turns),
        'top_labels': int(args.top_labels),
        'pool_mode': str(args.pool_mode),
        'response_temperature': float(args.response_temperature),
        'temperature': float(args.temperature),
        'style_mode': str(args.style_mode),
        'creativity': float(args.creativity),
    })
    if args.autoload:
        try:
            print(engine.load(args.weights, args.meta))
        except Exception as e:
            print(f'Autoload failed: {e}')
    app = build_app(engine, str(args.weights), str(args.meta))
    print(f'Web UI: http://{args.host}:{args.port}')
    app.run(host=args.host, port=int(args.port), threaded=True)


if __name__ == '__main__':
    main()
