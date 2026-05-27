const { request, showError } = require('../../utils/request')

Page({
  data: {
    form: {
      school_name: '深圳职业技术大学深汕校区',
      student_no: '',
      real_name: '',
      class_name: '',
      dorm_building: '',
      room_no: '',
      mobile: ''
    },
    saving: false
  },

  onLoad() {
    const profile = wx.getStorageSync('profile')
    if (profile) {
      this.setData({ form: { ...this.data.form, ...profile } })
    }
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const data = await request({ url: '/campus/profile' })
      const profile = data.profile || {}
      wx.setStorageSync('profile', profile)
      this.setData({ form: { ...this.data.form, ...profile } })
    } catch (err) {
      showError(err)
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  async save() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const data = await request({
        url: '/campus/profile',
        method: 'PUT',
        data: this.data.form
      })
      wx.setStorageSync('profile', data.profile)
      wx.showToast({ title: '已保存' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
