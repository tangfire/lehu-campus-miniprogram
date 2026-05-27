const apiBaseMap = {
  develop: 'http://localhost:18080/v1',
  trial: 'https://api.example.com/v1',
  release: 'https://api.example.com/v1'
}

function getEnvVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'develop'
  } catch (err) {
    return 'develop'
  }
}

function getApiBase() {
  const envVersion = getEnvVersion()
  return apiBaseMap[envVersion] || apiBaseMap.develop
}

module.exports = {
  getEnvVersion,
  getApiBase,
  apiBaseMap
}
