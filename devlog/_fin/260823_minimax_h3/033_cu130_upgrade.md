---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, cuda]
---

# 033 — torch cu128 → cu130 (모델 로드 없음)

    pip install --upgrade torch torchvision torchaudio \
      --index-url https://download.pytorch.org/whl/cu130

| | 전 | 후 |
|---|---|---|
| torch | 2.11.0+cu128 | **2.13.0+cu130** |
| torchvision | 0.26.0+cu128 | 0.28.0+cu130 |
| torchaudio | (cu128) | 2.11.0+cu130 (2.13 휠 없음) |
| kitchen cuda | available True, **disabled True** | available True, **disabled False** |
| "need cu130" 경고 | 있음 | 없음 |
| GPU smoke | — | zeros(1).cuda() on RTX 5090 |

pip --upgrade가 2.11.0+cu130 대신 최신 2.13.0+cu130을 집었다.
ComfyUI 0.33.3 기동 로그가 2.13.0+cu130을 인식하고 kitchen cuda를
켰다. 유닛으로 잠깐 기동 후 stop. H3 가중치는 올리지 않음.
