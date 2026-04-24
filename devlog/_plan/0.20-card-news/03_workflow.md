# 03 Workflow

## 사용자 흐름

```text
1. Card News mode 진입
2. Image Template 선택
3. Role Node Template 선택
4. Content Prompt 작성
5. 참고 이미지 최대 5장 추가
6. Draft with Codex
7. JSON-backed card deck 검토
8. 카드별 수정/lock/reorder
9. Batch Generate
10. 실패 카드 retry 또는 카드별 regenerate
11. ZIP export
```

## 첫 화면

입력:

- Topic
- Audience
- Platform: Instagram square / Instagram portrait / Story
- Output size: 2048x2048 / 3840x3840 / 2048x2560 / 2160x3840
- Image Template
- Role Node Template
- Content Prompt
- Reference images up to 5

버튼:

- `Draft with Codex`
- `Generate Set`
- `+ New Image Template`

## Workspace Layout

```text
Left rail            Center stage              Right inspector
──────────────────────────────────────────────────────────────
Template picker      Focused card preview       Card copy
Card list            JSON-backed card view      Visual prompt
Reorder              Generate/regenerate        Lock / status
Lock badges          Batch status               Export options
```

## Codex Planner

Planner는 바로 이미지 생성을 호출하지 않는다. JSON만 만든다.

입력:

```json
{
  "imageTemplate": "...",
  "roleNodeTemplate": "...",
  "contentBrief": "...",
  "references": ["ref1", "ref2"],
  "size": "2048x2048"
}
```

출력:

```json
{
  "title": "...",
  "cards": [
    {
      "order": 1,
      "role": "cover",
      "headline": "...",
      "body": "...",
      "visualPrompt": "...",
      "templateSlotAssignments": {
        "title": "headline",
        "body": "body",
        "image": "visual"
      },
      "references": ["ref1"],
      "locked": false
    }
  ]
}
```

Validation:

- 카드 수가 role node template과 일치해야 한다.
- 모든 required role이 있어야 한다.
- `visualPrompt`는 image template stylePrompt와 합쳐도 4000자 이하로 유지한다.
- `headline`은 한글 24자 정도를 넘으면 warning.
- `body`는 MVP에서 이미지에 직접 넣지 않고 manifest/UI에 보관한다.

## `+ New Image Template`

사용자 입력:

```text
템플릿 목적
톤/업종
색감
텍스트 위치
이미지 위치
금지할 스타일
크기
```

생성 결과:

```text
preview image
base image
stylePrompt
negativePrompt
slot preset
recommended role node templates
```
