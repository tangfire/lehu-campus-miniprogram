Component({
  data: {
    selected: 0,
    tabs: [
      {
        key: 'timetable',
        text: '课表',
        icon: 'icon-calendar',
        pagePath: '/pages/timetable/timetable'
      },
      {
        key: 'community',
        text: '社区',
        icon: 'icon-home',
        pagePath: '/pages/community/community'
      },
      {
        key: 'mine',
        text: '我的',
        icon: 'icon-user',
        pagePath: '/pages/mine/mine'
      }
    ]
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const tab = this.data.tabs[index]
      if (!tab) return
      wx.switchTab({ url: tab.pagePath })
    },

    goPublish() {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.switchTab({ url: '/pages/mine/mine' })
        return
      }
      wx.showActionSheet({
        itemList: ['发图文', '拍摄', '写文字'],
        success: res => {
          const urls = [
            '/pages/publish/publish?mode=album',
            '/pages/publish/publish?mode=camera',
            '/pages/publish/publish?mode=text'
          ]
          wx.navigateTo({ url: urls[res.tapIndex] || urls[0] })
        }
      })
    }
  }
})
