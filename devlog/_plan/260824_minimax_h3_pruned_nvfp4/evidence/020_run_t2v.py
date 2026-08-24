#!/usr/bin/env python3
import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def request_json(url: str, *, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {} if data is None else {"Content-Type": "application/json"}
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    return json.loads(raw or b"{}")


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def queue_contains(queue: dict, prompt_id: str) -> bool:
    for key in ("queue_running", "queue_pending"):
        for item in queue.get(key, []):
            if isinstance(item, list) and len(item) > 1 and item[1] == prompt_id:
                return True
    return False


def find_media(entry: dict, output_node: str) -> dict:
    outputs = entry.get("outputs") or {}
    ordered = []
    if output_node in outputs:
        ordered.append(outputs[output_node])
    ordered.extend(value for key, value in outputs.items() if key != output_node)
    for output in ordered:
        if not isinstance(output, dict):
            continue
        for key in ("images", "videos", "gifs"):
            values = output.get(key)
            if not isinstance(values, list):
                continue
            for value in values:
                if isinstance(value, dict) and isinstance(value.get("filename"), str):
                    return value
    raise RuntimeError("completed history has no downloadable media descriptor")


def download_media(origin: str, descriptor: dict, output_dir: Path) -> Path:
    filename = descriptor["filename"]
    suffix = Path(filename).suffix or ".bin"
    query = urllib.parse.urlencode({
        "filename": filename,
        "subfolder": descriptor.get("subfolder", ""),
        "type": descriptor.get("type", "output"),
    })
    output = output_dir / f"020_output{suffix}"
    with urllib.request.urlopen(f"{origin}/view?{query}", timeout=120) as response:
        output.write_bytes(response.read())
    write_json(output_dir / "020_media_descriptor.json", descriptor)
    return output


def wait_for_terminal(origin: str, prompt_id: str, output_dir: Path, timeout_s: int) -> dict:
    started = time.monotonic()
    missing_rounds = 0
    while time.monotonic() - started < timeout_s:
        history = request_json(f"{origin}/history/{prompt_id}")
        entry = history.get(prompt_id)
        if isinstance(entry, dict):
            write_json(output_dir / "020_history.json", history)
            status = entry.get("status") or {}
            if status.get("completed") is True and status.get("status_str") == "success":
                return entry
            if status.get("status_str") in ("error", "failed") or status.get("completed") is False:
                raise RuntimeError(f"terminal ComfyUI status: {json.dumps(status, ensure_ascii=False)}")
        queue = request_json(f"{origin}/queue")
        if queue_contains(queue, prompt_id):
            missing_rounds = 0
        else:
            missing_rounds += 1
            if missing_rounds >= 5 and not entry:
                raise RuntimeError("prompt disappeared from both queue and history")
        time.sleep(3)
    raise TimeoutError(f"generation exceeded {timeout_s} seconds")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:8188")
    parser.add_argument("--graph", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--timeout", type=int, default=6600)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    graph = json.loads(Path(args.graph).read_text())
    started_at = time.time()
    submit = request_json(f"{args.origin}/prompt", body={"prompt": graph, "client_id": "ima2-h3-pruned-proof"})
    write_json(output_dir / "020_submit.json", submit)
    prompt_id = submit.get("prompt_id")
    if not isinstance(prompt_id, str) or not prompt_id:
        raise RuntimeError(f"submit returned no prompt_id: {submit}")
    (output_dir / "020_prompt_id.txt").write_text(prompt_id + "\n")
    if submit.get("node_errors") not in ({}, None):
        raise RuntimeError(f"node_errors: {json.dumps(submit['node_errors'], ensure_ascii=False)}")

    entry = wait_for_terminal(args.origin, prompt_id, output_dir, args.timeout)
    descriptor = find_media(entry, "92")
    output = download_media(args.origin, descriptor, output_dir)
    summary = {
        "promptId": prompt_id,
        "elapsedSeconds": round(time.time() - started_at, 3),
        "output": str(output),
        "bytes": output.stat().st_size,
    }
    write_json(output_dir / "020_result.json", summary)
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, TimeoutError, urllib.error.URLError) as error:
        print(f"H3_PROOF_FAILED: {error}")
        raise SystemExit(1)
