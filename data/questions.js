/**
 * 问答题库的入口（可选环节）。
 *
 * 题目数据在 `data/questions/` 目录里按轴分文件，这里只做转发 ——
 * 这样 `require('../data/questions.js')` 的老调用点一行都不用改。
 *
 * 加题 / 改格式看 `data/questions/index.js` 顶部的说明。
 *
 * 三条不变的约定：
 *  - 每题主要打 1~2 根轴，增量乘上 CONFIG.DIVINATION.QUIZ_WEIGHT 后加到命盘上
 *  - 允许跳过：跳过的题不产生修正，命盘退回"纯星象"版本
 *  - option.fate 是可选的命途加权，会把某条命途的亲和度直接顶上去
 */

const bank = require('./questions/index.js');

module.exports = {
  QUESTIONS: bank.QUESTIONS,
  QUESTION_MAP: bank.QUESTION_MAP,
  BY_DIM: bank.BY_DIM,
  validate: bank.validate,
  stats: bank.stats,
  MIN_OPTIONS: bank.MIN_OPTIONS,
  MAX_OPTIONS: bank.MAX_OPTIONS
};
