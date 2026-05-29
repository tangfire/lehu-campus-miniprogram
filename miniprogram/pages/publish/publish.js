const { request, uploadImage, uploadVideo, trackEvent, showError } = require('../../utils/request')

const postTypes = [
  { value: 'note', label: '普通笔记', category: 'life' },
  { value: 'lost', label: '失物招领', category: 'lost' },
  { value: 'question', label: '提问', category: 'qa' },
  { value: 'guide', label: '攻略', category: 'guide' },
  { value: 'club', label: '社团', category: 'club' }
]

const MAX_VIDEO_SIZE = 20 * 1024 * 1024
const MAX_VIDEO_DURATION = 30
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
    localVideo: '',
    videoSizeLabel: '',
    videoDurationLabel: '',
    videoProcessLabel: '',
    coverImage: '',
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
      localVideo: '',
      videoSizeLabel: '',
      videoDurationLabel: '',
      videoProcessLabel: '',
      coverImage: ''
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
      localVideo: '',
      videoSizeLabel: '',
      videoDurationLabel: '',
      videoProcessLabel: '',
      coverImage: '',
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
      mediaType: ['image', 'video'],
      sourceType,
      sizeType: ['compressed'],
      maxDuration: MAX_VIDEO_DURATION,
      camera: 'back',
      success: async res => {
        const files = res.tempFiles || []
        const first = files[0]
        if (!first) return
        const fileType = first.fileType || res.type || inferMediaType(first.tempFilePath)
        if (fileType === 'video') {
          const duration = Number(first.duration || 0)
          if (duration > MAX_VIDEO_DURATION + 1) {
            wx.showToast({ title: `视频不能超过 ${MAX_VIDEO_DURATION} 秒`, icon: 'none' })
            return
          }
          try {
            const video = await prepareVideoForUpload(first.tempFilePath || '', Number(first.size || 0), duration)
            this.setData({
              mediaType: 'video',
              showMediaChooser: false,
              localImages: [],
              localVideo: video.filePath,
              coverImage: first.thumbTempFilePath || '',
              videoSizeLabel: video.size ? formatFileSize(video.size) : '',
              videoDurationLabel: duration ? `${Math.ceil(duration)}秒` : '',
              videoProcessLabel: video.compressed ? '已自动压缩' : ''
            })
            this.saveDraftSoon()
          } catch (err) {
            wx.showModal({
              title: '视频太大',
              content: err.message || '这个视频压缩后还是偏大，建议裁剪到30秒以内或换一个更短的视频。',
              showCancel: false
            })
          }
          return
        }
        const images = files
          .filter(file => (file.fileType || inferMediaType(file.tempFilePath)) !== 'video')
          .map(file => file.tempFilePath)
          .filter(Boolean)
        this.setData({
          mediaType: 'image',
          showMediaChooser: false,
          localVideo: '',
          coverImage: '',
          videoSizeLabel: '',
          videoDurationLabel: '',
          videoProcessLabel: '',
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

  chooseVideo(sourceType = ['album', 'camera']) {
    const sources = Array.isArray(sourceType) ? sourceType : ['album', 'camera']
    wx.chooseVideo({
      sourceType: sources,
      maxDuration: MAX_VIDEO_DURATION,
      compressed: true,
      success: async res => {
        const size = Number(res.size || 0)
        const duration = Number(res.duration || 0)
        if (duration > MAX_VIDEO_DURATION + 1) {
          wx.showToast({ title: `视频不能超过 ${MAX_VIDEO_DURATION} 秒`, icon: 'none' })
          return
        }
        try {
          const video = await prepareVideoForUpload(res.tempFilePath || '', size, duration)
          this.setData({
            mediaType: 'video',
            showMediaChooser: false,
            localVideo: video.filePath,
            videoSizeLabel: video.size ? formatFileSize(video.size) : '',
            videoDurationLabel: duration ? `${Math.ceil(duration)}秒` : '',
            videoProcessLabel: video.compressed ? '已自动压缩' : ''
          })
          this.saveDraftSoon()
        } catch (err) {
          wx.showModal({
            title: '视频太大',
            content: err.message || '这个视频压缩后还是偏大，建议裁剪到30秒以内或换一个更短的视频。',
            showCancel: false
          })
        }
      }
    })
  },

  removeVideo() {
    this.setData({ localVideo: '', videoSizeLabel: '', videoDurationLabel: '', videoProcessLabel: '' })
    this.saveDraftSoon()
  },

  chooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const files = res.tempFilePaths || []
        this.setData({ coverImage: files[0] || '' })
        this.saveDraftSoon()
      }
    })
  },

  removeCover() {
    this.setData({ coverImage: '' })
    this.saveDraftSoon()
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
      localVideo: draft.localVideo || '',
      videoSizeLabel: draft.videoSizeLabel || '',
      videoDurationLabel: draft.videoDurationLabel || '',
      videoProcessLabel: draft.videoProcessLabel || '',
      coverImage: draft.coverImage || '',
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
          localVideo: '',
          coverImage: '',
          videoSizeLabel: '',
          videoDurationLabel: '',
          videoProcessLabel: '',
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
      this.data.localImages.length ||
      this.data.localVideo ||
      this.data.coverImage
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
      localVideo: this.data.localVideo,
      videoSizeLabel: this.data.videoSizeLabel,
      videoDurationLabel: this.data.videoDurationLabel,
      videoProcessLabel: this.data.videoProcessLabel,
      coverImage: this.data.coverImage,
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
        cover_url: '',
        video_url: ''
      }
      if (this.data.mediaType === 'video') {
        if (!this.data.localVideo) {
          wx.showToast({ title: '请选择视频', icon: 'none' })
          return
        }
        if (!this.data.coverImage) {
          wx.showToast({ title: '请选择视频封面', icon: 'none' })
          return
        }
        await ensureVideoFileAllowed(this.data.localVideo)
        this.setData({ submitStatusText: '上传视频中...', uploadProgress: 15 })
        const uploadedVideo = await uploadVideo(this.data.localVideo)
        this.setData({ submitStatusText: '上传封面中...', uploadProgress: 70 })
        const uploadedCover = await uploadImage(this.data.coverImage)
        payload.media_type = 'video'
        payload.video_url = uploadedVideo.url
        payload.cover_url = uploadedCover.url
      } else if (this.data.mediaType === 'image') {
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
      const postStatus = Number(post ? post.status : 1)
      const pendingReview = postStatus === 0
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
        submitStatusText: pendingReview ? '已提交审核' : '已发布',
        successTip: {
          title: pendingReview ? '已提交审核' : '已发布',
          desc: pendingReview ? '审核通过后会展示在社区。' : '正在带你去看看这条内容。'
        }
      })
      const pages = getCurrentPages()
      const prev = pages[pages.length - 2]
      if (prev) prev._needsRefresh = true
      setTimeout(() => {
        if (postID && !pendingReview) {
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

async function prepareVideoForUpload(filePath, size, duration) {
  if (!filePath) {
    throw new Error('请选择视频')
  }
  if (size > 0 && size <= MAX_VIDEO_SIZE) {
    return { filePath, size, compressed: false }
  }
  if (!wx.compressVideo) {
    throw new Error('当前微信版本暂不支持自动压缩，请选择更短的视频。')
  }
  wx.showLoading({ title: '正在压缩视频', mask: true })
  try {
    const compressed = await compressVideo(filePath)
    const compressedSize = Number(compressed.size || 0)
    const checkedSize = compressedSize || await getFileSize(compressed.tempFilePath)
    if (checkedSize > MAX_VIDEO_SIZE) {
      throw new Error('这个视频压缩后还是偏大，建议裁剪到30秒以内或换一个更短的视频。')
    }
    return {
      filePath: compressed.tempFilePath,
      size: checkedSize,
      duration,
      compressed: true
    }
  } finally {
    wx.hideLoading()
  }
}

function compressVideo(filePath) {
  return new Promise((resolve, reject) => {
    wx.compressVideo({
      src: filePath,
      quality: 'medium',
      bitrate: 900,
      fps: 24,
      resolution: 0.75,
      success: resolve,
      fail: () => reject(new Error('视频压缩失败，请换一个更短的视频。'))
    })
  })
}

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

function ensureVideoFileAllowed(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: res => {
        if (Number(res.size || 0) > MAX_VIDEO_SIZE) {
          reject(new Error('视频压缩后不能超过 20MB'))
          return
        }
        resolve()
      },
      fail: () => resolve()
    })
  })
}

function getFileSize(filePath) {
  return new Promise(resolve => {
    wx.getFileInfo({
      filePath,
      success: res => resolve(Number(res.size || 0)),
      fail: () => resolve(0)
    })
  })
}

function formatFileSize(size) {
  if (!size) return ''
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`
  }
  return `${Math.ceil(size / 1024)}KB`
}

function inferMediaType(filePath) {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v')) {
    return 'video'
  }
  return 'image'
}

function pick(source, keys) {
  const out = {}
  keys.forEach(key => {
    const value = String(source[key] || '').trim()
    if (value) out[key] = value
  })
  return out
}
