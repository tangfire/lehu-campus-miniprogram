const app = getApp()

function request(options) {
  const token = wx.getStorageSync('token')
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }
        const message = body.message || '请求失败'
        if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('user')
          wx.removeStorageSync('profile')
        }
        reject(new Error(message))
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络不可用'))
      }
    })
  })
}

function uploadImage(filePath) {
  const token = wx.getStorageSync('token')
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBase}/campus/upload/image`,
      filePath,
      name: 'file',
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || '{}')
        } catch (err) {
          reject(new Error('上传响应无效'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }
        reject(new Error(body.message || '图片上传失败'))
      },
      fail(err) {
        reject(new Error(err.errMsg || '图片上传失败'))
      }
    })
  })
}

function showError(err) {
  wx.showToast({
    title: err.message || '操作失败',
    icon: 'none'
  })
}

module.exports = {
  request,
  uploadImage,
  showError
}
