# 04 Architecture

## 현재 코드베이스 관찰

현재 서버는 `server.js`가 runtime context를 만들고, `routes/index.js`에서 기능별 route module을 등록한다.

현재 route surface:

- `routes/generate.js`: classic image generation
- `routes/edit.js`: edit generation
- `routes/nodes.js`: Node mode generation
- `routes/sessions.js`: graph session CRUD + style sheet
- `routes/history.js`: generated file sidecar 기반 history
- `routes/health.js`: provider, OAuth, inflight, billing

저장 구조:

- generated 파일은 `config.storage.generatedDir` 아래에 이미지와 `*.json` sidecar로 저장된다.
- SQLite는 `lib/db.js`가 관리하고, 현재는 `sessions`, `nodes`, `edges` 중심이다.
- `lib/inflight.js`는 `kind: "classic" | "node"` 중심으로 동작한다.

## Backend 후보

```text
lib/cardNewsStore.js
lib/cardNewsTemplateStore.js
lib/cardNewsPlanner.js
lib/cardNewsExport.js
routes/cardNews.js
prompts/card-news/*.md
```

`routes/index.js`에 `registerCardNewsRoutes(app, ctx)`를 추가한다.

## Frontend 후보

현재 UI는 React + Zustand 구조다.

- `ui/src/App.tsx`: `uiMode === "classic"`이면 `Canvas`, 아니면 `NodeCanvas`
- `ui/src/components/UIModeSwitch.tsx`: `Classic | Node`
- `ui/src/components/Sidebar.tsx`: mode별 sidebar 분기
- `ui/src/store/useAppStore.ts`: classic/node/session/history 상태가 모여 있음
- `ui/src/lib/api.ts`: classic/node/session/history API client

Card News는 `useAppStore.ts`에 계속 밀어 넣지 말고 분리한다.

```text
ui/src/store/cardNewsStore.ts
ui/src/lib/cardNews.ts
ui/src/components/card-news/CardNewsWorkspace.tsx
ui/src/components/card-news/CardNewsComposer.tsx
ui/src/components/card-news/CardListRail.tsx
ui/src/components/card-news/CardStage.tsx
ui/src/components/card-news/CardInspector.tsx
```

## DB 후보

```sql
CREATE TABLE image_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  preview_filename TEXT NOT NULL,
  base_filename TEXT NOT NULL,
  style_prompt TEXT NOT NULL,
  negative_prompt TEXT,
  slots_json TEXT NOT NULL,
  palette_json TEXT,
  typography_json TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE role_node_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_count INTEGER NOT NULL,
  roles_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE card_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  image_template_id TEXT,
  role_node_template_id TEXT,
  platform TEXT NOT NULL,
  size TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE card_items (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  card_order INTEGER NOT NULL,
  role TEXT NOT NULL,
  headline TEXT,
  body TEXT,
  visual_prompt TEXT NOT NULL,
  image_filename TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
);
```

## API 후보

```text
GET    /api/cardnews
POST   /api/cardnews
GET    /api/cardnews/:setId
PATCH  /api/cardnews/:setId
DELETE /api/cardnews/:setId

GET    /api/cardnews/image-templates
POST   /api/cardnews/image-templates
GET    /api/cardnews/role-node-templates
POST   /api/cardnews/role-node-templates

POST   /api/cardnews/:setId/outline
POST   /api/cardnews/:setId/generate
POST   /api/cardnews/:setId/cards/:cardId/generate
PATCH  /api/cardnews/:setId/cards/:cardId
PATCH  /api/cardnews/:setId/order

POST   /api/cardnews/:setId/export
```

## Export 구조

```text
generated/
  cardnews/
    cs_<ulid>/
      card-01.png
      card-01.json
      card-02.png
      manifest.json
      copy.md
```
