const { request, showError } = require('../../utils/request')

Page({
  data: {
    categories: [],
    activeCategory: '',
    sort: 'new',
    keyword: '',
    posts: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false
  },

  onLoad() {
    this.loadCategories()
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

  async loadCategories() {
    try {
      const data = await request({ url: '/campus/forum/categories' })
      this.setData({ categories: data.categories || [] })
    } catch (err) {
      showError(err)
    }
  },

  async loadPosts(reset = false) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/campus/forum/posts',
        data: {
          page,
          size: this.data.size,
          sort: this.data.sort,
          category_code: this.data.activeCategory,
          keyword: this.data.keyword
        }
      })
      const nextPosts = data.posts || []
      this.setData({
        posts: reset ? nextPosts : this.data.posts.concat(nextPosts),
        total: data.page_stats ? data.page_stats.total : 0,
        page: page + 1
      })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.posts.length < this.data.total) {
      this.loadPosts(false)
    }
  },

  changeCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.code || '' })
    this.loadPosts(true)
  },

  changeSort(e) {
    this.setData({ sort: e.currentTarget.dataset.sort })
    this.loadPosts(true)
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value })
  },

  submitSearch() {
    this.loadPosts(true)
  },

  clearSearch() {
    this.setData({ keyword: '' })
    this.loadPosts(true)
  },

  goPublish() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  openPost(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  }
})
