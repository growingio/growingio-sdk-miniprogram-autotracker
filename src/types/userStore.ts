/**
 * 用户存储类型接口
 * @interface UserStoreType
 */
export interface UserStoreType {
  /**
   * 获取设备 Id
   * @returns {string} 设备 ID
   */
  getUid: () => string;
  /**
   * 设置设备 Id
   * @param {string} id 设备 ID
   */
  setUid: (id: string) => void;
  /**
   * 获取 sessionId
   * @param {string} trackingId 跟踪器 ID
   * @returns {string} Session ID
   */
  getSessionId: (trackingId: string) => string;
  /**
   * 设置 sessionId
   * @param {string} trackingId 跟踪器 ID
   * @param {string} [id] Session ID
   */
  setSessionId: (trackingId: string, id?: string) => void;
  /** session 超时时刻 */
  _sessionExpires: number;
  /**
   * 获取 userId
   * @param {string} trackingId 跟踪器 ID
   * @returns {string} 用户 ID
   */
  getUserId: (trackingId: string) => string;
  /**
   * 设置 userId
   * @param {string} trackingId 跟踪器 ID
   * @param {string} [id] 用户 ID
   */
  setUserId: (trackingId: string, id?: string) => void;
  /**
   * 获取 userKey
   * @param {string} trackingId 跟踪器 ID
   * @returns {string} 用户 Key
   */
  getUserKey: (trackingId: string) => string;
  /**
   * 设置 userKey
   * @param {string} trackingId 跟踪器 ID
   * @param {string} [key] 用户 Key
   */
  setUserKey: (trackingId: string, key?: string) => void;
  /**
   * 获取 gioId
   * @param {string} trackingId 跟踪器 ID
   * @returns {string} GrowingIO ID
   */
  getGioId: (trackingId: string) => string;
  /**
   * 设置 gioId
   * @param {string} trackingId 跟踪器 ID
   * @param {string} [id] GrowingIO ID
   */
  setGioId: (trackingId: string, id?: string) => void;
  /**
   * 初始化用户信息
   * @param {string} trackingId 跟踪器 ID
   */
  initUserInfo: (trackingId: string) => void;
  /**
   * 退出小程序时在存储中同步用户信息
   */
  saveUserInfo: () => void;
}
