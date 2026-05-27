Page({
  copyWechat() {
    wx.setClipboardData({
      data: '待上线后填写',
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    })
  }
})
