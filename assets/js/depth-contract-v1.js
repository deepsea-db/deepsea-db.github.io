(function (root) {
  'use strict';
  function band(n) { return n < 200 ? 'Shallow' : n < 1000 ? 'Slope' : n < 6000 ? 'Deep' : 'Hadal'; }
  function classify(input) {
    if (input == null || typeof input === 'boolean') return 'Unknown';
    if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? band(input) : 'Unknown';
    var text = String(input).trim();
    if (!text || /not\s*reported|unknown|unverified|未报告|未核实|未知|未确定|海拔|altitude/i.test(text)) return 'Unknown';
    text = text.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,function(n){return n.replace(/,/g,'');});
    if (/[<>≤≥±]/.test(text)) return 'Unknown';
    var residual=text.replace(/\d+(?:\.\d+)?/g,'').replace(/\b(?:m|km|meters?|metres?|depth|shallow|slope|deep|hadal|approximately|approx|about)\b/gi,'').replace(/水深|深度|千米|米|约/g,'').replace(/[\s()\[\]:：~～–—−.,-]/g,'');
    if (residual) return 'Unknown';
    var match = text.match(/\d+(?:\.\d+)?/g);
    if (!match || /(^|[\s(])-\d/.test(text)) return 'Unknown';
    var values = match.map(Number);
    if (/\bkm\b|千米/i.test(text)) values = values.map(function (n) { return n * 1000; });
    var lo = Math.min.apply(null,values), hi = Math.max.apply(null,values);
    return band(lo) === band(hi) ? band(lo) : 'Unknown';
  }
  function forRecord(record) {
    var key = record && (record.p || record.file);
    var map = root.DEEPSEA_DEPTH_BY_RECORD || {};
    return key && Object.prototype.hasOwnProperty.call(map,key) ? map[key] : classify(record && (record.d != null ? record.d : record.depth));
  }
  var api = {classify:classify,forRecord:forRecord};
  root.DeepSeaDepth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
