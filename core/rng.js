/**
 * 确定性伪随机。
 *
 * 整个产品的"命定感"都建立在这里：同一个人的生辰 + 同一个盐值 ⇒ 永远同一个结果。
 * 这样用户换设备、清缓存后再占一次，结果不会变（不然会被说"不准"），
 * 同时服务端不需要存任何东西也能保证一致。
 */

/** 把字符串搅成 32 位种子 */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32 位种子 → 均匀分布 [0,1) */
function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  const seedFn = xmur3(String(seed));
  const next = mulberry32(seedFn());

  return {
    /** [0,1) */
    next,

    /** [min, max] 闭区间整数 */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },

    /** 正负浮动：[base-amp, base+amp] */
    around(base, amp) {
      return base + (next() * 2 - 1) * amp;
    },

    pick(arr) {
      if (!arr || !arr.length) return null;
      return arr[Math.floor(next() * arr.length)];
    },

    /** Fisher–Yates，返回新数组 */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },

    /** 不放回地取 n 个 */
    sample(arr, n) {
      return this.shuffle(arr).slice(0, n);
    },

    /** 按权重取一个下标 */
    weightedIndex(weights) {
      let total = 0;
      for (let i = 0; i < weights.length; i += 1) total += Math.max(0, weights[i]);
      if (total <= 0) return 0;
      let r = next() * total;
      for (let i = 0; i < weights.length; i += 1) {
        r -= Math.max(0, weights[i]);
        if (r <= 0) return i;
      }
      return weights.length - 1;
    }
  };
}

module.exports = { createRng };
