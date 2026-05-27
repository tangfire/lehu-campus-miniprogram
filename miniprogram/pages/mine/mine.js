const { request, showError } = require('../../utils/request')

Page({
  data: {
    token: '',
    user: null,
    profile: null,
    loggingIn: false
  },

  onShow() {
    this.setData({
      token: wx.getStorageSync('token') || '',
      user: wx.getStorageSync('user') || null,
      profile: wx.getStorageSync('profile') || null
    })
  },

  login() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })
    wx.login({
      success: async res => {
        try {
          const code = res.code || 'mock-campus'
          const data = await request({
            url: '/auth/wechat-login',
            method: 'POST',
            data: {
              code,
              nickname: '深职同学'
            }
          })
          wx.setStorageSync('token', data.token)
          wx.setStorageSync('user', data.user)
          wx.setStorageSync('profile', data.profile)
          this.setData({ token: data.token, user: data.user, profile: data.profile })
          wx.showToast({ title: '已登录' })
        } catch (err) {
          showError(err)
        } finally {
          this.setData({ loggingIn: false })
        }
      },
      fail: () => {
        this.setData({ loggingIn: false })
        wx.showToast({ title: '微信登录失败', icon: 'none' })
      }
    })
  },

  logout() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('user')
    wx.removeStorageSync('profile')
    this.setData({ token: '', user: null, profile: null })
  },

  editProfile() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goMyPosts() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/my-posts/my-posts' })
  },

  goFreshmanKit() {
    wx.navigateTo({ url: '/pages/freshman-kit/freshman-kit' })
  },

  goMyCollections() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/my-collections/my-collections' })
  },

  goModeration() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/moderation/moderation' })
  }
})
