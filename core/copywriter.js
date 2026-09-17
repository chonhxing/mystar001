const { TEMPLATES } = require('../data/templates.js');
const { DIM_MAP, levelOf } = require('../data/archetypes.js');
const { COUNSEL } = require('../data/fortune.js');
const { FATE_MAP } = require('../data/fates.js');

/**
 * 文案拼装。
 *
 * 原则：不给每个角色手写解读（角色库会一直加，写不过来），
 * 而是把命盘的公共字段填进模板 —— 八轴名称、极性描述、命途释义、共振度。
 * 所以这里唯一要打磨的就是「句子本身读起来像人话」。
 */

function tpl(str, dict) {
  return String(str || '').replace(/\{(\w+)\}/g, (m, k) =>
    dict[k] === undefined || dict[k] === null ? '' : String(dict[k])
  );
}

function listText(arr) {
  return arr.join('、');
}

function build(chart, match, fortune) {
  const main = match.main;
  const char = main.char;
  const dimMeta = DIM_MAP[main.gap.key] || DIM_MAP.light;

  const sun = chart.signs.sun;
  const moon = chart.signs.moon;
  const rising = chart.signs.rising;

  const dict = {
    sunName: sun ? sun.name : '未定',
    sunTagline: sun ? sun.tagline : '',
    moonName: moon ? moon.name : '未定',
    moonTagline: moon ? moon.tagline : '',
    risingName: rising ? rising.name : '',
    risingTagline: rising ? rising.tagline : '',
    lifeNumberName: chart.lifeNumber ? chart.lifeNumber.name : '随心',
    pillarYearName: chart.pillars ? chart.pillars.year.name : '',
    veins: chart.draw ? chart.draw.veins : '',
    dominantName: chart.dominant.name,
    dominantBadge: chart.dominant.badge,
    charName: char.name,
    work: char.work,
    total: main.rankedAll,
    score: main.resonance
  };

  dict.risingSentence = chart.signs.risingKnown && rising
    ? tpl(TEMPLATES.risingSentence, dict)
    : TEMPLATES.risingUnknown;

  // ---- 1. 命盘本质 ----
  const essence =
    chart.mode === 'draw' ? tpl(TEMPLATES.essenceDraw, dict) : tpl(TEMPLATES.essence, dict);

  // ---- 2. 与角色共振 ----
  const fateSentence = main.sharedFates.length
    ? tpl(TEMPLATES.resonanceFate, {
        fateName: main.sharedFates[0].name,
        fateSummary: main.sharedFates[0].summary
      })
    : `TA走的是【${(FATE_MAP[char.fates[0]] && FATE_MAP[char.fates[0]].name) || '未被命名'}】那条路，` +
      '而你身上没有这条线——你们的相似，来自更细的地方。';

  const sharedSentence = main.sharedFates.length
    ? tpl(TEMPLATES.resonanceShared, {
        sharedList: listText(main.sharedFates.map((f) => `【${f.name}】`))
      })
    : '';

  const resonance = tpl(TEMPLATES.resonanceBody, {
    ...dict,
    fateSentence: `${fateSentence}${sharedSentence}`
  });

  // ---- 3. 差异：为什么你不是TA ----
  const gapText =
    main.gap.diff >= 0
      ? tpl(TEMPLATES.gapCharHigher, {
          dimName: dimMeta.name,
          pos: dimMeta.pos,
          posDesc: dimMeta.posDesc
        })
      : tpl(TEMPLATES.gapCharLower, {
          dimName: dimMeta.name,
          neg: dimMeta.neg,
          negDesc: dimMeta.negDesc
        });

  const difference = tpl(TEMPLATES.differenceBody, { gapText });

  // ---- 4. 带不动的命途 ----
  const anti = match.anti;
  const opp = anti.opposing && anti.opposing.length ? anti.opposing[0] : null;
  const oppMeta = opp ? DIM_MAP[opp.key] : dimMeta;
  const missingText = opp
    ? tpl(TEMPLATES.antiMissing, {
        dimName: oppMeta.name,
        userLevel: levelOf(opp.userValue),
        userPole: opp.userValue >= 50 ? oppMeta.pos : oppMeta.neg,
        charLevel: levelOf(opp.targetValue),
        charPole: opp.targetValue >= 50 ? oppMeta.pos : oppMeta.neg
      })
    : '你们的八轴方向几乎处处相反，没得商量。';

  const antiBody = tpl(TEMPLATES.antiBody, {
    charName: anti.char.name,
    work: anti.char.work,
    score: anti.resonance,
    missingText
  });

  // ---- 5. 神谕 ----
  const counselText =
    COUNSEL[chart.fates[0].id] || '你已经在自己那条路上走了很远了，别急着换道。';

  const sideLines = match.side.map((s) =>
    tpl(TEMPLATES.sideLine, {
      charName: s.char.name,
      work: s.char.work,
      score: s.resonance
    })
  );

  return {
    title: TEMPLATES.resultTitle,
    subtitle:
      chart.mode === 'draw'
        ? chart.draw.note
        : tpl(TEMPLATES.resultSubtitle, dict),
    oneLine: `${char.name} · ${main.rarity.label} · 共振 ${main.resonance}%`,
    essence,
    resonanceTitle: tpl(TEMPLATES.resonanceHeader, dict),
    resonance,
    differenceTitle: TEMPLATES.differenceHeader,
    difference,
    antiTitle: TEMPLATES.antiHeader,
    anti: antiBody,
    counselTitle: TEMPLATES.counselHeader,
    counsel: tpl(TEMPLATES.counsel, { counselText }),
    sideTitle: TEMPLATES.sideHeader,
    sideLines,
    chartHeader: TEMPLATES.chartHeader,
    shareTitle: tpl(TEMPLATES.shareTitle, dict)
  };
}

module.exports = { build, tpl };
