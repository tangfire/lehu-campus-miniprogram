const { request, uploadImage, uploadVideo, showError } = require('../../utils/request')

const postTypes = [
  { value: 'note', label: '普通笔记', category: 'life' },
  { value: 'lost', label: '失物招领', category: 'lost' },
  { value: 'question', label: '提问', category: 'qa' },
  { value: 'guide', label: '攻略', category: 'guide' },
  { value: 'club', label: '社团', category: 'club' }
]

const MAX_VIDEO_SIZE = 20 * 1024 * 1024
const MAX_VIDEO_DURATION = 30

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
    extra: {
      lost_kind: '丢失',
      location: '',
      event_time: '',
      contact: '',
      club_name: '',
      activity_time: '',
      activity_place: ''
    },
    submitting: false
  },

  onLoad() {
    this.loadCategories()
  },

  async loadCategories() {
    try {
      const data = await request({ url: '/campus/forum/categories' })
      const categories = data.categories || []
      this.setData({
        categories,
        categoryCode: categories[0] ? categories[0].code : 'study'
      })
    } catch (err) {
      showError(err)
    }
  },

  selectCategory(e) {
    this.setData({ categoryCode: e.currentTarget.dataset.code })
  },

  selectPostType(e) {
    const postType = e.currentTarget.dataset.type
    const matched = postTypes.find(item => item.value === postType)
    const next = { postType }
    if (matched && this.data.categories.some(category => category.code === matched.category)) {
      next.categoryCode = matched.category
    }
    this.setData(next)
  },

  onTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  onExtraInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`extra.${key}`]: e.detail.value })
  },

  changeLostKind(e) {
    this.setData({ 'extra.lost_kind': e.currentTarget.dataset.kind })
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
  },

  chooseImages() {
    const remain = 9 - this.data.localImages.length
    if (remain <= 0) return
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        this.setData({ localImages: this.data.localImages.concat(res.tempFilePaths || []) })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const next = this.data.localImages.slice()
    next.splice(index, 1)
    this.setData({ localImages: next })
  },

  chooseVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
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
            localVideo: video.filePath,
            videoSizeLabel: video.size ? formatFileSize(video.size) : '',
            videoDurationLabel: duration ? `${Math.ceil(duration)}秒` : '',
            videoProcessLabel: video.compressed ? '已自动压缩' : ''
          })
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
  },

  chooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const files = res.tempFilePaths || []
        this.setData({ coverImage: files[0] || '' })
      }
    })
  },

  removeCover() {
    this.setData({ coverImage: '' })
  },

  async submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
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
        const uploadedVideo = await uploadVideo(this.data.localVideo)
        const uploadedCover = await uploadImage(this.data.coverImage)
        payload.media_type = 'video'
        payload.video_url = uploadedVideo.url
        payload.cover_url = uploadedCover.url
      } else {
        const images = []
        for (const filePath of this.data.localImages) {
          const uploaded = await uploadImage(filePath)
          if (uploaded && uploaded.url) images.push(uploaded.url)
        }
        if (images.length) {
          payload.media_type = 'image'
          payload.images = images
          payload.cover_url = images[0]
        }
      }
      await request({
        url: '/campus/forum/posts',
        method: 'POST',
        data: payload
      })
      wx.showToast({ title: '已发布' })
      const pages = getCurrentPages()
      const prev = pages[pages.length - 2]
      if (prev) prev._needsRefresh = true
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ submitting: false })
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

function pick(source, keys) {
  const out = {}
  keys.forEach(key => {
    const value = String(source[key] || '').trim()
    if (value) out[key] = value
  })
  return out
}
