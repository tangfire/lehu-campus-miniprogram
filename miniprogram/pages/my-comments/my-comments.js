const { request, showError } = require('../../utils/request')

Page({
  data: {
    comments: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false
  },

  onLoad() {
    this.loadComments(true)
  },

  onPullDownRefresh() {
    this.loadComments(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.comments.length < this.data.total) {
      this.loadComments(false)
    }
  },

  async loadComments(reset = false) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/campus/forum/my-comments',
        data: { page, size: this.data.size }
      })
      const comments = (data.comments || []).map(normalizeComment)
      this.setData({
        comments: reset ? comments : this.data.comments.concat(comments),
        total: data.page_stats ? data.page_stats.total : 0,
        page: page + 1
      })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  openPost(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  withdrawComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '撤回评论',
      content: '撤回后，这条评论将从帖子和你的评论记录里移除。',
      confirmText: '撤回',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/comments/${id}`, method: 'DELETE' })
          wx.showToast({ title: '已撤回' })
          this.loadComments(true)
        } catch (err) {
          showError(err)
        }
      }
    })
  }
})

function normalizeComment(comment) {
  const post = comment.post || {}
  const images = post.images || []
  return {
    ...comment,
    post,
    post_title: post.title || '原帖已不可见',
    post_meta: [post.category_name, postTypeLabel(post.post_type), post.created_at].filter(Boolean).join(' · '),
    post_cover: post.cover_url || images[0] || ''
  }
}

function postTypeLabel(postType) {
  const map = { lost: '失物', question: '问答', guide: '攻略', club: '社团', note: '笔记' }
  return map[postType || 'note'] || '笔记'
}
