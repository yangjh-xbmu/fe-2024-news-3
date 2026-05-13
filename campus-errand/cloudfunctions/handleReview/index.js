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

  const existing = await db.collection('reviews')
    .where({ taskId, reviewerId: openid })
    .get();
  if (existing.data.length > 0) {
    return { error: '已评价' };
  }

  const { data: task } = await db.collection('tasks').doc(taskId).get();
  if (!task) return { error: '任务不存在' };
  if (task.status !== 'completed') return { error: '任务未完成' };
  if (task.publisherId !== openid && task.takerId !== openid) {
    return { error: '无权评价' };
  }

  const targetId = openid === task.publisherId ? task.takerId : task.publisherId;

  await db.collection('reviews').add({
    data: {
      taskId,
      reviewerId: openid,
      targetId,
      rating: rating,
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
