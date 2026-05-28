const { request, uploadImage, showError, trackEvent } = require('../../utils/request')

const types = [
  { value: 'suggestion', label: '功能建议' },
  { value: 'bug', label: '问题反馈' },
  { value: 'content', label: '内容纠错' },
  { value: 'cooperation', label: '合作投稿' },
  { value: 'contact', label: '联系我们' }
]

Page({
  data: {
    types,
    feedbackType: 'suggestion',
    content: '',
    contact: '',
    localImages: [],
    submitting: false
  },

  onLoad(query) {
    const type = query && query.type
    if (types.some(item => item.value === type)) {
      this.setData({ feedbackType: type })
    }
    trackEvent('visit', { page: 'feedback' })
  },

  selectType(e) {
    this.setData({ feedbackType: e.currentTarget.dataset.value })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  onContact(e) {
    this.setData({ contact: e.detail.value })
  },

  chooseImages() {
    const remain = 3 - this.data.localImages.length
    if (remain <= 0) return
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        this.setData({
          localImages: this.data.localImages.concat(res.tempFilePaths || []).slice(0, 3)
        })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const next = this.data.localImages.slice()
    next.splice(index, 1)
    this.setData({ localImages: next })
  },

  async submit() {
    if (this.data.submitting) return
    const content = this.data.content.trim()
    if (content.length < 5) {
      wx.showToast({ title: '请至少写 5 个字', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const images = []
      for (const filePath of this.data.localImages) {
        const uploaded = await uploadImage(filePath)
        if (uploaded && uploaded.url) images.push(uploaded.url)
      }
      await request({
        url: '/campus/feedback',
        method: 'POST',
        data: {
          feedback_type: this.data.feedbackType,
          content,
          contact: this.data.contact.trim(),
          images
        }
      })
      wx.showToast({ title: '已提交' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
