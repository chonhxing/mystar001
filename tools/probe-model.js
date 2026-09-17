/* eslint-disable no-console */
/**
 * 临时探针：用**真实提示词**比一比两个模型的延迟、成功率、文案质量。
 * 目的：确认"解读"这件事该用哪个模型 —— 推理模型要 45~70 秒，太贴超时线了。
 *   node --env-file=server/.env tools/probe-model.js [模型名...]
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const core = require(path.join(ROOT, 'core/index.js'));
const prompts = require(path.join(ROOT, 'server/prompts.js'));
const matcher = require(path.join(ROOT, 'core/matcher.js'));
const deepseek = require(path.join(ROOT, 'server/deepseek.js'));
const { CONFIG } = require(path.join(ROOT, 'server/config.js'));

const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['deepseek-v4-pro', 'deepseek-flash'];

const profile = {
  name: '探针',
  gender: 'she',
  birthDate: '1996-08-19',
  birthTime: '07:20',
  timeKnown: true,
  city: '上海'
};
const answers = {
  q_rewrite: 1, q_night_walk: 1, q_unfair_rule: 1, q_emergency_call: 0, q_destiny: 1,
  q_bystander: 0, q_price: 0, q_last_hit: 0, q_remembered: 1
};

(async () => {
  const local = core.divinate({ profile, answers });
  const chart = local.chart;
  const match = local.match;
  const fortune = local.fortune;
  const pool = match.ranked.slice(0, 8);
  const candidates = pool.map((item) => matcher.decorate(chart, item.character, item.score));
  const messages = prompts.buildMessages({ chart, match, fortune });
  console.log(`提示词 ${JSON.stringify(messages).length} 字节 ｜ 候选 ${candidates.length} 个 ｜ 主推 ${match.main.char.name}\n`);

  for (const model of MODELS) {
    CONFIG.ai.model = model;
    const t0 = Date.now();
    /* eslint-disable no-await-in-loop */
    const r = await deepseek.chat(messages, { tag: `probe-${model}`, budgetMs: 180000, maxTokens: 4000 });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(`【${model}】失败 ${(ms / 1000).toFixed(1)}s err=${r.error}\n`);
      continue;
    }
    const u = r.usage || {};
    console.log(
      `【${model}】成功 ${(ms / 1000).toFixed(1)}s ｜ in=${u.tokensIn} out=${u.tokensOut}（思考 ${u.tokensReasoning}）`
    );
    console.log(`  title: ${r.data.title}`);
    console.log(`  essence: ${String(r.data.essence || '').slice(0, 120)}…`);
    console.log(`  counsel: ${r.data.counsel}\n`);
  }
})().catch((e) => {
  console.error('探针异常:', e);
  process.exit(1);
});
