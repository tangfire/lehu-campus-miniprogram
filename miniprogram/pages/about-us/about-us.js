Page({
  goPolicy(e) {
    const type = e.currentTarget.dataset.type || 'terms'
    wx.navigateTo({ url: `/pages/policy/policy?type=${type}` })
  },

  copyWechat() {
    wx.setClipboardData({
      data: '待上线后填写',
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    })
  }
})
