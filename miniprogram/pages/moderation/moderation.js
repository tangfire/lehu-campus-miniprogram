const { request, showError } = require('../../utils/request')

Page({
  data: {
    tab: 'posts',
    posts: [],
    comments: [],
    loading: false
  },

  onLoad() {
    this.loadItems()
  },

  changeTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.loadItems()
  },

  async loadItems() {
    this.setData({ loading: true })
    try {
      if (this.data.tab === 'posts') {
        const data = await request({ url: '/campus/moderation/posts', data: { status: 0, size: 50 } })
        this.setData({ posts: data.posts || [] })
      } else {
        const data = await request({ url: '/campus/moderation/comments', data: { status: 0, size: 50 } })
        this.setData({ comments: data.comments || [] })
      }
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  review(e) {
    const type = e.currentTarget.dataset.type
    const id = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    const label = action === 'approve' ? '通过' : '拒绝'
    wx.showModal({
      title: `${label}内容`,
      editable: action !== 'approve',
      placeholderText: '填写原因，可选',
      confirmText: label,
      confirmColor: action === 'approve' ? '#0f766e' : '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({
            url: `/campus/moderation/${type}/${id}/review`,
            method: 'POST',
            data: {
              action,
              reason: res.content || ''
            }
          })
          wx.showToast({ title: '已处理' })
          this.loadItems()
        } catch (err) {
          showError(err)
        }
      }
    })
  }
})
