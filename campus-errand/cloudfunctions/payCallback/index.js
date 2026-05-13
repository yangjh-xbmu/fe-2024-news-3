const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { outTradeNo, transactionId, returnCode, resultCode } = event;

  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    console.error('Payment callback failed:', event);
    return { errcode: -1, errmsg: '支付失败' };
  }

  const existing = await db.collection('tasks')
    .where({ 'paymentRef.transactionId': transactionId })
    .get();
  if (existing.data.length > 0) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const prepayId = event.prepayId || outTradeNo;

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
