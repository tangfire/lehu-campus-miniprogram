const { request, uploadImage, uploadVideo, showError } = require('../../utils/request')

const postTypes = [
  { value: 'note', label: '普通笔记', category: 'life' },
  { value: 'lost', label: '失物招领', category: 'lost' },
  { value: 'question', label: '提问', category: 'qa' },
  { value: 'guide', label: '攻略', category: 'guide' },
  { value: 'club', label: '社团', category: 'club' }
]

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
      maxDuration: 60,
      compressed: true,
      success: res => {
        this.setData({ localVideo: res.tempFilePath || '' })
      }
    })
  },

  removeVideo() {
    this.setData({ localVideo: '' })
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
