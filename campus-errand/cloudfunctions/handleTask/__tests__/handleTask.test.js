const { describe, it, before } = require('node:test');
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
          if (idx >= 0) Object.assign(mockDb[name][idx], data);
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
          skip: () => ({
            limit: () => ({
              get: async () => ({ data: mockDb[name].filter(x => {
                if (condition.status && condition.type) return x.status === condition.status && x.type === condition.type;
                if (condition.status) return x.status === condition.status;
                if (condition.publisherId) return x.publisherId === condition.publisherId;
                if (condition.takerId) return x.takerId === condition.takerId;
                if (condition['paymentRef.prepayId']) return x.paymentRef && x.paymentRef.prepayId === condition['paymentRef.prepayId'];
                if (condition['paymentRef.transactionId']) return x.paymentRef && x.paymentRef.transactionId === condition['paymentRef.transactionId'];
                return true;
              }) })
            })
          })
        })
      })
    }),
    command: {
      eq: (v) => v,
      push: (item) => item
    }
  }),
  getWXContext: () => ({ OPENID: 'test_openid_123' })
};
const db = mockCloud.database();
const _ = db.command;

// Handler for testing — mirrors cloudfunction logic
async function handleTaskHandler({ action, ...params }) {
  const openid = mockCloud.getWXContext().OPENID;
  const tasks = db.collection('tasks');
  const users = db.collection('users');

  switch (action) {
    case 'getMyProfile': {
      const user = await users.where({ _openid: openid }).orderBy().skip().limit().get();
      if (!user.data || user.data.length === 0) return { user: null };
      return { user: user.data[0] };
    }
    case 'createAfterPay': {
      const existing = await tasks.where({ 'paymentRef.prepayId': params.prepayId }).orderBy().skip().limit().get();
      if (existing.data && existing.data.length > 0) return { taskId: existing.data[0]._id };
      const task = {
        publisherId: openid, type: params.type, description: params.description,
        address: params.address, reward: params.reward, platformFee: params.platformFee,
        totalFee: params.totalFee, expectedBy: params.expectedBy, status: 'pending',
        takerId: null,
        paymentRef: { prepayId: params.prepayId, transactionId: params.transactionId || null },
        timeline: [{ event: 'created', at: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };
      const result = await tasks.add({ data: task });
      return { taskId: result._id };
    }
    case 'list': {
      const result = await tasks.where({ status: 'pending' }).orderBy().skip().limit().get();
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
      const user = await users.where({ _openid: openid }).orderBy().skip().limit().get();
      if ((!user.data || user.data.length === 0 || !user.data[0].phone) && !params.phone) {
        return { error: 'NEED_PHONE' };
      }
      if (params.phone && (!user.data || user.data.length === 0 || !user.data[0].phone)) {
        await users.add({ data: { _openid: openid, phone: params.phone, createdAt: new Date().toISOString() } });
      }
      await tasks.doc(params.taskId).update({
        data: { takerId: openid, status: 'accepted',
          timeline: task.data.timeline.concat([{ event: 'accepted', at: new Date().toISOString() }]) }
      });
      return { success: true };
    }
    case 'deliver': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.takerId !== openid) return { error: '无权操作' };
      if (task.data.status !== 'accepted') return { error: '状态不正确' };
      await tasks.doc(params.taskId).update({
        data: { status: 'delivered', proofPhoto: params.proofPhoto || null,
          timeline: task.data.timeline.concat([{ event: 'delivered', at: new Date().toISOString() }]) }
      });
      return { success: true };
    }
    case 'confirm': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.publisherId !== openid) return { error: '无权操作' };
      if (task.data.status !== 'delivered') return { error: '状态不正确' };
      await tasks.doc(params.taskId).update({
        data: { status: 'completed',
          timeline: task.data.timeline.concat([{ event: 'completed', at: new Date().toISOString() }]) }
      });
      return { success: true, needPayout: true, takerId: task.data.takerId, reward: task.data.reward, platformFee: task.data.platformFee };
    }
    case 'cancel': {
      const task = await tasks.doc(params.taskId).get();
      if (!task.data) return { error: '任务不存在' };
      if (task.data.publisherId !== openid && task.data.takerId !== openid) return { error: '无权操作' };
      if (['completed', 'cancelled'].includes(task.data.status)) return { error: '状态不正确' };
      const needRefund = task.data.status === 'pending' && task.data.paymentRef && task.data.paymentRef.transactionId;
      await tasks.doc(params.taskId).update({
        data: { status: 'cancelled', cancelReason: params.reason || '', cancelledBy: openid,
          timeline: task.data.timeline.concat([{ event: 'cancelled', at: new Date().toISOString() }]) }
      });
      return { success: true, needRefund: !!needRefund, transactionId: task.data.paymentRef.transactionId };
    }
    case 'myTasks': {
      const field = params.role === 'publisher' ? 'publisherId' : 'takerId';
      const result = await tasks.where({ [field]: openid }).orderBy().skip().limit().get();
      return { tasks: result.data };
    }
    default: return { error: '未知操作' };
  }
}

// --- Tests ---
describe('handleTask', () => {
  before(() => { mockDb = { tasks: [], users: [] }; });

  it('getMyProfile returns null for new user', async () => {
    const result = await handleTaskHandler({ action: 'getMyProfile' });
    assert.strictEqual(result.user, null);
  });

  it('createAfterPay creates a task with pending status', async () => {
    const result = await handleTaskHandler({
      action: 'createAfterPay', type: 'pickup', description: '取快递',
      address: { pickup: { name: '东门' }, delivery: { name: '北区12栋' } },
      reward: 800, platformFee: 40, totalFee: 840,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_001', transactionId: 'txn_test_001'
    });
    assert.ok(result.taskId);
    assert.strictEqual(mockDb.tasks.length, 1);
    assert.strictEqual(mockDb.tasks[0].status, 'pending');
  });

  it('createAfterPay is idempotent with same prepayId', async () => {
    mockDb = { tasks: [], users: [] };
    const r1 = await handleTaskHandler({
      action: 'createAfterPay', type: 'pickup', description: 'test',
      address: { pickup: { name: 'a' }, delivery: { name: 'b' } },
      reward: 500, platformFee: 25, totalFee: 525,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_002', transactionId: 'txn_test_002'
    });
    const r2 = await handleTaskHandler({
      action: 'createAfterPay', type: 'pickup', description: 'test',
      address: { pickup: { name: 'a' }, delivery: { name: 'b' } },
      reward: 500, platformFee: 25, totalFee: 525,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_002', transactionId: 'txn_test_002'
    });
    assert.strictEqual(r1.taskId, r2.taskId);
    assert.strictEqual(mockDb.tasks.length, 1);
  });

  it('accept fails for own task', async () => {
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
    await handleTaskHandler({
      action: 'createAfterPay', type: 'meal', description: '买饭',
      address: { pickup: { name: '食堂' }, delivery: { name: '图书馆' } },
      reward: 1000, platformFee: 50, totalFee: 1050,
      expectedBy: new Date().toISOString(),
      prepayId: 'prepay_test_003', transactionId: 'txn_test_003'
    });
    const result = await handleTaskHandler({ action: 'list' });
    assert.strictEqual(result.tasks.length, 1);
    assert.strictEqual(result.tasks[0].status, 'pending');
  });
});
