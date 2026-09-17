const { CONFIG, aiReady } = require('./config.js');

/**
 * DeepSeek 调用封装（OpenAI 兼容协议）。
 *
 * 用 Node 内置 fetch，不引任何三方依赖 —— 后端要能在最干净的环境里起来。
 * 这里负责：超时、重试、取 JSON、记录用量。业务规则不放在这里。
 */

/**
 * 从模型输出里抠出第一个**完整的** JSON 对象。
 *
 * ⚠️ 不能用"第一个 { 到最后一个 }"这种偷懒办法（我们原来就是这么写的）：
 *    推理模型偶尔会输出两个对象、或者在 JSON 后面追加一段解释，
 *    那样切出来的片段必然不是合法 JSON，整次调用就白费了。
 *    这里用括号配对扫描，并且正确跳过字符串里的花括号和转义字符。
 */
function firstJsonObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch (e) {
          return null; // 括号配对但内容仍不合法（比如被截断后又补上的）
        }
      }
    }
  }
  return null; // 没闭合 → 基本上是被 max_tokens 截断了
}

function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();

  // 模型偶尔会包上 ```json 围栏
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();

  try {
    return JSON.parse(s);
  } catch (e) {
    // 交给括号配对扫描
    return firstJsonObject(s);
  }
}

/** 诊断用：解析失败时到底长什么样（首尾都看，才能分清是截断还是格式问题） */
function describeBadOutput(content) {
  const s = String(content === undefined || content === null ? '' : content);
  const flat = (t) => t.split('\n').join(' ');
  const head = flat(s.slice(0, 240));
  const tail = s.length > 240 ? flat(s.slice(-240)) : '';
  return `len=${s.length} 头: ${head}${tail ? ` … 尾: ${tail}` : ''}`;
}

/**
 * @param {Array} messages [{role, content}]
 * @param {object} opts { json: boolean, maxTokens, temperature, tag }
 * @returns {{ok:boolean, data?:object, usage?:object, model?:string, error?:string, raw?:string}}
 */
async function chat(messages, opts) {
  const o = opts || {};
  if (!aiReady()) {
    return { ok: false, error: 'AI_NOT_CONFIGURED' };
  }

  const url = `${CONFIG.ai.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: CONFIG.ai.model,
    messages,
    temperature: o.temperature === undefined ? CONFIG.ai.temperature : o.temperature,
    max_tokens: o.maxTokens || CONFIG.ai.maxTokens,
    stream: false
  };
  if (o.json !== false) body.response_format = { type: 'json_object' };

  const maxAttempts = Math.max(1, 1 + (CONFIG.ai.retries || 0));
  let lastError = 'UNKNOWN';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.ai.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CONFIG.ai.timeoutMs)
      });

      const text = await res.text();
      const elapsed = Date.now() - started;

      if (!res.ok) {
        lastError = `HTTP_${res.status}`;
        console.error(`[ai] ${o.tag || ''} 请求失败 ${res.status} ${elapsed}ms: ${text.slice(0, 300)}`);
        // 4xx（除 429）不重试，重试也没用
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        continue;
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        lastError = 'BAD_RESPONSE_ENVELOPE';
        continue;
      }

      const choice = payload.choices && payload.choices[0];
      const content = choice && choice.message && choice.message.content;
      const usage = payload.usage || {};

      const data = extractJson(content);
      if (!data) {
        lastError = 'BAD_JSON';
        console.error(`[ai] ${o.tag || ''} 返回的不是合法 JSON → ${describeBadOutput(content)}`);
        continue;
      }

      const details = usage.completion_tokens_details || {};
      const reasoning = details.reasoning_tokens || 0;
      const cacheHit = usage.prompt_cache_hit_tokens || 0;
      // 推理模型的 out 里有一大块是"思考"，把它单独打出来，方便看清成本花在哪
      console.log(
        `[ai] ${o.tag || ''} ok ${elapsed}ms in=${usage.prompt_tokens || 0}` +
          `（缓存命中 ${cacheHit}） out=${usage.completion_tokens || 0}` +
          `（思考 ${reasoning}）`
      );
      return {
        ok: true,
        data,
        model: payload.model || CONFIG.ai.model,
        usage: {
          tokensIn: usage.prompt_tokens || 0,
          tokensOut: usage.completion_tokens || 0,
          tokensReasoning: reasoning,
          cacheHit
        }
      };
    } catch (e) {
      const aborted = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      lastError = aborted ? 'TIMEOUT' : `NETWORK_${(e && e.message) || 'ERR'}`;
      console.error(`[ai] ${o.tag || ''} 异常(${lastError}) attempt=${attempt}`);
    }
  }

  return { ok: false, error: lastError };
}

module.exports = { chat, extractJson, firstJsonObject, describeBadOutput };
