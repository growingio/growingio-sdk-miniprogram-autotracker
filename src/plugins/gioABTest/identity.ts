import EMIT_MSG from '@@/constants/emitMsg';
import { isString, keys } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { IdentitySnapshot } from '@@/types/userStore';

export interface ABIdentityChange {
  trackingId?: string;
  identity?: IdentitySnapshot;
  /** 仅旧核心逐字段通知需要等待公开身份方法写完。 */
  legacy?: boolean;
}

/** 构造时选择核心能力；当前核心不运行旧首访或逐字段通知状态机。 */
export const createABIdentityProvider = (
  sdk: GrowingIOType,
  abServerUrl: any
) => {
  const { userStore, emitter } = sdk;
  let getNewDevice: (trackingId: string) => boolean;
  let ensureTracker: (trackingId: string) => void = () => undefined;
  if (typeof userStore.isNewDeviceInSession === 'function') {
    getNewDevice = (trackingId) => userStore.isNewDeviceInSession(trackingId);
  } else {
    let newDevice = false;
    const firstSessions: Record<string, string> = {};
    ensureTracker = (trackingId) => {
      if (newDevice && !firstSessions[trackingId]) {
        firstSessions[trackingId] = userStore.getSessionId(trackingId);
      }
    };
    emitter.on(EMIT_MSG.UID_UPDATE, ({ newUId, oldUId }) => {
      if (!oldUId && newUId) {
        newDevice = true;
        const trackingIds = isString(abServerUrl)
          ? [sdk.trackingId]
          : keys(abServerUrl);
        trackingIds.forEach(ensureTracker);
      }
    });
    getNewDevice = (trackingId) =>
      firstSessions[trackingId] === userStore.getSessionId(trackingId);
  }
  const subscribe =
    typeof userStore.runIdentityTransaction === 'function'
      ? (onChange: (change: ABIdentityChange) => void) =>
          emitter.on(EMIT_MSG.IDENTITY_CHANGED, onChange)
      : (onChange: (change: ABIdentityChange) => void) => {
          [
            EMIT_MSG.USERID_UPDATE,
            EMIT_MSG.USERKEY_UPDATE,
            EMIT_MSG.UID_UPDATE
          ].forEach((message) =>
            emitter.on(message, (payload: any = {}) =>
              onChange({ trackingId: payload.trackingId, legacy: true })
            )
          );
        };
  return { getNewDevice, ensureTracker, subscribe };
};
