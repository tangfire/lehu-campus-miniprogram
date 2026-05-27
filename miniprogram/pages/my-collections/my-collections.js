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
        url: '/campus/forum/my-collections',
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
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  },

  async uncollectPost(e) {
    const id = e.currentTarget.dataset.id
    try {
      await request({ url: `/campus/forum/posts/${id}/collection`, method: 'DELETE' })
      wx.showToast({ title: '已取消收藏' })
      this.loadPosts(true)
    } catch (err) {
      showError(err)
    }
  }
})

function normalizePost(post) {
  const images = post.images || []
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    display_cover: post.cover_url || images[0] || ''
  }
}
