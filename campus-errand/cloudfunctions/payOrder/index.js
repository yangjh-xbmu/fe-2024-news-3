const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { type, description, address, reward, expectedBy } = event;

  if (!type || !description || !address || !reward) {
    return { error: '缺少必填字段' };
  }
  if (reward < 100) {
    return { error: '报酬最低 1 元' };
  }

  const platformFee = Math.round(reward * 0.05);
  const totalFee = reward + platformFee;

  try {
    const result = await cloud.cloudPay.unifiedOrder({
      body: `校园跑腿-${type === 'pickup' ? '取快递' : type === 'meal' ? '代买饭' : '送文件'}`,
      outTradeNo: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      spbillCreateIp: '127.0.0.1',
      totalFee: totalFee,
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
