export interface UserStoreType {
  // 获取设备Id
  getUid: () => string;
  // 设置设备Id
  setUid: (id: string) => void;
  // 获取sessionId
  getSessionId: (trackingId: string) => string;
  // 设置sessionId
  setSessionId: (trackingId: string, id?: string) => void;
  // 获取userId
  getUserId: (trackingId: string) => string;
  // 设置userId
  setUserId: (trackingId: string, id?: string) => void;
  // 获取userKey
  getUserKey: (trackingId: string) => string;
  // 设置userKey
  setUserKey: (trackingId: string, key?: string) => void;
  // 获取gioId
  getGioId: (trackingId: string) => string;
  // 设置gioId
  setGioId: (trackingId: string, id?: string) => void;
  // 初始化用户信息
  initUserInfo: (trackingId: string) => void;
  // 退出小程序时在存储中同步用户信息
  saveUserInfo: () => void;
}
