export type Lang = 'en' | 'ko';

type Dict = Record<string, string>;

const en: Dict = {
  // Base / meta
  'meta.title': 'ima2-gen — Local Image Studio with Classic + Node + Canvas',
  'meta.desc':
    'Generate images locally with Classic mode, branch the ones you love in a Node graph, and clean them up in Canvas Mode.',
  'meta.og.title': 'ima2-gen — Generate, branch, clean up',
  'meta.og.desc':
    'A local image studio with Classic, Node-graph branching, multimode batches, and Canvas Mode cleanup. Run it with npx.',

  // Header
  'header.brand.aria': 'ima2-gen home',
  'header.nav.aria': 'Section navigation',
  'header.nav.workflows': 'Workflows',
  'header.nav.branch': 'Branch',
  'header.nav.local': 'Local',
  'header.nav.install': 'Install',
  'header.nav.faq': 'FAQ',
  'header.gh': 'GitHub ↗',

  // Hero
  'hero.eyebrow': 'Local image studio · Classic + Node + Canvas',
  'hero.h1.line1': 'Branch the',
  'hero.h1.line2': 'images you',
  'hero.h1.em': 'love.',
  'hero.sub':
    "An image studio for the way you actually iterate. Generate in Classic, fan out variations in a Node graph, run multimode batches, then clean up the winning frame in Canvas Mode.",
  'hero.cta.cmd': 'npx ima2-gen serve',
  'hero.cross.lang': '한국어 README →',
  'hero.shot.alt':
    'ima2-gen Classic mode showing the prompt composer, generated image, model label, and result metadata.',

  // Two Workflows
  'workflows.tag': '01 · Generate, branch, refine',
  'workflows.h.before': 'Two ways to make. ',
  'workflows.h.em': 'Canvas to refine.',
  'workflows.lede':
    "Classic for one strong frame or a multimode batch. Node for a tree of variations from a parent you locked in. Canvas for cleanup before the next prompt.",
  'workflows.classic.label': 'Classic',
  'workflows.classic.h': 'One prompt, one strong frame.',
  'workflows.classic.body':
    'Write, attach up to five references, generate one result or several multimode slots. Iterate until it lands. Continue from any result.',
  'workflows.classic.alt':
    'ima2-gen Classic mode with prompt composer, references, and a generated team portrait.',
  'workflows.node.label': 'Node',
  'workflows.node.h': 'One frame, ten directions.',
  'workflows.node.body':
    'Lock a parent. Fan out children — palette, framing, copy. Compare side by side. Running branches recover by request ID.',
  'workflows.node.alt':
    'ima2-gen Node mode with connected generated cards and per-node metadata.',

  // Latest Capabilities
  'latest.tag': '02 · New in the studio',
  'latest.h.before': 'Batch, polish, ',
  'latest.h.em': 'import.',
  'latest.lede':
    'Recent releases added multimode candidate slots, Canvas Mode cleanup tools, and prompt-library imports from files, GitHub folders, and curated sources.',
  'latest.multimode.label': 'Multimode',
  'latest.multimode.h': 'Four candidates from one prompt.',
  'latest.multimode.body':
    'Run a sequence from Classic mode, watch each slot progress, cancel when needed, and continue from the strongest result.',
  'latest.multimode.alt':
    'ima2-gen multimode sequence showing four generating slots and active job history.',
  'latest.canvas.label': 'Canvas Mode',
  'latest.canvas.h': 'Clean up the winning frame.',
  'latest.canvas.body':
    'Pan around a zoomed image, annotate target areas, clean backgrounds, and export transparent or matte-backed canvas versions.',
  'latest.canvas.alt':
    'ima2-gen Canvas Mode showing annotation marks, sticky note, zoom controls, and canvas toolbar.',
  'latest.import.label': 'Prompt import',
  'latest.import.h': 'Bring prompt packs in.',
  'latest.import.body':
    'Drag local files, preview GitHub folders, refresh curated sources, and index selected prompts into the built-in library.',
  'latest.import.alt':
    'ima2-gen prompt import dialog with local file drop, GitHub path input, curated sources, and discovered prompt results.',

  // Why Branch
  'branch.tag': '03 · Branching as a workflow',
  'branch.h.before': 'A good frame is a ',
  'branch.h.em': 'starting point.',
  'branch.lede':
    'Locking the parent and fanning out children is how visual ideas actually develop. ima2-gen makes it the default.',
  'branch.shot.alt':
    'ima2-gen Node mode canvas with a parent node and child branches showing palette, framing, and copy variants.',
  'branch.scenarios.aria': 'Branching scenario steps',
  'branch.s1.strong': 'Generate a parent.',
  'branch.s1.body': 'A frame you actually want to keep.',
  'branch.s2.strong': 'Fan out children.',
  'branch.s2.body': 'Palette swap, tighter crop, alternate copy margin — three nodes, three runs.',
  'branch.s3.strong': 'Compare without loss.',
  'branch.s3.body': 'The parent stays. Children recover by request ID even after a refresh.',

  // Local & OAuth
  'local.tag': '04 · Local & open',
  'local.h.before': 'Sign in. ',
  'local.h.em': 'Stay local.',
  'local.lede':
    "ima2-gen reuses your existing Codex/ChatGPT login. Generated frames and sessions live on your disk — not on someone else's.",
  'local.quote.before': 'If the settings page says ',
  'local.quote.strong': 'Configured but disabled',
  'local.quote.after': ', that means an API key exists in env/config but image generation still uses OAuth.',
  'local.meta': 'User-data folder · MIT licensed · Inspect, sync, version — your call.',
  'local.shot.alt':
    'ima2-gen Settings workspace showing OAuth active and an API key configured but disabled.',

  // Style & References
  'style.tag': '05 · Canvas, style & references',
  'style.h.before': 'Clean the frame. ',
  'style.h.em': 'Keep the look.',
  'style.lede':
    'Canvas Mode separates pan from selection, adds background cleanup, and exports alpha or matte-backed versions. Style sheets and references keep the visual direction reusable.',
  'style.shot.alt':
    'ima2-gen Style sheet editor with medium, composition, mood, subject, palette, and negative fields.',
  'style.field.medium': 'medium',
  'style.field.composition': 'composition',
  'style.field.mood': 'mood',
  'style.field.subject': 'subject',
  'style.field.palette': 'palette',
  'style.field.negative': 'negative',
  'style.field.canvas': 'canvas cleanup',
  'style.field.alpha': 'alpha / matte export',

  // Install
  'install.tag': '06 · Get going',
  'install.h.before': 'One command. ',
  'install.h.em': 'Then iterate.',
  'install.lede': 'Run it with npx. Sign in once with Codex. Start branching.',
  'install.badge.npm': 'npm v1.1.8',
  'install.badge.node': 'Node ≥20',
  'install.badge.mit': 'MIT',
  'install.links.aria': 'Project links',
  'install.link.repo': 'GitHub repository',
  'install.link.npm': 'npm package',
  'install.link.ko': '한국어 README',
  'install.link.ja': '日本語 README',
  'install.link.zh': '简体中文 README',

  // FAQ — short list shown on landing
  'faq.tag': 'FAQ',
  'faq.more': 'See all FAQ →',
  'faq.q1': 'When should I use Node mode or Canvas Mode?',
  'faq.a1':
    'Use Node mode to compare several directions from a result you like. Use Canvas Mode when the frame is close but needs targeted cleanup, background work, annotation, or alpha/matte export.',
  'faq.q2': 'Where do my images live?',
  'faq.a2':
    'Locally. Generated images and session logs live in your user-data folder. Inspect, sync, version — your call. Image files are not uploaded to a separate remote store.',
  'faq.q3': 'Do I need an OpenAI API key?',
  'faq.a3':
    'Not for image generation. `ima2-gen` uses your local Codex/ChatGPT login. An `API key` may still be detected for auxiliary tooling, but the generation path uses your login session by design.',

  // FAQ — full detail page
  'faq.page.title': 'FAQ — ima2-gen',
  'faq.page.h': 'Frequently asked questions',
  'faq.page.lede': 'Install, run, branch — answered short.',
  'faq.cat.install': 'Install',
  'faq.cat.usage': 'Usage',
  'faq.cat.tech': 'Tech',

  'faq.install.q1': 'Can I run it through the Codex desktop app?',
  'faq.install.a1':
    'No — it runs through the `Codex CLI`. If the CLI is missing, `ima2-gen` prompts you to install it on first run, then opens a login window. Approve and you are good to go.',
  'faq.install.q2': 'How do I install ima2-gen?',
  'faq.install.a2':
    'Open Terminal (macOS / Linux) or PowerShell (Windows). Install globally with `npm install -g ima2-gen`, then run `ima2 serve`. Open `http://localhost:3333` in your browser.',
  'faq.install.q3': 'What is npm? Is there a one-click install?',
  'faq.install.a3':
    '`npm` is the Node.js package manager. If you do not have it, use the installer for your OS — it helps set up Node when needed, installs `ima2-gen`, and starts the server.',
  'faq.install.q4': 'Does it work on Windows / PowerShell?',
  'faq.install.a4':
    'Yes. Windows 10+ with `PowerShell 5.1` or `PowerShell 7` are supported. The public installer script is served from GitHub Pages and prints every command before running it.',

  'faq.usage.q1': 'How many images can I generate at once?',
  'faq.usage.a1':
    'Up to eight in parallel from a single Classic run. Node mode runs each child node as its own request, so you can fan out as many branches as your quota allows.',
  'faq.usage.q2': 'Can I attach reference images?',
  'faq.usage.a2':
    'Up to five references per prompt. Drag, drop, or paste them into the composer. Large files are compressed before upload, so you do not have to pre-process them.',
  'faq.usage.q3': 'How does a Style sheet work?',
  'faq.usage.a3':
    'Save `medium`, `composition`, `mood`, `palette`, and `negative` cues into a sheet, then attach the sheet to any prompt. Style sheets persist across sessions, so you can reuse the same visual direction tomorrow.',
  'faq.usage.q4': 'What is multimode?',
  'faq.usage.a4':
    'Multimode starts several Classic candidates from one prompt and shows slot-by-slot progress. You can stop a run, inspect partial results, and continue from the best image.',
  'faq.usage.q5': 'Can I import prompts from GitHub?',
  'faq.usage.a5':
    'Yes. The prompt library can import local prompt packs, GitHub folders, curated sources, and GPT-image hint packs, then index them locally for search and ranking.',

  'faq.tech.q1': 'What data leaves my machine?',
  'faq.tech.a1':
    'The generation request goes to OpenAI to actually create the image. The result file and the session log stay on your disk. There is no separate `ima2-gen` analytics or remote store.',
  'faq.tech.q2': 'Does it work offline?',
  'faq.tech.a2':
    'Generation needs the OpenAI API, so an internet connection is required for that step. Browsing the local gallery, organizing sessions, and editing style sheets all work offline.',
  'faq.tech.q3': 'Is it open source?',
  'faq.tech.a3':
    'Yes. `ima2-gen` is MIT licensed. The code lives on GitHub.',

  // Footer
  'footer.line1': 'ima2-gen · MIT licensed',
  'footer.line2': 'Branch the images you love.',
  'footer.line3': 'Built local. Documented in the open.',
  'footer.lang.aria': 'Language READMEs',

  // LangToggle
  'lang.aria': 'Language',
};

const ko: Dict = {
  // Base / meta
  'meta.title': 'ima2-gen — 로컬 이미지 스튜디오, Classic + Node + Canvas',
  'meta.desc':
    'Classic으로 만들고, Node로 분기하고, Canvas Mode로 정리하는 로컬 이미지 스튜디오.',
  'meta.og.title': 'ima2-gen — 만들고, 분기하고, 정리하기',
  'meta.og.desc':
    'Classic, Node 분기, multimode batch, Canvas Mode cleanup을 갖춘 로컬 이미지 스튜디오. npx 한 줄로 시작합니다.',

  // Header
  'header.brand.aria': 'ima2-gen 홈',
  'header.nav.aria': '섹션 내비게이션',
  'header.nav.workflows': '워크플로',
  'header.nav.branch': '분기',
  'header.nav.local': '로컬',
  'header.nav.install': '설치',
  'header.nav.faq': 'FAQ',
  'header.gh': 'GitHub ↗',

  // Hero
  'hero.eyebrow': '로컬 이미지 스튜디오 · Classic + Node + Canvas',
  'hero.h1.line1': '마음에 든 한 장,',
  'hero.h1.line2': '다음 컷은',
  'hero.h1.em': '바로 펼치기.',
  'hero.sub':
    '한 장으로 끝나지 않는 작업을 위한 이미지 스튜디오. Classic에서 만들고, Node에서 방향을 펼치고, multimode로 후보를 빠르게 보고, Canvas Mode에서 결과를 정리하세요.',
  'hero.cta.cmd': 'npx ima2-gen serve',
  'hero.cross.lang': 'English landing →',
  'hero.shot.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 생성 이미지, 모델 라벨, 결과 메타가 한 화면에.',

  // Two Workflows
  'workflows.tag': '01 · 생성, 분기, 정리',
  'workflows.h.before': '만드는 방식은 두 가지. ',
  'workflows.h.em': '마무리는 Canvas.',
  'workflows.lede':
    '빠르게 한 장이나 여러 후보가 필요하면 Classic/multimode. 마음에 든 결과에서 여러 방향을 보고 싶다면 Node. 부분 정리는 Canvas Mode에서 이어갑니다.',
  'workflows.classic.label': 'Classic',
  'workflows.classic.h': '빠르게 한 장을 완성할 때.',
  'workflows.classic.body':
    '프롬프트를 쓰고, 레퍼런스를 다섯 장까지 붙이고, 한 장 또는 multimode 후보 여러 장을 만드세요. 어떤 결과에서든 이어 만들 수 있습니다.',
  'workflows.classic.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 레퍼런스, 생성된 인물 컷.',
  'workflows.node.label': 'Node',
  'workflows.node.h': '한 컷에서 여러 방향으로.',
  'workflows.node.body':
    '기준이 될 한 장을 고정하고, 색감·구도·카피를 노드별로 펼치세요. 실행 중인 branch는 request ID 기준으로 복구됩니다.',
  'workflows.node.alt':
    'ima2-gen Node 모드 — 연결된 카드들과 노드별 메타.',

  // Latest Capabilities
  'latest.tag': '02 · 새로 들어온 작업 도구',
  'latest.h.before': '여러 후보, 정리, ',
  'latest.h.em': '가져오기.',
  'latest.lede':
    '최근 릴리스에는 multimode 후보 슬롯, Canvas Mode 정리 도구, 파일/GitHub/curated source 기반 prompt library import가 들어왔습니다.',
  'latest.multimode.label': 'Multimode',
  'latest.multimode.h': '하나의 프롬프트에서 네 후보.',
  'latest.multimode.body':
    'Classic에서 시퀀스를 실행하고, 슬롯별 진행을 보면서 필요하면 취소하고, 가장 좋은 결과에서 바로 이어갈 수 있습니다.',
  'latest.multimode.alt':
    'ima2-gen multimode sequence — 네 개 생성 슬롯과 진행 중 작업 히스토리.',
  'latest.canvas.label': 'Canvas Mode',
  'latest.canvas.h': '마음에 든 컷을 정리하기.',
  'latest.canvas.body':
    '확대된 이미지를 이동하고, 수정 지점을 표시하고, 배경을 정리한 뒤 투명 또는 matte-backed canvas version으로 export합니다.',
  'latest.canvas.alt':
    'ima2-gen Canvas Mode — annotation, sticky note, zoom control, canvas toolbar가 보이는 화면.',
  'latest.import.label': 'Prompt import',
  'latest.import.h': 'Prompt pack 가져오기.',
  'latest.import.body':
    '로컬 파일을 끌어오고, GitHub folder를 미리 보고, curated source를 갱신해 선택한 prompt를 내장 library에 index합니다.',
  'latest.import.alt':
    'ima2-gen prompt import dialog — 파일 drop, GitHub path 입력, curated source, 발견된 prompt 결과.',

  // Why Branch
  'branch.tag': '03 · 분기, 그게 워크플로',
  'branch.h.before': '마음에 든 한 장이 ',
  'branch.h.em': '다음 작업의 시작.',
  'branch.lede':
    '원본은 그대로 두고, 색감·구도·카피만 바꿔 여러 방향을 비교하세요. ima2-gen은 이 흐름을 기본으로 만들었습니다.',
  'branch.shot.alt':
    'ima2-gen Node 모드 — 기준 노드 한 장과 색감·구도·카피 방향의 자식 노드들.',
  'branch.scenarios.aria': '분기 시나리오 단계',
  'branch.s1.strong': '먼저 기준이 될 한 장.',
  'branch.s1.body': '계속 가져가고 싶은 결과를 고르세요.',
  'branch.s2.strong': '거기서 방향을 펼치기.',
  'branch.s2.body':
    '색감은 살짝 다르게, 구도는 더 타이트하게, 카피 여백은 넓게. 방향마다 노드로 나눠 비교합니다.',
  'branch.s3.strong': '원본은 그대로, 결과는 나란히.',
  'branch.s3.body': '새로고침해도 요청 기록을 기준으로 결과를 다시 불러옵니다.',

  // Local & OAuth
  'local.tag': '04 · 로컬 & 오픈',
  'local.h.before': '로그인 한 번, ',
  'local.h.em': '저장은 내 컴퓨터.',
  'local.lede':
    '이미 쓰는 Codex/ChatGPT 로그인으로 시작하세요. 만든 이미지와 작업 기록은 외부 서버가 아니라 내 컴퓨터에 남습니다.',
  'local.quote.before': '설정에 ',
  'local.quote.strong': 'Configured but disabled',
  'local.quote.after':
    '가 보인다면, API key가 설정돼 있어도 이미지 생성은 Codex/ChatGPT 로그인으로만 실행된다는 뜻입니다.',
  'local.meta': '로컬 저장 · MIT 라이선스 · 확인, 동기화, 버전 관리까지 원하는 방식으로.',
  'local.shot.alt':
    'ima2-gen 설정 화면 — OAuth 활성, API key는 설정되어 있지만 비활성.',

  // Style & References
  'style.tag': '05 · Canvas, 스타일, 레퍼런스',
  'style.h.before': '프레임은 정리하고, ',
  'style.h.em': '룩은 유지하기.',
  'style.lede':
    'Canvas Mode는 화면 이동과 선택을 분리하고, 배경 정리와 alpha/matte export를 지원합니다. 스타일 시트와 레퍼런스는 다음 작업에서도 같은 방향을 유지하게 해줍니다.',
  'style.shot.alt':
    'ima2-gen 스타일 시트 에디터 — medium, composition, mood, subject, palette, negative 필드.',
  'style.field.medium': 'medium',
  'style.field.composition': 'composition',
  'style.field.mood': 'mood',
  'style.field.subject': 'subject',
  'style.field.palette': 'palette',
  'style.field.negative': 'negative',
  'style.field.canvas': 'canvas cleanup',
  'style.field.alpha': 'alpha / matte export',

  // Install
  'install.tag': '06 · 시작하기',
  'install.h.before': '한 줄로 실행하고, ',
  'install.h.em': '바로 반복하세요.',
  'install.lede':
    'npx로 열고, Codex로 로그인하세요. 마음에 드는 결과가 나오면 바로 다음 방향을 펼칠 수 있습니다.',
  'install.badge.npm': 'npm v1.1.8',
  'install.badge.node': 'Node ≥20',
  'install.badge.mit': 'MIT',
  'install.links.aria': '프로젝트 링크',
  'install.link.repo': 'GitHub 저장소',
  'install.link.npm': 'npm 패키지',
  'install.link.ko': '한국어 README',
  'install.link.ja': '日本語 README',
  'install.link.zh': '简体中文 README',

  // FAQ — 랜딩 짧은 목록
  'faq.tag': 'FAQ',
  'faq.more': '전체 FAQ 보기 →',
  'faq.q1': 'Node 모드와 Canvas Mode는 언제 쓰나요?',
  'faq.a1':
    '마음에 든 결과에서 여러 방향을 비교하려면 Node 모드를 씁니다. 이미지가 거의 맞지만 배경 정리, annotation, alpha/matte export 같은 부분 정리가 필요하면 Canvas Mode를 씁니다.',
  'faq.q2': '이미지는 어디 저장되나요?',
  'faq.a2':
    '로컬 사용자 데이터 폴더에 이미지와 작업 기록이 저장됩니다. 직접 확인, 동기화, 버전 관리까지 가능합니다. 이미지 파일을 별도 외부 저장소에 올리지 않습니다.',
  'faq.q3': 'OpenAI API key가 필요한가요?',
  'faq.a3':
    '이미지 생성에는 필요 없습니다. 로컬에 로그인된 Codex/ChatGPT 계정을 그대로 사용합니다. `API key`가 설정돼 있어도 이미지 생성 경로는 로그인 세션을 우선 사용하도록 설계되어 있습니다.',

  // FAQ — 상세 페이지
  'faq.page.title': 'FAQ — ima2-gen',
  'faq.page.h': '자주 묻는 질문',
  'faq.page.lede': '설치, 실행, 분기 — 핵심만 짧게.',
  'faq.cat.install': '설치',
  'faq.cat.usage': '사용',
  'faq.cat.tech': '기술',

  'faq.install.q1': 'Codex 데스크톱 앱으로도 되나요?',
  'faq.install.a1':
    '아니요. `Codex CLI`로 실행됩니다. CLI가 없으면 `ima2-gen`이 첫 실행 때 설치를 안내하고, 로그인 창을 띄워줍니다. 안내대로 깔면 바로 시작할 수 있습니다.',
  'faq.install.q2': '어떻게 설치하나요?',
  'faq.install.a2':
    '터미널(macOS / Linux) 또는 PowerShell(Windows)을 엽니다. `npm install -g ima2-gen`으로 전역 설치하고 `ima2 serve`로 실행하세요. 브라우저에서 `http://localhost:3333`을 열면 됩니다.',
  'faq.install.q3': 'npm이 뭔가요? 한 번에 설치하는 방법이 있나요?',
  'faq.install.a3':
    '`npm`은 Node.js 패키지 매니저입니다. 처음이라면 OS별 설치 스크립트를 사용할 수 있습니다. 스크립트는 Node가 없으면 설치를 안내하고, `ima2-gen` 설치와 서버 실행을 돕습니다.',
  'faq.install.q4': 'Windows / PowerShell에서도 되나요?',
  'faq.install.a4':
    '됩니다. Windows 10 이상, `PowerShell 5.1` 또는 `PowerShell 7`을 지원합니다. 공개 설치 스크립트는 GitHub Pages에서 제공되며, 실행 전 모든 명령을 화면에 출력합니다.',

  'faq.usage.q1': '한 번에 몇 장까지 만들 수 있나요?',
  'faq.usage.a1':
    'Classic은 한 번에 최대 8장까지 병렬로 만들 수 있습니다. Node에서는 자식 노드마다 별도 요청이 가니, 할당량이 허용하는 만큼 가지를 펼칠 수 있습니다.',
  'faq.usage.q2': '레퍼런스 이미지를 붙일 수 있나요?',
  'faq.usage.a2':
    '프롬프트당 다섯 장까지 붙일 수 있습니다. 컴포저에 끌어 놓거나 붙여 넣으면 끝. 큰 파일은 자동으로 압축돼서 업로드되므로 미리 손볼 필요는 없습니다.',
  'faq.usage.q3': 'Style sheet은 어떻게 쓰나요?',
  'faq.usage.a3':
    '`매체`, `구도`, `분위기`, `팔레트`, `제외할 요소`를 시트로 묶어 두고 프롬프트에 붙여 쓰면 됩니다. 시트는 세션을 넘겨도 유지되므로 같은 룩을 다음 작업에서도 그대로 가져갈 수 있습니다.',
  'faq.usage.q4': 'Multimode는 뭔가요?',
  'faq.usage.a4':
    '하나의 프롬프트에서 여러 Classic 후보를 동시에 시작하고 slot별 진행 상황을 보여주는 방식입니다. 중간에 멈추거나 partial 결과를 확인한 뒤 가장 좋은 이미지에서 이어갈 수 있습니다.',
  'faq.usage.q5': 'GitHub에서 prompt를 가져올 수 있나요?',
  'faq.usage.a5':
    '가능합니다. Prompt library는 로컬 prompt pack, GitHub folder, curated source, GPT-image hint pack을 가져와 로컬 index에 저장하고 검색/ranking에 사용합니다.',

  'faq.tech.q1': '내 컴퓨터에서 어떤 데이터가 나가나요?',
  'faq.tech.a1':
    '이미지 생성 요청은 OpenAI로 전송됩니다. 결과 파일과 작업 기록은 로컬에만 남습니다. `ima2-gen`이 별도로 수집하는 분석 데이터나 외부 저장소는 없습니다.',
  'faq.tech.q2': '오프라인에서도 되나요?',
  'faq.tech.a2':
    '이미지 생성은 OpenAI API 호출이 필요해 인터넷이 있어야 합니다. 로컬 갤러리 보기, 세션 정리, 스타일 시트 편집은 오프라인에서도 됩니다.',
  'faq.tech.q3': '오픈소스인가요?',
  'faq.tech.a3':
    '네. `ima2-gen`은 MIT 라이선스로 공개되어 있습니다. 코드는 GitHub에서 볼 수 있습니다.',

  // Footer
  'footer.line1': 'ima2-gen · MIT 라이선스',
  'footer.line2': '마음에 든 한 장, 다음 컷은 바로.',
  'footer.line3': '로컬에서 만들고, 코드는 공개로.',
  'footer.lang.aria': '언어별 README',

  // LangToggle
  'lang.aria': '언어',
};

export const STRINGS: Record<Lang, Dict> = { en, ko };

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
