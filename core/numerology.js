const { LIFE_NUMBERS, NAME_NOTE } = require('../data/numerology.js');

/**
 * 数字命理。整体权重刻意压得很低（命盘里只占一小份），
 * 因为这部分最"玄"，主要作用是产出好听的名字和短句，而不是决定结果。
 */

const MASTER_NUMBERS = [11, 22, 33];

function digitSum(n) {
  let s = 0;
  let x = Math.abs(n);
  while (x > 0) {
    s += x % 10;
    x = Math.floor(x / 10);
  }
  return s;
}

function reduce(n) {
  let x = n;
  let guard = 0;
  while (x > 9 && MASTER_NUMBERS.indexOf(x) < 0 && guard < 10) {
    x = digitSum(x);
    guard += 1;
  }
  return x;
}

function metaOf(num) {
  const meta = LIFE_NUMBERS[num] || LIFE_NUMBERS[reduce(num) >= 10 ? 9 : reduce(num)];
  return (
    meta || {
      name: '未定',
      en: 'Unknown',
      tagline: '这个数字还没被写下含义',
      dims: { light: 50, order: 50, bond: 50, passion: 50, fate: 50, mercy: 50, obsession: 50, sacrifice: 50 }
    }
  );
}

/**
 * 生命灵数：把出生年月日的所有数字相加并约简。
 * 例：1998-05-12 → 1+9+9+8+0+5+1+2 = 35 → 3+5 = 8
 */
function lifeNumber(year, month, day) {
  const raw = digitSum(year) + digitSum(month) + digitSum(day);
  const num = reduce(raw);
  const meta = metaOf(num);
  return {
    number: num,
    master: MASTER_NUMBERS.indexOf(num) >= 0,
    rawSum: raw,
    name: meta.name,
    en: meta.en,
    tagline: meta.tagline,
    dims: meta.dims
  };
}

/**
 * 姓名数理：用字编码折算，纯趣味算法（不是传统五格剖象，UI 上也会如实说明）。
 * 返回值 1~9，用来对命盘做微调。
 */
function nameNumber(name) {
  const str = String(name || '').trim();
  if (!str) {
    return { number: 0, name: '无名', tagline: '你还没把名字告诉这张命盘', dims: null, note: NAME_NOTE };
  }
  let sum = 0;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    sum += (c % 9) + 1;
  }
  const num = reduce(sum);
  const meta = metaOf(num);
  return {
    number: num,
    rawSum: sum,
    name: meta.name,
    tagline: meta.tagline,
    dims: meta.dims,
    note: NAME_NOTE
  };
}

module.exports = { lifeNumber, nameNumber, reduce, digitSum, MASTER_NUMBERS };
