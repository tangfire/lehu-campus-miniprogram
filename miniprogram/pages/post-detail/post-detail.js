const { request, trackEvent, showError } = require('../../utils/request')

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    commentText: '',
    currentUserId: '',
    statusBarHeight: 0,
    navBarHeight: 52,
    loading: false
  },

  onLoad(query) {
    this.setupNavBar()
    this.setData({ id: query.id })
    trackEvent('visit', { page: 'post-detail', targetType: 'post', targetId: query.id })
    this.loadPost()
    this.loadComments()
  },

  onShow() {
    const user = wx.getStorageSync('user') || {}
    this.setData({ currentUserId: user.id || '' })
  },

  setupNavBar() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const statusBarHeight = info.statusBarHeight || 0
    let navBarHeight = statusBarHeight + 52
    if (wx.getMenuButtonBoundingClientRect) {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu && menu.bottom) {
        navBarHeight = menu.bottom + (menu.top - statusBarHeight)
      }
    }
    this.setData({ statusBarHeight, navBarHeight })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/community/community' })
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
      this.setData({ comments: (data.comments || []).map(normalizeComment) })
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

  async toggleCollection() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const post = this.data.post
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/collection`,
        method: post.is_collected ? 'DELETE' : 'POST'
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
  },

  onShareAppMessage() {
    trackEvent('share', { page: 'post-detail', targetType: 'post', targetId: this.data.id, channel: 'app_message' })
    const post = this.data.post
    return {
      title: post ? post.title : '深汕校园e站校园笔记',
      path: `/pages/post-detail/post-detail?id=${this.data.id}`
    }
  }
})

function normalizePost(post) {
  if (!post) return post
  const images = post.images || []
  const postType = post.post_type || 'note'
  const typeLabel = postTypeLabel(postType)
  const teaser = cleanText(post.content || '')
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    post_type: postType,
    type_label: typeLabel,
    short_type_label: shortPostTypeLabel(postType),
    display_author: displayAuthor(post.author),
    avatar_text: post.is_official ? 'e' : '同',
    poster_class: `poster-${posterVariant(postType, post.id)}`,
    poster_kicker: post.is_official ? `深汕e仔 · ${typeLabel}` : typeLabel,
    poster_title: cleanText(post.title || teaser),
    display_time: formatDate(post.created_at),
    extra_items: extraItems(postType, post.extra || {}),
    is_official: !!post.is_official,
    is_featured: !!post.is_featured,
    is_pinned: !!post.is_pinned
  }
}

function normalizeComment(comment) {
  return {
    ...comment,
    display_author: displayAuthor(comment.author),
    avatar_text: comment.author && (comment.author.nickname || comment.author.name) ? String(comment.author.nickname || comment.author.name).slice(0, 1) : '同',
    display_time: formatDate(comment.created_at)
  }
}

function postTypeLabel(postType) {
  const map = {
    lost: '失物招领',
    question: '问答互助',
    guide: '校园攻略',
    club: '社团招新',
    note: '校园笔记'
  }
  return map[postType || 'note'] || '校园笔记'
}

function shortPostTypeLabel(postType) {
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

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function formatDate(value) {
  const text = String(value || '')
  const matched = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!matched) return text
  return `${matched[2]}-${matched[3]}`
}

function displayAuthor(author) {
  if (!author) return '深汕同学'
  return author.nickname || author.name || '深汕同学'
}

function extraItems(postType, extra) {
  const rows = []
  if (postType === 'lost') {
    push(rows, '类型', extra.lost_kind)
    push(rows, '地点', extra.location)
    push(rows, '时间', extra.event_time)
    push(rows, '联系', extra.contact)
  } else if (postType === 'club') {
    push(rows, '社团', extra.club_name)
    push(rows, '时间', extra.activity_time)
    push(rows, '地点', extra.activity_place)
    push(rows, '联系', extra.contact)
  } else if (postType === 'guide') {
    push(rows, '地点', extra.location)
  }
  return rows
}

function push(rows, label, value) {
  if (value) rows.push({ label, value })
}
