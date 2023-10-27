import { GrowingIOType } from '@@/types/growingIO';
import { UserStoreType } from '@@/types/userStore';
import { batchGetStorageSync, batchSetStorageSync, guid } from '@@/utils/tools';

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
  // 访问用户id在存储中的名称
  public uidStorageName: string;
  // 登录用户id在存储中的名称
  public userIdStorageName: string;
  // 登录用户key在存储中的名称
  public userKeyStorageName: string;
  // 最后一次登录用户id在存储中的名称
  public gioIdStorageName: string;
  // 用户访问会话id
  public _sessionId: string;
  // 访问用户id（系统设置持久性存储）
  public _uid: string;
  // 登录用户id（客户设置持久性存储）
  public _userId: string;
  // 登录用户key（客户设置持久性存储）
  public _userKey: string;
  // 最后一次登录用户id（持久性存储）
  public _gioId: string;
  constructor(public growingIO: GrowingIOType) {
    const { inPlugin } = this.growingIO;
    this.uidStorageName = inPlugin ? '_growing_plugin_uid_' : '_growing_uid_';
    this.userIdStorageName = inPlugin
      ? '_growing_plugin_userId_'
      : '_growing_userId_';
    this.userKeyStorageName = inPlugin
      ? '_growing_plugin_userKey_'
      : '_growing_userKey_';
    this.gioIdStorageName = inPlugin
      ? '_growing_plugin_gioId_'
      : '_growing_gioId_';
    this._sessionId = guid();
    this._uid = undefined;
    this._userId = undefined;
    this._userKey = undefined;
    this._gioId = undefined;
    if (this.growingIO?.gioPlatform !== 'quickapp') {
      this.initUserInfo();
    }
  }

  // @ts-ignore
  get sessionId() {
    if (!this._sessionId) {
      this._sessionId = guid();
    }
    return this._sessionId;
  }

  // @ts-ignore
  set sessionId(id: string) {
    const prevId = this._sessionId;
    if (!id) {
      this._sessionId = guid();
    } else {
      this._sessionId = id;
    }
    // 广播通知登录sessionId变更
    if (prevId !== this._sessionId) {
      this.growingIO.emitter.emit('SESSIONID_UPDATE', {
        newSessionId: this._sessionId,
        oldSessionId: prevId
      });
    }
  }

  // @ts-ignore
  get uid() {
    return this._uid;
  }

  // @ts-ignore
  set uid(id: string) {
    const prevId = this._uid;
    this._uid = id;
    if (prevId !== this._uid) {
      this.growingIO.minipInstance.setStorage(this.uidStorageName, this._uid);
      // 广播通知访问用户Id变更
      this.growingIO.emitter.emit('UID_UPDATE', {
        newUId: id,
        oldUId: prevId
      });
    }
  }

  // @ts-ignore
  get userId() {
    return this._userId;
  }

  // @ts-ignore
  set userId(id: string) {
    const prevId = this._userId;
    this._userId = id;
    if (prevId !== this._userId) {
      this.growingIO.minipInstance.setStorage(
        this.userIdStorageName,
        this._userId
      );
      // 广播通知登录用户Id变更
      this.growingIO.emitter.emit('USERID_UPDATE', {
        newUserId: id,
        oldUserId: prevId
      });
    }
    if (id) this.gioId = id;
  }

  // @ts-ignore
  get userKey() {
    return this._userKey;
  }

  // @ts-ignore
  set userKey(key: string) {
    const prevKey = this._userKey;
    this._userKey = key;
    if (prevKey !== this._userKey) {
      this.growingIO.minipInstance.setStorage(
        this.userKeyStorageName,
        this._userKey
      );
      // 广播通知登录用户key变更
      this.growingIO.emitter.emit('USERKEY_UPDATE', {
        newUserKey: key,
        oldUserKey: prevKey
      });
    }
  }

  // @ts-ignore
  get gioId() {
    return this._gioId;
  }

  // @ts-ignore
  set gioId(gioId: string) {
    const prevId = this._gioId;
    this._gioId = gioId;
    if (prevId !== this._gioId) {
      this.growingIO.minipInstance.setStorage(
        this.gioIdStorageName,
        this._gioId
      );
      // 广播通知登录用户Id变更
      this.growingIO.emitter.emit('GIOID_UPDATE', {
        newGioId: gioId,
        oldGioId: prevId
      });
    }
  }

  // 初始化用户信息
  initUserInfo = () => {
    const { minipInstance } = this.growingIO;
    const storeKeys = [
      this.uidStorageName,
      this.userIdStorageName,
      this.userKeyStorageName,
      this.gioIdStorageName
    ];
    const memoryKeys = ['_uid', '_userId', '_userKey', '_gioId'];
    // 批量获取的存储数据
    const values = batchGetStorageSync(minipInstance, storeKeys) ?? [];
    // 往存储中重设的key
    memoryKeys.forEach((key: string, index: number) => {
      // 往内存中赋值
      this[key] = values[index];
      // 如果uid没有值，则自动生成并赋值（这种情况是用户第一次进或者清了缓存）
      if (key === '_uid' && !this[key]) {
        // this.uid会自动给内存和存储都赋值
        this.uid = guid();
      }
    });
  };

  // 退出小程序时在存储中同步用户信息
  saveUserInfo = () => {
    const { minipInstance } = this.growingIO;
    batchSetStorageSync(minipInstance, [
      { key: this.uidStorageName, value: this.uid },
      { key: this.userIdStorageName, value: this.userId },
      { key: this.userKeyStorageName, value: this.userKey },
      { key: this.gioIdStorageName, value: this.gioId }
    ]);
  };
}

export default UserStore;
