const { request, trackEvent, showError } = require('../../utils/request')

const quickChannels = [
  { label: '推荐', postType: '', sort: 'recommend' },
  { label: '攻略', postType: 'guide', sort: 'recommend' },
  { label: '问答', postType: 'question', sort: 'hot' },
  { label: '失物', postType: 'lost', sort: 'new' },
  { label: '社团', postType: 'club', sort: 'new' }
]

const RECENT_SEARCH_KEY = 'campus_recent_searches_v1'

Page({
  data: {
    quickChannels,
    activeChannel: '推荐',
    activePostType: '',
    sort: 'recommend',
    keyword: '',
    searchedKeyword: '',
    recentSearches: [],
    showSearchPanel: false,
    statusBarHeight: 0,
    menuButtonRightSpace: 0,
    emptyTitle: '还没有内容',
    emptyDesc: '可以发一条攻略、提问、失物招领或校园瞬间。',
    posts: [],
    leftPosts: [],
    rightPosts: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const windowWidth = info.windowWidth || 375
    const menuButtonRightSpace = menu && menu.left ? Math.max(windowWidth - menu.left + 10, 0) : 0
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      menuButtonRightSpace
    })
    this.loadRecentSearches()
    this.loadPosts(true)
  },

  onShow() {
    syncTabBar(this, 1)
    trackEvent('visit', { page: 'community' })
    if (this._needsRefresh) {
      this._needsRefresh = false
      this.loadPosts(true)
    }
  },

  onPullDownRefresh() {
    this.loadPosts(true).finally(() => wx.stopPullDownRefresh())
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
          post_type: this.data.activePostType,
          keyword: this.data.keyword
        }
      })
      const nextPosts = (data.posts || []).map(normalizePost)
      const posts = reset ? nextPosts : this.data.posts.concat(nextPosts)
      const activeKeyword = this.data.keyword.trim()
      this.setData({
        posts,
        ...splitColumns(posts),
        total: data.page_stats ? data.page_stats.total : 0,
        page: page + 1,
        searchedKeyword: activeKeyword,
        emptyTitle: activeKeyword ? '没找到相关内容' : '还没有内容',
        emptyDesc: activeKeyword ? '可以换个关键词，或者直接发个提问让同学来答。' : '可以发一条攻略、提问、失物招领或校园瞬间。',
        emptyImage: activeKeyword ? '/assets/brand/empty/question.png' : '/assets/brand/empty/note.png'
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

  changeChannel(e) {
    const label = e.currentTarget.dataset.label
    const channel = quickChannels.find(item => item.label === label) || quickChannels[0]
    this.setData({
      activeChannel: channel.label,
      activePostType: channel.postType,
      sort: channel.sort || 'recommend'
    })
    this.loadPosts(true)
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value, showSearchPanel: true })
  },

  submitSearch() {
    this.saveRecentSearch(this.data.keyword)
    this.setData({ showSearchPanel: false })
    this.loadPosts(true)
  },

  clearSearch() {
    this.setData({ keyword: '', searchedKeyword: '', showSearchPanel: false })
    this.loadPosts(true)
  },

  focusSearch() {
    this.setData({ showSearchPanel: true })
  },

  useRecentSearch(e) {
    const keyword = e.currentTarget.dataset.keyword || ''
    this.setData({ keyword, showSearchPanel: false })
    this.saveRecentSearch(keyword)
    this.loadPosts(true)
  },

  clearRecentSearches() {
    wx.removeStorageSync(RECENT_SEARCH_KEY)
    this.setData({ recentSearches: [] })
  },

  createQuestionFromSearch() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const keyword = this.data.searchedKeyword || this.data.keyword || ''
    wx.navigateTo({ url: `/pages/publish/publish?mode=text&post_type=question&title=${encodeURIComponent(keyword)}` })
  },

  openPost(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  },

  openUserProfile(e) {
    const userId = String(e.currentTarget.dataset.userId || '')
    if (!userId || userId === '0') return
    wx.navigateTo({ url: `/pages/user-profile/user-profile?user_id=${userId}` })
  },

  async toggleLike(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const post = this.data.posts.find(item => String(item.id) === id)
    if (!post || post._likeLoading) return
    const nextLiked = !post.is_liked
    const nextCount = Math.max(Number(post.like_count || 0) + (nextLiked ? 1 : -1), 0)
    this.updatePostLike(id, nextLiked, nextCount, true)
    try {
      await request({
        url: `/campus/forum/posts/${id}/like`,
        method: nextLiked ? 'POST' : 'DELETE'
      })
      if (nextLiked) trackEvent('like', { page: 'community', targetType: 'post', targetId: Number(id) })
      this.updatePostLike(id, nextLiked, nextCount, false)
    } catch (err) {
      this.updatePostLike(id, post.is_liked, Number(post.like_count || 0), false)
      showError(err)
    }
  },

  loadRecentSearches() {
    const recentSearches = wx.getStorageSync(RECENT_SEARCH_KEY) || []
    this.setData({ recentSearches: Array.isArray(recentSearches) ? recentSearches.slice(0, 6) : [] })
  },

  saveRecentSearch(keyword) {
    const clean = String(keyword || '').trim()
    if (!clean) return
    const next = [clean].concat((wx.getStorageSync(RECENT_SEARCH_KEY) || []).filter(item => item !== clean)).slice(0, 6)
    wx.setStorageSync(RECENT_SEARCH_KEY, next)
    this.setData({ recentSearches: next })
  },

  updatePostLike(id, isLiked, likeCount, loading) {
    const posts = this.data.posts.map(item => {
      if (String(item.id) !== String(id)) return item
      return {
        ...item,
        is_liked: isLiked,
        like_count: likeCount,
        display_count: formatCount(likeCount),
        _likeLoading: loading
      }
    })
    this.setData({
      posts,
      ...splitColumns(posts)
    })
  },

  onShareAppMessage() {
    trackEvent('share', { page: 'community', channel: 'app_message' })
    return {
      title: '深汕校园e站：新生攻略、问答和校园笔记',
      path: '/pages/community/community'
    }
  }
})

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar) {
    tabBar.setData({ selected })
  }
}

function normalizePost(post) {
  const images = post.images || []
  const cover = post.cover_url || images[0] || ''
  const postType = post.post_type || 'note'
  const typeLabel = postTypeLabel(postType)
  const teaser = cleanText(post.content || '')
  const displayTitle = cleanText(post.title || teaser || '校园笔记')
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    post_type: postType,
    type_label: typeLabel,
    display_title: displayTitle,
    display_cover: cover,
    display_author: post.author ? (post.author.name || post.author.nickname || '同学') : '同学',
    author_label: post.is_official ? '深汕e仔' : (post.author ? (post.author.name || post.author.nickname || '同学') : '同学'),
    author_user_id: post.author ? post.author.user_id : '',
    avatar_text: post.is_official ? 'e' : '同',
    poster_class: `poster-${posterVariant(postType, post.id)}`,
    poster_kicker: post.is_official ? `深汕e仔 · ${typeLabel}` : typeLabel,
    poster_title: displayTitle,
    display_count: formatCount(post.like_count || 0),
    is_liked: !!post.is_liked,
    is_official: !!post.is_official,
    is_featured: !!post.is_featured,
    is_pinned: !!post.is_pinned
  }
}

function formatCount(count) {
  const n = Number(count || 0)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
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

function posterVariant(postType, id) {
  const fixed = {
    guide: 'mint',
    question: 'lemon',
    lost: 'rose',
    club: 'sky'
  }
  if (fixed[postType]) return fixed[postType]
  const variants = ['mint', 'lemon', 'rose', 'sky', 'paper']
  const text = String(id || '')
  const last = Number(text.slice(-1)) || 0
  return variants[last % variants.length]
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
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
