const { request, showError } = require('../../utils/request')

const quickChannels = [
  { label: '全部', category: '', postType: '' },
  { label: '失物', category: 'lost', postType: 'lost' },
  { label: '问答', category: 'qa', postType: 'question' },
  { label: '攻略', category: 'guide', postType: 'guide' },
  { label: '社团', category: 'club', postType: 'club' }
]

Page({
  data: {
    categories: [],
    quickChannels,
    activeChannel: '全部',
    activeCategory: '',
    sort: 'new',
    keyword: '',
    posts: [],
    leftPosts: [],
    rightPosts: [],
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
      const nextPosts = (data.posts || []).map(normalizePost)
      const posts = reset ? nextPosts : this.data.posts.concat(nextPosts)
      this.setData({
        posts,
        ...splitColumns(posts),
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
    this.setData({
      activeCategory: e.currentTarget.dataset.code || '',
      activeChannel: ''
    })
    this.loadPosts(true)
  },

  changeChannel(e) {
    const label = e.currentTarget.dataset.label
    const channel = quickChannels.find(item => item.label === label) || quickChannels[0]
    this.setData({
      activeChannel: channel.label,
      activeCategory: channel.category
    })
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

function normalizePost(post) {
  const images = post.images || []
  const cover = post.cover_url || images[0] || ''
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    post_type: post.post_type || 'note',
    type_label: postTypeLabel(post.post_type),
    display_cover: cover,
    display_author: post.author ? (post.author.name || post.author.nickname || '同学') : '同学'
  }
}

function postTypeLabel(postType) {
  const map = {
    lost: '失物',
    question: '问答',
    guide: '攻略',
    club: '社团',
    note: '笔记'
  }
  return map[postType || 'note'] || '笔记'
}

function splitColumns(posts) {
  const leftPosts = []
  const rightPosts = []
  posts.forEach((post, index) => {
    if (index % 2 === 0) {
      leftPosts.push(post)
    } else {
      rightPosts.push(post)
    }
  })
  return { leftPosts, rightPosts }
}
