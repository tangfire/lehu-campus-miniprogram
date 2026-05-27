const kit = require('../../utils/freshman-kit-data')

const openingDate = new Date('2026/09/01 00:00:00')

Page({
  data: {
    categories: kit.categories,
    activeCategory: '全部',
    items: kit.items,
    visibleItems: kit.items,
    expandedId: '',
    favoriteIds: [],
    countdownText: '',
    guideCards: [
      { key: 'report', title: '报到清单', desc: '证件、档案、到校流程先核对' },
      { key: 'dorm', title: '宿舍准备', desc: '床品、收纳、常用物品清单' },
      { key: 'traffic', title: '到校路线', desc: '交通、接驳和官网入口' },
      { key: 'official', title: '官网入口', desc: '学校、教务、招生信息' }
    ]
  },

  onLoad(query) {
    const favoriteIds = wx.getStorageSync('freshman_kit_favorites') || []
    this.setData({ favoriteIds, expandedId: query.id || '' })
    this.refreshCountdown()
    this.refreshFavoriteFlags()
  },

  onShow() {
    syncTabBar(this, 1)
  },

  changeCategory(e) {
    const category = e.currentTarget.dataset.category
    const visibleItems = category === '全部'
      ? this.data.items
      : this.data.items.filter(item => item.category === category)
    this.setData({
      activeCategory: category,
      visibleItems,
      expandedId: ''
    })
    this.refreshFavoriteFlags()
  },

  toggleItem(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? '' : id })
  },

  openGuideCard(e) {
    const id = e.currentTarget.dataset.id
    const target = this.data.items.find(item => item.id === id)
    if (!target) return
    this.setData({
      activeCategory: target.category,
      visibleItems: this.data.items.filter(item => item.category === target.category),
      expandedId: id
    })
    this.refreshFavoriteFlags()
  },

  toggleFavorite(e) {
    const id = e.currentTarget.dataset.id
    const set = new Set(this.data.favoriteIds)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    const favoriteIds = Array.from(set)
    wx.setStorageSync('freshman_kit_favorites', favoriteIds)
    this.setData({ favoriteIds })
    this.refreshFavoriteFlags()
  },

  copyText(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.text || '',
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    })
  },

  copyLink(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.url || '',
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    })
  },

  refreshFavoriteFlags() {
    const favoriteSet = new Set(this.data.favoriteIds)
    this.setData({
      visibleItems: this.data.visibleItems.map(item => ({
        ...item,
        is_favorite: favoriteSet.has(item.id)
      }))
    })
  },

  refreshCountdown() {
    const now = new Date()
    const diff = openingDate.getTime() - now.getTime()
    if (diff <= 0) {
      this.setData({ countdownText: '开学进行中' })
      return
    }
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
    this.setData({ countdownText: `距离 9 月开学约 ${days} 天` })
  },

  onShareAppMessage() {
    const item = this.data.items.find(entry => entry.id === this.data.expandedId)
    return {
      title: item ? `${item.title} - 深汕校园e站` : '深汕校园e站新生工具包',
      path: item ? `/pages/freshman-kit/freshman-kit?id=${item.id}` : '/pages/freshman-kit/freshman-kit'
    }
  }
})

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar) {
    tabBar.setData({ selected })
  }
}
