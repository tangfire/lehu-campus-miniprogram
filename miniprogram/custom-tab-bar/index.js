Component({
  data: {
    selected: 0,
    tabs: [
      {
        key: 'home',
        text: '首页',
        icon: 'icon-home',
        pagePath: '/pages/community/community'
      },
      {
        key: 'timetable',
        text: '课表',
        icon: 'icon-calendar',
        pagePath: '/pages/timetable/timetable'
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
      wx.navigateTo({ url: '/pages/publish/publish' })
    }
  }
})
