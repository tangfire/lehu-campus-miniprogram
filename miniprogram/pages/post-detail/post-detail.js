const { request, showError } = require('../../utils/request')

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    commentText: '',
    loading: false
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.loadPost()
    this.loadComments()
  },

  async loadPost() {
    try {
      const data = await request({ url: `/campus/forum/posts/${this.data.id}` })
      this.setData({ post: data.post })
    } catch (err) {
      showError(err)
    }
  },

  async loadComments() {
    try {
      const data = await request({ url: `/campus/forum/posts/${this.data.id}/comments` })
      this.setData({ comments: data.comments || [] })
    } catch (err) {
      showError(err)
    }
  },

  onInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  async submitComment() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const content = this.data.commentText.trim()
    if (!content) {
      wx.showToast({ title: '写点内容再发', icon: 'none' })
      return
    }
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/comments`,
        method: 'POST',
        data: { content }
      })
      this.setData({ commentText: '' })
      this.loadPost()
      this.loadComments()
    } catch (err) {
      showError(err)
    }
  },

  async toggleLike() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const post = this.data.post
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/like`,
        method: post.is_liked ? 'DELETE' : 'POST'
      })
      this.loadPost()
    } catch (err) {
      showError(err)
    }
  }
})
