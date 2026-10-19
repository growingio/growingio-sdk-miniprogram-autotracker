import { isObject } from '@@/utils/glodash';
import { niceTry } from '@@/utils/tools';
import { ABTEST_DATA_REG, ABTEST_SIGN_REG } from '@@/constants/regex';
import { ABRequestSnapshot } from './request';

export const getNextDayStart = () => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  ).getTime();
};

const ABTEST_MANIFEST_KEY = 'gdp_abt_v2_manifest';
const ABTEST_V2_SLOT_REG = /^gdp_abt_v2_[a-f0-9]{40}_(sign|data)$/;

/** V2 缓存索引：每个 signKey 对应同一身份槽的数据键与节流截止时间。 */
interface ABStorageManifest {
  version: 2;
  slots: {
    [signKey: string]: {
      dataKey: string;
      expiresAt: number;
    };
  };
}

/** AB 缓存的唯一所有者：节流、每日实验对照、索引与持久化故障恢复。 */
export class ABCacheStore {
  private failedStorageOrigins: {
    [dataKey: string]: { signature: string; expiresAt: number };
  } = {};

  constructor(
    private getStorage: () => any,
    private getRequestInterval: () => number
  ) {}

  read = (context: ABRequestSnapshot) => {
    this.pruneFailedStorageOrigins();
    const failedOrigin = this.failedStorageOrigins[context.dataKey];
    const abtSign = this.getABStorageItem(context.signKey) || 0;
    const storedExpData = this.getABStorageItem(context.dataKey);
    const slot = this.getManifest().slots[context.signKey];
    const hasStoredExpData = isObject(storedExpData);
    const hit =
      !!abtSign &&
      abtSign >= Date.now() &&
      slot?.dataKey === context.dataKey &&
      hasStoredExpData &&
      (!failedOrigin ||
        (slot.expiresAt === abtSign &&
          this.getExperimentStorageSignature(storedExpData) ===
            failedOrigin.signature));
    const originData = failedOrigin
      ? JSON.parse(failedOrigin.signature)
      : hasStoredExpData
      ? storedExpData
      : {};
    if (!hasStoredExpData) this.removeRequestSlot(context);
    if (hit) delete this.failedStorageOrigins[context.dataKey];
    return {
      hit,
      result: storedExpData,
      originData,
      originDataExpiresAt: failedOrigin?.expiresAt ?? getNextDayStart()
    };
  };

  commit = (context: ABRequestSnapshot, expData: any) => {
    const dataExpiresAt = getNextDayStart();
    this.setABStorageItem(context.dataKey, expData, dataExpiresAt);
    if (this.saveRequestSlot(context, expData)) {
      delete this.failedStorageOrigins[context.dataKey];
    } else {
      const signature = this.getExperimentStorageSignature(expData);
      if (signature)
        this.failedStorageOrigins[context.dataKey] = {
          signature,
          expiresAt: dataExpiresAt
        };
    }
  };

  /**
   * 清理 V2 manifest 指向的过期或半写入槽位；可枚举时也回收无索引槽和 V1 遗留键。
   * 不能枚举时依赖 manifest 与写入失败回滚，遗留 V1 键不会参与任何命中。
   */
  prune = () => {
    const minipInstance = this.getStorage();
    const now = Date.now();
    this.pruneFailedStorageOrigins(now);
    const manifest = this.getManifest();
    this.pruneManifest(manifest, now);
    this.setManifest(manifest);

    // 能枚举时顺带清除 V1 遗留键；不能枚举的平台虽然无法删除遗留键，
    // 但 V2 从不读取它们，因此不会再把前一账号的结果当作匿名缓存复用。
    const storageInfo =
      niceTry(() => minipInstance.minip?.getStorageInfoSync?.()) || {};
    const storageKeys = Array.isArray(storageInfo.keys) ? storageInfo.keys : [];
    const abtsKeys = storageKeys.filter((k) => ABTEST_SIGN_REG.test(k));
    const abtdKeys = storageKeys.filter((k) => ABTEST_DATA_REG.test(k));
    [...abtsKeys, ...abtdKeys].forEach((key) => this.removeABStorageItem(key));
    storageKeys
      .filter((key) => ABTEST_V2_SLOT_REG.test(key))
      .forEach((key) => {
        const prefix = key.replace(/_(sign|data)$/, '');
        const signKey = `${prefix}_sign`;
        const dataKey = `${prefix}_data`;
        // 只有严格属于 SDK V2 命名空间且未被有效索引登记的槽才回收。
        // 已登记的当日 data 即使 sign 到期仍需保留，用于下一次刷新去重。
        if (manifest.slots[signKey]?.dataKey !== dataKey) {
          this.removeABStorageItem(signKey);
          this.removeABStorageItem(dataKey);
        }
      });
  };

  /**
   * V2 AB 缓存不依赖小程序全局存储枚举。manifest 只保存摘要键与过期时间，
   * 不保存账号、userKey 或 deviceId 明文。
   */
  private getManifest = (): ABStorageManifest => {
    const value = this.getABStorageItem(ABTEST_MANIFEST_KEY);
    if (value?.version === 2 && isObject(value.slots)) {
      // 不原地修改读出的索引，避免存储适配层按引用返回时掩盖后续写入失败。
      return { version: 2, slots: { ...value.slots } };
    }
    return { version: 2, slots: {} };
  };

  /** 整体覆写 manifest，使删除过期槽与新增槽在同一份索引中完成。 */
  private setManifest = (manifest: ABStorageManifest) =>
    this.setABStorageItem(ABTEST_MANIFEST_KEY, manifest);

  /** 存储 API 异常返回 undefined，由调用方作为缓存未命中处理。 */
  private getABStorageItem = (key: string) =>
    niceTry(() => this.getStorage().getStorageSync(key));

  /** 写入失败不向上抛出，后续读取会因缺少成对缓存而重新分流。 */
  private setABStorageItem = (key: string, value: any, end?: number) =>
    niceTry(() => this.getStorage().setStorageSync(key, value, end));

  /** 仅删除明确属于 AB 缓存的键，避免清理过程影响业务方存储。 */
  private removeABStorageItem = (key?: string) => {
    if (key) niceTry(() => this.getStorage().removeStorageSync(key));
  };

  /** 回收所有过期身份的失败对照，避免长期运行时保留不再访问的旧账号槽。 */
  private pruneFailedStorageOrigins = (now = Date.now()) => {
    Object.keys(this.failedStorageOrigins).forEach((dataKey) => {
      if (this.failedStorageOrigins[dataKey].expiresAt <= now) {
        delete this.failedStorageOrigins[dataKey];
      }
    });
  };

  /**
   * 实验数据与请求间隔有不同的有效期：数据按自然日失效，
   * sign 只负责短时间节流。sign 过期时仅删除 sign，保留当日数据供刷新结果去重。
   */
  private pruneManifest = (manifest: ABStorageManifest, now = Date.now()) => {
    Object.keys(manifest.slots).forEach((signKey) => {
      const slot = manifest.slots[signKey];
      if (!slot?.dataKey) {
        this.removeABStorageItem(signKey);
        delete manifest.slots[signKey];
        return;
      }
      const sign = this.getABStorageItem(signKey);
      const data = this.getABStorageItem(slot.dataKey);
      // data 读取为空表示自然日已过期、存储损坏或半写入，
      // 这时才删除整组槽位。
      if (!isObject(data)) {
        this.removeABStorageItem(signKey);
        this.removeABStorageItem(slot.dataKey);
        delete manifest.slots[signKey];
        return;
      }
      // requestInterval 到期只允许重新请求，不应删除仍在当日有效的实验结果。
      if (!sign || sign < now || slot.expiresAt < now) {
        this.removeABStorageItem(signKey);
      }
    });
  };

  /**
   * 将本次协议响应的节流时间与 dataKey 登记为同一槽位。写入新槽前先清理过期项，
   * 让长时间运行期间的账号切换不会使 manifest 持续累积。
   */
  private saveRequestSlot = (context: ABRequestSnapshot, expectedData: any) => {
    const manifest = this.getManifest();
    // 旧槽位的 expiresAt 可能已过期。先把当前槽位从清理集合排除，
    // 否则 pruneManifest 会删掉 experimentVerify 刚写入的 data。
    delete manifest.slots[context.signKey];
    this.pruneManifest(manifest);
    // 不能只判断“读到了对象”：写入失败时还可能读到上一份旧实验。
    // 只有回读内容与本次响应一致时，才能建立 sign/manifest。
    const expectedSignature = this.getExperimentStorageSignature(expectedData);
    const storedSignature = this.getExperimentStorageSignature(
      this.getABStorageItem(context.dataKey)
    );
    if (!expectedSignature || storedSignature !== expectedSignature) {
      this.removeABStorageItem(context.signKey);
      this.removeABStorageItem(context.dataKey);
      this.setManifest(manifest);
      return false;
    }
    const expiresAt = Date.now() + 1000 * 60 * this.getRequestInterval();
    this.setABStorageItem(context.signKey, expiresAt);
    manifest.slots[context.signKey] = {
      dataKey: context.dataKey,
      expiresAt
    };
    this.setManifest(manifest);
    const storedSlot = this.getManifest().slots[context.signKey];
    if (
      this.getABStorageItem(context.signKey) !== expiresAt ||
      storedSlot?.dataKey !== context.dataKey ||
      storedSlot?.expiresAt !== expiresAt
    ) {
      // 平台可能吞掉写入错误；必须回读确认整组缓存可寻址，否则立即回滚。
      this.removeABStorageItem(context.signKey);
      this.removeABStorageItem(context.dataKey);
      delete manifest.slots[context.signKey];
      this.setManifest(manifest);
      return false;
    }
    return true;
  };

  /** 固定顶层字段顺序，用于校验本次实验结果是否真正落盘。 */
  private getExperimentStorageSignature = (data: any) => {
    if (!isObject(data)) return '';
    return (
      niceTry(() =>
        JSON.stringify({
          layerId: data.layerId,
          strategyId: data.strategyId,
          experimentId: data.experimentId,
          variables: data.variables,
          layerName: data.layerName,
          strategyName: data.strategyName,
          experimentName: data.experimentName
        })
      ) || ''
    );
  };

  /**
   * 数据自身已过自然日或无法读取时，按 iOS 的跨日语义删除整组落盘记录。
   * 不能只删 data：残留的 sign/manifest 会把空值误判为可命中缓存。
   */
  private removeRequestSlot = (context: ABRequestSnapshot) => {
    this.removeABStorageItem(context.signKey);
    this.removeABStorageItem(context.dataKey);
    const manifest = this.getManifest();
    delete manifest.slots[context.signKey];
    this.setManifest(manifest);
  };
}
