/**
 * 提示词。这是整个 AI 环节里最值钱的文件，值得反复打磨。
 *
 * 设计原则（也是这套方案能成立的原因）：
 *  1. 命盘、角色、共振度全部由本地引擎算好后再交给模型 —— 模型只负责"把话说好"，
 *     不负责"决定命是什么"。这样结果稳定、可缓存、不会胡说角色，也省 token。
 *  2. 把锚点（轴名、命途、角色台词位）明确列成清单，要求模型必须用到指定锚点，
 *     否则一放开它就写成一碗谁都能喝的鸡汤。
 *  3. 输出严格 JSON，字段和本地模板一一对应 —— 这样 AI 挂了可以无缝退回模板。
 *  4. 合规约束写在系统提示里（吉凶承诺 / 健康 / 投资 / 生死都不许碰）。
 *
 * ⚠️ 系统提示里不要出现"你是 AI 助手"这类身份描述 ——
 *    用户看到的是"命途解读者"，技术信息只留在服务端日志里。
 */

const { DIM_MAP } = require('../data/archetypes.js');

const SYSTEM_PROMPT = `你是一位"命途解读者"，在一款以角色命途为隐喻的占星小游戏里为用户解读命盘。

【写法要求】
- 全程第二人称"你"，用短句，像在耳边说话，不要书面腔、不要排比堆砌。
- 具体、克制、有画面感。可以点出用户的矛盾，但不要下判断、不要说教、不要鼓励。
- 允许留白和不确定（"大概""也许"），不允许绝对化承诺。
- 必须使用我给你的锚点词（轴名、命途名、星座名、干支名、角色名），不要自己另造名词。
- 角色名和作品名必须原样照抄我给的字符串，不许改写、不许换角色、不许提到我没给的角色。
- 禁止引用任何作品的官方台词、歌词、台词式口癖；禁止使用真实演员/声优的姓名。
- 禁止出现"作为AI""模型""人工智能""生成"这类自我描述。

【内容禁区（绝对不写）】
- 不预测疾病、寿命、死亡、意外；不做心理健康判断或建议。
- 不涉及投资、彩票、赌博、借贷、婚育的任何具体预测。
- 不预言具体事件发生的时间、地点、人物。
- 不写自我伤害、暴力细节；不使用羞辱性、宿命论式的贬低（如"你注定失败"）。

【输出格式】
只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。字段固定为：
{
  "title": "为这张命盘取一个名字，4~10 个汉字，要有意象，不要成语堆砌",
  "essence": "命盘本质，90~150 字",
  "resonance": "你与主推角色的共振，90~150 字",
  "difference": "你与主推角色的差异（为什么你没成为TA），70~120 字",
  "anti": "你带不动的那条命途，70~120 字",
  "counsel": "一句神谕式的提点，20~45 字，具体可执行，不要心灵鸡汤"
}`;

/** 把命盘事实写成紧凑的中文清单（模型对带标签的清单比对 JSON 更稳） */
function factSheet(ctx) {
  const { chart, match } = ctx;
  const lines = [];

  lines.push('【命盘】');
  if (chart.mode === 'draw') {
    lines.push(`- 类型：随心一签（不依生辰，由${(chart.draw && chart.draw.veins) || '随机两条线'}交织而成）`);
  } else {
    const s = chart.signs || {};
    lines.push(`- 太阳：${s.sun ? `${s.sun.name}（${s.sun.tagline}）` : '未定'}`);
    lines.push(`- 月亮：${s.moon ? `${s.moon.name}（${s.moon.tagline}）` : '未定'}`);
    lines.push(
      s.risingKnown && s.rising
        ? `- 上升：${s.rising.name}（${s.rising.tagline}）`
        : '- 上升：用户未提供出生时辰，不要提上升星座'
    );
    if (chart.pillars) {
      lines.push(`- 四柱：年${chart.pillars.year.name} 月${chart.pillars.month.name} 日${chart.pillars.day.name}${chart.input && chart.input.timeKnown ? ` 时${chart.pillars.hour.name}` : '（时柱未知）'}`);
      lines.push(`- 日主：${chart.pillars.day.stem}（${chart.pillars.day.tagline}）`);
    }
    if (chart.lifeNumber) {
      lines.push(`- 生命灵数：${chart.lifeNumber.number} ${chart.lifeNumber.name}（${chart.lifeNumber.tagline}）`);
    }
  }
  lines.push(`- 本命元素：${chart.element ? chart.element.name : '未定'}（${chart.element ? chart.element.trait : ''}）`);
  lines.push(`- 命格稀有度：${chart.rarity ? chart.rarity.label : '未定'}，偏科度 ${chart.extremity}/100`);
  lines.push(`- 最突出的轴：${chart.dominant.name} → 偏「${chart.dominant.pole}」（${chart.dominant.badge}），数值 ${chart.dominant.value}/100`);

  lines.push('');
  lines.push('【八轴数值】（0=完全靠后一极，100=完全靠前一极；括号里是相对TA自己平均水平的强弱）');
  (chart.axes || []).forEach((a) => {
    const dev = a.value - 50;
    const tag = Math.abs(dev) < 8 ? '接近中位' : dev > 0 ? `偏${a.pos}` : `偏${a.neg}`;
    lines.push(`- ${a.name}：${a.value}（${tag}）`);
  });

  if (chart.fates && chart.fates.length) {
    lines.push('');
    lines.push('【命途判定】（按相似度排序，前三条是用户携带的命途）');
    chart.fates.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.name}（${f.summary}）｜阴影面：${f.shadow}`);
    });
  }

  lines.push('');
  lines.push('【主推角色（必须写这个角色，不要换）】');
  const main = match.main;
  lines.push(`- 角色：${main.char.name}　作品：《${main.char.work}》　类型：${main.char.medium}`);
  lines.push(`- 稀有度：${main.rarity.label}　共振度：${main.resonance}%`);
  lines.push(`- 意象：${main.char.motif}`);
  lines.push(`- 一句话定位：${main.char.signature}`);
  if (main.sharedFates && main.sharedFates.length) {
    lines.push(`- 共享命途：${main.sharedFates.map((f) => f.name).join('、')}`);
  } else {
    lines.push('- 共享命途：无（他们的相似来自更细的轴分布，请如实处理，不要硬说有共同命途）');
  }
  const gap = main.gap;
  if (gap) {
    const meta = DIM_MAP[gap.key];
    lines.push(
      `- 最大差异轴：${meta ? `${meta.name}（${meta.pos} ↔ ${meta.neg}）` : gap.key}` +
        `（用户的数值 ${gap.userValue}，角色的数值 ${gap.targetValue}，` +
        `${gap.diff > 0 ? '角色的这一轴比用户更靠前' : '用户比角色更靠前'}）`
    );
  }

  lines.push('');
  lines.push('【副推（可提可不提，最多提一个）】');
  (match.side || []).forEach((s) => {
    lines.push(`- ${s.char.name}《${s.char.work}》 共振 ${s.resonance}%`);
  });

  lines.push('');
  lines.push('【反向角色：用户带不动的命途（必须写，用它来写 anti 段）】');
  const anti = match.anti;
  lines.push(`- 角色：${anti.char.name}　作品：《${anti.char.work}》　共振度仅 ${anti.resonance}%（镜像对立度 ${anti.mirrorScore}%）`);
  lines.push(`- 意象：${anti.char.motif}`);
  if (anti.opposing && anti.opposing.length) {
    anti.opposing.slice(0, 2).forEach((o) => {
      const meta = DIM_MAP[o.key];
      lines.push(`- 对立轴：${meta ? meta.name : o.key}（用户 ${o.userValue}，TA ${o.targetValue}）`);
    });
  }

  if (ctx.fortune) {
    lines.push('');
    lines.push('【当日运势（仅供 counsel 参考，不要照抄）】');
    lines.push(`- ${ctx.fortune.levelName}：${ctx.fortune.levelDesc}`);
    lines.push(`- 幸运色 ${ctx.fortune.luckyColor.name}　幸运数 ${ctx.fortune.luckyNumber}`);
  }

  return lines.join('\n');
}

function buildUserPrompt(ctx) {
  const parts = [];
  parts.push('请根据下面这份已经算好的命盘，写五行解读。');
  parts.push('');
  parts.push(factSheet(ctx));
  parts.push('');
  parts.push('【写作提示】');
  parts.push('- essence 要把命盘最关键的那个矛盾讲出来，并至少用到两个锚点（星座/干支/轴名/命途）。');
  parts.push('- resonance 讲的是"你为什么会在这个角色身上看到自己"，用共享命途和TA的意象来写，不要复述设定。');
  parts.push('- difference 用最大差异轴来解释"你没能走进TA的命途"，要写得像替用户松了口气，而不是贬低。');
  parts.push('- anti 讲"另一种语言"：TA 的选择你为什么做不到，或者说为什么不必做到。');
  parts.push('- counsel 要具体到今天能做的一件小事。');
  parts.push('- 全文避免"命运注定""天生如此"这类封闭表述，多用"你更愿意""你习惯"这类选择式表述。');
  parts.push('');
  parts.push('再次强调：只输出 JSON 对象，字段为 title / essence / resonance / difference / anti / counsel。');

  return parts.join('\n');
}

function buildMessages(ctx) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(ctx) }
  ];
}

/**
 * 让模型在候选池里自己挑角色时的额外指令。
 * 默认关闭：开启后角色出场分布会偏离本地引擎的公平性设计，属于玩法取舍。
 */
function buildPickerMessages(ctx, candidates) {
  const lines = candidates.map(
    (c, i) => `${i + 1}. id=${c.id} ${c.char.name}《${c.char.work}》 共振 ${c.resonance}% 意象：${c.char.motif}`
  );
  const extra = [
    '',
    '【附加任务】请从下面这几个候选角色里挑一个作为主推，并在 JSON 里加一个字段 "mainId"（只能填给定的 id）。',
    '选择标准：意象与命盘的气质最贴合，而不是共振度最高的那个。其余角色不要提到。',
    lines.join('\n')
  ].join('\n');
  const msgs = buildMessages(ctx);
  msgs[1] = { role: 'user', content: `${msgs[1].content}\n${extra}` };
  return msgs;
}

module.exports = { SYSTEM_PROMPT, buildMessages, buildPickerMessages, factSheet };
