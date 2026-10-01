/* البحث يتم في نسخة القائمة المرفقة، ولا يتصل بأنظمة المشغل. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const input = $('boxInput');
  const button = $('checkButton');
  const result = $('result');
  let codes = [];
  let ready = false;
  let loading = false;
  let sourceScript = null;
  let pendingCode = null;
  const formatCount = new Intl.NumberFormat('en-US');

  function normalize(value) {
    return String(value ?? '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '')
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
      .trim().replace(/^ODB\s*[:：]\s*/i, '')
      .replace(/\s+/g, '').toUpperCase();
  }

  function lowerBound(query) {
    let lo = 0, hi = codes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (codes[mid] < query) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function similarCodes(query) {
    for (let length = query.length; length >= 5; length--) {
      const prefix = query.slice(0, length);
      const start = lowerBound(prefix);
      const matches = [];
      for (let i = start; i < codes.length && matches.length < 8; i++) {
        if (!codes[i].startsWith(prefix)) break;
        matches.push(codes[i]);
      }
      if (matches.length) return matches;
    }
    return [];
  }

  function hideSearchState() {
    result.hidden = true;
    $('suggestions').hidden = true;
    $('suggestionList').replaceChildren();
    $('inputError').hidden = true;
    input.removeAttribute('aria-invalid');
    pendingCode = null;
  }

  function search(value) {
    const query = normalize(value);
    hideSearchState();
    if (!query || !/^[A-Z0-9]+$/.test(query)) {
      $('inputError').textContent = query ? 'اكتب رقم اللوحة بالحروف الإنجليزية والأرقام، مثل RYDHEAU0007.' : 'أدخل رقم اللوحة أولًا.';
      $('inputError').hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return {status: 'invalid', code: query};
    }
    if (!ready) {
      if (loading) pendingCode = query;
      return {status: loading ? 'loading' : 'unavailable', code: query};
    }
    input.value = query;
    $('clearButton').hidden = false;
    const found = codes[lowerBound(query)] === query;
    result.className = found ? 'result found' : 'result missing';
    $('resultSymbol').innerHTML = found
      ? '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 7v6M12 17v.2"/></svg>';
    $('resultLabel').textContent = found ? 'تم العثور على اللوحة' : 'لا توجد مطابقة';
    $('resultTitle').textContent = found ? 'لوحتك موجودة ضمن قائمة العرض' : 'اللوحة غير موجودة في هذه القائمة';
    $('resultCode').textContent = query;
    $('resultDescription').textContent = found
      ? 'المطابقة حسب نسخة القائمة المرفقة بهذه الصفحة.'
      : 'تأكد من الرقم كاملًا. عدم وجوده في القائمة لا يعني أن اللوحة غير صالحة للتفعيل.';
    result.hidden = false;
    const suggestions = found ? [] : similarCodes(query);
    if (suggestions.length) {
      for (const code of suggestions) {
        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = code;
        item.setAttribute('aria-label', 'البحث عن اللوحة ' + code);
        item.addEventListener('click', () => search(code));
        $('suggestionList').append(item);
      }
      $('suggestions').hidden = false;
    }
    return {status: found ? 'found' : 'not_found', code: query, suggestions, total: codes.length};
  }

  function loadFailure() {
    loading = false;
    ready = false;
    button.disabled = true;
    $('buttonText').textContent = 'البحث غير متاح';
    $('databaseError').hidden = false;
    $('databaseStatus').className = 'database-status error';
    $('statusText').textContent = 'قائمة اللوحات غير متاحة';
    $('searchForm').removeAttribute('aria-busy');
  }

  function prepareCodes() {
    try {
      const source = typeof BOX_CODES === 'undefined' ? null : BOX_CODES;
      if (!Array.isArray(source) || !source.length || source.some((code) => typeof code !== 'string' || !/^[A-Z0-9]+$/.test(normalize(code)))) throw new Error('Invalid ODB list');
      codes = [...new Set(source.map(normalize))].sort();
      loading = false;
      ready = true;
      button.disabled = false;
      $('buttonText').textContent = 'بحث عن اللوحة';
      $('databaseStatus').className = 'database-status ready';
      $('statusText').replaceChildren();
      const count = document.createElement('strong');
      count.dir = 'ltr';
      count.textContent = formatCount.format(codes.length);
      $('statusText').append(count, document.createTextNode(' لوحة جاهزة للبحث'));
      $('searchForm').removeAttribute('aria-busy');
      if (pendingCode) search(pendingCode);
    } catch (_) { loadFailure(); }
  }

  function loadCodes() {
    if (loading || ready) return;
    loading = true;
    $('databaseError').hidden = true;
    $('databaseStatus').className = 'database-status';
    $('statusText').textContent = 'جاري تجهيز قائمة اللوحات…';
    $('buttonText').textContent = 'جاري التحميل';
    $('searchForm').setAttribute('aria-busy', 'true');
    if (typeof BOX_CODES !== 'undefined') { setTimeout(prepareCodes, 0); return; }
    if (sourceScript) sourceScript.remove();
    sourceScript = document.createElement('script');
    sourceScript.src = './data.js';
    sourceScript.async = true;
    sourceScript.onload = () => setTimeout(prepareCodes, 0);
    sourceScript.onerror = loadFailure;
    document.head.append(sourceScript);
  }

  $('searchForm').addEventListener('submit', (event) => { event.preventDefault(); search(input.value); });
  input.addEventListener('input', () => { hideSearchState(); $('clearButton').hidden = !input.value; });
  $('clearButton').addEventListener('click', () => { input.value = ''; hideSearchState(); $('clearButton').hidden = true; input.focus(); });
  $('retryButton').addEventListener('click', loadCodes);
  loadCodes();

  const context = document.modelContext;
  if (context?.registerTool) {
    try {
      Promise.resolve(context.registerTool({
        name: 'search_odb_list',
        title: 'البحث في قائمة اللوحات',
        description: 'Find an ODB code in the attached published list and display the same result as the visible search. This does not check live network coverage or ports.',
        inputSchema: {type: 'object', properties: {code: {type: 'string', minLength: 1, maxLength: 100}}, required: ['code'], additionalProperties: false},
        annotations: {readOnlyHint: false, untrustedContentHint: false},
        execute(args) {
          if (!args || typeof args.code !== 'string' || !args.code.trim() || args.code.length > 100) throw new Error('A non-empty ODB code of at most 100 characters is required.');
          if (!ready) throw new Error('ODB list is not ready. Try again when the page reports readiness.');
          return search(args.code);
        }
      })).catch(() => {});
    } catch (_) { /* البحث اليدوي يعمل في المتصفحات غير الداعمة. */ }
  }
})();
