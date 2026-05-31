const { request, trackEvent, showError } = require('../../utils/request')
const { getSession, hasToken } = require('../../utils/session')

const reportReasons = ['虚假信息', '人身攻击', '泄露隐私', '广告引流', '低俗不适', '其他']

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    commentText: '',
    showEzaiMention: false,
    replyTarget: null,
    currentUserId: '',
    statusBarHeight: 0,
    navBarHeight: 52,
    loading: false
  },

  onLoad(query) {
    this.setupNavBar()
    const id = resolvePostId(query)
    if (!id) {
      wx.showToast({ title: '帖子不存在', icon: 'none' })
      return
    }
    this.setData({ id })
    trackEvent('post_detail_visit', { page: 'post-detail', targetType: 'post', targetId: id })
    this.loadInitialDetail()
  },

  onShow() {
    const user = getSession().user || {}
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
      const post = normalizePost(data.post)
      this.setData({ post })
      return post
    } catch (err) {
      showError(err)
      return null
    }
  },

  async loadInitialDetail() {
    const post = await this.loadPost()
    if (post && post.can_interact) {
      this.loadComments()
      return
    }
    this.setData({ comments: [] })
  },

  async loadComments() {
    if (this.data.post && !this.data.post.can_interact) {
      this.setData({ comments: [] })
      return
    }
    try {
      const data = await request({ url: `/campus/forum/posts/${this.data.id}/comments` })
      this.setData({ comments: (data.comments || []).map(normalizeComment) })
    } catch (err) {
      showError(err)
    }
  },

  onInput(e) {
    const value = e.detail.value || ''
    this.setData({
      commentText: value,
      showEzaiMention: shouldShowEzaiMention(value)
    })
  },

  async submitComment() {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const content = this.data.commentText.trim()
    if (!content) {
      wx.showToast({ title: '写点内容再发', icon: 'none' })
      return
    }
    if (this.data.post && !this.data.post.can_interact) {
      wx.showToast({ title: '内容同步后可评论', icon: 'none' })
      return
    }
    const replyTarget = this.data.replyTarget
    const payload = { content }
    if (replyTarget) {
      payload.parent_id = replyTarget.rootId || replyTarget.id
      payload.reply_to_comment_id = replyTarget.id
    }
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/comments`,
        method: 'POST',
        data: payload
      })
      trackEvent('comment_create', { page: 'post-detail', targetType: 'post', targetId: this.data.id })
      this.setData({ commentText: '', replyTarget: null, showEzaiMention: false })
      if (containsEzaiMention(content)) {
        setTimeout(() => this.loadComments(), 3000)
        setTimeout(() => this.loadComments(), 8000)
      }
      this.loadPost()
      this.loadComments()
    } catch (err) {
      showError(err)
    }
  },

  insertEzaiMention() {
    const current = this.data.commentText || ''
    const text = current.endsWith('@') || current.endsWith('＠')
      ? `${current.slice(0, -1)}@深汕e仔 `
      : `${current}${current.trim() ? ' ' : ''}@深汕e仔 `
    this.setData({
      commentText: text,
      showEzaiMention: false
    })
  },

  startReply(e) {
    const comment = this.findComment(e.currentTarget.dataset.id)
    if (!comment) return
    this.setData({
      replyTarget: {
        id: comment.id,
        rootId: comment.parent_id && comment.parent_id !== '0' ? comment.parent_id : comment.id,
        name: comment.display_author || '同学'
      }
    })
  },

  openUserProfile(e) {
    const userId = String(e.currentTarget.dataset.userId || '')
    if (!userId || userId === '0') return
    wx.navigateTo({ url: `/pages/user-profile/user-profile?user_id=${userId}` })
  },

  clearReply() {
    this.setData({ replyTarget: null })
  },

  async loadReplies(e) {
    const rootId = String(e.currentTarget.dataset.id || '')
    if (!rootId) return
    try {
      const data = await request({ url: `/campus/forum/comments/${rootId}/replies` })
      const replies = (data.comments || []).map(normalizeComment)
      const comments = this.data.comments.map(comment => {
        if (String(comment.id) !== rootId) return comment
        return {
          ...comment,
          preview_replies: replies,
          replies_expanded: true
        }
      })
      this.setData({ comments })
    } catch (err) {
      showError(err)
    }
  },

  async toggleCommentLike(e) {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const id = String(e.currentTarget.dataset.id || '')
    const comment = this.findComment(id)
    if (!comment) return
    this.updateCommentLocal(id, {
      is_liked: !comment.is_liked,
      like_count: Math.max((Number(comment.like_count) || 0) + (comment.is_liked ? -1 : 1), 0)
    })
    try {
      await request({
        url: `/campus/forum/comments/${id}/like`,
        method: comment.is_liked ? 'DELETE' : 'POST'
      })
      if (!comment.is_liked) trackEvent('comment_like', { page: 'post-detail', targetType: 'comment', targetId: id })
    } catch (err) {
      this.updateCommentLocal(id, {
        is_liked: comment.is_liked,
        like_count: Number(comment.like_count) || 0
      })
      showError(err)
    }
  },

  async toggleLike() {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const post = this.data.post
    if (!post || !post.can_interact) {
      wx.showToast({ title: '内容同步后可点赞', icon: 'none' })
      return
    }
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/like`,
        method: post.is_liked ? 'DELETE' : 'POST'
      })
      if (!post.is_liked) trackEvent('like', { page: 'post-detail', targetType: 'post', targetId: this.data.id })
      this.loadPost()
    } catch (err) {
      showError(err)
    }
  },

  async toggleCollection() {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    const post = this.data.post
    if (!post || !post.can_interact) {
      wx.showToast({ title: '内容同步后可收藏', icon: 'none' })
      return
    }
    try {
      await request({
        url: `/campus/forum/posts/${this.data.id}/collection`,
        method: post.is_collected ? 'DELETE' : 'POST'
      })
      if (!post.is_collected) trackEvent('collect', { page: 'post-detail', targetType: 'post', targetId: this.data.id })
      this.loadPost()
    } catch (err) {
      showError(err)
    }
  },

  openPostMenu() {
    const post = this.data.post
    if (!post) return
    const isOwner = post.author && post.author.user_id === this.data.currentUserId
    const itemList = isOwner ? ['撤回帖子'] : ['举报帖子']
    wx.showActionSheet({
      itemList,
      success: res => {
        if (isOwner && res.tapIndex === 0) this.withdrawPost()
        if (!isOwner && res.tapIndex === 0) this.reportPost()
      }
    })
  },

  withdrawPost() {
    wx.showModal({
      title: '撤回帖子',
      content: '撤回后，同学将无法再看到这条内容。',
      confirmText: '撤回',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/posts/${this.data.id}`, method: 'DELETE' })
          wx.showToast({ title: '已撤回' })
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

  openCommentMenu(e) {
    const comment = this.findComment(e.currentTarget.dataset.id)
    if (!comment) return
    const isOwner = comment.author && comment.author.user_id === this.data.currentUserId
    const itemList = isOwner ? ['回复', '复制', '撤回'] : ['回复', '复制', '举报']
    wx.showActionSheet({
      itemList,
      success: res => {
        const index = res.tapIndex
        if (index === 0) {
          this.startReply({ currentTarget: { dataset: { id: comment.id } } })
          return
        }
        if (index === 1) {
          wx.setClipboardData({ data: comment.content || '' })
          return
        }
        if (isOwner) {
          this.withdrawCommentById(comment.id)
        } else {
          this.reportContent(`/campus/forum/comments/${comment.id}/report`)
        }
      }
    })
  },

  withdrawComment(e) {
    this.withdrawCommentById(e.currentTarget.dataset.id)
  },

  withdrawCommentById(id) {
    wx.showModal({
      title: '撤回评论',
      content: '撤回后，这条评论将不再展示给其他同学。',
      confirmText: '撤回',
      confirmColor: '#dc2626',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({ url: `/campus/forum/comments/${id}`, method: 'DELETE' })
          wx.showToast({ title: '已撤回' })
          this.loadPost()
          this.loadComments()
        } catch (err) {
          showError(err)
        }
      }
    })
  },

  findComment(id) {
    const target = String(id || '')
    for (const comment of this.data.comments) {
      if (String(comment.id) === target) return comment
      const replies = comment.preview_replies || []
      for (const reply of replies) {
        if (String(reply.id) === target) return reply
      }
    }
    return null
  },

  updateCommentLocal(id, patch) {
    const target = String(id || '')
    const comments = this.data.comments.map(comment => {
      if (String(comment.id) === target) {
        return { ...comment, ...patch }
      }
      const replies = (comment.preview_replies || []).map(reply => (
        String(reply.id) === target ? { ...reply, ...patch } : reply
      ))
      return { ...comment, preview_replies: replies }
    })
    this.setData({ comments })
  },

  reportContent(url) {
    if (!hasToken()) {
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    wx.showActionSheet({
      itemList: reportReasons,
      success: res => {
        const reason = reportReasons[res.tapIndex] || '其他'
        this.submitReport(url, reason)
      }
    })
  },

  submitReport(url, reason) {
    wx.showModal({
      title: reason,
      editable: true,
      placeholderText: '补充说明，可不填',
      confirmText: '提交',
      success: async res => {
        if (!res.confirm) return
        try {
          await request({
            url,
            method: 'POST',
            data: {
              reason,
              detail: res.content || ''
            }
          })
          trackEvent('report_create', { page: 'post-detail', channel: reason })
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
    if (post && !post.can_interact) {
      return {
        title: '深汕校园e站',
        path: '/pages/community/community'
      }
    }
    return {
      title: post ? post.display_title : '深汕校园e站校园笔记',
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
  const displayTitle = cleanText(post.title || teaser || '校园笔记')
  const status = Number(post.status == null ? 1 : post.status)
  const rawPublishState = normalizePublishState(post, status)
  const publicVisible = post.public_visible != null ? !!post.public_visible : rawPublishState === 'visible'
  const publishState = !publicVisible && rawPublishState === 'visible' ? 'syncing' : rawPublishState
  const useFallbackStatus = !publicVisible && rawPublishState === 'visible'
  return {
    ...post,
    images,
    status,
    publish_state: publishState,
    public_visible: publicVisible,
    client_status_label: useFallbackStatus ? statusLabel(publishState) : (post.client_status_label || statusLabel(publishState)),
    client_status_detail: useFallbackStatus ? statusDetail(publishState) : (post.client_status_detail || statusDetail(publishState)),
    status_class: `state-${publishState}`,
    can_interact: publicVisible && publishState === 'visible',
    media_type: post.media_type || (images.length ? 'image' : 'text'),
    post_type: postType,
    type_label: typeLabel,
    short_type_label: shortPostTypeLabel(postType),
    display_title: displayTitle,
    display_author: displayAuthor(post.author),
    author_user_id: post.author ? post.author.user_id : '',
    avatar_text: post.is_official ? 'e' : '同',
    poster_class: `poster-${posterVariant(postType, post.id)}`,
    poster_kicker: post.is_official ? `深汕e仔 · ${typeLabel}` : typeLabel,
    poster_title: displayTitle,
    display_time: formatDate(post.created_at),
    extra_items: extraItems(postType, post.extra || {}),
    is_official: !!post.is_official,
    is_featured: !!post.is_featured,
    is_pinned: !!post.is_pinned
  }
}

function normalizePublishState(post, status) {
  if (post && post.publish_state) return post.publish_state
  if (status === 1) return 'visible'
  if (status === 2) return 'needs_attention'
  if (status === 3) return 'hidden'
  return 'syncing'
}

function statusLabel(state) {
  const map = {
    syncing: '同步中',
    visible: '已发布',
    needs_attention: '需修改',
    hidden: '已撤回'
  }
  return map[state] || '同步中'
}

function statusDetail(state) {
  const map = {
    syncing: '正在同步到社区，只有你自己可以看到。',
    visible: '',
    needs_attention: '这条内容暂未同步，请修改后再发布。',
    hidden: '这条内容已撤回。'
  }
  return map[state] || ''
}

function resolvePostId(query = {}) {
  if (query.id) return String(query.id).trim()
  const scene = query.scene ? safeDecode(query.scene) : ''
  if (!scene) return ''
  if (/^\d+$/.test(scene)) return scene
  const params = {}
  scene.split('&').forEach((part) => {
    const [key, value = ''] = part.split('=')
    if (key) params[key] = value
  })
  return String(params.id || params.post_id || '').trim()
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch (err) {
    return String(value || '')
  }
}

function normalizeComment(comment) {
  const normalized = {
    ...comment,
    id: String(comment.id || ''),
    post_id: String(comment.post_id || ''),
    parent_id: String(comment.parent_id || '0'),
    reply_to_comment_id: String(comment.reply_to_comment_id || '0'),
    reply_count: Number(comment.reply_count) || 0,
    like_count: Number(comment.like_count) || 0,
    is_liked: !!comment.is_liked,
    preview_replies: (comment.preview_replies || []).map(normalizeComment),
    replies_expanded: false,
    display_author: displayAuthor(comment.author),
    author_user_id: comment.author ? comment.author.user_id : '',
    reply_to_name: displayAuthor(comment.reply_to_user),
    reply_to_user_id: comment.reply_to_user ? comment.reply_to_user.user_id : '',
    avatar_text: comment.author && (comment.author.nickname || comment.author.name) ? String(comment.author.nickname || comment.author.name).slice(0, 1) : '同',
    display_time: formatDate(comment.created_at)
  }
  normalized.hidden_reply_count = Math.max(normalized.reply_count - (normalized.preview_replies || []).length, 0)
  return normalized
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

function shouldShowEzaiMention(value) {
  const text = String(value || '')
  return text.endsWith('@') || text.endsWith('＠')
}

function containsEzaiMention(value) {
  const text = String(value || '').toLowerCase()
  return text.includes('@深汕e仔') || text.includes('＠深汕e仔') || text.includes('@e仔') || text.includes('＠e仔')
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
