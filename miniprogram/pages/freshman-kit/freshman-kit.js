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
    checkedMap: {},
    favoriteOnly: false,
    countdownText: '',
    guideCards: [
      { key: 'before-school', title: '报到前', desc: '通知、材料、缴费、行程' },
      { key: 'documents', title: '材料袋', desc: '证件、档案、照片备份' },
      { key: 'dorm-essentials', title: '宿舍', desc: '只带第一周必需品' },
      { key: 'official-links', title: '官网', desc: '教务、招生、学生入口' }
    ]
  },

  onLoad(query) {
    const favoriteIds = wx.getStorageSync('freshman_kit_favorites') || []
    const checkedMap = wx.getStorageSync('freshman_kit_checked') || {}
    this.setData({ favoriteIds, checkedMap, expandedId: query.id || '' })
    this.refreshCountdown()
    this.refreshVisibleItems()
  },

  onShow() {
    syncTabBar(this, 1)
  },

  changeCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      activeCategory: category,
      expandedId: ''
    })
    this.refreshVisibleItems()
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
      favoriteOnly: false,
      expandedId: id
    })
    this.refreshVisibleItems()
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
    this.refreshVisibleItems()
  },

  toggleFavoriteOnly() {
    this.setData({
      favoriteOnly: !this.data.favoriteOnly,
      expandedId: ''
    })
    this.refreshVisibleItems()
  },

  toggleChecklist(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    const key = `${id}_${index}`
    const checkedMap = { ...this.data.checkedMap, [key]: !this.data.checkedMap[key] }
    wx.setStorageSync('freshman_kit_checked', checkedMap)
    this.setData({ checkedMap })
    this.refreshVisibleItems()
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

  refreshVisibleItems() {
    const favoriteSet = new Set(this.data.favoriteIds)
    const checkedMap = this.data.checkedMap || {}
    const visibleItems = this.data.items
      .filter(item => this.data.activeCategory === '全部' || item.category === this.data.activeCategory)
      .filter(item => !this.data.favoriteOnly || favoriteSet.has(item.id))
      .map(item => {
        const checklist = (item.checklist || []).map((text, index) => ({
          text,
          checked: !!checkedMap[`${item.id}_${index}`]
        }))
        const checkedCount = checklist.filter(entry => entry.checked).length
        const progressText = checklist.length ? `${checkedCount}/${checklist.length}` : ''
        return {
          ...item,
          checklist,
          progressText,
          is_favorite: favoriteSet.has(item.id)
        }
      })
    this.setData({
      visibleItems
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
