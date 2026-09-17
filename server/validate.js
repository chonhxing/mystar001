/**
 * 模型输出的守门人。
 *
 * 不管提示词写得多严，模型偶尔还是会跑偏：字段缺失、写成 markdown、
 * 突然开始聊健康、或者把角色名写错。这一层负责：
 *   1. 逐字段校验（类型/长度）
 *   2. 违禁内容过滤（命中就退回本地模板那一段，而不是整体丢弃）
 *   3. 角色名一致性检查（AI 提到了不存在的角色名 → 判为不可信，整段退回模板）
 *
 * 原则：宁可退回模板，也不让用户看到一段跑偏的话。
 */

const { CONFIG } = require('./config.js');

const FIELDS = {
  title: { min: 2, max: 24 },
  essence: { min: 40, max: 400 },
  resonance: { min: 40, max: 400 },
  difference: { min: 30, max: 360 },
  anti: { min: 30, max: 360 },
  counsel: { min: 8, max: 120 }
};

/** 命中即判该段不可用（合规底线，只做保守过滤） */
const BLOCK_PATTERNS = [
  /(作为|我是一个)?\s*(AI|人工智能|语言模型|大模型|模型)/i,
  /ChatGPT|DeepSeek|OpenAI|Gemini|Claude/i,
  /(确诊|癌症|寿命|活不过|死亡时间|会死|绝症|抑郁|焦虑症|精神疾病)/,
  /(什么时候死|几岁死|能活多久)/,
  /(买|卖|投|涨|跌)(哪只|什么)?(股票|基金|币|彩票)/,
  /(必|一定|保证)(会|能)(发财|成功|考上|复合|结婚|中奖)/,
  /(建议你|必须|马上去)(离婚|分手|辞职|借钱|投资)/,
  /(自杀|自残|伤害自己)/,
  /(生辰八字|命盘)(决定|注定)你(一定|必然)/,
  /https?:\/\//i,
  /<\/?[a-z]+>/i
];

function clean(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkField(name, value) {
  const spec = FIELDS[name];
  const text = clean(value);
  if (!text) return { ok: false, reason: 'EMPTY' };
  if (text.length < spec.min) return { ok: false, reason: 'TOO_SHORT' };
  if (text.length > spec.max * 2) return { ok: false, reason: 'TOO_LONG' };
  for (let i = 0; i < BLOCK_PATTERNS.length; i += 1) {
    if (BLOCK_PATTERNS[i].test(text)) return { ok: false, reason: `BLOCKED_${i}` };
  }
  return { ok: true, text: text.length > spec.max ? `${text.slice(0, spec.max)}…` : text };
}

/**
 * 校验 AI 输出。
 * @param {object} data 模型返回的对象
 * @param {object} fallback 本地模板产的文案（同结构）
 * @param {object} ctx { allowedNames: [] }
 * @returns {{ copy, ai: {used:number, rejected:{field:reason}}, fields }}
 */
function validateProse(data, fallback, ctx) {
  const out = {};
  const rejected = {};
  let used = 0;
  const allowed = (ctx && ctx.allowedNames) || [];

  // 先做一次"角色名一致性"检查：模型如果自己编了角色名，整批都不信
  if (allowed.length) {
    const all = Object.keys(FIELDS)
      .map((k) => clean(data && data[k]))
      .join(' ');
    const suspicious = /《[^》]{1,20}》/g;
    const works = all.match(suspicious) || [];
    const badWork = works.find((w) => {
      const name = w.slice(1, -1);
      return !allowed.some((a) => a.work === name);
    });
    if (badWork) {
      return {
        copy: Object.assign({}, fallback, { aiGenerated: false, aiNote: 'name_mismatch' }),
        ai: { used: 0, rejected: { all: `UNKNOWN_WORK:${badWork}` } }
      };
    }
  }

  Object.keys(FIELDS).forEach((field) => {
    const res = checkField(field, data && data[field]);
    if (res.ok) {
      out[field] = res.text;
      used += 1;
    } else {
      rejected[field] = res.reason;
      out[field] = fallback[field];
    }
  });

  // 标题太短/太长都退回模板的话，模板里本来也没有 title，兜一个
  if (!out.title) out.title = fallback.title || '命途已读出';

  out.aiGenerated = used >= 4;
  out.aiFields = used;
  return { copy: out, ai: { used, rejected } };
}

/** 模型挑角色的结果校验 */
function validatePick(id, candidates) {
  if (!id) return null;
  const hit = candidates.find((c) => c.id === id);
  return hit ? hit.id : null;
}

module.exports = { validateProse, validatePick, checkField, clean, FIELDS, BLOCK_PATTERNS };
