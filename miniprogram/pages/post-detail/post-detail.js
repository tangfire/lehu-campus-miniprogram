const { request, showError } = require('../../utils/request')

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    commentText: '',
    currentUserId: '',
    loading: false
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.loadPost()
    this.loadComments()
  },

  onShow() {
    const user = wx.getStorageSync('user') || {}
    this.setData({ currentUserId: user.id || '' })
  },

  async loadPost() {
    try {
      const data = await request({ url: `/campus/forum/posts/${this.data.id}` })
      this.setData({ post: normalizePost(data.post) })
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
  },

  openPostMenu() {
    const post = this.data.post
    if (!post) return
    const isOwner = post.author && post.author.user_id === this.data.currentUserId
    const itemList = isOwner ? ['删除帖子'] : ['举报帖子']
    wx.showActionSheet({
      itemList,
      success: res => {
        if (isOwner && res.tapIndex === 0) this.deletePost()
        if (!isOwner && res.tapIndex === 0) this.reportPost()
      }
    })
  },

  deletePost() {
    wx.showModal({
      title: '删除帖子',
      content: '删除后同学将无法再看到这条内容。',
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/posts/${this.data.id}`, method: 'DELETE' })
          wx.showToast({ title: '已删除' })
          const pages = getCurrentPages()
          const prev = pages[pages.length - 2]
          if (prev) prev._needsRefresh = true
          setTimeout(() => wx.navigateBack(), 500)
        } catch (err) {
          showError(err)
        }
      }
    })
  },

  reportPost() {
    this.reportContent(`/campus/forum/posts/${this.data.id}/report`)
  },

  reportComment(e) {
    this.reportContent(`/campus/forum/comments/${e.currentTarget.dataset.id}/report`)
  },

  deleteComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除评论',
      content: '确认删除这条评论吗？',
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/comments/${id}`, method: 'DELETE' })
          wx.showToast({ title: '已删除' })
          this.loadPost()
          this.loadComments()
        } catch (err) {
          showError(err)
        }
      }
    })
  },

  reportContent(url) {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    wx.showModal({
      title: '举报内容',
      editable: true,
      placeholderText: '请简单说明原因',
      confirmText: '提交',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({
            url,
            method: 'POST',
            data: {
              reason: '内容不合适',
              detail: res.content || ''
            }
          })
          wx.showToast({ title: '已提交' })
        } catch (err) {
          showError(err)
        }
      }
    })
  }
})

function normalizePost(post) {
  if (!post) return post
  const images = post.images || []
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text')
  }
}
