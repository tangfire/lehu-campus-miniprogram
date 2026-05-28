const { request, showError } = require('../../utils/request')

Page({
  data: {
    posts: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false
  },

  onLoad() {
    this.loadPosts(true)
  },

  onShow() {
    if (this._needsRefresh) {
      this._needsRefresh = false
      this.loadPosts(true)
    }
  },

  onPullDownRefresh() {
    this.loadPosts(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.posts.length < this.data.total) {
      this.loadPosts(false)
    }
  },

  async loadPosts(reset = false) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/campus/forum/my-posts',
        data: { page, size: this.data.size }
      })
      const posts = (data.posts || []).map(normalizePost)
      this.setData({
        posts: reset ? posts : this.data.posts.concat(posts),
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
    const id = String(e.currentTarget.dataset.id || '')
    const post = this.data.posts.find(item => String(item.id) === id)
    if (post && Number(post.status) !== 1) {
      wx.showModal({
        title: post.status_label || '内容状态',
        content: post.audit_reason || '这条内容暂未公开展示，审核通过后同学才可以看到。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  withdrawPost(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '撤回帖子',
      content: '撤回后，同学将无法再看到这条内容。',
      confirmText: '撤回',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/posts/${id}`, method: 'DELETE' })
          wx.showToast({ title: '已撤回' })
          this.loadPosts(true)
        } catch (err) {
          showError(err)
        }
      }
    })
  }
})

function normalizePost(post) {
  const images = post.images || []
  const status = Number(post.status == null ? 1 : post.status)
  return {
    ...post,
    images,
    status,
    status_label: statusLabel(status),
    status_class: `status-${status}`,
    audit_reason: post.audit_reason || '',
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    type_label: postTypeLabel(post.post_type),
    display_cover: post.cover_url || images[0] || ''
  }
}

function statusLabel(status) {
  const map = {
    0: '待审核',
    1: '正常展示',
    2: '未通过',
    3: '已撤回'
  }
  return map[Number(status)] || '未知'
}

function postTypeLabel(postType) {
  const map = { lost: '失物', question: '问答', guide: '攻略', club: '社团', note: '笔记' }
  return map[postType || 'note'] || '笔记'
}
