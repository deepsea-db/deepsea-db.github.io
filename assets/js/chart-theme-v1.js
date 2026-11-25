/* Shared presentation palette. No records, categories or counts are changed. */
(function (root) {
  'use strict';
  var categorical = ['#3279a3','#348e88','#697caf','#8a739f','#4199ad','#536e83','#9b895d','#a1737f','#7e906b','#7799a4','#587e9a','#8d879d','#6e9d93'];
  var chemotypes = Object.freeze({
    'Polyketide':'#3279a3','Terpenoid':'#348e88','Alkaloid':'#697caf',
    'Alkaloid-Peptide':'#8a739f','Polyketide-Peptide':'#4199ad','Peptide':'#536e83',
    'Phenylpropanoid':'#9b895d','Azaphilone':'#a1737f','Phenolic':'#7e906b',
    'Other':'#879ba6','Unclassified':'#b1bec6','':'#b1bec6'
  });
  var depth = Object.freeze({'Shallow':'#77afc7','Slope':'#418bad','Deep':'#285e86','Hadal':'#293e64','Unknown':'#9baeb8'});
  var target = Object.freeze({
    'Receptor/Channel':'#3279a3','Kinase/Phosphatase':'#697caf','DNA Repair':'#348e88',
    'Oxidoreductase':'#7799a4','Cytochrome P450':'#8a739f','Metabolic Enzyme':'#7e906b',
    'Transcription Factor':'#a1737f','Epigenetic':'#9b895d','Protease':'#3f827b',
    'ABC Transporter':'#587e9a','DNA Topology':'#4199ad','Cytoskeletal':'#92986c',
    'Chaperone':'#8d879d','Other':'#9baeb8'
  });
  var phenotype = Object.freeze({
    'Anticancer':'#697caf','Antimicrobial':'#348e88','Anti-inflammatory':'#3279a3',
    'Enzyme Inhibition':'#8a739f','Antioxidant':'#7e906b','Antiviral':'#4199ad',
    'Antiparasitic':'#9b895d','Neuroprotective':'#7799a4','Bioactivity (Generic)':'#879ba6','Other':'#9baeb8'
  });
  function color(group, name) {
    var map = group === 'target' ? target : group === 'phenotype' ? phenotype : chemotypes;
    if (Object.prototype.hasOwnProperty.call(map,name)) return map[name];
    var hash=0;String(name || '').split('').forEach(function(c){hash=(hash*31+c.charCodeAt(0))>>>0;});
    return categorical[hash % categorical.length];
  }
  function recolor(original, group) {
    var result={};Object.keys(original).forEach(function(k){result[k]=color(group,k);});return result;
  }
  function ink(canvas, property, fallback) {
    return root.getComputedStyle(canvas).getPropertyValue(property).trim() || fallback;
  }
  root.DeepSeaChartTheme=Object.freeze({
    bar:'#3279a3',neutral:'#9baeb8',chemotypes:chemotypes,depth:depth,
    color:color,recolor:recolor,ink:ink,series:Object.freeze(Array(16).fill('#3279a3'))
  });
})(window);
