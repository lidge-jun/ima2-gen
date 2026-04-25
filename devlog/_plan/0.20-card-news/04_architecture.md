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
lib/cardNewsManifestStore.js
lib/cardNewsTemplateStore.js
lib/cardNewsRoleTemplateStore.js
lib/cardNewsPlanner.js
lib/cardNewsGenerator.js
lib/cardNewsExport.js
routes/cardNews.js
prompts/card-news/*.md
```

`routes/index.js`에 `registerCardNewsRoutes(app, ctx)`를 추가한다.

0.20 MVP는 route module을 쪼개지 않는다. `routes/cardNews.js` 하나가 `registerCardNewsRoutes(app, ctx)`를 export하고, 내부에서 template, role, draft, generate endpoints를 등록한다. `routes/cardNewsTemplates.js`나 `routes/cardNewsRoleTemplates.js`는 0.21 이후 분리 후보로만 둔다.

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

0.20 MVP는 `npm run dev`에서만 실행되도록 실제 feature gate를 둔다. 따라서 npm package release, installed-user migration, production build asset migration까지 한 번에 풀지 않는다. 개발 서버에서 검증 가능한 feature slice를 먼저 만든다.

## Dev-only Feature Gate

현재 repo에는 이미 dev runtime 신호가 있다.

```text
scripts/dev.mjs
  VITE_IMA2_DEV=1 during UI build
  IMA2_DEV=1 while running server.js --watch

ui/src/lib/devMode.ts
  IS_DEV_UI
  ENABLE_NODE_MODE
```

Card News는 이 흐름을 재사용한다.

Backend config:

```ts
features: {
  cardNews: pickBool(env.IMA2_CARD_NEWS, fileCfg.features?.cardNews, env.IMA2_DEV === "1"),
}
```

Frontend gate:

```ts
export const ENABLE_CARD_NEWS_MODE =
  import.meta.env.VITE_IMA2_CARD_NEWS === "1" || IS_DEV_UI;
```

Route registration:

```ts
if (ctx.config.features.cardNews) {
  registerCardNewsRoutes(app, ctx);
}
```

UI behavior:

```text
ENABLE_CARD_NEWS_MODE=true  -> Classic | Node | Card News
ENABLE_CARD_NEWS_MODE=false -> Classic | Node
```

Invalid persisted mode guard:

```text
if localStorage has "card-news" but ENABLE_CARD_NEWS_MODE=false,
fall back to "classic".
```

## 0.20 Persistence Decision

0.20 MVP에서는 DB schema migration을 하지 않는다.

이유:

- `npm run dev`에서 Card News product flow를 먼저 검증한다.
- 기존 사용자 migration은 0.20 범위가 아니다.
- DB schema를 먼저 고정하면 template/card set schema 변경 비용이 커진다.

0.20 저장 source of truth:

```text
generated/cardnews/<setId>/
  manifest.json
  card-01.png
  card-01.json
  card-02.png
  card-02.json
```

브라우저 review 상태는 `cardNewsStore.ts`가 들고, generate/export 결과는 manifest/sidecar로 저장한다.

0.20에서 Image Template Registry는 built-in template만 읽는다. User-created image template CRUD, `slots_json` 저장/수정, generated template asset persistence는 0.21로 보류한다.

## DB 후보, 0.21 이후

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

## Generation Job Model

Card News generation은 기존 `classic`/`node` job과 다르게 set 단위 orchestration이 필요하다. 다만 MVP에서는 단일 process 개발 서버만 가정하므로 durable queue는 만들지 않는다.

```ts
type CardNewsGenerationStrategy =
  | "parallel-template-i2i"
  | "selected-card-i2i"
  | "sequential-continuity-i2i";
```

기본 API는 `parallel-template-i2i`만 production path로 구현한다.

```text
template base image
  ├─ card 01 prompt → image generation
  ├─ card 02 prompt → image generation
  ├─ card 03 prompt → image generation
  └─ card 04 prompt → image generation
```

각 요청은 같은 image template asset을 input/reference로 사용하지만, 이전 카드의 생성 결과를 다음 카드에 넘기지 않는다.

`selected-card-i2i`는 카드 1장 재생성에만 쓴다.

```text
existing card image + revised card prompt → regenerate selected card
```

`sequential-continuity-i2i`는 schema와 UI enum에는 남길 수 있지만, 0.20 MVP 구현에서는 disabled 상태로 둔다.

## API 후보

```text
GET    /api/cardnews/image-templates
GET    /api/cardnews/image-templates/:templateId/preview
GET    /api/cardnews/role-templates
POST   /api/cardnews/draft
POST   /api/cardnews/generate
POST   /api/cardnews/cards/:cardId/regenerate
POST   /api/cardnews/export
```

0.20에서는 full CardSet CRUD를 만들지 않는다. `draft`는 JSON plan을 반환하고, 클라이언트가 review/edit 상태를 보관한다. `generate`는 plan과 card list를 받아 `generated/cardnews/<setId>`에 결과와 manifest를 쓴다.

## Template Asset Resolver

Built-in template asset 기준:

```text
assets/card-news/templates/<templateId>/
  preview.png
  base.png
  template.json
```

`lib/cardNewsTemplateStore.js`가 담당한다.

규칙:

- base root는 `join(ctx.rootDir, "assets", "card-news", "templates")`.
- `templateId`는 allowlisted directory name만 허용한다.
- `..`, absolute path, slash 포함 id는 거부한다.
- `base.png`는 generation reference/input image로 읽어 base64화한다.
- `preview.png`는 `/api/cardnews/image-templates/:templateId/preview` route로 반환한다.
- 기존 `loadAssetB64()`는 generated storage 기준이라 built-in template asset에는 쓰지 않는다.

## Card News Sidecar / Manifest

`lib/cardNewsGenerator.js`는 카드별 sidecar와 set manifest를 쓴다.

카드 sidecar 최소 필드:

```json
{
  "kind": "card-news",
  "setId": "cs_...",
  "cardId": "card_...",
  "cardOrder": 1,
  "role": "cover",
  "headline": "...",
  "body": "...",
  "imageTemplateId": "academy-lesson-square",
  "generationStrategy": "parallel-template-i2i",
  "templateBase": "assets/card-news/templates/academy-lesson-square/base.png",
  "prompt": "...",
  "visualPrompt": "...",
  "createdAt": 1770000000000
}
```

`manifest.json` 최소 필드:

```json
{
  "kind": "card-news-set",
  "setId": "cs_...",
  "title": "...",
  "imageTemplateId": "...",
  "roleTemplateId": "...",
  "generationStrategy": "parallel-template-i2i",
  "cards": [
    {
      "cardId": "card_...",
      "cardOrder": 1,
      "role": "cover",
      "headline": "...",
      "body": "...",
      "visualPrompt": "...",
      "imageFilename": "card-01.png",
      "sidecarFilename": "card-01.json",
      "locked": false,
      "status": "generated"
    }
  ]
}
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
