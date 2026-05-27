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
  }
})

function normalizePost(post) {
  if (!post) return post
  const images = post.images || []
  return {
    ...post,
    images,
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    post_type: post.post_type || 'note',
    type_label: postTypeLabel(post.post_type),
    short_type_label: shortPostTypeLabel(post.post_type),
    display_author: displayAuthor(post.author),
    extra_items: extraItems(post.post_type, post.extra || {})
  }
}

function normalizeComment(comment) {
  return {
    ...comment,
    display_author: displayAuthor(comment.author)
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
