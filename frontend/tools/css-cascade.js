/* cDex CSS Cascade Tracer — paste into DevTools console (F12 → Console).
 *
 *   cascade('.chat-panel-bg')            trace one selector
 *   cascade('.chat-panel-bg', el)        trace a specific element
 *   cascade('.btn', document.body, ['color','background'])
 *
 * Answers: which rule wins each property, which rules were suppressed,
 * and WHY (layer order inversion for !important, specificity, source order).
 * Deterministic JSON in console.table form — paste straight into OpenCode.
 */
(() => {
  if (typeof window.__cascade === "undefined") window.__cascade = {};

  const SPEC_RE = /[#.][\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(\([^)]*\))?|::?[a-z-]+/gi;

  function specificity(selector) {
    let ids = 0, cls = 0, el = 0;
    for (const m of (selector.match(SPEC_RE) || [])) {
      if (m[0] === "#") ids++;
      else if (m[0] === "." || m[0] === "[" || /^::?[a-z-]+/.test(m) && !/^::?(before|after|first-line|first-letter)/i.test(m)) {
        if (m[0] === ":" && /^::?(before|after|first-line|first-letter|root|html|body)/i.test(m)) el++;
        else if (m[0] === ":" && /^(hover|focus|active|visited|link|disabled|checked|first-child|last-child|nth-child|not|is|where)/i.test(m)) cls++;
        else if (m[0] === ":" && /^::?(hover|focus|active|visited|link)/i.test(m)) cls++;
        else cls++;
      }
      else el++;
    }
    return [ids, cls, el];
  }

  function matches(el, selectorText) {
    try { return el.matches(selectorText); } catch { return false; }
  }

  function walkRules(rules, layerPath, layerIndex, media, out) {
    let i = 0;
    for (const rule of rules) {
      if (rule.type === CSSRule.LAYER_BLOCK_RULE) {
        walkRules(rule.cssRules, [...layerPath, rule.name || "(anonymous)"], [...layerIndex, i], media, out);
      } else if (rule.type === CSSRule.LAYER_STATEMENT_RULE) {
        // handled via ordering below; no rules here
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        walkRules(rule.cssRules, layerPath, layerIndex, media || rule.conditionText, out);
      } else if (rule.type === CSSRule.STYLE_RULE) {
        out.push({ rule, layerPath, layerIndex, media, order: i });
      }
      i++;
    }
  }

  function collect(el) {
    const out = [];
    document.styleSheets.forEach((sheet, si) => {
      let rules;
      try { rules = sheet.cssRules; } catch { return; }
      walkRules(rules, [], [], null, out);
      out.forEach((r) => { if (r.rule.parentStyleSheet && !r.sheet) r.sheet = sheet; r.sheetIdx = si; });
    });
    return out.filter((r) => {
      for (const sel of r.rule.selectorText.split(",")) {
        if (matches(el, sel.trim())) return true;
      }
      return false;
    });
  }

  function verdict(entries) {
    const props = {};
    for (const e of entries) {
      const st = e.rule.style;
      for (let i = 0; i < st.length; i++) {
        const prop = st[i];
        const val = st.getPropertyValue(prop).trim();
        const important = st.getPropertyPriority(prop) === "important";
        const key = prop + (important ? "!important" : "");
        if (!props[key]) props[key] = [];
        props[key].push({
          selector: e.rule.selectorText,
          value: val,
          important,
          layer: e.layerPath.join(">") || "(unlayered)",
          layerIndex: e.layerIndex.join("."),
          layerRank: e.layerIndex.length,   // nesting depth of layer
          media: e.media,
          sheet: (e.sheet && e.sheet.href) ? e.sheet.href.split("/").pop() : "inline",
          cssText: e.rule.cssText.slice(0, 160),
          spec: specificity(e.rule.selectorText).join("-"),
          order: e.order,
          sheetIdx: e.sheetIdx,
        });
      }
    }
    const report = {};
    for (const [key, list] of Object.entries(props)) {
      const important = key.endsWith("!important");
      // Layer precedence: normal → later layer wins; important → earlier layer wins.
      // Unlayered: normal beats layered; layered-important beats unlayered-important.
      const layered = list.filter((x) => x.layer !== "(unlayered)");
      const unlayered = list.filter((x) => x.layer === "(unlayered)");
      let pool, reason;
      if (important) {
        pool = layered.length ? layered : unlayered;
        if (layered.length) reason = "layered !important beats unlayered !important (cascade-spec inversion)";
      } else {
        pool = unlayered.length ? unlayered : layered;
        if (unlayered.length) reason = "unlayered normal beats layered normal";
      }
      // Within the pool: layer order (reversed for important), then specificity, then source order
      const cmp = (a, b) => {
        if (a.layerIndex.length || b.layerIndex.length) {
          const li = important
            ? a.layerIndex.join().localeCompare(b.layerIndex.join())   // earlier wins → ascending
            : b.layerIndex.join().localeCompare(a.layerIndex.join());  // later wins → descending
          if (li !== 0) return li;
        }
        const sa = a.spec.split("-").map(Number), sb = b.spec.split("-").map(Number);
        for (let k = 0; k < 3; k++) if (sa[k] !== sb[k]) return sb[k] - sa[k];
        return b.order - a.order;
      };
      pool.sort(cmp);
      const winner = pool[0];
      const losers = pool.slice(1).concat(pool === layered ? unlayered : layered);
      report[key] = {
        winner: { value: winner.value, selector: winner.selector, layer: winner.layer, spec: winner.spec, sheet: winner.sheet, media: winner.media },
        why: reason || (winner.layer !== "(unlayered)" ? `layer "${winner.layer}" wins` : "highest specificity / latest source order"),
        suppressed: losers.map((l) => ({
          value: l.value, selector: l.selector, layer: l.layer, spec: l.spec, sheet: l.sheet,
          because: l.layer !== winner.layer
            ? (l.layer === "(unlayered)" ? "unlayered loses to layered " + (important ? "!important" : "normal")
                                          : `layer "${l.layer}" loses to "${winner.layer}"${important ? " (important: earlier layer wins)" : " (normal: later layer wins)"}`)
            : (l.spec === winner.spec ? "same specificity, earlier in source order" : "lower specificity"),
        })),
      };
    }
    return report;
  }

  window.cascade = (selector, el = null, only = null) => {
    const target = el || document.querySelector(selector);
    if (!target) { console.warn("no element for", selector); return null; }
    const r = verdict(collect(target));
    const rows = Object.entries(r)
      .filter(([k]) => !only || only.includes(k.replace("!important", "")))
      .map(([k, v]) => ({
        property: k,
        "WINNER": `${v.winner.value}  ← ${v.winner.selector} [${v.winner.layer}]`,
        why: v.why,
        suppressed: v.suppressed.map((s) => `${s.value} ← ${s.selector} [${s.layer}] — ${s.because}`).join("  •  "),
      }));
    console.table(rows);
    console.log("%ccascade verdict (JSON)", "font-weight:bold", JSON.stringify(r, null, 1));
    return r;
  };

  console.log("%ccascade() ready", "font-weight:bold;color:#7ec7ff",
    "cascade('.your-selector') — winner + suppressed rules + reasons, per property");
})();
