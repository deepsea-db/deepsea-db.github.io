/* Pure result presentation. No source records or review decisions are changed. SPDX-License-Identifier: MIT */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    let core;
    try { core = require('./pharmacology-core-v1.js'); }
    catch (first) {
      if (first.code !== 'MODULE_NOT_FOUND') throw first;
      core = require('../../../assets/js/pharmacology-core-v1.js');
    }
    module.exports = factory(core);
  } else root.ActivityResultDisplay = factory(root.PharmacologyCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const VERSION = '1.0.2';
  const NOTE_LABELS = Object.freeze({"误差类型：": "Error type: ", "原文未明确误差类型。": "Error type not specified in the original report."});
  function evidenceNoteText(value) {
    const text = String(value ?? '');
    if (Object.prototype.hasOwnProperty.call(NOTE_LABELS, text)) return NOTE_LABELS[text];
    const prefix = '误差类型：';
    return text.startsWith(prefix) ? NOTE_LABELS[prefix] + text.slice(prefix.length) : text;
  }
  const present = value => value !== null && value !== undefined && value !== '';
  const escapeRE = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  const unitPattern = '(?:μmol/L|umol/L|μmol·L[−-]1|umol·L[−-]1|mmol/L|mol/L|μM|uM|mM|nM|pM|M)';
  const unitAliases = Object.freeze({
    'μmol/L': 'uM', 'umol/L': 'uM', 'μmol·L−1': 'uM', 'μmol·L-1': 'uM',
    'umol·L−1': 'uM', 'umol·L-1': 'uM', 'mmol/L': 'mM', 'mol/L': 'M'
  });
  const displayUnits = Object.freeze([
    { label: 'M', factor: 1e6 }, { label: 'mM', factor: 1e3 },
    { label: 'μM', factor: 1 }, { label: 'nM', factor: 1e-3 }, { label: 'pM', factor: 1e-6 }
  ]);
  const canonicalRelation = value => String(value || '=').replace('≤', '<=').replace('≥', '>=');
  // Both operands come from the same-unit decimal fields, so no tolerance is
  // needed: alternate spellings such as 0.060 and 6e-2 parse identically.
  const equalNumber = (a, b) => a === b;
  const formatNumber = value => value === 0 ? '0' : Number(value.toPrecision(15)).toString();
  function unitValue(value) {
    const text = core.clean(value).replace(/\s/g, '');
    return unitAliases[text] || text;
  }
  function info(value) { return core.unitInfo(unitValue(value)); }

  /* This grammar consumes the entire result. It never searches prose for numbers.
     The structured fields must agree before explicit uncertainty is reused. */
  function parseReportedResult(row, normalized) {
    const endpoint = core.clean(row.endpoint);
    const prefix = endpoint ? '(?:' + escapeRE(endpoint) + '\\s*)?' : '';
    const source = core.clean(row.result);
    const rangeRE = new RegExp('^' + prefix + '(?:=\\s*)?(' + numeric + ')\\s*(?:–|−|—|-|to)\\s*(' + numeric + ')\\s*(' + unitPattern + ')$');
    const scalarRE = new RegExp('^' + prefix + '(<=|>=|≤|≥|=|<|>)?\\s*(' + numeric + ')(?:\\s*(?:±|\\+/-)\\s*(' + numeric + '))?\\s*(' + unitPattern + ')$');
    const match = source.match(normalized.relation === 'range' ? rangeRE : scalarRE);
    if (!match) return null;
    let parsed;
    if (normalized.relation === 'range') {
      parsed = { relation: 'range', value: null, value_min: core.num(match[1]), value_max: core.num(match[2]), error: null, unit: match[3] };
    } else {
      parsed = { relation: canonicalRelation(match[1]), value: core.num(match[2]), value_min: null, value_max: null, error: present(match[3]) ? core.num(match[3]) : null, unit: match[4] };
    }
    const parsedUnit = info(parsed.unit), storedUnit = info(row.unit);
    if (!parsedUnit || !storedUnit || parsedUnit.family !== 'molar' || storedUnit.family !== 'molar' || parsedUnit.factor !== storedUnit.factor) return null;
    if (parsed.relation !== normalized.relation) return null;
    for (const field of ['value', 'value_min', 'value_max']) {
      if ((parsed[field] === null) !== (normalized[field] === null)) return null;
      if (parsed[field] !== null && !equalNumber(parsed[field], normalized[field])) return null;
    }
    if (normalized.error !== null && (parsed.error === null || !equalNumber(parsed.error, normalized.error))) return null;
    if (parsed.error !== null && parsed.error < 0) return null;
    return parsed;
  }
  function chooseUnit(normalized) {
    const reference = normalized.normalized_max !== null ? normalized.normalized_max : normalized.normalized_value;
    if (reference === 0) return displayUnits.find(unit => unit.factor === info(normalized.original_unit)?.factor) || displayUnits[2];
    if (reference >= 1e6) return displayUnits[0];
    if (reference >= 1e3) return displayUnits[1];
    if (reference >= 1) return displayUnits[2];
    if (reference >= 1e-3) return displayUnits[3];
    return displayUnits[4];
  }

  /* `convertible` describes unit presentation only; it is not an evidence,
     target-binding, comparability or scientific-verification decision. */
  function format(input) {
    const row = input && typeof input === 'object' ? input : {};
    const original = typeof row.result === 'string' ? row.result : '';
    const result = {
      original_text: original, display_text: 'Not converted', endpoint: String(row.endpoint ?? ''),
      status: 'original_only', convertible: false, converted: false, unit: null,
      value: null, value_min: null, value_max: null, error: null,
      error_type: String(row.error_type ?? ''), error_source: null,
      relation: canonicalRelation(row.relation), reason: '', warnings: []
    };
    if (!original.trim()) return { ...result, status: 'missing', display_text: 'Not recorded', reason: 'No original result text.' };
    if (!core || typeof core.normalizeResult !== 'function') return { ...result, reason: 'Presentation core unavailable.' };
    if (row.quantitative_allowed === false || row.quantitative_allowed === 'false' || ['not_tested', 'not_determined'].includes(row.status || row.activity_status)) {
      return { ...result, status: 'restricted', reason: 'Quantitative presentation is restricted by the source row.' };
    }
    const normalized = core.normalizeResult({ ...row, unit: unitValue(row.unit) });
    result.warnings = [...normalized.warnings];
    if (!normalized.valid || !normalized.quantitative) return { ...result, reason: 'A permitted, valid numeric representation is unavailable.' };
    if (normalized.family !== 'molar') return { ...result, reason: 'Only explicit molar concentration units are interconverted.' };
    const parsed = parseReportedResult(row, normalized);
    if (!parsed) return { ...result, reason: 'Original text is composite or does not fully agree with the structured result.' };
    const complete = core.normalizeResult({ ...row, unit: unitValue(row.unit), error: parsed.error });
    if (!complete.valid || !complete.quantitative) return { ...result, reason: 'The complete reported result cannot be safely presented numerically.' };
    for (const [source, target] of [['value', 'normalized_value'], ['value_min', 'normalized_min'], ['value_max', 'normalized_max'], ['error', 'normalized_error']]) {
      if (complete[source] !== null && complete[source] !== 0 && complete[target] === 0) return { ...result, reason: 'Unit conversion would underflow; original text is retained.' };
    }
    const unit = chooseUnit(complete);
    const scale = value => value === null ? null : value / unit.factor;
    const values = {
      value: scale(complete.normalized_value), value_min: scale(complete.normalized_min),
      value_max: scale(complete.normalized_max), error: scale(complete.normalized_error)
    };
    if (Object.values(values).some(value => value !== null && !Number.isFinite(value))) return { ...result, reason: 'Conversion would exceed a finite numeric representation.' };
    const symbol = { '<=': '≤', '>=': '≥' }[complete.relation] || complete.relation;
    const main = complete.relation === 'range'
      ? formatNumber(values.value_min) + '–' + formatNumber(values.value_max)
      : (complete.relation === '=' ? '' : symbol + ' ') + formatNumber(values.value);
    const uncertainty = values.error === null ? '' : ' ± ' + formatNumber(values.error);
    return {
      ...result, ...values, display_text: main + uncertainty + ' ' + unit.label,
      warnings: [...complete.warnings],
      status: 'molar_display', convertible: true, converted: unit.factor !== info(row.unit).factor,
      unit: unit.label, relation: complete.relation,
      error_source: parsed.error === null ? null : normalized.error === null ? 'original_full_string' : 'structured_and_original',
      reason: 'Presentation of the complete reported molar result; source values and review status are unchanged.'
    };
  }
  function notationHTML(value) {
    const text = String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return text.replace(/\b(IC|EC|CC|GI|LC|LD|ED|CTC)(50|90)\b|\b(K)(D|d)\b/g,
      (_, endpoint, number, k, d) => (endpoint || '<i class="scientific-equilibrium-symbol">K</i>') + '<sub>' + (number || d) + '</sub>');
  }
  return Object.freeze({ VERSION, format, notationHTML, evidenceNoteText, NOTE_LABELS });
});
