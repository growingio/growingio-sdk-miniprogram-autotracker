import { batchGetStorageSync, batchSetStorageSync, guid } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { isNil } from '@@/utils/glodash';
import { StringObject } from '@@/types/base';
import { UserStoreType } from '@@/types/userStore';
import EMIT_MSG from '@@/constants/emitMsg';

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
  constructor(public growingIO: GrowingIOType) {
    this._uid = undefined;
    this._sessionId = {};
    this._userId = {};
    this._userKey = {};
    this._gioId = {};
  }

  // 获取sessionId存储key
  _getUidKey = () =>
    this.growingIO.inPlugin ? '_growing_plugin_uid_' : '_growing_uid_';

  // 获取设备Id
  getUid = () => {
    const { minipInstance } = this.growingIO;
    // 内存中拿不到尝试从存储中拿
    if (!this._uid) {
      this._uid = minipInstance.getStorageSync(this._getUidKey());
    }
    // 存储中拿不到尝试设新值
    if (!this._uid) {
      this._uid = guid();
      minipInstance.setStorage(this._getUidKey(), this._uid);
    }
    return this._uid;
  };

  // 设置设备Id
  setUid = (id: string) => {
    const prevId = this._uid;
    this._uid = id;
    if (prevId !== this._uid) {
      this.growingIO.minipInstance.setStorage(this._getUidKey(), this._uid);
      // 广播通知访问用户Id变更
      this.growingIO.emitter.emit(EMIT_MSG.UID_UPDATE, {
        newUId: id,
        oldUId: prevId
      });
    }
  };

  // 获取sessionId
  getSessionId = (trackingId: string) => {
    if (!this._sessionId[trackingId]) {
      this.setSessionId(trackingId);
    }
    return this._sessionId[trackingId];
  };

  // 设置sessionId
  setSessionId = (trackingId: string, id?: string) => {
    const prevId = this._sessionId[trackingId];
    if (!id) {
      id = guid();
    }
    // 小程序中sessionId只需要在内存中存储就可以，不需要持久化存储
    this._sessionId[trackingId] = id;
    // 广播通知登录sessionId变更
    if (prevId !== id) {
      this.growingIO.emitter.emit(EMIT_MSG.SESSIONID_UPDATE, {
        newSessionId: id,
        oldSessionId: prevId
      });
    }
  };

  // 获取userId存储key
  _getUserIdKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'userId');

  // 获取userId
  getUserId = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    // 内存中拿不到尝试从存储中拿
    if (!this._userId[trackingId]) {
      this._userId[trackingId] = minipInstance.getStorageSync(
        this._getUserIdKey(trackingId)
      );
    }
    return this._userId[trackingId];
  };

  // 设置userId
  setUserId = (trackingId: string, id: string) => {
    const prevId = this._userId[trackingId];
    this._userId[trackingId] = isNil(id) ? '' : id;
    if (prevId !== this._userId[trackingId]) {
      this.growingIO.minipInstance.setStorage(
        this._getUserIdKey(trackingId),
        this._userId[trackingId]
      );
      // 广播通知登录用户Id变更
      this.growingIO.emitter.emit(EMIT_MSG.USERID_UPDATE, {
        newUserId: id,
        oldUserId: prevId
      });
    }
    if (id) this.setGioId(trackingId, id);
  };

  // 获取userKey存储key
  _getUserKeyKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'userKey');

  // 获取userKey
  getUserKey = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    // 内存中拿不到尝试从存储中拿
    if (!this._userKey[trackingId]) {
      this._userKey[trackingId] = minipInstance.getStorageSync(
        this._getUserKeyKey(trackingId)
      );
    }
    return this._userKey[trackingId];
  };

  // 设置userKey
  setUserKey = (trackingId: string, key: string) => {
    const prevKey = this._userKey[trackingId];
    this._userKey[trackingId] = isNil(key) ? '' : key;
    if (prevKey !== this._userKey[trackingId]) {
      this.growingIO.minipInstance.setStorage(
        this._getUserKeyKey(trackingId),
        this._userKey[trackingId]
      );
      // 广播通知登录用户key变更
      this.growingIO.emitter.emit(EMIT_MSG.USERKEY_UPDATE, {
        newUserKey: key,
        oldUserKey: prevKey
      });
    }
  };

  // 获取gioId存储key
  _getGioIdKey = (trackingId: string) =>
    this.growingIO.dataStore.getStorageKey(trackingId, 'gioId');

  // 获取gioId
  getGioId = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    // 内存中拿不到尝试从存储中拿
    if (!this._gioId[trackingId]) {
      this._gioId[trackingId] = minipInstance.getStorageSync(
        this._getGioIdKey(trackingId)
      );
    }
    return this._gioId[trackingId];
  };

  // 设置gioId
  setGioId = (trackingId: string, gioId: string) => {
    const prevId = this._gioId[trackingId];
    this._gioId[trackingId] = isNil(gioId) ? '' : gioId;
    if (prevId !== this._gioId[trackingId]) {
      this.growingIO.minipInstance.setStorage(
        this._getGioIdKey(trackingId),
        this._gioId[trackingId]
      );
      // 广播通知登录用户Id变更
      this.growingIO.emitter.emit(EMIT_MSG.GIOID_UPDATE, {
        newGioId: gioId,
        oldGioId: prevId
      });
    }
  };

  // 初始化用户信息
  initUserInfo = (trackingId: string) => {
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
        this[key][trackingId] = values[index];
      }
    });
  };

  // 退出小程序时在存储中同步用户信息
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
