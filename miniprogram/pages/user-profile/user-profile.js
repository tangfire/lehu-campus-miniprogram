const { request, showError, trackEvent } = require('../../utils/request')

Page({
  data: {
    userId: '',
    user: null,
    posts: [],
    leftPosts: [],
    rightPosts: [],
    page: 1,
    size: 20,
    total: 0,
    loading: false,
    profileLoading: false
  },

  onLoad(query) {
    const userId = String(query.user_id || query.id || '').trim()
    this.setData({ userId })
    if (!userId) {
      wx.showToast({ title: '用户不存在', icon: 'none' })
      return
    }
    trackEvent('visit', { page: 'user-profile', targetType: 'user', targetId: Number(userId) || 0 })
    this.loadProfile()
    this.loadPosts(true)
  },

  onPullDownRefresh() {
    Promise.all([this.loadProfile(), this.loadPosts(true)]).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.posts.length < this.data.total) {
      this.loadPosts(false)
    }
  },

  async loadProfile() {
    if (!this.data.userId || this.data.profileLoading) return
    this.setData({ profileLoading: true })
    try {
      const data = await request({ url: `/campus/users/${this.data.userId}` })
      this.setData({ user: normalizeUser(data.user) })
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ profileLoading: false })
    }
  },

  async loadPosts(reset = false) {
    if (!this.data.userId || this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const data = await request({
        url: `/campus/users/${this.data.userId}/posts`,
        data: {
          page,
          size: this.data.size,
          sort: 'new'
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

  openPost(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
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
      if (nextLiked) trackEvent('like', { page: 'user-profile', targetType: 'post', targetId: Number(id) || 0 })
      this.updatePostLike(id, nextLiked, nextCount, false)
    } catch (err) {
      this.updatePostLike(id, post.is_liked, Number(post.like_count || 0), false)
      showError(err)
    }
  },

  updatePostLike(id, isLiked, likeCount, loading) {
    const previous = this.data.posts.find(item => String(item.id) === String(id))
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
    const user = this.data.user
    let nextUser = user
    if (user && user.stats && previous && previous.is_liked !== isLiked) {
      nextUser = {
        ...user,
        stats: {
          ...user.stats,
          like_count: Math.max(Number(user.stats.like_count || 0) + (isLiked ? 1 : -1), 0)
        }
      }
    }
    this.setData({
      posts,
      ...splitColumns(posts),
      ...(nextUser !== user ? { user: nextUser } : {})
    })
  },

  openMenu() {
    if (!this.data.userId) return
    wx.showActionSheet({
      itemList: ['复制用户ID', '举报用户'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.setClipboardData({ data: this.data.userId })
          return
        }
        this.reportUser()
      }
    })
  },

  reportUser() {
    wx.showModal({
      title: '举报用户',
      content: '请在意见反馈里说明对方昵称、用户ID和具体问题，运营会尽快处理。',
      confirmText: '去反馈',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/feedback/feedback?type=content' })
        }
      }
    })
  },

  onShareAppMessage() {
    const user = this.data.user
    return {
      title: user ? `${user.display_name}的校园主页` : '深汕校园e站同学主页',
      path: `/pages/user-profile/user-profile?user_id=${this.data.userId}`
    }
  }
})

function normalizeUser(user) {
  if (!user) return null
  const stats = user.stats || {}
  const displayName = user.nickname || user.name || '深汕同学'
  return {
    ...user,
    display_name: displayName,
    avatar_text: displayName.slice(0, 1),
    school_name: user.school_name || '深圳职业技术大学',
    auth_label: user.is_official ? '官方账号' : (Number(user.auth_status || 0) === 1 ? '校园认证' : ''),
    bio: user.bio || '深汕校园社区同学',
    stats: {
      post_count: Number(stats.post_count || 0),
      like_count: Number(stats.like_count || 0),
      collected_count: Number(stats.collected_count || 0)
    }
  }
}

function normalizePost(post) {
  const images = post.images || []
  const postType = post.post_type || 'note'
  const title = cleanText(post.title || post.content || '校园笔记')
  return {
    ...post,
    images,
    like_count: Number(post.like_count || 0),
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    display_cover: post.cover_url || images[0] || '',
    display_title: title,
    type_label: postTypeLabel(postType),
    avatar_text: post.is_official ? 'e' : '同',
    poster_class: `poster-${posterVariant(postType, post.id)}`,
    poster_kicker: post.is_official ? `深汕e仔 · ${postTypeLabel(postType)}` : postTypeLabel(postType),
    poster_title: title,
    display_time: formatDate(post.created_at),
    display_count: formatCount(post.like_count || 0),
    is_liked: !!post.is_liked,
    is_official: !!post.is_official,
    is_featured: !!post.is_featured,
    is_pinned: !!post.is_pinned
  }
}

function postTypeLabel(postType) {
  const map = { lost: '失物', question: '问答', guide: '攻略', club: '社团', note: '笔记' }
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

function formatCount(count) {
  const n = Number(count || 0)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(value) {
  const text = String(value || '')
  const matched = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!matched) return text
  return `${matched[2]}-${matched[3]}`
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
