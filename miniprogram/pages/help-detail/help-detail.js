const { request, trackEvent, showError } = require('../../utils/request')

Page({
  data: {
    id: '',
    order: null,
    loading: false,
    acting: false
  },

  onLoad(query = {}) {
    const id = String(query.id || query.order_id || '')
    if (!id) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    this.setData({ id })
    trackEvent('help_order_view', { page: 'help-detail', targetType: 'help_order', targetId: Number(id) })
    this.loadOrder()
  },

  async loadOrder() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const data = await request({ url: `/campus/help/orders/${this.data.id}` })
      const order = normalizeOrder(data.order)
      this.setData({ order })
      return order
    } catch (err) {
      showError(err)
      return null
    } finally {
      this.setData({ loading: false })
    }
  },

  async acceptOrder() {
    if (this.data.acting) return
    this.setData({ acting: true })
    try {
      const data = await request({
        url: `/campus/help/orders/${this.data.id}/accept`,
        method: 'POST'
      })
      this.setData({ order: normalizeOrder(data.order) })
      wx.showToast({ title: '已接单' })
    } catch (err) {
      if (err.statusCode === 409) {
        const latest = await this.loadOrder()
        const helperName = latest && latest.helper_name ? `\n接单人：${latest.helper_name}` : ''
        wx.showModal({
          title: '来晚啦',
          content: `${err.message || '该订单已被其他同学接走'}${helperName}`,
          confirmText: '返回大厅',
          showCancel: true,
          cancelText: '查看详情',
          success: res => {
            if (res.confirm) wx.switchTab({ url: '/pages/help/help' })
          }
        })
      } else {
        showError(err)
      }
    } finally {
      this.setData({ acting: false })
    }
  },

  submitComplete() {
    wx.showModal({
      title: '提交完成',
      editable: true,
      placeholderText: '可填写说明，例如已送到门口',
      confirmText: '提交',
      success: res => {
        if (!res.confirm) return
        this.runAction('submit-complete', { note: res.content || '' }, '已提交')
      }
    })
  },

  confirmComplete() {
    wx.showModal({
      title: '确认完成',
      content: '确认后订单会标记为已完成。',
      confirmText: '确认',
      success: res => {
        if (res.confirm) this.runAction('confirm-complete', {}, '已确认')
      }
    })
  },

  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      editable: true,
      placeholderText: '填写取消原因',
      confirmText: '取消订单',
      confirmColor: '#ff4d5f',
      success: res => {
        if (!res.confirm) return
        this.runAction('cancel', { reason: res.content || '用户取消' }, '已取消')
      }
    })
  },

  async runAction(action, data, toastTitle) {
    if (this.data.acting) return
    this.setData({ acting: true })
    try {
      const res = await request({
        url: `/campus/help/orders/${this.data.id}/${action}`,
        method: 'POST',
        data
      })
      this.setData({ order: normalizeOrder(res.order) })
      wx.showToast({ title: toastTitle || '已处理' })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ acting: false })
    }
  },

  goHall() {
    wx.switchTab({ url: '/pages/help/help' })
  }
})

function normalizeOrder(order) {
  if (!order) return null
  const requester = order.requester || {}
  const helper = order.helper || {}
  return {
    ...order,
    requester_name: requester.name || requester.nickname || '同学',
    requester_initial: (requester.name || requester.nickname || '同').slice(0, 1),
    requester_avatar: requester.avatar || '',
    helper_name: helper.name || helper.nickname || '',
    helper_avatar: helper.avatar || '',
    reward_text: formatMoney(order.reward_amount_cents),
    status_class: statusClass(order.status),
    deadline_text: order.deadline_at || '未设置',
    pickup_text: order.pickup_location || '未填写',
    delivery_text: order.delivery_location || '未填写',
    events: (order.events || []).map(normalizeEvent)
  }
}

function normalizeEvent(event) {
  const actor = event.actor || {}
  return {
    ...event,
    actor_name: actor.name || actor.nickname || '',
    display_content: event.content || event.label || '订单更新',
    time_text: event.created_at || '',
    event_class: eventClass(event.event_type)
  }
}

function eventClass(eventType) {
  const map = {
    created: 'created',
    accepted: 'active',
    submitted: 'submitted',
    completed: 'done',
    cancelled: 'muted',
    helper_cancelled: 'muted'
  }
  return map[eventType] || 'muted'
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
