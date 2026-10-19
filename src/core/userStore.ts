import {
  batchGetStorageSync,
  batchSetStorageSync,
  guid,
  niceTry
} from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { isNil } from '@@/utils/glodash';
import { StringObject } from '@@/types/base';
import { IdentitySnapshot, UserStoreType } from '@@/types/userStore';
import EMIT_MSG from '@@/constants/emitMsg';
import { emitSafely } from '@@/utils/safeEmitter';

/**
 * 代码中与3.0测量协议字段对应关系
 * 代码定义    |  3.0测量协议定义  |  字段解释
 * ---------------------------------------------------
 * sessionId  |  sessionId      |  访问会话id
 * uid        |  deviceId       |  访问用户id(持久化)
 * userId     |  userId         |  登录用户id(持久化)
 * gioId      |  gioId          |  上一个非空的登录用户id(持久化)
 */

class UserStore implements UserStoreType {
  // 访问用户id/设备id（系统设置持久性存储）
  public _uid: string;
  // 用户访问会话id
  public _sessionId: StringObject;
  // 登录用户id（客户设置持久性存储）
  public _userId: StringObject;
  // 登录用户key（客户设置持久性存储）
  public _userKey: StringObject;
  // 最后一次登录用户id（持久性存储）
  public _gioId: StringObject;
  // 设置了session有效期以后判断用的session失效时间
  public _sessionExpires: number;
  /** 本次运行首次生成设备 ID 的标记，供内嵌 Web 继承小程序的 AB 首访语义。 */
  public isNewDevice: boolean;
  /** 每个实例设备首次创建时对应的 session，session 更换后不再视为新设备。 */
  public _newDeviceSessionIds: StringObject;
  private identityTransactionDepth = 0;
  private changedIdentities = new Set<string>();
  private deviceIdentityChanged = false;
  private identityRevisions: Record<string, number> = {};
  private identityNotifications: { message: string; payload: any }[] = [];
  constructor(public growingIO: GrowingIOType) {
    this._uid = undefined;
    this._sessionId = {};
    this._userId = {};
    this._userKey = {};
    this._gioId = {};
    this._sessionExpires = -1;
    this.isNewDevice = false;
    this._newDeviceSessionIds = {};
  }

  /** 同步身份写入先完成，再提交一次完整快照，客户回调可以安全地重入身份 API。 */
  runIdentityTransaction = <T>(trackingId: string, callback: () => T): T => {
    this.identityTransactionDepth += 1;
    try {
      return callback();
    } finally {
      this.identityTransactionDepth -= 1;
      if (!this.identityTransactionDepth) this.flushIdentityNotifications();
    }
  };

  getSessionSnapshot = (trackingId: string) => this._sessionId[trackingId];

  getIdentitySnapshot = (trackingId: string): IdentitySnapshot =>
    Object.freeze({
      deviceId: this._uid || '',
      userId: this._userId[trackingId] ?? '',
      userKey: this._userKey[trackingId] ?? '',
      gioId: this._gioId[trackingId] ?? '',
      sessionId: this.getSessionSnapshot(trackingId),
      revision: this.identityRevisions[trackingId] || 0
    });

  private recordIdentityChange = (trackingId?: string) => {
    if (trackingId) this.changedIdentities.add(trackingId);
    else this.deviceIdentityChanged = true;
  };

  private notifyIdentityField = (message: string, payload: any) => {
    this.identityNotifications.push({ message, payload });
  };

  private flushIdentityNotifications = () => {
    const trackingIds = new Set(this.changedIdentities);
    if (this.deviceIdentityChanged) {
      [
        this.growingIO.trackingId,
        ...(this.growingIO.dataStore.initializedTrackingIds || []),
        ...Object.keys(this._sessionId),
        ...Object.keys(this._userId)
      ].forEach((trackingId) => {
        if (trackingId) trackingIds.add(trackingId);
      });
    }
    const fieldNotifications = this.identityNotifications;
    this.changedIdentities.clear();
    this.deviceIdentityChanged = false;
    this.identityNotifications = [];
    const identities = Array.from(trackingIds, (trackingId) => {
      this.identityRevisions[trackingId] =
        (this.identityRevisions[trackingId] || 0) + 1;
      return Object.freeze({
        trackingId,
        identity: this.getIdentitySnapshot(trackingId)
      });
    });
    // 先通知完整身份；兼容字段通知的观察者也只能看到已经提交的内存状态。
    identities.forEach((change) =>
      emitSafely(this.growingIO.emitter, EMIT_MSG.IDENTITY_CHANGED, change)
    );
    fieldNotifications.forEach(({ message, payload }) =>
      emitSafely(this.growingIO.emitter, message, payload)
    );
  };

  /**
   * 获取sessionId存储key
   * @returns {string} - sessionId 存储 key
   */
  _getUidKey = () =>
    this.growingIO.inPlugin ? '_growing_plugin_uid_' : '_growing_uid_';

  /**
   * 获取设备Id
   * @returns {string} - 设备 ID
   */
  getUid = () => {
    const { minipInstance } = this.growingIO;
    // 快应用存储为异步 API。恢复完成前返回空值，避免先生成临时 uid，
    // 首批事件释放时会由 eventRefactor 使用恢复后的稳定身份重新补齐。
    if (
      this.growingIO.gioPlatform === 'quickapp' &&
      minipInstance.identityReady === false
    ) {
      return '';
    }
    // 内存中拿不到尝试从存储中拿
    if (!this._uid) {
      this._uid = minipInstance.getStorageSync(this._getUidKey());
    }
    // 存储中拿不到尝试设新值
    if (!this._uid) {
      this.setUid(guid());
    }
    return this._uid;
  };

  /**
   * 设置设备Id
   * @param {string} id - 设备 ID
   */
  setUid = (id: string) =>
    this.runIdentityTransaction(this.growingIO.trackingId, () => {
      const { minipInstance } = this.growingIO;
      // 显式 identify 也可能是首次创建 UID；同步平台先检查尚未加载的历史值。
      // 快应用恢复前只能暂定首访，之后由真实持久 UID 的恢复结果校正。
      const prevId =
        this._uid ||
        niceTry(() => minipInstance.getStorageSync(this._getUidKey()));
      this._uid = id;
      if (!prevId && id) {
        this.isNewDevice = true;
        // 异步恢复前可能已创建多个实例的 session，均属于当前设备首访。
        Object.keys(this._sessionId).forEach((trackingId) => {
          if (!this._newDeviceSessionIds[trackingId]) {
            this._newDeviceSessionIds[trackingId] = this._sessionId[trackingId];
          }
        });
      }
      if (prevId !== this._uid) {
        niceTry(() => minipInstance.setStorage(this._getUidKey(), this._uid));
        // 广播通知访问用户Id变更
        this.recordIdentityChange();
        this.notifyIdentityField(EMIT_MSG.UID_UPDATE, {
          newUId: id,
          oldUId: prevId
        });
      }
    });

  /** 恢复真正存在的持久 UID，撤销恢复完成前暂定的设备首访状态。 */
  restoreUid = (id: string) =>
    this.runIdentityTransaction(this.growingIO.trackingId, () => {
      const prevId = this._uid;
      this._uid = id;
      this.isNewDevice = false;
      this._newDeviceSessionIds = {};
      // 恢复完成也改变了异步平台的有效身份可见性，即使内存 UID 恰好与持久值相同。
      this.recordIdentityChange();
      if (prevId !== id) {
        this.notifyIdentityField(EMIT_MSG.UID_UPDATE, {
          newUId: id,
          oldUId: prevId
        });
      }
    });

  /**
   * 获取sessionId
   * @param {string} trackingId - 实例 ID
   * @returns {string} - Session ID
   */
  getSessionId = (trackingId: string) => {
    // 设置了session时长，就需要检查session是否过期
    const {
      vdsConfig: { sessionExpires },
      dataStore: { trackersExecute }
    } = this.growingIO;
    // 不存在sessionId（即新进）要设一个新的sessionId
    if (!this._sessionId[trackingId]) {
      this.setSessionId(trackingId);
    }
    // 设置了session时长且过期
    if (sessionExpires > -1) {
      // 只要有一个session超时，所有实例都要重设sessionId
      if (Date.now() > this._sessionExpires) {
        trackersExecute((id: string) => {
          this.setSessionId(id);
        });
      }
      // 每次获取session后要更新过期时间
      this._sessionExpires = Date.now() + 1000 * 60 * sessionExpires;
    }
    return this._sessionId[trackingId];
  };

  /**
   * 设置sessionId
   * @param {string} trackingId - 实例 ID
   * @param {string} [id] - Session ID
   */
  setSessionId = (trackingId: string, id?: string) => {
    const prevId = this._sessionId[trackingId];
    if (!id) {
      id = guid();
    }
    // 小程序中sessionId只需要在内存中存储就可以，不需要持久化存储
    this._sessionId[trackingId] = id;
    if (this.isNewDevice && !this._newDeviceSessionIds[trackingId]) {
      this._newDeviceSessionIds[trackingId] = id;
    }
    // 设置了session时长，就需要更新过期时间
    const { sessionExpires } = this.growingIO.vdsConfig;
    if (sessionExpires > -1) {
      this._sessionExpires = Date.now() + 1000 * 60 * sessionExpires;
    }
    // 广播通知登录sessionId变更
    if (prevId !== id) {
      emitSafely(this.growingIO.emitter, EMIT_MSG.SESSIONID_UPDATE, {
        trackingId,
        newSessionId: id,
        oldSessionId: prevId
      });
    }
  };

  /**
   * 设备初次创建只在其首个 session 内成立。内嵌 Web 必须继承此结果，
   * 不能把同一次 App 运行中后续的新 session 继续标成新设备。
   */
  isNewDeviceInSession = (trackingId: string) => {
    if (!this.isNewDevice) return false;
    const sessionId = this.getSessionId(trackingId);
    return this._newDeviceSessionIds[trackingId] === sessionId;
  };

  /**
   * 获取userId存储key
   * @param {string} trackingId - 实例 ID
   * @returns {string} - userId 存储 key
   */
  _getUserIdKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'userId');

  /**
   * 获取userId
   * @param {string} trackingId - 实例 ID
   * @returns {string} - User ID
   */
  getUserId = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    // 空字符串代表已加载或显式清除；仅未加载时读取存储，避免异步写盘期间恢复旧账号。
    if (isNil(this._userId[trackingId])) {
      this._userId[trackingId] =
        minipInstance.getStorageSync(this._getUserIdKey(trackingId)) ?? '';
    }
    return this._userId[trackingId];
  };

  /**
   * 设置userId
   * @param {string} trackingId - 实例 ID
   * @param {string} id - User ID
   */
  setUserId = (trackingId: string, id: string) =>
    this.runIdentityTransaction(trackingId, () => {
      const prevId = this._userId[trackingId];
      this._userId[trackingId] = isNil(id) ? '' : id;
      if (prevId !== this._userId[trackingId]) {
        niceTry(() =>
          this.growingIO.minipInstance.setStorage(
            this._getUserIdKey(trackingId),
            this._userId[trackingId]
          )
        );
        // 广播通知登录用户Id变更
        this.recordIdentityChange(trackingId);
        this.notifyIdentityField(EMIT_MSG.USERID_UPDATE, {
          trackingId,
          newUserId: id,
          oldUserId: prevId
        });
      }
      if (id) this.setGioId(trackingId, id);
    });

  /**
   * 获取userKey存储key
   * @param {string} trackingId - 实例 ID
   * @returns {string} - userKey 存储 key
   */
  _getUserKeyKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'userKey');

  /**
   * 获取userKey
   * @param {string} trackingId - 实例 ID
   * @returns {string} - User Key
   */
  getUserKey = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    if (isNil(this._userKey[trackingId])) {
      this._userKey[trackingId] =
        minipInstance.getStorageSync(this._getUserKeyKey(trackingId)) ?? '';
    }
    return this._userKey[trackingId];
  };

  /**
   * 设置userKey
   * @param {string} trackingId - 实例 ID
   * @param {string} key - User Key
   */
  setUserKey = (trackingId: string, key: string) =>
    this.runIdentityTransaction(trackingId, () => {
      const prevKey = this._userKey[trackingId];
      this._userKey[trackingId] = isNil(key) ? '' : key;
      if (prevKey !== this._userKey[trackingId]) {
        niceTry(() =>
          this.growingIO.minipInstance.setStorage(
            this._getUserKeyKey(trackingId),
            this._userKey[trackingId]
          )
        );
        // 广播通知登录用户key变更
        this.recordIdentityChange(trackingId);
        this.notifyIdentityField(EMIT_MSG.USERKEY_UPDATE, {
          trackingId,
          newUserKey: key,
          oldUserKey: prevKey
        });
      }
    });

  /**
   * 获取gioId存储key
   * @param {string} trackingId - 实例 ID
   * @returns {string} - gioId 存储 key
   */
  _getGioIdKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'gioId');

  /**
   * 获取gioId
   * @param {string} trackingId - 实例 ID
   * @returns {string} - Gio ID
   */
  getGioId = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    if (isNil(this._gioId[trackingId])) {
      this._gioId[trackingId] =
        minipInstance.getStorageSync(this._getGioIdKey(trackingId)) ?? '';
    }
    return this._gioId[trackingId];
  };

  /**
   * 设置gioId
   * @param {string} trackingId - 实例 ID
   * @param {string} gioId - Gio ID
   */
  setGioId = (trackingId: string, gioId: string) =>
    this.runIdentityTransaction(trackingId, () => {
      const prevId = this._gioId[trackingId];
      this._gioId[trackingId] = isNil(gioId) ? '' : gioId;
      if (prevId !== this._gioId[trackingId]) {
        niceTry(() =>
          this.growingIO.minipInstance.setStorage(
            this._getGioIdKey(trackingId),
            this._gioId[trackingId]
          )
        );
        // 广播通知登录用户Id变更
        this.notifyIdentityField(EMIT_MSG.GIOID_UPDATE, {
          trackingId,
          newGioId: gioId,
          oldGioId: prevId
        });
      }
    });

  /**
   * 初始化用户信息
   * @param {string} trackingId - 实例 ID
   */
  initUserInfo = (trackingId: string) =>
    this.runIdentityTransaction(trackingId, () => {
      const previous = this.getIdentitySnapshot(trackingId);
      const { minipInstance } = this.growingIO;
      const storeKeys = [
        this._getUidKey(),
        this._getUserIdKey(trackingId),
        this._getUserKeyKey(trackingId),
        this._getGioIdKey(trackingId)
      ];
      const memoryKeys = ['_uid', '_userId', '_userKey', '_gioId'];
      // 批量获取的存储数据
      const values = batchGetStorageSync(minipInstance, storeKeys) ?? [];
      // 往存储中重设的key
      memoryKeys.forEach((key: string, index: number) => {
        if (key === '_uid') {
          // 调用一次往内存里存一份
          this.getUid();
        } else {
          // 往内存中赋值
          this[key][trackingId] = values[index] ?? '';
        }
      });
      const current = this.getIdentitySnapshot(trackingId);
      if (
        previous.deviceId !== current.deviceId ||
        previous.userId !== current.userId ||
        previous.userKey !== current.userKey
      )
        this.recordIdentityChange(trackingId);
    });

  /**
   * 退出小程序时在存储中同步用户信息
   */
  saveUserInfo = () => {
    const {
      minipInstance,
      dataStore: { trackersExecute }
    } = this.growingIO;
    trackersExecute((trackingId: string) => {
      batchSetStorageSync(minipInstance, [
        { key: this._getUidKey(), value: this._uid },
        {
          key: this._getUserIdKey(trackingId),
          value: this._userId[trackingId]
        },
        {
          key: this._getUserKeyKey(trackingId),
          value: this._userKey[trackingId]
        },
        { key: this._getGioIdKey(trackingId), value: this._gioId[trackingId] }
      ]);
    });
  };
}

export default UserStore;
