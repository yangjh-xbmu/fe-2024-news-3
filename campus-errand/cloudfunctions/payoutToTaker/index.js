const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { taskId } = event;

  const { data: task } = await db.collection('tasks').doc(taskId).get();
  if (!task) return { error: '任务不存在' };

  if (task.publisherId !== OPENID) return { error: '无权操作' };
  if (task.status !== 'completed') return { error: '任务未完成' };
  if (task.payoutRef) return { error: '已放款，请勿重复操作' };

  const payoutAmount = task.reward - task.platformFee;

  try {
    await cloud.cloudPay.unifiedOrder({
      body: '跑腿报酬',
      outTradeNo: 'payout_' + taskId,
      totalFee: payoutAmount,
      spbillCreateIp: '127.0.0.1',
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payCallback',
      tradeType: 'JSAPI',
      openid: task.takerId
    });

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
