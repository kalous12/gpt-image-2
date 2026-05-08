# GPT-Image-2 文生图/图生图网站设计

## 技术栈

- 前端: React 18 + Vite
- 后端: Node.js + Express
- 数据库: SQLite (better-sqlite3)
- 素材来源: Git 子模块 `awesome-gpt-image-2-API-and-Prompts`
- 图像 API: APIMart GPT-Image-2 (`api.apimart.ai`)

## 布局

```
┌──────────────────────────────────────┐
│       ┌─────────────────┐            │
│       │ 用户库 生成库 素材库 │ 浮动面板  │
│       └─────────────────┘            │
│  ┌──┐ ┌──┐ ┌──┐                     │
│  │  │ │  │ │  │   瀑布流（全屏）      │
│  │  ├─┤  │ │  │                     │
│  └──┘ │  │ └──┘                     │
│       └──┘                          │
├──────────────────────────────────────┤
│  已选缩略图                          │
│  [Prompt 输入框]                     │
│  价格｜APIKey｜分辨率｜尺寸｜数量｜生成  │
└──────────────────────────────────────┘
```

- 顶部: 浮动面板，固定居中，毛玻璃效果，切换三个库
- 中间: 瀑布流图片展示，可滚动
- 底部: 固定操作面板，三层

## 三个库的功能

### 用户库

- 第一张固定为上传 Slot
- 其他图片 hover 显示: 查看 / 选择，右上角删除
- 图片存后端 `user_images` 表

### 生成库

- 生成中时第一张显示旋转 loading 占位图
- 图片 hover 显示: 查看 / 选择 / 做同款，右上角删除
- 图片存后端 `generated_images` 表

### 素材库

- 图片 hover 显示: 查看 / 做同款
- 启动时解析 git 子模块入 `materials` 表

## 数据库

```sql
user_images (id, filename, original_name, file_size, created_at)

generated_images (id, prompt, filename, task_id, status, resolution, size, created_at)
-- status: 'generating' | 'completed' | 'failed'

materials (id, category, prompt_text, image_path, author, source_url, created_at)

settings (key, value)
```

## 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/images?type=user\|generated` | GET | 图片列表 |
| `/api/images/upload` | POST | 上传图片（用户库） |
| `/api/images/:id` | DELETE | 删除图片 |
| `/api/generate` | POST | 提交生成任务 |
| `/api/tasks/:id` | GET | 查询任务状态 |
| `/api/materials` | GET | 素材库列表 |
| `/api/settings/apikey` | GET/PUT | API Key 管理 |

## 生成流程

1. 校验 prompt 非空 / apiKey 已设置
2. POST `/api/generate` → 后端调 APIMart → 返回 task_id
3. 生成库插入 status='generating' 记录
4. 前端每 5 秒轮询 GET `/api/tasks/:id`
5. completed → 更新记录、展示结果
6. failed → 更新状态为 failed

## API 参数

- model: gpt-image-2
- prompt: 文本描述
- n: 1-10
- size: auto / 1:1 / 3:2 / 2:3 / 4:3 / 3:4 / 5:4 / 4:5 / 16:9 / 9:16 / 2:1 / 1:2 / 21:9 / 9:21
- resolution: 1k / 2k / 4k
- image_urls: base64 数组（图生图时，最多16张）

## 价格 (1:7 汇率)

| 分辨率 | 美元 | 人民币 |
|--------|------|--------|
| 1K | $0.006 | ¥0.04/张 |
| 2K | $0.012 | ¥0.08/张 |
| 4K | $0.018 | ¥0.13/张 |

## 模态框预览

- 用户库图片: 显示大图
- 生成库图片: 显示大图 + prompt + 使用的参考图缩略图
- 素材库图片: 显示大图 + prompt

## 前端组件

```
App
├── FloatingPanel          # 库切换
├── MasonryGallery         # 瀑布流
│   └── ImageCard × N      # 图片卡片 + hover 按钮
├── ImageModal              # 预览模态框
├── Footer
│   ├── SelectedImages      # 已选缩略图
│   ├── PromptInput
│   └── ActionBar
│       ├── PriceDisplay
│       ├── ApiKeyButton → ApiKeyModal
│       ├── ResolutionSelect
│       ├── SizeSelect
│       ├── CountSelect (1-10)
│       └── GenerateButton
└── ApiKeyModal
```

## 前端依赖

- react-masonry-css (瀑布流)
- react-dropzone (拖拽上传)

## 后端依赖

- express
- better-sqlite3
- multer (文件上传)
- node-fetch (调用 APIMart API)

## 项目结构

```
gpt-image-2/
├── client/                 # React 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── hooks/          # 自定义 hooks
│   │   ├── api.ts          # 后端 API 封装
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── ...
├── server/                 # Express 后端
│   ├── routes/
│   │   ├── images.js
│   │   ├── generate.js
│   │   ├── materials.js
│   │   └── settings.js
│   ├── db.js               # SQLite
│   ├── sync-materials.js   # 启动解析素材
│   └── index.js
├── materials/              # Git 子模块
└── package.json
```
