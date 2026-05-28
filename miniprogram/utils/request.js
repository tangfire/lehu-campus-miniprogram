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
  return directUpload(filePath, 'image').catch(() => legacyUpload(filePath, 'image'))
}

function uploadVideo(filePath) {
  return directUpload(filePath, 'video').catch(() => legacyUpload(filePath, 'video'))
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
  if (!presign || !presign.upload_url || !presign.file_id) {
    throw new Error('直传地址无效')
  }
  await putFileToObjectStorage(filePath, presign)
  return request({
    url: '/campus/upload/complete',
    method: 'POST',
    data: {
      media_type: mediaType,
      file_id: presign.file_id
    }
  })
}

function legacyUpload(filePath, mediaType) {
  const token = wx.getStorageSync('token')
  const path = mediaType === 'video' ? '/campus/upload/video' : '/campus/upload/image'
  const fallbackMessage = mediaType === 'video' ? '视频上传失败' : '图片上传失败'
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBase}${path}`,
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
        reject(new Error(body.message || fallbackMessage))
      },
      fail(err) {
        reject(new Error(err.errMsg || fallbackMessage))
      }
    })
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
  if (mediaType === 'video' && size > 20 * 1024 * 1024) {
    throw new Error('视频压缩后不能超过 20MB')
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
  if (mediaType === 'video') {
    return ext === 'mov' ? 'mov' : 'mp4'
  }
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
  wx.showToast({
    title: err.message || '操作失败',
    icon: 'none'
  })
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
  uploadVideo,
  trackEvent,
  showError
}
