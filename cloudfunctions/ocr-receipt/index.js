const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// OCR 专用密钥（百度文字识别应用）
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
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    const urlObj = new URL(url)
    const isFormData = typeof body === 'string'
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': isFormData ? 'application/x-www-form-urlencoded' : 'application/json',
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
  const { fileID } = event
  if (!fileID) {
    return { success: false, error: 'Missing fileID' }
  }

  // 1. 从云存储下载图片并转 base64
  let base64Image
  try {
    const downloadResult = await cloud.downloadFile({ fileID })
    base64Image = downloadResult.fileContent.toString('base64')
  } catch (err) {
    return { success: false, error: 'Download failed: ' + String(err) }
  }

  // 2. 获取百度 access_token
  let tokenData
  try {
    tokenData = await httpsGet(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
    )
  } catch (e) {
    return { success: false, error: 'Token request failed: ' + String(e) }
  }
  if (!tokenData || !tokenData.access_token) {
    return { success: false, error: 'No access_token', detail: tokenData }
  }

  // 3. 调用百度通用文字识别（高精度版）
  const body = `image=${encodeURIComponent(base64Image)}&detect_direction=true&paragraph=false&probability=false`
  let ocrData
  try {
    ocrData = await httpsPost(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${tokenData.access_token}`,
      body
    )
  } catch (e) {
    return { success: false, error: 'OCR request failed: ' + String(e) }
  }

  if (ocrData.error_code) {
    return { success: false, error: ocrData.error_msg || String(ocrData.error_code) }
  }

  const words = (ocrData.words_result || []).map((w) => w.words)
  return {
    success: true,
    text: words.join('\n'),
    items: words,
  }
}
