const { request, uploadImage, trackEvent, showError } = require('../../utils/request')

const postTypes = [
  { value: 'note', label: '普通笔记', category: 'life' },
  { value: 'lost', label: '失物招领', category: 'lost' },
  { value: 'question', label: '提问', category: 'qa' },
  { value: 'guide', label: '攻略', category: 'guide' },
  { value: 'club', label: '社团', category: 'club' }
]

const DRAFT_KEY = 'campus_publish_draft_v1'

Page({
  data: {
    categories: [],
    postTypes,
    postType: 'note',
    categoryCode: 'study',
    title: '',
    content: '',
    mediaType: 'image',
    localImages: [],
    createMode: 'album',
    showMediaChooser: true,
    extra: {
      lost_kind: '丢失',
      location: '',
      event_time: '',
      contact: '',
      club_name: '',
      activity_time: '',
      activity_place: ''
    },
    hasDraft: false,
    submitting: false,
    uploadProgress: 0,
    submitStatusText: '',
    successTip: null
  },

  onLoad(options = {}) {
    this.loadCategories()
    const mode = options.mode || 'album'
    const restore = options.restore === '1'
    const optionPostType = options.post_type || ''
    const optionTitle = decodeURIComponent(options.title || '')
    const matchedType = postTypes.find(item => item.value === optionPostType)
    trackEvent('publish_open', { page: 'publish', channel: restore ? 'draft' : mode })
    this.setData({
      createMode: mode,
      mediaType: mode === 'text' ? 'text' : 'image',
      showMediaChooser: !restore && mode !== 'text',
      ...(optionPostType ? { postType: optionPostType } : {}),
      ...(matchedType ? { categoryCode: matchedType.category } : {}),
      ...(optionTitle ? { title: optionTitle } : {})
    })
    if (restore) {
      this.restoreSavedDraft()
    } else if (mode === 'album') {
      setTimeout(() => this.chooseFromAlbum(), 250)
    } else if (mode === 'camera') {
      setTimeout(() => this.takePhoto(), 250)
    }
    if (!restore) this.checkDraft()
  },

  async loadCategories() {
    try {
      const data = await request({ url: '/campus/forum/categories' })
      const categories = data.categories || []
      const matched = postTypes.find(item => item.value === this.data.postType)
      const preferredCode = matched && categories.some(category => category.code === matched.category)
        ? matched.category
        : (categories[0] ? categories[0].code : 'study')
      this.setData({
        categories,
        categoryCode: this.data.categoryCode || preferredCode
      })
    } catch (err) {
      showError(err)
    }
  },

  selectCategory(e) {
    this.setData({ categoryCode: e.currentTarget.dataset.code })
    this.saveDraftSoon()
  },

  selectPostType(e) {
    const postType = e.currentTarget.dataset.type
    const matched = postTypes.find(item => item.value === postType)
    const next = { postType }
    if (matched && this.data.categories.some(category => category.code === matched.category)) {
      next.categoryCode = matched.category
    }
    this.setData(next)
    this.saveDraftSoon()
  },

  onTitle(e) {
    this.setData({ title: e.detail.value })
    this.saveDraftSoon()
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
    this.saveDraftSoon()
  },

  onExtraInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`extra.${key}`]: e.detail.value })
    this.saveDraftSoon()
  },

  changeLostKind(e) {
    this.setData({ 'extra.lost_kind': e.currentTarget.dataset.kind })
    this.saveDraftSoon()
  },

  changeMediaType(e) {
    const mediaType = e.currentTarget.dataset.type
    if (mediaType === this.data.mediaType) return
    this.setData({
      mediaType,
      localImages: [],
    })
    this.saveDraftSoon()
  },

  chooseFromAlbum() {
    this.chooseMixedMedia(['album'])
  },

  takePhoto() {
    this.chooseMixedMedia(['camera'])
  },

  writeText() {
    this.setData({
      mediaType: 'text',
      localImages: [],
      showMediaChooser: false
    })
    this.saveDraftSoon()
  },

  chooseMedia(sourceType) {
    const remain = 9 - this.data.localImages.length
    if (remain <= 0) return
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType,
      success: res => {
        this.setData({
          mediaType: 'image',
          showMediaChooser: false,
          localImages: this.data.localImages.concat(res.tempFilePaths || [])
        })
        this.saveDraftSoon()
      }
    })
  },

  chooseMixedMedia(sourceType) {
    if (!wx.chooseMedia) {
      this.chooseMedia(sourceType)
      return
    }
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      camera: 'back',
      success: async res => {
        const images = (res.tempFiles || [])
          .map(file => file.tempFilePath)
          .filter(Boolean)
        if (!images.length) return
        this.setData({
          mediaType: 'image',
          showMediaChooser: false,
          localImages: this.data.localImages.concat(images).slice(0, 9)
        })
        this.saveDraftSoon()
      }
    })
  },

  chooseImages() {
    this.chooseMedia(['album', 'camera'])
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const next = this.data.localImages.slice()
    next.splice(index, 1)
    this.setData({ localImages: next })
    this.saveDraftSoon()
  },

  editImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const filePath = this.data.localImages[index]
    if (!filePath) return
    if (!wx.editImage) {
      wx.showToast({ title: '当前微信版本不支持图片编辑', icon: 'none' })
      return
    }
    wx.editImage({
      src: filePath,
      success: res => {
        const next = this.data.localImages.slice()
        next[index] = res.tempFilePath
        this.setData({ localImages: next })
        this.saveDraftSoon()
      }
    })
  },

  checkDraft() {
    const draft = wx.getStorageSync(DRAFT_KEY)
    if (!draft || !draft.updated_at) return
    this.setData({ hasDraft: true })
    wx.showModal({
      title: '恢复草稿？',
      content: '检测到上次未发布的内容，要继续编辑吗？',
      confirmText: '恢复',
      cancelText: '不用',
      success: res => {
        if (res.confirm) {
          this.restoreDraft(draft)
        }
      }
    })
  },

  restoreSavedDraft() {
    const draft = wx.getStorageSync(DRAFT_KEY)
    if (!draft || !draft.updated_at) {
      wx.showToast({ title: '暂无草稿', icon: 'none' })
      return
    }
    this.restoreDraft(draft)
  },

  restoreDraft(draft) {
    this.setData({
      postType: draft.postType || 'note',
      categoryCode: draft.categoryCode || this.data.categoryCode,
      title: draft.title || '',
      content: draft.content || '',
      mediaType: draft.mediaType || 'text',
      localImages: draft.localImages || [],
      showMediaChooser: false,
      extra: {
        ...this.data.extra,
        ...(draft.extra || {})
      },
      hasDraft: true
    })
  },

  clearDraft() {
    wx.showModal({
      title: '清空草稿？',
      content: '清空后无法恢复。',
      confirmText: '清空',
      confirmColor: '#ff4d5f',
      success: res => {
        if (!res.confirm) return
        wx.removeStorageSync(DRAFT_KEY)
        this.setData({
          title: '',
          content: '',
          localImages: [],
          hasDraft: false,
          showMediaChooser: true
        })
      }
    })
  },

  goRules() {
    wx.navigateTo({ url: '/pages/policy/policy?type=rules' })
  },

  saveDraftSoon() {
    if (this._draftTimer) clearTimeout(this._draftTimer)
    this._draftTimer = setTimeout(() => this.saveDraft(), 300)
  },

  saveDraft() {
    const hasContent = Boolean(
      this.data.title.trim() ||
      this.data.content.trim() ||
      this.data.localImages.length
    )
    if (!hasContent) {
      wx.removeStorageSync(DRAFT_KEY)
      this.setData({ hasDraft: false })
      return
    }
    wx.setStorageSync(DRAFT_KEY, {
      postType: this.data.postType,
      categoryCode: this.data.categoryCode,
      title: this.data.title,
      content: this.data.content,
      mediaType: this.data.mediaType,
      localImages: this.data.localImages,
      extra: this.data.extra,
      updated_at: Date.now()
    })
    if (!this.data.hasDraft) this.setData({ hasDraft: true })
  },

  async submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true, uploadProgress: 0, submitStatusText: '准备发布...' })
    try {
      const payload = {
        category_code: this.data.categoryCode,
        title: this.data.title,
        content: this.data.content,
        media_type: 'text',
        post_type: this.data.postType,
        extra: buildExtra(this.data.postType, this.data.extra),
        images: [],
        cover_url: ''
      }
      if (this.data.mediaType === 'image') {
        const images = []
        const total = this.data.localImages.length || 1
        for (let index = 0; index < this.data.localImages.length; index += 1) {
          const filePath = this.data.localImages[index]
          this.setData({
            submitStatusText: `上传图片 ${index + 1}/${total}`,
            uploadProgress: Math.round((index / total) * 75)
          })
          const uploaded = await uploadImage(filePath)
          if (uploaded && uploaded.url) images.push(uploaded.url)
        }
        if (images.length) {
          payload.media_type = 'image'
          payload.images = images
          payload.cover_url = images[0]
        }
      } else {
        payload.media_type = 'text'
      }
      this.setData({ submitStatusText: '发布中...', uploadProgress: 88 })
      const created = await request({
        url: '/campus/forum/posts',
        method: 'POST',
        data: payload
      })
      const post = created && created.post ? created.post : null
      const postID = post ? post.id : ''
      trackEvent('publish_success', {
        page: 'publish',
        targetType: 'post',
        targetId: Number(postID || 0),
        channel: payload.media_type,
        extra: { post_type: this.data.postType }
      })
      wx.removeStorageSync(DRAFT_KEY)
      this.setData({
        hasDraft: false,
        uploadProgress: 100,
        submitStatusText: '发布成功',
        successTip: {
          title: '发布成功',
          desc: postID ? '正在带你去看看这条内容。' : '可以在我的帖子里继续查看。'
        }
      })
      const pages = getCurrentPages()
      const prev = pages[pages.length - 2]
      if (prev) prev._needsRefresh = true
      setTimeout(() => {
        if (postID) {
          wx.redirectTo({ url: `/pages/post-detail/post-detail?id=${postID}` })
          return
        }
        wx.redirectTo({ url: '/pages/my-posts/my-posts' })
      }, 600)
    } catch (err) {
      this.saveDraft()
      wx.showModal({
        title: '发布失败',
        content: `${err.message || '网络或上传异常'}\n已自动保存草稿，可以稍后重试。`,
        confirmText: '重试发布',
        cancelText: '先留草稿',
        success: res => {
          if (res.confirm) {
            setTimeout(() => this.submit(), 120)
          }
        }
      })
    } finally {
      this.setData({ submitting: false, submitStatusText: '', uploadProgress: 0 })
    }
  }
})

function buildExtra(postType, extra) {
  if (postType === 'lost') {
    return pick(extra, ['lost_kind', 'location', 'event_time', 'contact'])
  }
  if (postType === 'club') {
    return pick(extra, ['club_name', 'activity_time', 'activity_place', 'contact'])
  }
  if (postType === 'guide') {
    return pick(extra, ['location'])
  }
  return {}
}

function pick(source, keys) {
  const out = {}
  keys.forEach(key => {
    const value = String(source[key] || '').trim()
    if (value) out[key] = value
  })
  return out
}
