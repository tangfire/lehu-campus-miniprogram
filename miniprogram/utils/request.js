const app = getApp()

function request(options) {
  const token = wx.getStorageSync('token')
  const requestId = createRequestId()
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        'X-Request-ID': requestId,
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
        reject(createRequestError(message, body.request_id || res.header['X-Request-ID'] || requestId, res.statusCode, body))
      },
      fail(err) {
        reject(createRequestError(err.errMsg || '网络不可用', requestId, 0, null))
      }
    })
  })
}

function uploadImage(filePath) {
  return directUpload(filePath, 'image')
}

async function directUpload(filePath, mediaType) {
  const info = await getUploadFileInfo(filePath)
  validateUploadFile(info, mediaType)
  const fileType = inferFileType(filePath, mediaType)
  const presign = await request({
    url: '/campus/upload/presign',
    method: 'POST',
    data: {
      media_type: mediaType,
      hash: info.digest,
      file_type: fileType,
      filename: inferFilename(filePath, fileType),
      size: info.size
    }
  })
  if (!presign || !presign.file_id) {
    throw new Error('直传地址无效')
  }
  if (presign.upload_url) {
    await putFileToObjectStorage(filePath, presign)
  }
  return request({
    url: '/campus/upload/complete',
    method: 'POST',
    data: {
      media_type: mediaType,
      file_id: presign.file_id
    }
  })
}

function getUploadFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      digestAlgorithm: 'md5',
      success: res => resolve({ size: Number(res.size || 0), digest: res.digest || '' }),
      fail: err => reject(new Error(err.errMsg || '读取文件信息失败'))
    })
  })
}

function validateUploadFile(info, mediaType) {
  const size = Number(info && info.size ? info.size : 0)
  const digest = info && info.digest ? info.digest : ''
  if (!size || !digest) {
    throw new Error('文件信息无效')
  }
  if (mediaType === 'image' && size > 5 * 1024 * 1024) {
    throw new Error('图片不能超过 5MB')
  }
}

function putFileToObjectStorage(filePath, presign) {
  const fs = wx.getFileSystemManager()
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      success: readRes => {
        wx.request({
          url: presign.upload_url,
          method: presign.method || 'PUT',
          data: readRes.data,
          header: presign.headers || { 'Content-Type': 'application/octet-stream' },
          success: res => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve()
              return
            }
            reject(new Error(`直传失败 ${res.statusCode}`))
          },
          fail: err => reject(new Error(err.errMsg || '直传失败'))
        })
      },
      fail: err => reject(new Error(err.errMsg || '读取文件失败'))
    })
  })
}

function inferFileType(filePath, mediaType) {
  const lower = String(filePath || '').split('?')[0].toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  if (ext === 'jpeg') return 'jpg'
  if (ext === 'png' || ext === 'webp' || ext === 'jpg') return ext
  return 'jpg'
}

function inferFilename(filePath, fileType) {
  const clean = String(filePath || '').split('?')[0]
  const name = clean.slice(clean.lastIndexOf('/') + 1)
  if (name && name.includes('.')) return name
  return `campus-${Date.now()}.${fileType}`
}

function showError(err) {
  const requestId = err && err.requestId ? String(err.requestId) : ''
  if (requestId) {
    console.error('[request failed]', {
      request_id: requestId,
      status_code: err.statusCode,
      message: err.message,
      data: err.data
    })
    wx.showModal({
      title: '操作失败',
      content: `${err.message || '操作失败'}\n请求编号：${requestId}`,
      confirmText: '知道了',
      cancelText: '复制编号',
      success: res => {
        if (res.cancel) {
          wx.setClipboardData({ data: requestId })
        }
      }
    })
    return
  }
  wx.showToast({
    title: err.message || '操作失败',
    icon: 'none'
  })
}

function createRequestId() {
  const random = Math.random().toString(16).slice(2, 10)
  return `mp-${Date.now()}-${random}`
}

function createRequestError(message, requestId, statusCode, data) {
  const err = new Error(message || '请求失败')
  err.requestId = requestId || ''
  err.statusCode = statusCode || 0
  err.data = data || null
  return err
}

function trackEvent(eventType, options = {}) {
  return request({
    url: '/campus/analytics/track',
    method: 'POST',
    data: {
      event_type: eventType,
      page: options.page || '',
      target_type: options.targetType || '',
      target_id: options.targetId || 0,
      channel: options.channel || '',
      extra: options.extra || {}
    }
  }).catch(() => {})
}

module.exports = {
  request,
  uploadImage,
  trackEvent,
  showError
}
