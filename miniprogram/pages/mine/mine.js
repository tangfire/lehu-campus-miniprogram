const { request, uploadImage, trackEvent, showError } = require('../../utils/request')
const { getSession, setSession, patchUser, clearSession, subscribeSession } = require('../../utils/session')
const { getEnvVersion } = require('../../utils/config')

const DRAFT_KEY = 'campus_publish_draft_v1'

Page({
  data: {
    token: '',
    user: null,
    profile: null,
    navSafeHeight: 0,
    loggingIn: false,
    uploadingAvatar: false,
    hasDraft: false,
    draftDesc: '暂无草稿',
    unreadCount: 0
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = info.statusBarHeight || 0
    const navSafeHeight = menu && menu.bottom ? menu.bottom + Math.max(menu.top - statusBarHeight, 0) : statusBarHeight + 52
    this.setData({ navSafeHeight })
    this._unsubscribeSession = subscribeSession(session => {
      this.setData({
        token: session.token,
        user: session.user,
        profile: session.profile
      })
    })
  },

  onUnload() {
    if (this._unsubscribeSession) {
      this._unsubscribeSession()
      this._unsubscribeSession = null
    }
  },

  onShow() {
    syncTabBar(this, 2)
    trackEvent('visit', { page: 'mine' })
    const draft = wx.getStorageSync(DRAFT_KEY)
    const hasDraft = Boolean(draft && draft.updated_at)
    const session = getSession()
    this.setData({
      token: session.token,
      user: session.user,
      profile: session.profile,
      hasDraft,
      draftDesc: hasDraft ? '1篇未发布' : '暂无草稿'
    })
    if (session.token) this.loadUnreadCount()
  },

  async loadUnreadCount() {
    try {
      const data = await request({ url: '/campus/notifications/unread-count' })
      this.setData({ unreadCount: Number(data.total || 0) })
    } catch (err) {
      this.setData({ unreadCount: 0 })
    }
  },

  login() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })
    wx.login({
      success: async res => {
        try {
          const code = res.code || (getEnvVersion() === 'develop' ? 'mock-campus' : '')
          if (!code) {
            throw new Error('微信登录凭证获取失败，请重试')
          }
          const data = await request({
            url: '/auth/wechat-login',
            method: 'POST',
            data: {
              code,
              nickname: '深汕同学'
            }
          })
          setSession({
            token: data.token,
            user: data.user,
            profile: data.profile
          })
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
    clearSession()
    this.setData({ unreadCount: 0 })
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
          patchUser(data.user)
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

  goAboutUs() {
    wx.navigateTo({ url: '/pages/about-us/about-us' })
  },

  goFeedback() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/feedback/feedback' })
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
  },

  goNotifications() {
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },

  goDrafts() {
    const draft = wx.getStorageSync(DRAFT_KEY)
    if (!draft || !draft.updated_at) {
      wx.showToast({ title: '暂无草稿', icon: 'none' })
      return
    }
    if (!this.data.token) {
      this.login()
      return
    }
    wx.navigateTo({ url: '/pages/publish/publish?restore=1' })
  },

})

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar) {
    tabBar.setData({ selected })
  }
}
