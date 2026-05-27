const { request, uploadImage, uploadVideo, showError } = require('../../utils/request')

Page({
  data: {
    categories: [],
    categoryCode: 'study',
    title: '',
    content: '',
    mediaType: 'image',
    localImages: [],
    localVideo: '',
    coverImage: '',
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

  onTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
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
