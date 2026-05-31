const { request, trackEvent, showError } = require('../../utils/request')
const { hasToken } = require('../../utils/session')

const tabs = [
  { key: 'all', label: '全部订单' },
  { key: 'waiting', label: '等待帮助' },
  { key: 'mine', label: '我发布的' },
  { key: 'helped', label: '我帮助的' }
]

Page({
  data: {
    tabs,
    activeTab: 'all',
    orders: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false,
    needLogin: false
  },

  onLoad() {
    this.loadOrders(true)
  },

  onShow() {
    syncTabBar(this, 2)
    trackEvent('visit', { page: 'help' })
    if (this._needsRefresh) {
      this._needsRefresh = false
      this.loadOrders(true)
    }
  },

  onPullDownRefresh() {
    this.loadOrders(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.orders.length < this.data.total) {
      this.loadOrders(false)
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.activeTab) return
    this.setData({ activeTab: key })
    this.loadOrders(true)
  },

  async loadOrders(reset = false) {
    if (!hasToken()) {
      this.setData({ needLogin: true, orders: [], total: 0, page: 1 })
      return
    }
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, needLogin: false })
    try {
      const data = await request({
        url: '/campus/help/orders',
        data: {
          tab: this.data.activeTab,
          page,
          size: this.data.size
        }
      })
      const nextOrders = (data.orders || []).map(normalizeOrder)
      const orders = reset ? nextOrders : this.data.orders.concat(nextOrders)
      this.setData({
        orders,
        total: data.page_stats ? Number(data.page_stats.total || 0) : 0,
        page: page + 1
      })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  goPublish() {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    wx.navigateTo({ url: '/pages/help-publish/help-publish' })
  },

  goVerify() {
    wx.showToast({ title: '首版暂不需要认证', icon: 'none' })
  },

  openOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/help-detail/help-detail?id=${id}` })
  },

  onShareAppMessage() {
    return {
      title: '深汕校园e站互助大厅',
      path: '/pages/help/help'
    }
  }
})

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar) tabBar.setData({ selected })
}

function normalizeOrder(order) {
  const requester = order.requester || {}
  return {
    ...order,
    display_author: requester.name || requester.nickname || '同学',
    avatar: requester.avatar || '',
    avatar_text: (requester.name || requester.nickname || '同').slice(0, 1),
    display_content: order.title || order.content || '互助需求',
    reward_text: formatMoney(order.reward_amount_cents),
    time_text: timeAgo(order.created_at),
    status_class: statusClass(order.status),
    campus_text: order.campus_name || '深汕校区'
  }
}

function statusClass(status) {
  const map = {
    open: 'open',
    accepted: 'active',
    submitted: 'submitted',
    completed: 'done',
    cancelled: 'muted'
  }
  return map[status] || 'muted'
}

function formatMoney(cents) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`
}

function timeAgo(value) {
  const ts = Date.parse(String(value || '').replace(/-/g, '/'))
  if (!ts) return ''
  const diff = Math.max(Date.now() - ts, 0)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}
