const app = getApp()
const { getSession, clearSession } = require('./session')

const IMAGE_MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const IMAGE_COMPRESS_TRIGGER_SIZE = 1200 * 1024
const IMAGE_COMPRESS_QUALITIES = [82, 72, 62, 52]

function request(options) {
  const token = getSession().token
  const requestId = createRequestId()
  const apiBase = String(app.globalData.apiBase || '')
  if (!isApiBaseConfigured(apiBase)) {
    return Promise.reject(createRequestError('API 域名未配置，请先在 config.js 填写正式 HTTPS 地址', '', 0, null))
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBase}${options.url}`,
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
          clearSession()
        }
        reject(createRequestError(message, body.request_id || getResponseHeader(res.header, 'x-request-id') || requestId, res.statusCode, body))
      },
      fail(err) {
        reject(createRequestError(err.errMsg || '网络不可用', requestId, 0, null))
      }
    })
  })
}

async function uploadImage(filePath) {
  const prepared = await prepareImageForUpload(filePath)
  return directUpload(prepared.filePath, 'image', prepared.info)
}

async function directUpload(filePath, mediaType, knownInfo) {
  const info = knownInfo || await getUploadFileInfo(filePath)
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

async function prepareImageForUpload(filePath) {
  let currentPath = filePath
  let currentInfo = await getUploadFileInfo(currentPath)
  if (!wx.compressImage || currentInfo.size <= IMAGE_COMPRESS_TRIGGER_SIZE) {
    return { filePath: currentPath, info: currentInfo }
  }
  for (const quality of IMAGE_COMPRESS_QUALITIES) {
    const compressedPath = await compressImage(currentPath, quality).catch(() => '')
    if (!compressedPath || compressedPath === currentPath) continue
    const compressedInfo = await getUploadFileInfo(compressedPath).catch(() => null)
    if (!compressedInfo || !compressedInfo.size) continue
    if (compressedInfo.size < currentInfo.size) {
      currentPath = compressedPath
      currentInfo = compressedInfo
    }
    if (currentInfo.size <= IMAGE_MAX_UPLOAD_SIZE && quality <= 72) break
  }
  return { filePath: currentPath, info: currentInfo }
}

function compressImage(src, quality) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality,
      success: res => resolve(res.tempFilePath || src),
      fail: err => reject(new Error(err.errMsg || '图片压缩失败'))
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
  if (mediaType === 'image' && size > IMAGE_MAX_UPLOAD_SIZE) {
    throw new Error('图片压缩后仍超过 10MB，请换一张更小的图片')
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

function getResponseHeader(headers = {}, key) {
  const target = String(key || '').toLowerCase()
  for (const name in headers || {}) {
    if (String(name).toLowerCase() === target) return headers[name]
  }
  return ''
}

function isApiBaseConfigured(apiBase) {
  if (!apiBase) return false
  return !/YOUR_(TRIAL|RELEASE)_API_DOMAIN/.test(apiBase)
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
