const { request, trackEvent, showError } = require('../../utils/request')

const categories = [
  { value: 'express', label: '取快递' },
  { value: 'delivery', label: '帮送' },
  { value: 'buy', label: '帮买' },
  { value: 'print', label: '打印' },
  { value: 'other', label: '其他' }
]

Page({
  data: {
    categories,
    category: 'express',
    title: '',
    content: '',
    campusName: '深汕校区',
    pickupLocation: '',
    deliveryLocation: '',
    rewardAmount: '',
    deadlineAt: '',
    submitting: false
  },

  onLoad() {
    trackEvent('help_publish_open', { page: 'help-publish' })
  },

  selectCategory(e) {
    this.setData({ category: e.currentTarget.dataset.value })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  async submit() {
    if (this.data.submitting) return
    const payload = this.buildPayload()
    if (!payload) return
    this.setData({ submitting: true })
    try {
      const data = await request({
        url: '/campus/help/orders',
        method: 'POST',
        data: payload
      })
      const id = data.order && data.order.id
      trackEvent('help_order_create', { page: 'help-publish', targetType: 'help_order', targetId: Number(id || 0) })
      wx.showToast({ title: '已发布' })
      setTimeout(() => {
        if (id) {
          wx.redirectTo({ url: `/pages/help-detail/help-detail?id=${id}` })
        } else {
          wx.navigateBack()
        }
      }, 450)
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ submitting: false })
    }
  },

  buildPayload() {
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    const reward = Number(this.data.rewardAmount)
    if (!title && !content) {
      wx.showToast({ title: '写一下需要帮什么', icon: 'none' })
      return null
    }
    if (title && title.length < 2) {
      wx.showToast({ title: '标题至少 2 个字', icon: 'none' })
      return null
    }
    if (content.length < 2) {
      wx.showToast({ title: '描述至少 2 个字', icon: 'none' })
      return null
    }
    if (!Number.isFinite(reward) || reward < 0) {
      wx.showToast({ title: '金额填写不对', icon: 'none' })
      return null
    }
    if (reward > 200) {
      wx.showToast({ title: '首版悬赏不超过 200 元', icon: 'none' })
      return null
    }
    return {
      title,
      content,
      category: this.data.category,
      campus_name: this.data.campusName.trim() || '深汕校区',
      pickup_location: this.data.pickupLocation.trim(),
      delivery_location: this.data.deliveryLocation.trim(),
      reward_amount: reward,
      deadline_at: this.data.deadlineAt.trim()
    }
  }
})
