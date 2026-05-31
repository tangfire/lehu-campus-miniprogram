const { getApiBase, getEnvVersion } = require('./utils/config')
const { initSession } = require('./utils/session')

App({
  globalData: {
    apiBase: getApiBase(),
    envVersion: getEnvVersion()
  },

  onLaunch() {
    initSession()
  }
})
