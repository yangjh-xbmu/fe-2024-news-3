App({
  onLaunch() {
    wx.cloud.init({
      env: '{{your-cloud-env-id}}',
      traceUser: true
    });
    this.loadUser();
  },

  async loadUser() {
    const { result } = await wx.cloud.callFunction({ name: 'handleTask', data: { action: 'getMyProfile' } });
    if (result.user) {
      this.globalData.user = result.user;
    }
  },

  globalData: {
    user: null
  }
});
