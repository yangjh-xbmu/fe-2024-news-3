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
  if (user && user.phone) {
    user.phone = maskPhone(user.phone);
  }
  return { user };
}

async function createAfterPay(openid, params) {
  const { prepayId } = params;
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
  return { task: data };
}

async function acceptTask(openid, params) {
  const { taskId, phone } = params;
  const { data: task } = await db.collection('tasks').doc(taskId).get();

  if (!task) return { error: '任务不存在' };
  if (task.status !== 'pending') return { error: '任务已被接' };
  if (task.publisherId === openid) return { error: '不能接自己的任务' };

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
  const { role } = params;
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
