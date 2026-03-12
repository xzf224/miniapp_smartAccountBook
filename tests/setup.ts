/**
 * 全局 wx 模拟对象，供所有测试文件使用。
 * setupFiles 在 jest 测试框架安装之前运行，此处使用普通函数而非 jest.fn()。
 * 需要追踪调用次数的场景，请在各测试文件中用 jest.mock() 覆盖对应模块。
 */

const store: Record<string, unknown> = {};

(global as any).wx = {
  // Storage
  getStorageSync: (key: string) => store[key],
  setStorageSync: (key: string, val: unknown) => { store[key] = val },
  removeStorageSync: (key: string) => { delete store[key] },

  // System
  getSystemInfoSync: () => ({ platform: 'devtools', SDKVersion: '3.0.0' }),

  // FileSystem
  env: { USER_DATA_PATH: '/mock/user/data' },
  getFileSystemManager: () => ({
    readFileSync: () => '',
    writeFileSync: () => undefined,
    readdirSync: () => [] as string[],
    unlinkSync: () => undefined,
  }),

  // Cloud
  cloud: {
    init: () => undefined,
    callFunction: () => Promise.resolve({ result: {} }),
    uploadFile: () => Promise.resolve({ fileID: 'mock_file_id' }),
  },

  // UI
  request: () => undefined,
  showToast: () => undefined,
  showModal: () => undefined,
  navigateTo: () => undefined,
  navigateBack: () => undefined,
  showLoading: () => undefined,
  hideLoading: () => undefined,
}
