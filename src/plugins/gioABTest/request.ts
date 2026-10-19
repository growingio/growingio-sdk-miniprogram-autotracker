/**
 * AB 分流请求的协议编解码与缓存命名空间。
 *
 * 保持 ES5 可运行：不能依赖 TextEncoder、btoa、Web Crypto 或 URL 等浏览器 API。
 * 这不是通用存储加密；它只服务于 AB 服务端以 URL query 中 stm 还原身份字段。
 */
export interface ABIdentitySnapshot {
  /** 请求开始时读取的登录用户 ID；空字符串表示匿名身份。 */
  readonly userId: string;
  /** 仅当当前实例启用 idMapping 时读取的用户键。 */
  readonly userKey: string;
}

/** 不可变的请求输入；重试计数、取消和原生任务由逻辑 job/attempt 持有。 */
export interface ABRequestSnapshot {
  /** 整个逻辑请求生命周期内不变的实例、层级和服务配置。 */
  readonly trackingId: string;
  readonly layerId: string | number;
  readonly projectId: string;
  readonly dataSourceId: string;
  /** 保持既有 distinctId 语义的设备标识，不单独承担身份隔离。 */
  readonly deviceId: string;
  /** 首访 session 判定结果；重试时不重新读取 session。 */
  readonly newDevice: boolean;
  /** 未追加本次 stm 的分流地址。 */
  readonly url: string;
  /** 请求开始时冻结的身份，重试和响应回写共用该快照。 */
  readonly identity: ABIdentitySnapshot;
  /** 同一身份分区下的请求节流标记与实验结果键。 */
  readonly signKey: string;
  readonly dataKey: string;
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** 按十进制字符串逐位取模，避免未来超过 Number 安全范围时低 8 位错误。 */
export const getStmLowByte = (stm: string | number): number => {
  const value = String(stm);
  if (!/^\d+$/.test(value)) {
    throw new Error('stm must be a non-negative integer');
  }
  let key = 0;
  for (let index = 0; index < value.length; index += 1) {
    key = (key * 10 + value.charCodeAt(index) - 48) & 0xff;
  }
  return key;
};

/** 将 JS 字符串按 Unicode code point 转为 UTF-8 字节，孤立代理项替换为 U+FFFD。 */
export const utf8ToBytes = (value: string): number[] => {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    // JS 按 UTF-16 code unit 遍历；高低代理项必须先合成一个四字节 UTF-8 code point。
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // 末尾高代理项的下一项为 NaN，也必须走孤立代理项替换分支。
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + next - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return bytes;
};

/** 按 UTF-8 字节进行 RFC 3986 编码，孤立代理项与身份编码一致替换为 U+FFFD。 */
const strictEncodeURIComponent = (value: string): string =>
  utf8ToBytes(value)
    .map((byte) => {
      const unreserved =
        (byte >= 0x41 && byte <= 0x5a) ||
        (byte >= 0x61 && byte <= 0x7a) ||
        (byte >= 0x30 && byte <= 0x39) ||
        byte === 0x2d ||
        byte === 0x2e ||
        byte === 0x5f ||
        byte === 0x7e;
      return unreserved
        ? String.fromCharCode(byte)
        : `%${`0${byte.toString(16).toUpperCase()}`.slice(-2)}`;
    })
    .join('');

/** 同一 stm 的低字节分别 XOR userId、userKey；XOR 两次可恢复原 UTF-8 字节。 */
export const xorWithStm = (bytes: number[], stm: string | number): number[] => {
  const key = getStmLowByte(stm);
  return bytes.map((value) => value ^ key);
};

/** 标准 Base64：服务端约定保留 +、/ 和 = 填充。 */
export const bytesToBase64 = (bytes: number[]): string => {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += BASE64_ALPHABET.charAt(first >> 2);
    encoded += BASE64_ALPHABET.charAt(((first & 0x03) << 4) | (second >> 4));
    // 尾部不足三个字节时以 = 补足四字符组，保持服务端要求的标准 Base64 格式。
    encoded +=
      typeof second === 'undefined'
        ? '='
        : BASE64_ALPHABET.charAt(((second & 0x0f) << 2) | (third >> 6));
    encoded +=
      typeof third === 'undefined' ? '=' : BASE64_ALPHABET.charAt(third & 0x3f);
  }
  return encoded;
};

export const encodeStmXor = (value: string, stm: string | number): string =>
  bytesToBase64(xorWithStm(utf8ToBytes(value), stm));

/** 同步 SHA-1 仅用于隐藏缓存键中的身份明文，不提供认证或保密性。 */
export const sha1 = (value: string): string => {
  const bytes = utf8ToBytes(value);
  const bitLength = bytes.length * 8;
  // SHA-1 以 1 bit、0 填充和 64 位原文长度将输入对齐到 512 bit 分组。
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let index = 7; index >= 0; index -= 1) {
    bytes.push(index > 3 ? 0 : (bitLength >>> (index * 8)) & 0xff);
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    // 每组先读取 16 个大端字，再扩展到 80 个工作字供四轮压缩使用。
    const words: number[] = new Array(80);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        (bytes[start] << 24) |
        (bytes[start + 1] << 16) |
        (bytes[start + 2] << 8) |
        bytes[start + 3];
    }
    for (let index = 16; index < 80; index += 1) {
      const word =
        words[index - 3] ^
        words[index - 8] ^
        words[index - 14] ^
        words[index - 16];
      words[index] = (word << 1) | (word >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      // 位运算将结果收敛到 32 位，与服务端 SHA-1 的无符号字运算保持一致。
      const rotatedA = (a << 5) | (a >>> 27);
      const temp = (rotatedA + f + e + k + words[index]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4]
    .map((part) => `00000000${(part >>> 0).toString(16)}`.slice(-8))
    .join('');
};

/**
 * 先组合所有缓存分区维度再计算摘要，避免相同设备和 layer 在账号切换或
 * 多实例场景下共享实验结果。JSON 数组保证含换行的字段也有明确的边界。
 * V2 前缀让启动清理能明确区分旧格式键。
 */
export const getABCacheKeys = (
  trackingId: string,
  projectId: string,
  deviceId: string,
  layerId: string | number,
  identityHash: string
) => {
  const cacheHash = sha1(
    JSON.stringify([
      trackingId,
      projectId,
      deviceId,
      String(layerId),
      identityHash
    ])
  );
  const prefix = `gdp_abt_v2_${cacheHash}`;
  return { signKey: `${prefix}_sign`, dataKey: `${prefix}_data` };
};

/**
 * 逐字段使用 RFC 3986 编码，标准 Base64 中的 +、/、= 不会被表单解析器
 * 当作空格、路径分隔符或键值分隔符。undefined/null 不是协议字段。
 */
export const stringifyABForm = (data: { [key: string]: any }): string =>
  Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null)
    .map(
      (key) =>
        `${strictEncodeURIComponent(key)}=${strictEncodeURIComponent(
          String(data[key])
        )}`
    )
    .join('&');

/** 将唯一 stm 放入 URL query，同时保留已有 query 与 fragment。 */
export const appendStm = (url: string, stm: string): string => {
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  return `${base}${
    base.indexOf('?') === -1 ? '?' : '&'
  }stm=${strictEncodeURIComponent(stm)}${hash}`;
};

export const buildABRequestBody = (
  context: ABRequestSnapshot,
  stm: string
): string => {
  // distinctId、layerId 与 newDevice 保持既有分流协议；stm 绝不进入正文。
  const data: { [key: string]: any } = {
    accountId: context.projectId,
    datasourceId: context.dataSourceId,
    distinctId: context.deviceId,
    layerId: context.layerId,
    newDevice: context.newDevice
  };
  // 编码失败应结束该身份请求，不能把登录身份悄悄降为匿名分流。
  if (context.identity.userId) {
    data.userId = encodeStmXor(context.identity.userId, stm);
  }
  if (context.identity.userKey) {
    data.userKey = encodeStmXor(context.identity.userKey, stm);
  }
  return stringifyABForm(data);
};
