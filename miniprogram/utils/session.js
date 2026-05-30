let state = {
  token: '',
  user: null,
  profile: null
}
let initialized = false
const listeners = []

function initSession() {
  state = readSessionFromStorage()
  initialized = true
  syncAppGlobal()
  return getSession()
}

function getSession() {
  if (!initialized) initSession()
  return {
    token: state.token,
    user: state.user,
    profile: state.profile
  }
}

function hasToken() {
  return Boolean(getSession().token)
}

function setSession(next = {}) {
  const merged = {
    token: next.token != null ? String(next.token || '') : state.token,
    user: next.user !== undefined ? next.user || null : state.user,
    profile: next.profile !== undefined ? next.profile || null : state.profile
  }
  state = merged
  initialized = true
  writeSessionToStorage(state)
  syncAppGlobal()
  notify()
  return getSession()
}

function patchUser(user) {
  return setSession({ user: user || null })
}

function patchProfile(profile) {
  return setSession({ profile: profile || null })
}

function clearSession() {
  state = { token: '', user: null, profile: null }
  initialized = true
  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
  wx.removeStorageSync('profile')
  syncAppGlobal()
  notify()
  return getSession()
}

function subscribeSession(listener) {
  if (typeof listener !== 'function') return function noop() {}
  listeners.push(listener)
  listener(getSession())
  return function unsubscribe() {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

function readSessionFromStorage() {
  return {
    token: wx.getStorageSync('token') || '',
    user: wx.getStorageSync('user') || null,
    profile: wx.getStorageSync('profile') || null
  }
}

function writeSessionToStorage(session) {
  if (session.token) wx.setStorageSync('token', session.token)
  else wx.removeStorageSync('token')
  if (session.user) wx.setStorageSync('user', session.user)
  else wx.removeStorageSync('user')
  if (session.profile) wx.setStorageSync('profile', session.profile)
  else wx.removeStorageSync('profile')
}

function syncAppGlobal() {
  try {
    const app = getApp()
    if (!app || !app.globalData) return
    app.globalData.token = state.token
    app.globalData.user = state.user
    app.globalData.profile = state.profile
  } catch (err) {
    // App 尚未初始化时会进入这里，等 onLaunch 再同步即可。
  }
}

function notify() {
  const snapshot = getSession()
  listeners.slice().forEach(listener => {
    try {
      listener(snapshot)
    } catch (err) {
      console.warn('[session listener failed]', err)
    }
  })
}

module.exports = {
  initSession,
  getSession,
  hasToken,
  setSession,
  patchUser,
  patchProfile,
  clearSession,
  subscribeSession
}
