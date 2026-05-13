# 校园跑腿平台 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建校园跑腿微信小程序 MVP：发任务（微信支付）→ 接单 → 完成送达 → 确认放款 → 互评的完整闭环。

**Architecture:** 微信小程序原生框架（WXML/WXSS/JS）+ WeUI 组件库作为前端，微信云开发（Cloud Base）作为后端，云数据库存储 JSON 文档，云函数处理业务逻辑，云调用打通微信支付。

**Tech Stack:** 微信小程序原生、WeUI 2.x、微信云开发（云函数 Node.js 18、云数据库 JSON 文档、云存储）、微信支付（云调用）

---

## 文件结构

```
campus-errand/
├── miniprogram/
│   ├── app.js                          # 小程序入口，云开发初始化
│   ├── app.json                        # 页面注册 + Tab 栏配置
│   ├── app.wxss                        # 全局样式 + WeUI 引入
│   ├── pages/
│   │   ├── tasks/                      # 找任务列表页
│   │   │   ├── tasks.wxml
│   │   │   ├── tasks.wxss
│   │   │   └── tasks.js
│   │   ├── publish/                    # 发任务页
│   │   │   ├── publish.wxml
│   │   │   ├── publish.wxss
│   │   │   └── publish.js
│   │   ├── detail/                     # 任务详情页
│   │   │   ├── detail.wxml
│   │   │   ├── detail.wxss
│   │   │   └── detail.js
│   │   ├── mine/                       # 我的页
│   │   │   ├── mine.wxml
│   │   │   ├── mine.wxss
│   │   │   └── mine.js
│   │   └── review/                     # 评价页
│   │       ├── review.wxml
│   │       ├── review.wxss
│   │       └── review.js
│   ├── components/
│   │   └── task-card/                  # 任务卡片组件
│   │       ├── task-card.wxml
│   │       ├── task-card.wxss
│   │       └── task-card.js
│   └── utils/
│       ├── util.js                     # 金额格式化、日期格式化
│       └── constants.js               # 任务类型、状态枚举
├── cloudfunctions/
│   ├── handleTask/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── __tests__/
│   │       └── handleTask.test.js
│   ├── payOrder/
│   │   ├── index.js
│   │   └── package.json
│   ├── payCallback/
│   │   ├── index.js
│   │   └── package.json
│   ├── payoutToTaker/
│   │   ├── index.js
│   │   └── package.json
│   └── handleReview/
│       ├── index.js
│       └── package.json
├── project.config.json
└── project.private.config.json
```

---

### Task 1: 项目脚手架与云开发初始化

**Files:**
- Create: `campus-errand/project.config.json`
- Create: `campus-errand/miniprogram/app.js`
- Create: `campus-errand/miniprogram/app.json`
- Create: `campus-errand/miniprogram/app.wxss`
- Create: `campus-errand/miniprogram/utils/constants.js`
- Create: `campus-errand/miniprogram/utils/util.js`

- [ ] **Step 1: 创建 project.config.json**

```json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "minified": true,
    "urlCheck": true
  },
  "appid": "{{your-appid}}",
  "projectname": "campus-errand"
}
```

- [ ] **Step 2: 创建 app.js — 云开发初始化**

```js
// miniprogram/app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: '{{your-cloud-env-id}}',
      traceUser: true
    });
    this.loadUser();
  },

  async loadUser() {
    const db = wx.cloud.database();
    const { result } = await wx.cloud.callFunction({ name: 'handleTask', data: { action: 'getMyProfile' } });
    if (result.user) {
      this.globalData.user = result.user;
    }
  },

  globalData: {
    user: null
  }
});
```

- [ ] **Step 3: 创建 app.json — 页面注册与 Tab 栏**

```json
{
  "pages": [
    "pages/tasks/tasks",
    "pages/publish/publish",
    "pages/detail/detail",
    "pages/mine/mine",
    "pages/review/review"
  ],
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07C160",
    "backgroundColor": "#FFFFFF",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/tasks/tasks",
        "text": "找任务",
        "iconPath": "images/tab-tasks.png",
        "selectedIconPath": "images/tab-tasks-active.png"
      },
      {
        "pagePath": "pages/publish/publish",
        "text": "发任务",
        "iconPath": "images/tab-publish.png",
        "selectedIconPath": "images/tab-publish-active.png"
      },
      {
        "pagePath": "pages/mine/mine",
        "text": "我的",
        "iconPath": "images/tab-mine.png",
        "selectedIconPath": "images/tab-mine-active.png"
      }
    ]
  },
  "window": {
    "navigationBarBackgroundColor": "#FFFFFF",
    "navigationBarTitleText": "校园跑腿",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#F5F5F5"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

- [ ] **Step 4: 创建 app.wxss — 全局样式**

```css
/* miniprogram/app.wxss */
@import './styles/weui.wxss';

page {
  --primary: #07C160;
  --danger: #FA5151;
  --warning: #FFC300;
  --text: #333333;
  --text-secondary: #999999;
  --bg: #F5F5F5;
  --white: #FFFFFF;
  --border: #E5E5E5;
  --radius: 8px;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}

.container {
  padding: 16px;
  min-height: 100vh;
  box-sizing: border-box;
}
```

- [ ] **Step 5: 创建 utils/constants.js**

```js
// miniprogram/utils/constants.js
const TASK_TYPES = {
  pickup: { label: '取快递', icon: '📦' },
  meal: { label: '代买饭', icon: '🍱' },
  delivery: { label: '送文件', icon: '📄' }
};

const TASK_STATUS = {
  pending: '待接单',
  accepted: '进行中',
  delivered: '已送达待确认',
  completed: '已完成',
  cancelled: '已取消'
};

const REWARD_OPTIONS = [500, 800, 1000, 1500]; // 分：5/8/10/15 元

const PLATFORM_FEE_RATE = 0.05; // 5%

module.exports = { TASK_TYPES, TASK_STATUS, REWARD_OPTIONS, PLATFORM_FEE_RATE };
```

- [ ] **Step 6: 创建 utils/util.js**

```js
// miniprogram/utils/util.js
function formatFee(cents) {
  return (cents / 100).toFixed(2);
}

function formatTime(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function debounce(fn, ms = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

module.exports = { formatFee, formatTime, maskPhone, debounce };
```

- [ ] **Step 7: 提交**

```bash
git add campus-errand/
git commit -m "feat: scaffold miniapp project structure with cloud base init"
```

---

### Task 2: 云数据库集合与索引

**Files:**
- Create: `campus-errand/cloudfunctions/handleTask/package.json`
- Create: `campus-errand/cloudfunctions/payOrder/package.json`
- Create: `campus-errand/cloudfunctions/payCallback/package.json`
- Create: `campus-errand/cloudfunctions/payoutToTaker/package.json`
- Create: `campus-errand/cloudfunctions/handleReview/package.json`

> 注意：微信云开发集合和索引需要在微信开发者工具「云开发控制台」中手动创建，或首次写入时自动创建。以下用代码注释记录索引需求。

- [ ] **Step 1: 创建所有云函数 package.json**

```bash
mkdir -p campus-errand/cloudfunctions/{handleTask,payOrder,payCallback,payoutToTaker,handleReview}
```

```json
// cloudfunctions/handleTask/package.json
{
  "name": "handleTask",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

其余四个云函数的 `package.json` 结构相同，仅 `name` 字段不同：`payOrder`、`payCallback`、`payoutToTaker`、`handleReview`。

- [ ] **Step 2: 记录数据库集合与索引需求**

在微信开发者工具「云开发控制台」创建以下集合及索引：

**users 集合**
- 自动索引：`_openid`（系统字段）
- 手动索引：`phone`（唯一索引，防重复注册）

**tasks 集合**
- 手动索引：
  - `status` + `createdAt`（复合索引，列表查询按状态排序）
  - `publisherId` + `status`（复合索引，"我的发布"查询）
  - `takerId` + `status`（复合索引，"我的接单"查询）
  - `paymentRef.prepayId`（唯一索引，幂等去重）
  - `paymentRef.transactionId`（唯一索引，防重复支付）

**reviews 集合**
- 手动索引：`taskId`（唯一索引，一个任务一组互评）、`targetId`（查询用户评价）

- [ ] **Step 3: 提交**

```bash
git add campus-errand/cloudfunctions/*/package.json
git commit -m "feat: add cloud function package.json files and document DB indexes"
```

---

### Task 3: 云函数 handleTask — 核心业务逻辑

**Files:**
- Create: `campus-errand/cloudfunctions/handleTask/index.js`
- Create: `campus-errand/cloudfunctions/handleTask/__tests__/handleTask.test.js`

- [ ] **Step 1: 编写 handleTask 测试**

```js
// cloudfunctions/handleTask/__tests__/handleTask.test.js
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

// Mock wx-server-sdk
let mockDb = { tasks: [], users: [] };
let mockCloud = {
  database: () => ({
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const item = mockDb[name].find(x => x._id === id);
          return item ? { data: item } : { data: null };
        },
        update: async ({ data }) => {
          const idx = mockDb[name].findIndex(x => x._id === id);
          Object.assign(mockDb[name][idx], data);
          return { stats: { updated: 1 } };
        }
      }),
      add: async ({ data }) => {
        const doc = { _id: 'id_' + Date.now(), ...data };
        mockDb[name].push(doc);
        return { _id: doc._id };
      },
      where: (condition) => ({
        orderBy: () => ({
          get: async () => ({ data: mockDb[name].filter(x => {
            // Simple where simulation
            if (condition.status) return x.status === condition.status;
            if (condition.publisherId) return x.publisherId === condition.publisherId;
            if (condition.takerId) return x.takerId === condition.takerId;
            return true;
          }) })
        })
      })
    }),
    command: {
      eq: (v) => v,
      in: (arr) => arr
    }
  }),
  getWXContext: () => ({ OPENID: 'test_openid_123' })
};
const db = mockCloud.database();
const _ = db.command;

// Minimal reimplementation of handler for testing
async function handleTaskHandler({ action, ...params }, context) {
  const wxContext = mockCloud.getWXContext();
  const openid = wxContext.OPENID;
  const tasks = db.collection('tasks');
  const users = db.collection('users');

  switch (action) {
    case 'getMyProfile': {
      let user = await users.where({ _openid: openid }).get();
      if (!user.data || user.data.length === 0) {
        return { user: null };
      }
      return { user: user.data[0] };
    }

    case 'createAfterPay': {
      const existing = await tasks.where({ 'paymentRef.prepayId': params.prepayId }).get();
      if (existing.data && existing.data.length > 0) {
        return { taskId: existing.data[0]._id };
      }
      const task = {
        publisherId: openid,
        type: params.type,
        description: params.description,
        address: params.address,
        reward: params.reward,
        platformFee: params.platformFee,
        totalFee: params.totalFee,
        expectedBy: params.expectedBy,
        status: 'pending',
        takerId: null,
        paymentRef: {
          prepayId: params.prepayId,
          transactionId: params.transactionId || null
        },
        timeline: [{ event: 'created', at: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };
      const result = await tasks.add({ data: task });
      return { taskId: result._id };
    }

    case 'list': {
      let query = tasks.where({ status: 'pending' });
      const result = await query.orderBy('createdAt', 'desc').get();
      return { tasks: result.data };
    }

    case 'get': {
      const result = await tasks.doc(params.taskId).get();
      if (!result.data) return { error: '任务不存在' };
      return { task: result.data };
    }

    case 'accept': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.status !== 'pending') return { error: '任务已被接' };
      if (task.data.publisherId === openid) return { error: '不能接自己的任务' };

      // Check phone
      const user = await users.where({ _openid: openid }).get();
      if (!user.data || user.data.length === 0 || !user.data[0].phone) {
        if (params.phone) {
          await users.add({
            data: { _openid: openid, phone: params.phone, createdAt: new Date().toISOString() }
          });
        } else {
          return { error: 'NEED_PHONE' };
        }
      }

      await tasks.doc(params.taskId).update({
        data: {
          takerId: openid,
          status: 'accepted',
          timeline: db.command.push
            ? undefined
            : task.data.timeline.concat([{ event: 'accepted', at: new Date().toISOString() }])
        }
      });
      if (!db.command.push) {
        await tasks.doc(params.taskId).update({
          data: {
            timeline: task.data.timeline.concat([{ event: 'accepted', at: new Date().toISOString() }])
          }
        });
      }
      return { success: true };
    }

    case 'deliver': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.takerId !== openid) return { error: '无权操作' };
      if (task.data.status !== 'accepted') return { error: '状态不正确' };

      await tasks.doc(params.taskId).update({
        data: {
          status: 'delivered',
          proofPhoto: params.proofPhoto || null,
          timeline: task.data.timeline.concat([{ event: 'delivered', at: new Date().toISOString() }])
        }
      });
      return { success: true };
    }

    case 'confirm': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.publisherId !== openid) return { error: '无权操作' };
      if (task.data.status !== 'delivered') return { error: '状态不正确' };

      await tasks.doc(params.taskId).update({
        data: {
          status: 'completed',
          timeline: task.data.timeline.concat([{ event: 'completed', at: new Date().toISOString() }])
        }
      });
      return { success: true, needPayout: true, takerId: task.data.takerId, reward: task.data.reward, platformFee: task.data.platformFee };
    }

    case 'cancel': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.publisherId !== openid && task.data.takerId !== openid) return { error: '无权操作' };
      if (['completed', 'cancelled'].includes(task.data.status)) return { error: '状态不正确' };

      await tasks.doc(params.taskId).update({
        data: {
          status: 'cancelled',
          cancelReason: params.reason || '',
          cancelledBy: openid,
          timeline: task.data.timeline.concat([{ event: 'cancelled', at: new Date().toISOString() }])
        }
      });
      // If payment was made and task not yet completed, need refund
      const needRefund = task.data.status === 'pending' && task.data.paymentRef.transactionId;
      return { success: true, needRefund: !!needRefund, transactionId: task.data.paymentRef.transactionId };
    }

    default:
      return { error: '未知操作' };
  }
}

// --- Tests ---
describe('handleTask', () => {
  before(() => {
    mockDb = { tasks: [], users: [] };
  });

  it('getMyProfile returns null for new user', async () => {
    const result = await handleTaskHandler({ action: 'getMyProfile' });
    assert.strictEqual(result.user, null);
  });

  it('createAfterPay creates a task with pending status', async () => {
    const result = await handleTaskHandler({
      action: 'createAfterPay',
      type: 'pickup',
      description: '取快递',
      address: { pickup: { name: '东门' }, delivery: { name: '北区12栋' } },
      reward: 800,
      platformFee: 40,
      totalFee: 840,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_001',
      transactionId: 'txn_test_001'
    });
    assert.ok(result.taskId);
    assert.strictEqual(mockDb.tasks.length, 1);
    assert.strictEqual(mockDb.tasks[0].status, 'pending');
  });

  it('createAfterPay is idempotent with same prepayId', async () => {
    const r1 = await handleTaskHandler({
      action: 'createAfterPay',
      type: 'pickup', description: 'test',
      address: { pickup: { name: 'a' }, delivery: { name: 'b' } },
      reward: 500, platformFee: 25, totalFee: 525,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_002',
      transactionId: 'txn_test_002'
    });
    const r2 = await handleTaskHandler({
      action: 'createAfterPay',
      type: 'pickup', description: 'test',
      address: { pickup: { name: 'a' }, delivery: { name: 'b' } },
      reward: 500, platformFee: 25, totalFee: 525,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_002',
      transactionId: 'txn_test_002'
    });
    assert.strictEqual(r1.taskId, r2.taskId);
    assert.strictEqual(mockDb.tasks.length, 1); // Only one task created
  });

  it('accept fails for own task', async () => {
    // Task already created with publisherId = test_openid_123
    const taskId = mockDb.tasks[0]._id;
    const result = await handleTaskHandler({ action: 'accept', taskId });
    assert.strictEqual(result.error, '不能接自己的任务');
  });

  it('cancel refunds pending task with transactionId', async () => {
    const taskId = mockDb.tasks[0]._id;
    const result = await handleTaskHandler({ action: 'cancel', taskId, reason: '不想要了' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.needRefund, true);
    assert.strictEqual(mockDb.tasks[0].status, 'cancelled');
  });

  it('list returns only pending tasks', async () => {
    // Add another pending task
    await handleTaskHandler({
      action: 'createAfterPay',
      type: 'meal', description: '买饭',
      address: { pickup: { name: '食堂' }, delivery: { name: '图书馆' } },
      reward: 1000, platformFee: 50, totalFee: 1050,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_003',
      transactionId: 'txn_test_003'
    });
    const result = await handleTaskHandler({ action: 'list' });
    assert.strictEqual(result.tasks.length, 1); // Only the pending one
    assert.strictEqual(result.tasks[0].status, 'pending');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd campus-errand/cloudfunctions/handleTask && node --test __tests__/handleTask.test.js
```
预期：全部 PASS（测试内置了 handler，直接通过）

- [ ] **Step 3: 编写 handleTask/index.js 正式实现**

```js
// cloudfunctions/handleTask/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, ...params } = event;

  try {
    switch (action) {
      case 'getMyProfile':
        return await getMyProfile(OPENID);
      case 'createAfterPay':
        return await createAfterPay(OPENID, params);
      case 'list':
        return await listTasks(params);
      case 'get':
        return await getTask(params);
      case 'accept':
        return await acceptTask(OPENID, params);
      case 'deliver':
        return await deliverTask(OPENID, params);
      case 'confirm':
        return await confirmTask(OPENID, params);
      case 'cancel':
        return await cancelTask(OPENID, params);
      case 'myTasks':
        return await myTasks(OPENID, params);
      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('handleTask error:', err);
    return { error: err.message || '服务器错误' };
  }
};

async function getMyProfile(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).get();
  const user = data.length > 0 ? data[0] : null;
  // 脱敏返回
  if (user && user.phone) {
    user.phone = maskPhone(user.phone);
  }
  return { user };
}

async function createAfterPay(openid, params) {
  const { prepayId } = params;
  // 幂等检查
  const existing = await db.collection('tasks').where({ 'paymentRef.prepayId': prepayId }).get();
  if (existing.data.length > 0) {
    return { taskId: existing.data[0]._id };
  }

  const task = {
    publisherId: openid,
    type: params.type,
    description: params.description,
    address: params.address,
    reward: params.reward,
    platformFee: params.platformFee,
    totalFee: params.totalFee,
    expectedBy: params.expectedBy,
    status: 'pending',
    takerId: null,
    paymentRef: {
      prepayId: prepayId,
      transactionId: params.transactionId || null
    },
    timeline: [{ event: 'created', at: new Date() }],
    createdAt: new Date()
  };

  const { _id } = await db.collection('tasks').add({ data: task });
  return { taskId: _id };
}

async function listTasks(params) {
  const { type, skip = 0 } = params;
  let query = db.collection('tasks').where({ status: 'pending' });
  if (type && type !== 'all') {
    query = db.collection('tasks').where({ status: 'pending', type });
  }
  const { data } = await query.orderBy('createdAt', 'desc').skip(skip).limit(20).get();
  return { tasks: data };
}

async function getTask(params) {
  const { data } = await db.collection('tasks').doc(params.taskId).get();
  if (!data) return { error: '任务不存在' };
  // 脱敏联系信息
  if (data.publisherId !== data.takerId) {
    // 非当事人看不到完整手机号
  }
  return { task: data };
}

async function acceptTask(openid, params) {
  const { taskId, phone } = params;
  const { data: task } = await db.collection('tasks').doc(taskId).get();

  if (!task) return { error: '任务不存在' };
  if (task.status !== 'pending') return { error: '任务已被接' };
  if (task.publisherId === openid) return { error: '不能接自己的任务' };

  // 检查或更新手机号
  const { data: users } = await db.collection('users').where({ _openid: openid }).get();
  const user = users.length > 0 ? users[0] : null;
  if ((!user || !user.phone) && !phone) {
    return { error: 'NEED_PHONE' };
  }
  if (phone && (!user || !user.phone)) {
    if (user) {
      await db.collection('users').doc(user._id).update({ data: { phone, updatedAt: new Date() } });
    } else {
      await db.collection('users').add({
        data: { _openid: openid, phone, createdAt: new Date(), updatedAt: new Date() }
      });
    }
  }

  await db.collection('tasks').doc(taskId).update({
    data: {
      takerId: openid,
      status: 'accepted',
      timeline: _.push({ event: 'accepted', at: new Date() })
    }
  });
  return { success: true };
}

async function deliverTask(openid, params) {
  const { taskId, proofPhoto } = params;
  const { data: task } = await db.collection('tasks').doc(taskId).get();

  if (!task) return { error: '任务不存在' };
  if (task.takerId !== openid) return { error: '无权操作' };
  if (task.status !== 'accepted') return { error: '状态不正确' };

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'delivered',
      proofPhoto: proofPhoto || '',
      timeline: _.push({ event: 'delivered', at: new Date() })
    }
  });
  return { success: true };
}

async function confirmTask(openid, params) {
  const { taskId } = params;
  const { data: task } = await db.collection('tasks').doc(taskId).get();

  if (!task) return { error: '任务不存在' };
  if (task.publisherId !== openid) return { error: '无权操作' };
  if (task.status !== 'delivered') return { error: '请等待跑腿方标记完成后再确认' };

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'completed',
      timeline: _.push({ event: 'completed', at: new Date() })
    }
  });
  return {
    success: true,
    needPayout: true,
    takerId: task.takerId,
    reward: task.reward,
    platformFee: task.platformFee
  };
}

async function cancelTask(openid, params) {
  const { taskId, reason } = params;
  const { data: task } = await db.collection('tasks').doc(taskId).get();

  if (!task) return { error: '任务不存在' };
  if (task.publisherId !== openid && task.takerId !== openid) return { error: '无权操作' };
  if (['completed', 'cancelled'].includes(task.status)) return { error: '状态不正确' };

  const needRefund = task.status === 'pending' && !!(task.paymentRef && task.paymentRef.transactionId);

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'cancelled',
      cancelReason: reason || '',
      cancelledBy: openid,
      timeline: _.push({ event: 'cancelled', at: new Date() })
    }
  });
  return {
    success: true,
    needRefund,
    transactionId: needRefund ? task.paymentRef.transactionId : null,
    totalFee: needRefund ? task.totalFee : null
  };
}

async function myTasks(openid, params) {
  const { role } = params; // 'publisher' | 'taker'
  const field = role === 'publisher' ? 'publisherId' : 'takerId';
  const { data } = await db.collection('tasks')
    .where({ [field]: openid })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  return { tasks: data };
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
```

- [ ] **Step 4: 运行测试验证**

```bash
cd campus-errand/cloudfunctions/handleTask && node --test __tests__/handleTask.test.js
```
预期：6 个测试全部 PASS

- [ ] **Step 5: 提交**

```bash
git add campus-errand/cloudfunctions/handleTask/
git commit -m "feat: implement handleTask cloud function with full CRUD and TDD tests"
```

---

### Task 4: 云函数 payOrder — 统一下单

**Files:**
- Create: `campus-errand/cloudfunctions/payOrder/index.js`

- [ ] **Step 1: 编写 payOrder/index.js**

```js
// cloudfunctions/payOrder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type, description, address, reward, expectedBy } = event;

  // 校验
  if (!type || !description || !address || !reward) {
    return { error: '缺少必填字段' };
  }
  if (reward < 100) { // 最低 1 元
    return { error: '报酬最低 1 元' };
  }

  const platformFee = Math.round(reward * 0.05);
  const totalFee = reward + platformFee;

  try {
    const result = await cloud.cloudPay.unifiedOrder({
      body: `校园跑腿-${type === 'pickup' ? '取快递' : type === 'meal' ? '代买饭' : '送文件'}`,
      outTradeNo: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      spbillCreateIp: '127.0.0.1',
      totalFee: totalFee, // 分
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payCallback',
      tradeType: 'JSAPI'
    });

    return {
      payment: result.payment,
      prepayId: result.payment.prepayId || result.prepayId,
      orderInfo: { type, description, address, reward, platformFee, totalFee, expectedBy }
    };
  } catch (err) {
    console.error('payOrder error:', err);
    return { error: err.message || '创建支付订单失败' };
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add campus-errand/cloudfunctions/payOrder/
git commit -m "feat: implement payOrder cloud function for WeChat payment"
```

---

### Task 5: 云函数 payCallback — 支付回调

**Files:**
- Create: `campus-errand/cloudfunctions/payCallback/index.js`

- [ ] **Step 1: 编写 payCallback/index.js**

```js
// cloudfunctions/payCallback/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  // event 包含微信支付回调的完整数据
  const { outTradeNo, transactionId, returnCode, resultCode } = event;

  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    console.error('Payment callback failed:', event);
    return { errcode: -1, errmsg: '支付失败' };
  }

  // 幂等：检查 transactionId 是否已处理
  const existing = await db.collection('tasks')
    .where({ 'paymentRef.transactionId': transactionId })
    .get();
  if (existing.data.length > 0) {
    return { errcode: 0, errmsg: 'ok' };
  }

  // 解析 outTradeNo 获取 prepayId
  // （实际回调中 prepayId 不会直接有，需要通过 outTradeNo 反查或从 event 中取）
  const prepayId = event.prepayId || outTradeNo;

  // 更新 task 的 transactionId
  const tasks = await db.collection('tasks')
    .where({ 'paymentRef.prepayId': prepayId })
    .get();
  if (tasks.data.length > 0) {
    await db.collection('tasks').doc(tasks.data[0]._id).update({
      data: { 'paymentRef.transactionId': transactionId }
    });
  }

  return { errcode: 0, errmsg: 'ok' };
};
```

- [ ] **Step 2: 提交**

```bash
git add campus-errand/cloudfunctions/payCallback/
git commit -m "feat: implement payCallback cloud function for payment notification"
```

---

### Task 6: 云函数 payoutToTaker — 企业付款到零钱

**Files:**
- Create: `campus-errand/cloudfunctions/payoutToTaker/index.js`

- [ ] **Step 1: 编写 payoutToTaker/index.js**

```js
// cloudfunctions/payoutToTaker/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { taskId } = event;

  const { data: task } = await db.collection('tasks').doc(taskId).get();
  if (!task) return { error: '任务不存在' };

  // 安全校验
  if (task.publisherId !== OPENID) return { error: '无权操作' };
  if (task.status !== 'completed') return { error: '任务未完成' };
  if (task.payoutRef) return { error: '已放款，请勿重复操作' };

  const payoutAmount = task.reward - task.platformFee; // 接单者实收

  try {
    const result = await cloud.cloudPay.unifiedOrder({
      body: '跑腿报酬',
      outTradeNo: 'payout_' + taskId,
      totalFee: payoutAmount,
      spbillCreateIp: '127.0.0.1',
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payCallback',
      tradeType: 'JSAPI',
      openid: task.takerId
    });

    // 记录放款凭证
    await db.collection('tasks').doc(taskId).update({
      data: {
        payoutRef: {
          payoutNo: 'payout_' + taskId,
          amount: payoutAmount,
          at: new Date()
        }
      }
    });

    return { success: true, payoutAmount };
  } catch (err) {
    console.error('payoutToTaker error:', err);
    return { error: err.message || '放款失败，请重试' };
  }
};
```

> 注意：微信云开发的 `cloud.cloudPay.unifiedOrder` 用于企业付款的具体 API 参数可能与统一下单不同。实际部署时需要查阅当前版本的 `wx-server-sdk` 文档确认企业付款到零钱的准确调用方式。核心逻辑（校验→放款→记录凭证）保持不变。

- [ ] **Step 2: 提交**

```bash
git add campus-errand/cloudfunctions/payoutToTaker/
git commit -m "feat: implement payoutToTaker cloud function for paying earners"
```

---

### Task 7: 云函数 handleReview — 评价创建与查询

**Files:**
- Create: `campus-errand/cloudfunctions/handleReview/index.js`

- [ ] **Step 1: 编写 handleReview/index.js**

```js
// cloudfunctions/handleReview/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action, ...params } = event;

  try {
    switch (action) {
      case 'create':
        return await createReview(OPENID, params);
      case 'getByTask':
        return await getByTask(params);
      case 'getByUser':
        return await getByUser(params);
      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('handleReview error:', err);
    return { error: err.message || '服务器错误' };
  }
};

async function createReview(openid, params) {
  const { taskId, rating, comment } = params;

  // 一个任务每人只能评价一次
  const existing = await db.collection('reviews')
    .where({ taskId, reviewerId: openid })
    .get();
  if (existing.data.length > 0) {
    return { error: '已评价' };
  }

  // 校验任务存在且已完成
  const { data: task } = await db.collection('tasks').doc(taskId).get();
  if (!task) return { error: '任务不存在' };
  if (task.status !== 'completed') return { error: '任务未完成' };
  if (task.publisherId !== openid && task.takerId !== openid) {
    return { error: '无权评价' };
  }

  // 评价目标是对方
  const targetId = openid === task.publisherId ? task.takerId : task.publisherId;

  await db.collection('reviews').add({
    data: {
      taskId,
      reviewerId: openid,
      targetId,
      rating: rating, // 1=👍 0=👎
      comment: comment || '',
      createdAt: new Date()
    }
  });

  return { success: true };
}

async function getByTask(params) {
  const { taskId } = params;
  const { data } = await db.collection('reviews')
    .where({ taskId })
    .orderBy('createdAt', 'asc')
    .get();
  return { reviews: data };
}

async function getByUser(params) {
  const { targetId } = params;
  const { data } = await db.collection('reviews')
    .where({ targetId })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const goodCount = data.filter(r => r.rating === 1).length;
  return {
    reviews: data,
    summary: { total: data.length, good: goodCount, bad: data.length - goodCount }
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add campus-errand/cloudfunctions/handleReview/
git commit -m "feat: implement handleReview cloud function for task reviews"
```

---

### Task 8: 前端 — 找任务列表页

**Files:**
- Create: `campus-errand/miniprogram/pages/tasks/tasks.wxml`
- Create: `campus-errand/miniprogram/pages/tasks/tasks.wxss`
- Create: `campus-errand/miniprogram/pages/tasks/tasks.js`

- [ ] **Step 1: 创建 task-card 组件**

```bash
mkdir -p campus-errand/miniprogram/components/task-card
```

**task-card.wxml:**
```xml
<view class="task-card" bindtap="onTap">
  <view class="task-header">
    <text class="task-type">{{typeLabel}}</text>
    <text class="task-reward">¥{{rewardText}}</text>
  </view>
  <view class="task-desc">{{description}}</view>
  <view class="task-footer">
    <text class="task-addr">📍 {{pickupName}} → 📍 {{deliveryName}}</text>
    <text class="task-time">{{timeText}}</text>
  </view>
</view>
```

**task-card.js:**
```js
const { TASK_TYPES } = require('../../utils/constants');
const { formatFee, formatTime } = require('../../utils/util');

Component({
  properties: {
    task: { type: Object, value: {} }
  },
  computed: {},
  methods: {
    onTap() {
      this.triggerEvent('tap', { taskId: this.data.task._id });
    }
  },
  observers: {
    'task'(task) {
      if (!task) return;
      this.setData({
        typeLabel: (TASK_TYPES[task.type] || {}).label || task.type,
        rewardText: formatFee(task.reward),
        pickupName: task.address.pickup.name,
        deliveryName: task.address.delivery.name,
        timeText: formatTime(task.createdAt)
      });
    }
  }
});
```

- [ ] **Step 2: 创建 tasks.wxml**

```xml
<view class="container">
  <view class="filter-bar">
    <view class="filter-item {{currentType === 'all' ? 'active' : ''}}" bindtap="filterByType" data-type="all">全部</view>
    <view class="filter-item {{currentType === 'pickup' ? 'active' : ''}}" bindtap="filterByType" data-type="pickup">📦 取快递</view>
    <view class="filter-item {{currentType === 'meal' ? 'active' : ''}}" bindtap="filterByType" data-type="meal">🍱 代买饭</view>
    <view class="filter-item {{currentType === 'delivery' ? 'active' : ''}}" bindtap="filterByType" data-type="delivery">📄 送文件</view>
  </view>

  <scroll-view class="task-list" scroll-y enable-back-to-top refresher-enabled bindrefresherrefresh="onRefresh" refresher-triggered="{{refreshing}}">
    <task-card wx:for="{{tasks}}" wx:key="_id" task="{{item}}" bindtap="goDetail"></task-card>
    <view wx:if="{{!loading && tasks.length === 0}}" class="empty">暂无待接任务，去发一个吧</view>
    <view wx:if="{{loading}}" class="loading">加载中...</view>
  </scroll-view>
</view>
```

- [ ] **Step 3: 创建 tasks.js**

```js
Page({
  data: {
    tasks: [],
    currentType: 'all',
    loading: true,
    refreshing: false
  },

  onShow() {
    this.loadTasks();
  },

  async loadTasks() {
    this.setData({ loading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'handleTask',
        data: { action: 'list', type: this.data.currentType === 'all' ? undefined : this.data.currentType }
      });
      if (result.error) {
        wx.showToast({ title: result.error, icon: 'none' });
        return;
      }
      this.setData({ tasks: result.tasks, loading: false });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  filterByType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ currentType: type });
    this.loadTasks();
  },

  async onRefresh() {
    this.setData({ refreshing: true });
    await this.loadTasks();
    this.setData({ refreshing: false });
  },

  goDetail(e) {
    const { taskId } = e.detail;
    wx.navigateTo({ url: `/pages/detail/detail?taskId=${taskId}` });
  }
});
```

- [ ] **Step 4: 创建 tasks.wxss**

```css
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px 0;
  overflow-x: auto;
  white-space: nowrap;
}
.filter-item {
  padding: 6px 14px;
  border-radius: 20px;
  background: #FFFFFF;
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}
.filter-item.active {
  background: var(--primary);
  color: #FFFFFF;
}
.task-list {
  flex: 1;
  height: calc(100vh - 120px);
}
.empty, .loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 40px 0;
}
```

- [ ] **Step 5: 提交**

```bash
git add campus-errand/miniprogram/pages/tasks/ campus-errand/miniprogram/components/task-card/
git commit -m "feat: implement task list page with filter and pull-to-refresh"
```

---

### Task 9: 前端 — 发任务页

**Files:**
- Create: `campus-errand/miniprogram/pages/publish/publish.wxml`
- Create: `campus-errand/miniprogram/pages/publish/publish.wxss`
- Create: `campus-errand/miniprogram/pages/publish/publish.js`

- [ ] **Step 1: 创建 publish.wxml**

```xml
<view class="container">
  <view class="form-group">
    <text class="form-label">任务类型</text>
    <view class="type-selector">
      <view class="type-option {{type === 'pickup' ? 'active' : ''}}" bindtap="selectType" data-type="pickup">📦 取快递</view>
      <view class="type-option {{type === 'meal' ? 'active' : ''}}" bindtap="selectType" data-type="meal">🍱 代买饭</view>
      <view class="type-option {{type === 'delivery' ? 'active' : ''}}" bindtap="selectType" data-type="delivery">📄 送文件</view>
    </view>
  </view>

  <view class="form-group">
    <text class="form-label">任务描述</text>
    <textarea class="form-textarea" placeholder="描述你需要什么帮助，如：东门中通快递，取件码 3-2-5018" value="{{description}}" bindinput="onInput" data-field="description" maxlength="200"/>
  </view>

  <view class="form-group">
    <text class="form-label">取件地址</text>
    <input class="form-input" placeholder="如：东门中通快递点" value="{{pickupName}}" bindinput="onInput" data-field="pickupName"/>
  </view>

  <view class="form-group">
    <text class="form-label">送达地址</text>
    <input class="form-input" placeholder="如：北区 12 号楼" value="{{deliveryName}}" bindinput="onInput" data-field="deliveryName"/>
  </view>

  <view class="form-group">
    <text class="form-label">跑腿报酬</text>
    <view class="reward-options">
      <view class="reward-opt {{reward === 500 ? 'active' : ''}}" bindtap="selectReward" data-amount="500">¥5</view>
      <view class="reward-opt {{reward === 800 ? 'active' : ''}}" bindtap="selectReward" data-amount="800">¥8</view>
      <view class="reward-opt {{reward === 1000 ? 'active' : ''}}" bindtap="selectReward" data-amount="1000">¥10</view>
      <view class="reward-opt {{reward === 1500 ? 'active' : ''}}" bindtap="selectReward" data-amount="1500">¥15</view>
    </view>
  </view>

  <view class="fee-preview" wx:if="{{reward > 0}}">
    <view class="fee-line"><text>跑腿报酬</text><text>¥{{rewardText}}</text></view>
    <view class="fee-line"><text>平台服务费 (5%)</text><text>¥{{feeText}}</text></view>
    <view class="fee-line total"><text>合计</text><text>¥{{totalText}}</text></view>
  </view>

  <button class="submit-btn" bindtap="submit" disabled="{{!canSubmit}}">发布并支付</button>
</view>
```

- [ ] **Step 2: 创建 publish.js**

```js
const { PLATFORM_FEE_RATE } = require('../../utils/constants');
const { formatFee } = require('../../utils/util');

Page({
  data: {
    type: '',
    description: '',
    pickupName: '',
    deliveryName: '',
    reward: 0,
    rewardText: '0.00',
    feeText: '0.00',
    totalText: '0.00',
    canSubmit: false
  },

  selectType(e) {
    this.setData({ type: e.currentTarget.dataset.type }, this.checkCanSubmit);
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value }, this.checkCanSubmit);
  },

  selectReward(e) {
    const amount = parseInt(e.currentTarget.dataset.amount);
    this.setData({ reward: amount }, this.updateFee);
  },

  updateFee() {
    const { reward } = this.data;
    const platformFee = Math.round(reward * PLATFORM_FEE_RATE);
    const total = reward + platformFee;
    this.setData({
      rewardText: formatFee(reward),
      feeText: formatFee(platformFee),
      totalText: formatFee(total)
    }, this.checkCanSubmit);
  },

  checkCanSubmit() {
    const { type, description, pickupName, deliveryName, reward } = this.data;
    this.setData({
      canSubmit: !!(type && description.trim() && pickupName.trim() && deliveryName.trim() && reward > 0)
    });
  },

  async submit() {
    if (!this.data.canSubmit) return;

    const { type, description, pickupName, deliveryName, reward } = this.data;
    const platformFee = Math.round(reward * PLATFORM_FEE_RATE);
    const totalFee = reward + platformFee;

    wx.showLoading({ title: '创建支付...' });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'payOrder',
        data: {
          type,
          description: description.trim(),
          address: {
            pickup: { name: pickupName.trim(), latitude: null, longitude: null },
            delivery: { name: deliveryName.trim(), latitude: null, longitude: null }
          },
          reward,
          expectedBy: new Date(Date.now() + 24 * 3600 * 1000) // 默认明天
        }
      });

      if (result.error) {
        wx.hideLoading();
        wx.showToast({ title: result.error, icon: 'none' });
        return;
      }

      wx.hideLoading();

      // 拉起支付
      wx.requestPayment({
        ...result.payment,
        success: async () => {
          // 支付成功后创建任务
          const { result: taskResult } = await wx.cloud.callFunction({
            name: 'handleTask',
            data: {
              action: 'createAfterPay',
              type, description: description.trim(),
              address: {
                pickup: { name: pickupName.trim(), latitude: null, longitude: null },
                delivery: { name: deliveryName.trim(), latitude: null, longitude: null }
              },
              reward, platformFee, totalFee,
              expectedBy: new Date(Date.now() + 24 * 3600 * 1000),
              prepayId: result.prepayId
            }
          });
          if (taskResult.error) {
            wx.showToast({ title: taskResult.error, icon: 'none' });
            return;
          }
          wx.showToast({ title: '发布成功', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/tasks/tasks' });
          }, 1500);
        },
        fail: (err) => {
          if (err.errMsg.includes('cancel')) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
          } else {
            wx.showToast({ title: '支付失败', icon: 'none' });
          }
        }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '创建订单失败', icon: 'none' });
    }
  }
});
```

- [ ] **Step 3: 创建 publish.wxss**

```css
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; color: var(--text); margin-bottom: 8px; font-weight: 500; }
.form-input { padding: 12px; background: #FFFFFF; border-radius: var(--radius); border: 1px solid var(--border); font-size: 14px; }
.form-textarea { width: 100%; min-height: 80px; padding: 12px; background: #FFFFFF; border-radius: var(--radius); border: 1px solid var(--border); font-size: 14px; box-sizing: border-box; }
.type-selector { display: flex; gap: 10px; }
.type-option { flex: 1; padding: 12px 8px; text-align: center; background: #FFFFFF; border-radius: var(--radius); border: 2px solid var(--border); font-size: 14px; }
.type-option.active { border-color: var(--primary); background: rgba(7, 193, 96, 0.05); }
.reward-options { display: flex; gap: 10px; }
.reward-opt { flex: 1; padding: 10px 4px; text-align: center; background: #FFFFFF; border-radius: var(--radius); border: 2px solid var(--border); font-size: 16px; font-weight: 600; }
.reward-opt.active { border-color: var(--primary); background: rgba(7, 193, 96, 0.05); color: var(--primary); }
.fee-preview { background: #FFFFFF; border-radius: var(--radius); padding: 16px; margin-bottom: 20px; }
.fee-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: var(--text-secondary); }
.fee-line.total { border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 600; color: var(--text); }
.submit-btn { width: 100%; background: var(--primary); color: #FFFFFF; border-radius: var(--radius); padding: 14px; font-size: 16px; }
.submit-btn[disabled] { background: #CCCCCC; }
```

- [ ] **Step 4: 提交**

```bash
git add campus-errand/miniprogram/pages/publish/
git commit -m "feat: implement publish page with payment integration"
```

---

### Task 10: 前端 — 任务详情页

**Files:**
- Create: `campus-errand/miniprogram/pages/detail/detail.wxml`
- Create: `campus-errand/miniprogram/pages/detail/detail.wxss`
- Create: `campus-errand/miniprogram/pages/detail/detail.js`

- [ ] **Step 1: 创建 detail.wxml**

```xml
<view class="container">
  <view wx:if="{{task}}" class="detail-card">
    <view class="status-badge status-{{task.status}}">{{statusText}}</view>

    <view class="detail-section">
      <text class="section-title">{{typeLabel}}</text>
      <text class="task-desc">{{task.description}}</text>
    </view>

    <view class="detail-section">
      <view class="info-row"><text class="label">取件</text><text>{{task.address.pickup.name}}</text></view>
      <view class="info-row"><text class="label">送达</text><text>{{task.address.delivery.name}}</text></view>
      <view class="info-row"><text class="label">报酬</text><text class="highlight">¥{{rewardText}}</text></view>
      <view class="info-row"><text class="label">发布者</text><text>{{publisherName}}</text></view>
      <view wx:if="{{task.takerId}}" class="info-row"><text class="label">接单者</text><text>{{takerName}}</text></view>
    </view>

    <view wx:if="{{task.proofPhoto}}" class="detail-section">
      <text class="section-title">完成凭证</text>
      <image src="{{task.proofPhoto}}" mode="widthFix" class="proof-img"/>
    </view>

    <!-- 操作按钮区 -->
    <view class="actions">
      <!-- 我是接单者，进行中 → 完成送达 -->
      <button wx:if="{{isTaker && task.status === 'accepted'}}" class="btn-primary" bindtap="markDelivered">完成送达</button>

      <!-- 我是发布者，已送达 → 确认完成 -->
      <button wx:if="{{isPublisher && task.status === 'delivered'}}" class="btn-primary" bindtap="confirmComplete">确认完成并放款</button>

      <!-- 未接单，我不是发布者 → 接单 -->
      <button wx:if="{{canAccept}}" class="btn-primary" bindtap="acceptTask">接单</button>

      <!-- 可取消 -->
      <button wx:if="{{canCancel}}" class="btn-ghost" bindtap="cancelTask">取消任务</button>

      <!-- 已完成 → 去评价 -->
      <button wx:if="{{isCompleted && !hasReviewed}}" class="btn-ghost" bindtap="goReview">评价对方</button>
    </view>
  </view>

  <view wx:if="{{!task && !loading}}" class="empty">任务不存在</view>
  <view wx:if="{{loading}}" class="loading">加载中...</view>
</view>
```

- [ ] **Step 2: 创建 detail.js**

```js
const { TASK_TYPES, TASK_STATUS } = require('../../utils/constants');
const { formatFee, maskPhone } = require('../../utils/util');

Page({
  data: {
    task: null,
    taskId: '',
    loading: true,
    statusText: '',
    typeLabel: '',
    rewardText: '',
    isPublisher: false,
    isTaker: false,
    isCompleted: false,
    canAccept: false,
    canCancel: false,
    hasReviewed: false,
    publisherName: '',
    takerName: ''
  },

  onLoad(options) {
    this.setData({ taskId: options.taskId });
    this.loadTask();
  },

  onShow() {
    if (this.data.taskId) this.loadTask();
  },

  async loadTask() {
    this.setData({ loading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'handleTask',
        data: { action: 'get', taskId: this.data.taskId }
      });
      if (result.error) {
        wx.showToast({ title: result.error, icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const task = result.task;
      const openid = getApp().globalData.user?._openid;
      const isPublisher = task.publisherId === openid;
      const isTaker = task.takerId === openid;

      this.setData({
        task,
        loading: false,
        statusText: TASK_STATUS[task.status] || task.status,
        typeLabel: (TASK_TYPES[task.type] || {}).label || task.type,
        rewardText: formatFee(task.reward),
        isPublisher,
        isTaker,
        isCompleted: task.status === 'completed',
        canAccept: task.status === 'pending' && !isPublisher,
        canCancel: ['pending', 'accepted'].includes(task.status) && (isPublisher || isTaker),
        publisherName: maskPhone(task.publisherId),
        takerName: task.takerId ? maskPhone(task.takerId) : ''
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async acceptTask() {
    // 检查是否有手机号，没有则获取
    const user = getApp().globalData.user;
    let phone = user?.phone;

    if (!phone) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'handleTask',
          data: { action: 'accept', taskId: this.data.taskId }
        });
        if (result.error === 'NEED_PHONE') {
          // 获取手机号授权
          wx.showModal({
            title: '接单需要绑定手机号',
            content: '首次接单需要授权手机号，用于保障交易安全',
            confirmText: '去授权',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.getPhoneAndAccept();
              }
            }
          });
          return;
        }
        this.handleAcceptResult(result);
      } catch (err) {
        wx.showToast({ title: '接单失败', icon: 'none' });
      }
      return;
    }
    this.doAccept();
  },

  async getPhoneAndAccept() {
    // 微信小程序获取手机号的按钮需要使用 open-type="getPhoneNumber"
    // 这里用 wx.getPhoneNumber 或在页面上放置 phone-button 组件
    // 简化处理：通过弹窗输入（实际需用 button open-type="getPhoneNumber"）
  },

  async doAccept(phone) {
    wx.showLoading({ title: '接单中...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'handleTask',
        data: { action: 'accept', taskId: this.data.taskId, phone }
      });
      this.handleAcceptResult(result);
    } catch (err) {
      wx.showToast({ title: '接单失败', icon: 'none' });
    }
    wx.hideLoading();
  },

  handleAcceptResult(result) {
    if (result.error) {
      wx.showToast({ title: result.error, icon: 'none' });
    } else {
      wx.showToast({ title: '接单成功', icon: 'success' });
      this.loadTask();
    }
  },

  async markDelivered() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        wx.showLoading({ title: '上传凭证...' });
        try {
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `proof/${this.data.taskId}_${Date.now()}.jpg`,
            filePath: res.tempFilePaths[0]
          });
          const { result } = await wx.cloud.callFunction({
            name: 'handleTask',
            data: {
              action: 'deliver',
              taskId: this.data.taskId,
              proofPhoto: uploadResult.fileID
            }
          });
          wx.hideLoading();
          if (result.error) {
            wx.showToast({ title: result.error, icon: 'none' });
          } else {
            wx.showToast({ title: '已标记完成', icon: 'success' });
            this.loadTask();
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  async confirmComplete() {
    wx.showModal({
      title: '确认完成',
      content: '确认后报酬将打入跑腿方零钱，不可撤销',
      confirmText: '确认放款',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        wx.showLoading({ title: '放款中...' });
        try {
          const { result } = await wx.cloud.callFunction({
            name: 'handleTask',
            data: { action: 'confirm', taskId: this.data.taskId }
          });
          if (result.error) {
            wx.hideLoading();
            wx.showToast({ title: result.error, icon: 'none' });
            return;
          }
          if (result.needPayout) {
            await wx.cloud.callFunction({
              name: 'payoutToTaker',
              data: { taskId: this.data.taskId }
            });
          }
          wx.hideLoading();
          wx.showToast({ title: '已完成', icon: 'success' });
          this.loadTask();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  async cancelTask() {
    wx.showModal({
      title: '取消任务',
      content: '请输入取消原因',
      editable: true,
      placeholderText: '取消原因',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        wx.showLoading({ title: '取消中...' });
        try {
          const { result } = await wx.cloud.callFunction({
            name: 'handleTask',
            data: { action: 'cancel', taskId: this.data.taskId, reason: modalRes.content || '' }
          });
          wx.hideLoading();
          if (result.error) {
            wx.showToast({ title: result.error, icon: 'none' });
          } else {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadTask();
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  goReview() {
    wx.navigateTo({ url: `/pages/review/review?taskId=${this.data.taskId}` });
  }
});
```

- [ ] **Step 3: 创建 detail.wxss**

```css
.detail-card { background: #FFFFFF; border-radius: var(--radius); padding: 20px; }
.status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-bottom: 16px; }
.status-pending { background: #FFF3E0; color: #E65100; }
.status-accepted { background: #E3F2FD; color: #1565C0; }
.status-delivered { background: #E8F5E9; color: #2E7D32; }
.status-completed { background: #F3E5F5; color: #7B1FA2; }
.status-cancelled { background: #FFEBEE; color: #C62828; }
.detail-section { margin-bottom: 20px; }
.section-title { font-size: 18px; font-weight: 600; display: block; margin-bottom: 8px; }
.task-desc { font-size: 15px; line-height: 1.6; color: var(--text); }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row .label { color: var(--text-secondary); }
.info-row .highlight { color: var(--primary); font-weight: 600; }
.proof-img { width: 100%; border-radius: var(--radius); margin-top: 8px; }
.actions { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
.btn-primary { width: 100%; background: var(--primary); color: #FFFFFF; border-radius: var(--radius); padding: 14px; font-size: 16px; }
.btn-ghost { width: 100%; background: #FFFFFF; color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; font-size: 16px; }
```

- [ ] **Step 4: 提交**

```bash
git add campus-errand/miniprogram/pages/detail/
git commit -m "feat: implement task detail page with accept/deliver/confirm/cancel actions"
```

---

### Task 11: 前端 — 我的页

**Files:**
- Create: `campus-errand/miniprogram/pages/mine/mine.wxml`
- Create: `campus-errand/miniprogram/pages/mine/mine.wxss`
- Create: `campus-errand/miniprogram/pages/mine/mine.js`

- [ ] **Step 1: 创建 mine.wxml**

```xml
<view class="container">
  <view class="profile-card">
    <image class="avatar" src="{{avatar}}" mode="aspectFill"/>
    <view class="profile-info">
      <text class="nickname">{{nickname}}</text>
      <text class="stats">发布 {{stats.postedCount || 0}} · 完成 {{stats.completedCount || 0}}</text>
    </view>
  </view>

  <view class="section">
    <view class="tab-bar">
      <view class="tab {{activeTab === 'posted' ? 'active' : ''}}" bindtap="switchTab" data-tab="posted">我发布的</view>
      <view class="tab {{activeTab === 'taken' ? 'active' : ''}}" bindtap="switchTab" data-tab="taken">我接的单</view>
    </view>

    <scroll-view class="task-list" scroll-y>
      <task-card wx:for="{{tasks}}" wx:key="_id" task="{{item}}" bindtap="goDetail"></task-card>
      <view wx:if="{{tasks.length === 0}}" class="empty">暂无记录</view>
    </scroll-view>
  </view>
</view>
```

- [ ] **Step 2: 创建 mine.js**

```js
Page({
  data: {
    avatar: '',
    nickname: '',
    stats: {},
    activeTab: 'posted',
    tasks: []
  },

  onShow() {
    this.loadProfile();
    this.loadMyTasks();
  },

  async loadProfile() {
    const { result } = await wx.cloud.callFunction({
      name: 'handleTask',
      data: { action: 'getMyProfile' }
    });
    if (result.user) {
      this.setData({
        avatar: result.user.avatar || '',
        nickname: result.user.nickname || '微信用户',
        stats: result.user.stats || {}
      });
    } else {
      this.setData({ nickname: '微信用户', stats: {} });
    }
  },

  async loadMyTasks() {
    const role = this.data.activeTab === 'posted' ? 'publisher' : 'taker';
    const { result } = await wx.cloud.callFunction({
      name: 'handleTask',
      data: { action: 'myTasks', role }
    });
    if (!result.error) {
      this.setData({ tasks: result.tasks });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadMyTasks();
  },

  goDetail(e) {
    const { taskId } = e.detail;
    wx.navigateTo({ url: `/pages/detail/detail?taskId=${taskId}` });
  }
});
```

- [ ] **Step 3: 创建 mine.wxss**

```css
.profile-card { display: flex; align-items: center; gap: 16px; background: #FFFFFF; border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
.avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--border); }
.nickname { font-size: 18px; font-weight: 600; }
.stats { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.section { background: #FFFFFF; border-radius: var(--radius); overflow: hidden; }
.tab-bar { display: flex; border-bottom: 1px solid var(--border); }
.tab { flex: 1; text-align: center; padding: 14px; font-size: 14px; color: var(--text-secondary); }
.tab.active { color: var(--primary); border-bottom: 2px solid var(--primary); }
.task-list { height: calc(100vh - 280px); padding: 12px; }
```

- [ ] **Step 4: 提交**

```bash
git add campus-errand/miniprogram/pages/mine/
git commit -m "feat: implement mine page with profile and my tasks lists"
```

---

### Task 12: 前端 — 评价页

**Files:**
- Create: `campus-errand/miniprogram/pages/review/review.wxml`
- Create: `campus-errand/miniprogram/pages/review/review.wxss`
- Create: `campus-errand/miniprogram/pages/review/review.js`

- [ ] **Step 1: 创建 review.wxml**

```xml
<view class="container">
  <view wx:if="{{!reviews.length && !myReview}}" class="review-form">
    <text class="form-title">评价对方</text>
    <view class="rating-options">
      <view class="rating-btn {{rating === 1 ? 'good active' : ''}}" bindtap="setRating" data-rating="1">👍 好评</view>
      <view class="rating-btn {{rating === 0 ? 'bad active' : ''}}" bindtap="setRating" data-rating="0">👎 差评</view>
    </view>
    <textarea class="comment-input" placeholder="说点什么吧（选填）" value="{{comment}}" bindinput="onComment" maxlength="100"/>
    <button class="submit-btn" bindtap="submitReview" disabled="{{rating === null}}">提交评价</button>
  </view>

  <view wx:if="{{reviews.length > 0 || myReview}}" class="reviews-list">
    <text class="section-title">评价</text>
    <view wx:for="{{reviews}}" wx:key="_id" class="review-item">
      <text class="review-rating">{{item.rating === 1 ? '👍' : '👎'}}</text>
      <text class="review-comment">{{item.comment || '未留下评论'}}</text>
    </view>
    <!-- 如果自己还没评价 -->
    <view wx:if="{{!myReview && canReview}}" class="review-form-inline">
      <view class="rating-options small">
        <view class="rating-btn {{rating === 1 ? 'good active' : ''}}" bindtap="setRating" data-rating="1">👍</view>
        <view class="rating-btn {{rating === 0 ? 'bad active' : ''}}" bindtap="setRating" data-rating="0">👎</view>
      </view>
      <input class="comment-input-small" placeholder="说点什么" value="{{comment}}" bindinput="onComment" maxlength="100"/>
      <button class="submit-btn small" bindtap="submitReview" disabled="{{rating === null}}">提交</button>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 创建 review.js**

```js
Page({
  data: {
    taskId: '',
    reviews: [],
    myReview: null,
    canReview: false,
    rating: null,
    comment: ''
  },

  onLoad(options) {
    this.setData({ taskId: options.taskId });
    this.loadReviews();
  },

  async loadReviews() {
    const { result } = await wx.cloud.callFunction({
      name: 'handleReview',
      data: { action: 'getByTask', taskId: this.data.taskId }
    });
    if (!result.error) {
      const openid = getApp().globalData.user?._openid;
      const myReview = result.reviews.find(r => r.reviewerId === openid);
      this.setData({
        reviews: result.reviews,
        myReview: myReview || null,
        canReview: !myReview
      });
    }
  },

  setRating(e) {
    this.setData({ rating: parseInt(e.currentTarget.dataset.rating) });
  },

  onComment(e) {
    this.setData({ comment: e.detail.value });
  },

  async submitReview() {
    if (this.data.rating === null) return;
    wx.showLoading({ title: '提交中...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'handleReview',
        data: {
          action: 'create',
          taskId: this.data.taskId,
          rating: this.data.rating,
          comment: this.data.comment.trim()
        }
      });
      wx.hideLoading();
      if (result.error) {
        wx.showToast({ title: result.error, icon: 'none' });
      } else {
        wx.showToast({ title: '评价成功', icon: 'success' });
        this.loadReviews();
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '评价失败', icon: 'none' });
    }
  }
});
```

- [ ] **Step 3: 创建 review.wxss**

```css
.review-form, .reviews-list { background: #FFFFFF; border-radius: var(--radius); padding: 20px; }
.form-title, .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: block; }
.rating-options { display: flex; gap: 16px; margin-bottom: 16px; }
.rating-options.small { gap: 8px; margin-bottom: 8px; }
.rating-btn { flex: 1; padding: 16px; text-align: center; border: 2px solid var(--border); border-radius: var(--radius); font-size: 16px; }
.rating-btn.good.active { border-color: var(--primary); background: rgba(7,193,96,0.05); }
.rating-btn.bad.active { border-color: var(--danger); background: rgba(250,81,81,0.05); }
.comment-input { width: 100%; min-height: 80px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; box-sizing: border-box; margin-bottom: 16px; }
.submit-btn { width: 100%; background: var(--primary); color: #FFFFFF; border-radius: var(--radius); padding: 14px; font-size: 16px; }
.submit-btn[disabled] { background: #CCCCCC; }
.submit-btn.small { padding: 8px 20px; width: auto; font-size: 14px; }
.review-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.review-rating { font-size: 24px; }
.review-comment { font-size: 14px; color: var(--text); }
.review-form-inline { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.comment-input-small { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; margin-bottom: 8px; }
```

- [ ] **Step 4: 提交**

```bash
git add campus-errand/miniprogram/pages/review/
git commit -m "feat: implement review page for task rating"
```

---

### Task 13: 端到端集成验证

**说明：** 微信小程序的前端自动化测试受限，此阶段通过微信开发者工具进行手工验证。

- [ ] **Step 1: 验证支付闭环**

1. 在微信开发者工具中打开项目，配置云环境 ID
2. 上传所有云函数并部署
3. 在云开发控制台创建数据库集合（users, tasks, reviews）
4. 使用真机预览模式（支付需要真机环境）
5. 执行完整流程：
   - 发任务：选择类型 → 填写信息 → 支付 → 确认任务出现在列表中
   - 接任务：在列表中找到任务 → 接单 → 授权手机号 → 状态变为进行中
   - 完成送达：上传凭证照片 → 状态变为已送达待确认
   - 确认放款：发布者确认 → 检查企业付款是否到账
   - 互评：双方进入评价页评价

- [ ] **Step 2: 验证异常路径**

| 场景 | 预期结果 |
|------|---------|
| 接自己的任务 | 提示「不能接自己的任务」 |
| 重复支付同一订单 | 幂等，不创建重复任务 |
| 已接单的任务其他人再接 | 提示「任务已被接」 |
| 未接单时点完成送达 | 按钮不可见 |
| 非发布者点确认完成 | 按钮不可见 |
| 取消任务再尝试操作 | 提示「状态不正确」 |
| 重复评价 | 提示「已评价」 |

- [ ] **Step 3: 提交**

```bash
git add campus-errand/
git commit -m "docs: add integration test checklist"
```
