# GPT-Image-2 文生图/图生图网站设计

## 技术栈

- 前端: React 18 + Vite
- 后端: Node.js + Express + SQLite (better-sqlite3)
- 图片生成 API: APIMart GPT-Image-2

## 布局

```
┌──────────────────────────────────────┐
│        ┌─────────────────┐           │
│        │ 用户库 生成库 素材库 │ 浮动面板  │
│        └─────────────────┘           │
│  ┌──┐ ┌──┐ ┌──┐                     │
│  │  │ │  │ │  │                     │
│  │  ├─┤  │ │  │   瀑布流（全屏可滚动）  │
│  └──┘ │  │ └──┘                     │
│       └──┘                          │
├──────────────────────────────────────┤
│  已选图片 (多选缩略图)                 │
│  Prompt 输入框                       │
│  价格｜APIKey｜分辨率｜尺寸｜数量｜生成   │
└──────────────────────────────────────┘
```

## 组件树

```
App
├── FloatingPanel (浮动库切换)
├── MasonryGallery (瀑布流)
│   └── ImageCard × N (hover 显示操作按钮)
├── ImageModal (预览模态框)
├── Footer
│   ├── SelectedImages (已选缩略图)
│   ├── PromptInput
│   └── ActionBar
│       ├── PriceDisplay
│       ├── ApiKeyButton → ApiKeyModal
│       ├── ResolutionSelect
│       ├── SizeSelect
│       ├── CountSelect
│       └── GenerateButton
└── ApiKeyModal
```

## 三个库的行为

| 操作 | 用户库 | 生成库 | 素材库 |
|------|--------|--------|--------|
| 第一张 | 上传按钮 | 生成中旋转占位 | -- |
| 查看 | 大图 | 大图+prompt+参考图 | 大图+prompt |
| 选择 | 选为参考图 | 选为参考图 | -- |
| 做同款 | -- | 填充 prompt | 填充 prompt |
| 删除 | 支持 | 支持 | 不支持 |

## 数据库表

```sql
user_images (id, filename, original_name, file_size, created_at)

generated_images (id, prompt, filename, task_id, status, resolution, size, created_at)
-- status: 'generating' | 'completed' | 'failed'

materials (id, category, prompt_text, image_path, author, source_url, created_at)
-- 启动时解析 git 子模块写入

settings (key, value)
```

## 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/images` | GET | 获取用户库/生成库图片列表 |
| `/api/images/upload` | POST | 上传图片 |
| `/api/images/:id` | DELETE | 删除图片 |
| `/api/generate` | POST | 提交生成任务 |
| `/api/tasks/:id` | GET | 查询任务状态 |
| `/api/materials` | GET | 获取素材库列表 |
| `/api/settings/apikey` | GET/PUT | 读写 API Key |

## 数据流

```
Browser → POST /api/generate → Backend → APIMart
                                    ↓
                             返回 task_id
                                    ↓
Browser 轮询 GET /api/tasks/:id (每5s)
                                    ↓
                          completed → 显示结果
                          failed    → 显示错误
```

## 价格 (1:7 汇率)

| 分辨率 | 美元 | 人民币 |
|--------|------|--------|
| 1K | $0.006 | ¥0.04/张 |
| 2K | $0.012 | ¥0.08/张 |
| 4K | $0.018 | ¥0.13/张 |

## 核心状态

```ts
currentTab: 'user' | 'generated' | 'material'
selectedImages: Image[]       // 最多16张
resolution: '1k' | '2k' | '4k'
size: 'auto' | '1:1' | '16:9' | ...
count: 1-10
prompt: string
apiKey: string
```

## 项目结构

```
gpt-image-2/
├── client/                  # React
│   ├── src/
│   │   ├── components/
│   │   │   ├── FloatingPanel.tsx
│   │   │   ├── MasonryGallery.tsx
│   │   │   ├── ImageCard.tsx
│   │   │   ├── ImageModal.tsx
│   │   │   ├── SelectedImages.tsx
│   │   │   ├── PromptInput.tsx
│   │   │   ├── ActionBar.tsx
│   │   │   └── ApiKeyModal.tsx
│   │   ├── hooks/
│   │   │   └── usePolling.ts
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── ...
├── server/                  # Express
│   ├── routes/
│   │   ├── images.js
│   │   ├── generate.js
│   │   ├── materials.js
│   │   └── settings.js
│   ├── db.js
│   ├── sync-materials.js
│   └── index.js
├── materials/               # Git 子模块
└── package.json
```
