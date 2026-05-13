const { TASK_TYPES } = require('../../utils/constants');
const { formatFee, formatTime } = require('../../utils/util');

Component({
  properties: {
    task: { type: Object, value: {} }
  },
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
