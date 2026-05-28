const { request, trackEvent, showError } = require('../../utils/request')

const tabs = [
  { label: '全部', type: 'all', unread: 0 },
  { label: '回复', type: 'reply', unread: 0 },
  { label: '赞藏', type: 'interaction', unread: 0 },
  { label: '系统', type: 'system', unread: 0 }
]

Page({
  data: {
    tabs,
    activeType: 'all',
    emptyDesc: '有人回复、点赞或收藏你的内容时，会出现在这里。',
    notifications: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false,
    unread: { total: 0, reply: 0, interaction: 0, system: 0 }
  },

  onLoad() {
    trackEvent('visit', { page: 'notifications' })
    this.loadUnread()
    this.loadNotifications(true)
  },

  onPullDownRefresh() {
    Promise.all([this.loadUnread(), this.loadNotifications(true)]).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.notifications.length < this.data.total) {
      this.loadNotifications(false)
    }
  },

  switchTab(e) {
    const type = e.currentTarget.dataset.type || 'all'
    if (type === this.data.activeType) return
    this.setData({ activeType: type })
    this.loadNotifications(true)
  },

  async loadUnread() {
    try {
      const data = await request({ url: '/campus/notifications/unread-count' })
      const unread = data || { total: 0, reply: 0, interaction: 0, system: 0 }
      this.setData({ unread, tabs: tabsWithUnread(unread) })
    } catch (err) {
      showError(err)
    }
  },

  async loadNotifications(reset = false) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, emptyDesc: emptyDesc(this.data.activeType) })
    try {
      const data = await request({
        url: '/campus/notifications',
        data: {
          type: this.data.activeType,
          page,
          size: this.data.size
        }
      })
      const next = (data.notifications || []).map(normalizeNotification)
      const notifications = reset ? next : this.data.notifications.concat(next)
      this.setData({
        notifications,
        total: data.page_stats ? Number(data.page_stats.total || 0) : 0,
        page: page + 1
      })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async openNotification(e) {
    const id = String(e.currentTarget.dataset.id || '')
    const item = this.data.notifications.find(notification => String(notification.id) === id)
    if (!item) return
    if (!item.is_read) {
      this.markLocalRead(id)
      request({ url: `/campus/notifications/${id}/read`, method: 'POST' })
        .then(() => this.loadUnread())
        .catch(() => {})
    }
    const page = item.link_page || ''
    const params = item.link_params || {}
    if (page === 'post-detail' && params.id) {
      wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${params.id}` })
      return
    }
    if (page === 'timetable') {
      wx.switchTab({ url: '/pages/timetable/timetable' })
      return
    }
    wx.switchTab({ url: '/pages/community/community' })
  },

  async readAll() {
    try {
      await request({ url: '/campus/notifications/read-all', method: 'POST' })
      const notifications = this.data.notifications.map(item => ({ ...item, is_read: true }))
      this.setData({
        notifications,
        unread: { total: 0, reply: 0, interaction: 0, system: 0 },
        tabs: tabsWithUnread({ total: 0, reply: 0, interaction: 0, system: 0 })
      })
      wx.showToast({ title: '已全部已读', icon: 'none' })
    } catch (err) {
      showError(err)
    }
  },

  markLocalRead(id) {
    const notifications = this.data.notifications.map(item => (
      String(item.id) === String(id) ? { ...item, is_read: true } : item
    ))
    this.setData({ notifications })
  }
})

function normalizeNotification(item) {
  const actorName = item.actor ? (item.actor.name || item.actor.nickname || '同学') : ''
  return {
    ...item,
    actor_name: item.event_type === 'system' ? '深汕e仔' : actorName,
    icon_text: notificationIcon(item.event_type),
    display_time: item.created_at || '',
    is_read: !!item.is_read
  }
}

function notificationIcon(type) {
  const map = {
    comment: '评',
    reply: '回',
    post_like: '赞',
    post_collect: '藏',
    comment_like: '赞',
    system: 'e'
  }
  return map[type] || '信'
}

function tabsWithUnread(unread) {
  const counts = unread || {}
  return tabs.map(item => ({
    ...item,
    unread: item.type === 'all' ? 0 : Number(counts[item.type] || 0)
  }))
}

function emptyDesc(type) {
  const map = {
    reply: '有人评论你的帖子或回复你的评论时，会出现在这里。',
    interaction: '有人点赞或收藏你的内容时，会出现在这里。',
    system: '深汕e仔发布的内测公告、维护提示会出现在这里。'
  }
  return map[type] || '有人回复、点赞或收藏你的内容时，会出现在这里。'
}
