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
