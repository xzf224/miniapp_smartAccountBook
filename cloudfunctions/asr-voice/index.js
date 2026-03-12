const https = require('https')

// 密钥通过云函数环境变量注入，不硬编码在源码中
// 配置路径：云开发控制台 → 云函数 → asr-voice → 函数配置 → 环境变量
const BAIDU_API_KEY = process.env.BAIDU_API_KEY
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

exports.main = async (event) => {
  const { base64Audio, audioLen } = event
  if (!base64Audio || !audioLen) {
    return { success: false, error: 'Missing base64Audio or audioLen' }
  }

  // 1. 获取百度 access_token
  let tokenData
  try {
    tokenData = await httpsGet(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
    )
  } catch (e) {
    return { success: false, error: 'Token request failed: ' + String(e) }
  }

  if (!tokenData || !tokenData.access_token) {
    return { success: false, error: 'No access_token in response', detail: tokenData }
  }

  // 2. 调用百度语音识别
  let asrData
  try {
    asrData = await httpsPost('https://vop.baidu.com/server_api', {
      format: 'pcm',
      rate: 16000,
      channel: 1,
      cuid: 'wxmini_cloud',
      token: tokenData.access_token,
      speech: base64Audio,
      len: audioLen,
      dev_pid: 1537,
    })
  } catch (e) {
    return { success: false, error: 'ASR request failed: ' + String(e) }
  }

  if (asrData.err_no === 0) {
    return { success: true, text: (asrData.result && asrData.result[0]) || '' }
  } else {
    return { success: false, error: asrData.err_msg || String(asrData.err_no), err_no: asrData.err_no }
  }
}
