const { request, uploadImage, showError } = require('../../utils/request')

Page({
  data: {
    token: '',
    user: null,
    profile: null,
    loggingIn: false,
    uploadingAvatar: false
  },

  onShow() {
    syncTabBar(this, 2)
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
              nickname: '深汕同学'
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

  changeAvatar() {
    if (!this.data.token) {
      this.login()
      return
    }
    if (this.data.uploadingAvatar) return
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const files = res.tempFilePaths || []
        const filePath = files[0]
        if (!filePath) return
        this.setData({ uploadingAvatar: true })
        try {
          const uploaded = await uploadImage(filePath)
          const data = await request({
            url: '/campus/me/avatar',
            method: 'PUT',
            data: { avatar: uploaded.url }
          })
          wx.setStorageSync('user', data.user)
          this.setData({ user: data.user })
          wx.showToast({ title: '头像已更新' })
        } catch (err) {
          showError(err)
        } finally {
          this.setData({ uploadingAvatar: false })
        }
      }
    })
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

  goAboutUs() {
    wx.navigateTo({ url: '/pages/about-us/about-us' })
  },

  goMyCollections() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/my-collections/my-collections' })
  },

  goMyComments() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/my-comments/my-comments' })
  }
})

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar) {
    tabBar.setData({ selected })
  }
}
