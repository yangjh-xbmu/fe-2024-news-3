# 食品配料表评价应用 — 设计文档

## 概述

面向减肥群体的 Web 应用。用户上传食品配料表图片，MinerU 提取文字后由 DeepSeek V4 Pro 生成评价，以两栏布局展示结果：左栏（综合评分 + 减肥友好度），右栏（风险警示 + 成分科普）。

## 架构

```
HTML 前端 (单文件)  ──▶  Node.js 后端 (代理)  ──▶  MinerU API v4 (文字提取)
                              │
                              ▼
                        DeepSeek API (LLM 评价)
```

后端职责：静态文件托管 + 读取 `.env` 中的 API key + 代理 MinerU 和 DeepSeek 调用。前端不接触任何密钥。

## API 流程

### 图片解析（MinerU v4 文件上传）

1. `POST /api/v4/file-urls/batch` — 获取签名上传 URL
2. `PUT {file_url}` — 上传图片文件到 MinerU
3. `GET /api/v4/extract-results/batch/{batch_id}` — 轮询解析状态
4. 解析完成后下载 `full_zip_url`，解压提取 `.md` 文件内容

### LLM 评价（DeepSeek）

1. `POST https://api.deepseek.com/v1/chat/completions` — 发送配料表文字 + 系统提示词
2. 返回结构化 JSON，前端渲染

### 后端路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 静态文件 `index.html` |
| `/api/parse` | POST | 接收图片 multipart，调 MinerU 返回提取文字 |
| `/api/evaluate` | POST | 接收文字 JSON，调 DeepSeek 返回评价 JSON |

## LLM 系统提示词

要求 DeepSeek 返回严格 JSON，包含四个维度的评价内容：

```json
{
  "score": 72,
  "friendliness": "moderate",
  "friendlinessReason": "含添加糖但整体蛋白质含量较高，适量食用",
  "warnings": ["白砂糖（第3位，含量较高）", "起酥油（可能含反式脂肪）"],
  "ingredients": [
    {"name": "全麦粉", "role": "主食成分", "note": "富含膳食纤维，升糖指数低"},
    {"name": "白砂糖", "role": "甜味剂", "note": "升糖指数高，减肥期间建议控制"}
  ]
}
```

字段约束：
- `score`：0-100 整数，越高越适合减肥
- `friendliness`：枚举 `"high"` / `"moderate"` / `"low"`
- `friendlinessReason`：一句话说明评分依据
- `warnings`：风险配料及原因，每条不超过 30 字
- `ingredients`：每个配料含 `name`、`role`（功能类别）、`note`（减肥视角评价）

## 前端 UI

单文件 `index.html`，移动端优先响应式。

### 布局（桌面端两栏，移动端上下堆叠）

```
┌──────────────────────────────────────────────────┐
│  🥗 食品配料表评价                                 │
│  ┌────────────┐                                  │
│  │  上传区域    │ 拖拽或点击上传配料表图片             │
│  └────────────┘                                  │
│  ┌──────────────────┬──────────────────────────┐ │
│  │ 综合评分 (环形图)  │ ⚠️ 风险警示               │ │
│  │ 72分             │ • 白砂糖含量较高            │ │
│  │                  │ • 起酥油可能含反式脂肪       │ │
│  ├──────────────────┼──────────────────────────┤ │
│  │ 减肥友好度        │ 🔬 成分科普               │ │
│  │ 🟡 适量食用       │ • 全麦粉：富含膳食纤维...   │ │
│  │ 含添加糖但整体...  │ • 白砂糖：升糖指数高...     │ │
│  └──────────────────┴──────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 状态流转

```
初始（上传区）→ 上传中 → 解析中 → 评价中 → 结果展示
                                  ↘ 错误提示（任一步骤失败）
```

## 依赖

- Node.js + Express + dotenv + multer + form-data（后端）
- MinerU API v4（Token 认证，文件解析）
- DeepSeek API v1/chat/completions（API Key 认证）

## 非目标

- 用户系统、登录注册
- 历史记录持久化
- 批量上传
- 多语言支持（仅中文）
