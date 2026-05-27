const kit = require('../../utils/freshman-kit-data')

Page({
  data: {
    categories: kit.categories,
    activeCategory: '全部',
    items: kit.items,
    visibleItems: kit.items,
    expandedId: '',
    favoriteIds: []
  },

  onLoad() {
    const favoriteIds = wx.getStorageSync('freshman_kit_favorites') || []
    this.setData({ favoriteIds })
    this.refreshFavoriteFlags()
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
  }
})
