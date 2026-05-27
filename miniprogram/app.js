const { getApiBase, getEnvVersion } = require('./utils/config')

App({
  globalData: {
    apiBase: getApiBase(),
    envVersion: getEnvVersion()
  },

  onLaunch() {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user')
    const profile = wx.getStorageSync('profile')
    this.globalData.token = token || ''
    this.globalData.user = user || null
    this.globalData.profile = profile || null
  }
})
