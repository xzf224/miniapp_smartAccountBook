const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const MAX_CONTENT_LENGTH = 500
const MAX_CONTACT_LENGTH = 60
const VALID_TYPES = new Set(['功能建议', '体验问题', 'Bug 反馈', '其他'])

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

exports.main = async (event) => {
  const type = VALID_TYPES.has(event?.type) ? event.type : '其他'
  const content = normalizeText(event?.content, MAX_CONTENT_LENGTH)
  const contact = normalizeText(event?.contact, MAX_CONTACT_LENGTH)
  const appVersion = normalizeText(event?.appVersion, 30)
  const clientInfo = typeof event?.clientInfo === 'object' && event.clientInfo ? {
    brand: normalizeText(event.clientInfo.brand, 40),
    model: normalizeText(event.clientInfo.model, 80),
    system: normalizeText(event.clientInfo.system, 40),
    platform: normalizeText(event.clientInfo.platform, 20),
    language: normalizeText(event.clientInfo.language, 20),
    SDKVersion: normalizeText(event.clientInfo.SDKVersion, 20),
    version: normalizeText(event.clientInfo.version, 40),
  } : {}

  if (content.length < 5) {
    return {
      success: false,
      error: '反馈内容太短',
    }
  }

  try {
    const context = cloud.getWXContext()
    const result = await db.collection('feedback_records').add({
      data: {
        type,
        content,
        contact,
        appVersion,
        clientInfo,
        openid: context.OPENID || '',
        appid: context.APPID || '',
        unionid: context.UNIONID || '',
        source: 'miniprogram',
        status: 'new',
        createdAt: db.serverDate(),
        createdAtTs: Date.now(),
      },
    })

    return {
      success: true,
      id: result._id,
    }
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : '数据库写入失败',
    }
  }
}
