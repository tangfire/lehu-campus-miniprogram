Page({
  goPolicy(e) {
    const type = e.currentTarget.dataset.type || 'terms'
    wx.navigateTo({ url: `/pages/policy/policy?type=${type}` })
  }
})
