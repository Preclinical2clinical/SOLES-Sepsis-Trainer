/**
 * Systematic Review Screening Trainer - Core Application Logic
 * Baby Pink & Red Theme with Lead Reviewer Hub & Gradebook
 */

// Authorized Lead Accounts
const LEAD_ACCOUNTS = {
  'zfisk': {
    password: 'missy',
    name: 'Zoe',
    title: 'Project Lead - Zoe',
    role: 'lead'
  },
  'ekuhar': {
    password: 'gunner',
    name: 'Eva',
    title: 'Project Lead - Eva',
    role: 'colead'
  }
};

// Application State
const state = {
  activeStage: 'training', // 'training' (10 papers) | 'exam1' (30 papers) | 'exam2' (30 papers)
  userRole: 'student',     // 'student' | 'lead' | 'colead'
  userName: 'Student',
  authenticatedLead: null, // { password, name, title, role } if logged in
  tempRole: 'student',
  currentPaperIndex: 0,
  selectedDecision: null,
  selectedExclusionReason: 'EX-CLINICAL',
  studentNotes: '',
  activeHighlight: null,
  filterScorecard: 'all',

  // Datasets
  guidelines: null,
  trainingPapers: [],
  exam1Papers: [],
  exam2Papers: [],

  // Lead Decisions: Zoe & Eva manual records and joint consensus overrides
  leadDecisions: {
    zoe: { training: {}, exam1: {}, exam2: {} },
    eva: { training: {}, exam1: {}, exam2: {} },
    consensusOverrides: { training: {}, exam1: {}, exam2: {} }
  },

  // Answers saved per stage for student: { [paperId]: { decision, reason, notes, timestamp } }
  answers: {
    training: {},
    exam1: {},
    exam2: {}
  },

  // Uploaded student records for the Lead Gradebook
  gradebookRoster: [],

  // PICO bullets display preference
  showPicoBullets: true
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadStoredPreferences();
  initDatasets();
  bindKeyboardShortcuts();
  setupGradebookUpload();
  setupCustomFileUpload();
  renderApp();
});

function loadStoredPreferences() {
  const savedBullets = localStorage.getItem('sr_show_pico_bullets');
  if (savedBullets !== null) {
    try { state.showPicoBullets = JSON.parse(savedBullets); } catch (e) { state.showPicoBullets = true; }
  }

  const savedAuth = localStorage.getItem('sr_auth_lead');
  if (savedAuth && LEAD_ACCOUNTS[savedAuth]) {
    state.authenticatedLead = LEAD_ACCOUNTS[savedAuth];
    state.userRole = state.authenticatedLead.role;
    state.userName = state.authenticatedLead.name;
  } else {
    const savedRole = localStorage.getItem('sr_user_role');
    if (savedRole) state.userRole = savedRole;

    const savedName = localStorage.getItem('sr_user_name');
    if (savedName) state.userName = savedName;
  }

  const savedStage = localStorage.getItem('sr_active_stage');
  if (savedStage) state.activeStage = savedStage;

  ['training', 'exam1', 'exam2'].forEach(stage => {
    const saved = localStorage.getItem(`sr_answers_${stage}`);
    if (saved) {
      try { state.answers[stage] = JSON.parse(saved); } catch (e) { console.error(e); }
    }
  });

  // Load Lead Decisions for Zoe & Eva
  const savedZoe = localStorage.getItem('sr_lead_decisions_zoe');
  if (savedZoe) {
    try {
      const p = JSON.parse(savedZoe);
      state.leadDecisions.zoe = { training: p.training || {}, exam1: p.exam1 || {}, exam2: p.exam2 || {} };
    } catch (e) { console.error(e); }
  }

  const savedEva = localStorage.getItem('sr_lead_decisions_eva');
  if (savedEva) {
    try {
      const p = JSON.parse(savedEva);
      state.leadDecisions.eva = { training: p.training || {}, exam1: p.exam1 || {}, exam2: p.exam2 || {} };
    } catch (e) { console.error(e); }
  }

  const savedOverrides = localStorage.getItem('sr_lead_consensus_overrides');
  if (savedOverrides) {
    try {
      const p = JSON.parse(savedOverrides);
      state.leadDecisions.consensusOverrides = { training: p.training || {}, exam1: p.exam1 || {}, exam2: p.exam2 || {} };
    } catch (e) { console.error(e); }
  }

  // Backward compatibility migration: If lead previously screened into state.answers
  if (state.userRole === 'lead' && Object.keys(state.leadDecisions.zoe.training).length === 0) {
    ['training', 'exam1', 'exam2'].forEach(stage => {
      if (state.answers[stage] && Object.keys(state.answers[stage]).length > 0) {
        state.leadDecisions.zoe[stage] = { ...state.answers[stage] };
      }
    });
    localStorage.setItem('sr_lead_decisions_zoe', JSON.stringify(state.leadDecisions.zoe));
  } else if (state.userRole === 'colead' && Object.keys(state.leadDecisions.eva.training).length === 0) {
    ['training', 'exam1', 'exam2'].forEach(stage => {
      if (state.answers[stage] && Object.keys(state.answers[stage]).length > 0) {
        state.leadDecisions.eva[stage] = { ...state.answers[stage] };
      }
    });
    localStorage.setItem('sr_lead_decisions_eva', JSON.stringify(state.leadDecisions.eva));
  }

  const savedRoster = localStorage.getItem('sr_gradebook_roster');
  if (savedRoster) {
    try { state.gradebookRoster = JSON.parse(savedRoster); } catch (e) { console.error(e); }
  }
}

function initDatasets() {
  const defaultData = window.DEFAULT_DATA || { guidelines: {}, training: [], exam1: [], exam2: [] };

  const customGuidelines = localStorage.getItem('sr_custom_guidelines');
  const customTrain = localStorage.getItem('sr_custom_training');
  const customE1 = localStorage.getItem('sr_custom_exam1');
  const customE2 = localStorage.getItem('sr_custom_exam2');

  state.guidelines = customGuidelines ? JSON.parse(customGuidelines) : defaultData.guidelines;
  if (state.guidelines) {
    if (state.guidelines.question && !state.guidelines.objective) {
      state.guidelines.objective = state.guidelines.question;
    }
    if (state.guidelines.exclusionCriteria && Array.isArray(state.guidelines.exclusionCriteria)) {
      state.guidelines.exclusionCriteria = state.guidelines.exclusionCriteria.filter(item => item.code !== 'EX-NOT-BENEFICIAL');
      if (!state.guidelines.exclusionCriteria.some(item => item.code === 'EX-CLINICAL')) {
        state.guidelines.exclusionCriteria.unshift({
          code: "EX-CLINICAL",
          label: "Clinical Paper / Human Patients",
          description: "Human clinical trials, ICU patient studies, observational cohorts, or clinical case reports. Our review is strictly limited to preclinical mammalian laboratory animal models!"
        });
      }
    }
    if (state.guidelines.screeningTips && Array.isArray(state.guidelines.screeningTips)) {
      if (!state.guidelines.screeningTips.some(t => t.includes('Clinical vs. Preclinical') || t.includes('EX-CLINICAL'))) {
        state.guidelines.screeningTips.unshift("🩺 Clinical vs. Preclinical: Human patient studies and clinical trials are excluded under EX-CLINICAL. Look for laboratory animal models (mice, rats, pigs, sheep)!");
      }
    }
  }

  // Load training papers (auto-sync updated DOIs if outdated mock papers were cached)
  if (customTrain) {
    try {
      const parsed = JSON.parse(customTrain);
      if (parsed.length > 0 && parsed[0].doi !== '10.1038/s41598-023-38311-6') {
        state.trainingPapers = defaultData.training;
        localStorage.removeItem('sr_custom_training');
      } else {
        // Sync paper 2 if it still has old EX-NOT-INVIVO
        if (parsed.length > 1 && parsed[1].doi === '10.3389/fphar.2022.1013284' && parsed[1].exclusion_code === 'EX-NOT-INVIVO') {
          parsed[1].exclusion_code = 'EX-CLINICAL';
          parsed[1].rationale = "Population violation: This is a clinical trial conducted in 150 human adult ICU patients with sepsis. Our systematic review only includes preclinical mammalian animal models -> EX-CLINICAL.";
          parsed[1].learning_pearl = "🚨 Clinical Paper Trap: Clinical trials in human patients are excluded under EX-CLINICAL because our protocol is strictly limited to preclinical mammalian laboratory animal models (mice, rats, pigs, sheep, etc.).";
          localStorage.setItem('sr_custom_training', JSON.stringify(parsed));
        }
        state.trainingPapers = parsed;
      }
    } catch (e) {
      state.trainingPapers = defaultData.training;
    }
  } else {
    state.trainingPapers = defaultData.training;
  }

  // Load exam1 papers (auto-sync updated DOIs if outdated mock papers were cached)
  if (customE1) {
    try {
      const parsed = JSON.parse(customE1);
      if (parsed.length > 0 && parsed[0].doi !== '10.23812/20-108-A-20') {
        state.exam1Papers = defaultData.exam1;
        localStorage.removeItem('sr_custom_exam1');
      } else {
        state.exam1Papers = parsed;
      }
    } catch (e) {
      state.exam1Papers = defaultData.exam1;
    }
  } else {
    state.exam1Papers = defaultData.exam1;
  }

  // Load exam2 papers (auto-sync updated DOIs if outdated mock papers were cached)
  if (customE2) {
    try {
      const parsed = JSON.parse(customE2);
      if (parsed.length > 0 && parsed[0].doi !== '10.1016/j.intimp.2026.117200') {
        state.exam2Papers = defaultData.exam2;
        localStorage.removeItem('sr_custom_exam2');
      } else {
        state.exam2Papers = parsed;
      }
    } catch (e) {
      state.exam2Papers = defaultData.exam2;
    }
  } else {
    state.exam2Papers = defaultData.exam2;
  }
}

function getActivePapers() {
  if (state.activeStage === 'training') return state.trainingPapers;
  if (state.activeStage === 'exam1') return state.exam1Papers;
  return state.exam2Papers;
}

function getActiveAnswers() {
  if (state.userRole === 'lead') {
    if (!state.leadDecisions.zoe[state.activeStage]) state.leadDecisions.zoe[state.activeStage] = {};
    return state.leadDecisions.zoe[state.activeStage];
  } else if (state.userRole === 'colead') {
    if (!state.leadDecisions.eva[state.activeStage]) state.leadDecisions.eva[state.activeStage] = {};
    return state.leadDecisions.eva[state.activeStage];
  }
  if (!state.answers[state.activeStage]) state.answers[state.activeStage] = {};
  return state.answers[state.activeStage];
}

function saveAnswersToStorage() {
  if (state.userRole === 'lead') {
    localStorage.setItem('sr_lead_decisions_zoe', JSON.stringify(state.leadDecisions.zoe));
  } else if (state.userRole === 'colead') {
    localStorage.setItem('sr_lead_decisions_eva', JSON.stringify(state.leadDecisions.eva));
  } else {
    localStorage.setItem(`sr_answers_${state.activeStage}`, JSON.stringify(state.answers[state.activeStage]));
  }
}

// RESOLVE DYNAMIC PAPER BENCHMARKS (ZOE, EVA, & EXPERT CONSENSUS)
function getResolvedPaperDecisions(paper, stage = state.activeStage) {
  if (!paper) {
    return {
      paperId: 0,
      zoeDecision: 'INCLUDE',
      zoeReason: null,
      zoeNotes: '',
      zoeIsManual: false,
      evaDecision: 'INCLUDE',
      evaReason: null,
      evaNotes: '',
      evaIsManual: false,
      consensusDecision: 'INCLUDE',
      consensusStatus: 'BASELINE',
      exclusionCode: null,
      isConflict: false
    };
  }

  const paperId = paper.id;

  // Zoe's Decision
  const zoeEntry = state.leadDecisions?.zoe?.[stage]?.[paperId];
  const zoeIsManual = !!(zoeEntry && zoeEntry.decision);
  const zoeDecision = zoeIsManual ? zoeEntry.decision : (paper.lead_decision || 'INCLUDE');
  const zoeReason = zoeIsManual ? zoeEntry.reason : (zoeDecision === 'EXCLUDE' ? (paper.exclusion_code || 'EX-CLINICAL') : null);
  const zoeNotes = zoeIsManual ? (zoeEntry.notes || '') : '';

  // Eva's Decision
  const evaEntry = state.leadDecisions?.eva?.[stage]?.[paperId];
  const evaIsManual = !!(evaEntry && evaEntry.decision);
  const evaDecision = evaIsManual ? evaEntry.decision : (paper.colead_decision || 'INCLUDE');
  const evaReason = evaIsManual ? evaEntry.reason : (evaDecision === 'EXCLUDE' ? (paper.exclusion_code || 'EX-CLINICAL') : null);
  const evaNotes = evaIsManual ? (evaEntry.notes || '') : '';

  // Consensus Decision
  const override = state.leadDecisions?.consensusOverrides?.[stage]?.[paperId];
  let consensusDecision = paper.consensus_decision || 'INCLUDE';
  let consensusStatus = 'BASELINE'; // 'AGREED' | 'CONFLICT' | 'OVERRIDE' | 'ZOE_MANUAL' | 'EVA_MANUAL' | 'BASELINE'

  if (override) {
    consensusDecision = override;
    consensusStatus = 'OVERRIDE';
  } else if (zoeIsManual && evaIsManual) {
    if (zoeDecision === evaDecision) {
      consensusDecision = zoeDecision;
      consensusStatus = 'AGREED';
    } else {
      // Disagreement between Zoe and Eva
      consensusDecision = paper.consensus_decision || zoeDecision;
      consensusStatus = 'CONFLICT';
    }
  } else if (zoeIsManual && !evaIsManual) {
    consensusDecision = zoeDecision;
    consensusStatus = (zoeDecision === evaDecision) ? 'AGREED' : 'ZOE_MANUAL';
  } else if (!zoeIsManual && evaIsManual) {
    consensusDecision = evaDecision;
    consensusStatus = (evaDecision === zoeDecision) ? 'AGREED' : 'EVA_MANUAL';
  }

  // Exclusion code for consensus
  let exclusionCode = paper.exclusion_code;
  if (consensusDecision === 'EXCLUDE') {
    if (zoeDecision === 'EXCLUDE' && zoeReason) exclusionCode = zoeReason;
    else if (evaDecision === 'EXCLUDE' && evaReason) exclusionCode = evaReason;
  } else {
    exclusionCode = null;
  }

  const isConflict = (zoeIsManual && evaIsManual && zoeDecision !== evaDecision && !override);

  return {
    paperId,
    zoeDecision,
    zoeReason,
    zoeNotes,
    zoeIsManual,
    evaDecision,
    evaReason,
    evaNotes,
    evaIsManual,
    consensusDecision,
    consensusStatus,
    exclusionCode,
    isConflict
  };
}

// RENDER ALL UI COMPONENTS
function renderApp() {
  updateHeaderAndRoleUI();
  updateStageTabsUI();
  updateProgressUI();
  renderPaperCard();
  renderGuidelinesDrawerContent();
  renderScorecardStats();
  renderGradebookTable();
}

function updateHeaderAndRoleUI() {
  // Update Role Button in Header
  const roleIcon = document.getElementById('role-icon');
  const roleLabel = document.getElementById('role-display-label');

  if (state.userRole === 'lead') {
    roleIcon.textContent = '👑';
    roleLabel.textContent = `Project Lead - Zoe`;
  } else if (state.userRole === 'colead') {
    roleIcon.textContent = '👑';
    roleLabel.textContent = `Project Lead - Eva`;
  } else {
    roleIcon.textContent = '🎓';
    roleLabel.textContent = `${state.userName || 'Student'}`;
  }

  // Guidelines project title
  if (state.guidelines && state.guidelines.title) {
    document.getElementById('header-project-title').textContent = state.guidelines.title;
  }
}

function updateStageTabsUI() {
  const tabTrain = document.getElementById('btn-tab-training');
  const tabE1 = document.getElementById('btn-tab-exam1');
  const tabE2 = document.getElementById('btn-tab-exam2');
  const headerBadge = document.getElementById('header-round-badge');
  const modeTag = document.getElementById('active-mode-tag');
  const modeLabel = document.getElementById('active-mode-label');
  const simCard = document.getElementById('simulation-info-card');
  const feedbackCard = document.getElementById('training-feedback-card');

  // Reset desktop button styles
  const activeClass = "px-3.5 py-1.5 rounded-lg bg-brand-600 text-white font-extrabold shadow-sm transition";
  const inactiveClass = "px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-brand-700 font-bold transition";

  tabTrain.className = (state.activeStage === 'training') ? activeClass : inactiveClass;
  tabE1.className = (state.activeStage === 'exam1') ? activeClass : inactiveClass;
  tabE2.className = (state.activeStage === 'exam2') ? activeClass : inactiveClass;

  // Mobile labels
  const mobTrain = document.getElementById('mobile-tab-training');
  const mobE1 = document.getElementById('mobile-tab-exam1');
  const mobE2 = document.getElementById('mobile-tab-exam2');
  if (mobTrain) mobTrain.className = (state.activeStage === 'training') ? 'text-brand-700 font-black' : 'text-slate-600';
  if (mobE1) mobE1.className = (state.activeStage === 'exam1') ? 'text-brand-700 font-black' : 'text-slate-600';
  if (mobE2) mobE2.className = (state.activeStage === 'exam2') ? 'text-brand-700 font-black' : 'text-slate-600';

  // Badge & Mode behavior
  if (state.activeStage === 'training') {
    headerBadge.textContent = "Training (10 Papers)";
    modeTag.className = "text-xs font-bold px-3 py-1 rounded-full bg-pink-100 text-brand-800 flex items-center space-x-1.5";
    modeLabel.textContent = "Training: Instant Feedback";
    simCard.classList.add('hidden');
  } else if (state.activeStage === 'exam1') {
    headerBadge.textContent = "Exam 1 (30 Papers)";
    modeTag.className = "text-xs font-bold px-3 py-1 rounded-full bg-pink-100 text-slate-700 flex items-center space-x-1.5";
    modeLabel.textContent = "Exam 1: Blinded (Score at End)";
    feedbackCard.classList.add('hidden');
    simCard.classList.remove('hidden');
  } else {
    headerBadge.textContent = "Exam 2 (30 Papers)";
    modeTag.className = "text-xs font-bold px-3 py-1 rounded-full bg-pink-100 text-slate-700 flex items-center space-x-1.5";
    modeLabel.textContent = "Exam 2: Blinded (Score at End)";
    feedbackCard.classList.add('hidden');
    simCard.classList.remove('hidden');
  }
}

// SWITCH STAGE (Training 10 vs Exam 1 vs Exam 2)
function switchStage(stageName) {
  state.activeStage = stageName;
  localStorage.setItem('sr_active_stage', stageName);
  state.currentPaperIndex = 0;
  state.activeHighlight = null;
  renderApp();
}

// RENDER CURRENT PAPER CARD
function renderPaperCard() {
  const papers = getActivePapers();
  if (!papers || papers.length === 0) return;

  const paper = papers[state.currentPaperIndex];
  const answers = getActiveAnswers();
  const existingAns = answers[paper.id];

  // Metadata
  document.getElementById('paper-indicator').textContent = `Paper ${state.currentPaperIndex + 1} of ${papers.length}`;
  document.getElementById('paper-id-tag').textContent = `#${paper.id}`;
  document.getElementById('paper-year-journal').textContent = `${paper.journal} (${paper.year})`;

  const diffBadge = document.getElementById('paper-difficulty-badge');
  diffBadge.textContent = paper.difficulty || 'Standard';

  // DOI link
  const doiLink = document.getElementById('paper-doi-link');
  const doiText = document.getElementById('paper-doi-text');
  if (paper.doi) {
    doiText.textContent = paper.doi;
    doiLink.href = `https://doi.org/${paper.doi}`;
    doiLink.classList.remove('hidden');
  } else {
    doiLink.classList.add('hidden');
  }

  // Title and Authors
  document.getElementById('paper-title').textContent = paper.title;
  document.getElementById('paper-authors').textContent = paper.authors;

  // Render Abstract with PICO highlights
  renderAbstractWithHighlights(paper.abstract);

  // Restore decision selection
  const defaultExclReason = (state.guidelines?.exclusionCriteria?.[0]?.code) || 'EX-CLINICAL';
  if (existingAns) {
    state.selectedDecision = existingAns.decision;
    state.selectedExclusionReason = existingAns.reason || defaultExclReason;
    state.studentNotes = existingAns.notes || '';
    document.getElementById('student-notes-input').value = state.studentNotes;
    document.getElementById('select-exclusion-reason').value = state.selectedExclusionReason;
    updateDecisionButtonsUI();
    document.getElementById('decision-status-pill').textContent = 'Saved';
    document.getElementById('decision-status-pill').className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';

    if (state.activeStage === 'training') {
      showTrainingFeedback(existingAns, paper);
    } else {
      document.getElementById('training-feedback-card').classList.add('hidden');
    }
  } else {
    state.selectedDecision = null;
    state.selectedExclusionReason = defaultExclReason;
    state.studentNotes = '';
    document.getElementById('student-notes-input').value = '';
    updateDecisionButtonsUI();
    document.getElementById('decision-status-pill').textContent = 'Pending';
    document.getElementById('decision-status-pill').className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-pink-100 text-brand-800';
    document.getElementById('training-feedback-card').classList.add('hidden');
  }

  // Prev/Next disabled logic
  document.getElementById('btn-prev-paper').disabled = (state.currentPaperIndex === 0);
  document.getElementById('btn-next-paper').disabled = (state.currentPaperIndex === papers.length - 1);

  updateProgressUI();
  updateLeadScreeningBanner(paper);
}

// UPDATE LEAD SCREENING BANNER (ZOE & EVA DUAL-LEAD STATUS)
function updateLeadScreeningBanner(paper) {
  const banner = document.getElementById('lead-screening-banner');
  if (!banner) return;

  if (state.userRole !== 'lead' && state.userRole !== 'colead') {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const title = document.getElementById('lead-screening-banner-title');
  const myStatusBadge = document.getElementById('lead-paper-status-badge');
  const peerName = document.getElementById('colead-peer-name');
  const peerBadge = document.getElementById('colead-peer-status-badge');

  const isZoe = (state.userRole === 'lead');
  const myName = isZoe ? 'Zoe' : 'Eva';
  const peerLeadName = isZoe ? 'Eva' : 'Zoe';

  title.textContent = `Screening as Project Lead - ${myName}`;

  const myAns = isZoe ? state.leadDecisions.zoe?.[state.activeStage]?.[paper.id] : state.leadDecisions.eva?.[state.activeStage]?.[paper.id];
  const peerAns = isZoe ? state.leadDecisions.eva?.[state.activeStage]?.[paper.id] : state.leadDecisions.zoe?.[state.activeStage]?.[paper.id];

  if (myAns && myAns.decision) {
    myStatusBadge.textContent = `✓ ${myName} Screened: ${myAns.decision}`;
    myStatusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';
  } else {
    myStatusBadge.textContent = `⚪ ${myName} Pending`;
    myStatusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white text-slate-500 border border-pink-200';
  }

  peerName.textContent = `${peerLeadName}'s Status:`;
  if (peerAns && peerAns.decision) {
    if (state.activeStage === 'training') {
      peerBadge.innerHTML = `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold ${getDecisionBadgeBg(peerAns.decision)}">✓ Screened: ${peerAns.decision}</span>`;
    } else {
      peerBadge.innerHTML = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">✓ Completed by ${peerLeadName}</span>`;
    }
  } else {
    peerBadge.innerHTML = `<span class="text-slate-400 font-medium text-[10px]">⚪ Pending ${peerLeadName}</span>`;
  }
}

function getDecisionBadgeBg(dec) {
  if (dec === 'INCLUDE') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  if (dec === 'EXCLUDE') return 'bg-rose-100 text-rose-800 border border-rose-200';
  return 'bg-amber-100 text-amber-800 border border-amber-200';
}

// PICO HIGHLIGHTING
function renderAbstractWithHighlights(text) {
  const container = document.getElementById('paper-abstract');
  if (!state.activeHighlight) {
    container.textContent = text;
    return;
  }

  let html = escapeHtml(text);

  // Sepsis Models & Mammalian organisms
  const modelRegex = /(cecal ligation and puncture|cecal ligation|cecum ligation|colon ligation|cecal incision|clp|cli|casp|fip|fecal[- ]induced peritonitis|fecal slurry|fecal pellet|agar pellet|fibrin clot|necrotizing enterocolitis|nec|neonatal sepsis|streptococcus agalactiae|group b streptococcus|gbs|sepsis|septic shock|septicemia|septicaemia|bacteremia|candidemia|urosepsis|peritonitis|pneumonia-derived sepsis|pneumonia|intratracheal inoculation|intranasal inoculation|bloodstream infection|interstitial nephritis|e\. coli|escherichia coli|pseudomonas aeruginosa|pseudomonas|klebsiella pneumoniae|klebsiella|staphylococcus aureus|staph|streptococcus|candida albicans|candida|mice|mouse|murine|c57bl\/6|balb\/c|rats?|wistar|sprague-dawley|pigs?|swine|piglets?|sheep|ovine|rabbits?)/gi;

  // Interventions / Therapies
  const therapyRegex = /(treatment|therapy|therapeutic|administered|administration|doses?|pre-treatment|pretreatment|rescue|intervention|adjuvant|infusion|injected|gavaged|oral|intraperitoneal|intravenous|co-administered|combination|peptide|antibody|monoclonal|mab|inhibitor|antagonist|antioxidant|antibiotic|probiotic|nanoparticles?|hypothermia|dialysis|lavage|resuscitation|secretome|extracellular vesicles|quercetin|resveratrol|curcumin|ulinastatin|thrombomodulin|alkaline phosphatase|bacteriophage)/gi;

  // Sepsis Outcomes
  const outcomeRegex = /(survival|mortality|succumbed|organ failure|organ dysfunction|acute kidney injury|sa-aki|creatinine|bun|acute lung injury|pao2\/fio2|wet-to-dry|pulmonary edema|liver|alt|ast|bilirubin|cytokines?|tnf-α|tnf-alpha|il-6|il-1β|il-1beta|il-10|bacteremia|cfu|bacterial burden|bacterial clearance|mean arterial pressure|map|hypotension|lactate|histology|microcirculation)/gi;

  // LPS / Endotoxin Trap Warning
  const lpsRegex = /(lipopolysaccharide|lps|endotoxin|endotoxemia|endotoxaemia|endotoxic shock|d-galactosamine)/gi;

  // Study Design & In vitro / Non-mammalian traps
  const desRegex = /(randomized controlled trial|randomised controlled trial|rct|systematic review|meta-analysis|cohort|in vitro|ex vivo|cell lines?|raw 264\.7|thp-1|macrophages|bmdm|splenocytes|zebrafish|drosophila|c\. elegans|galleria mellonella)/gi;

  if (state.activeHighlight === 'model' || state.activeHighlight === 'population') {
    html = html.replace(modelRegex, '<mark class="hl-pico-p">$&</mark>');
  } else if (state.activeHighlight === 'therapy' || state.activeHighlight === 'intervention') {
    html = html.replace(therapyRegex, '<mark class="hl-pico-i">$&</mark>');
  } else if (state.activeHighlight === 'outcome') {
    html = html.replace(outcomeRegex, '<mark class="hl-pico-o">$&</mark>');
  } else if (state.activeHighlight === 'lps') {
    html = html.replace(lpsRegex, '<mark class="hl-pico-lps">$&</mark>');
  } else if (state.activeHighlight === 'design') {
    html = html.replace(desRegex, '<mark class="hl-pico-s">$&</mark>');
  }

  container.innerHTML = html;
}

function toggleHighlight(type) {
  state.activeHighlight = (state.activeHighlight === type) ? null : type;
  const papers = getActivePapers();
  renderAbstractWithHighlights(papers[state.currentPaperIndex].abstract);
}

function clearHighlights() {
  state.activeHighlight = null;
  const papers = getActivePapers();
  renderAbstractWithHighlights(papers[state.currentPaperIndex].abstract);
}

// DECISION SELECTION
function selectDecision(decision) {
  state.selectedDecision = decision;
  updateDecisionButtonsUI();
}

function updateDecisionButtonsUI() {
  const btnInc = document.getElementById('btn-decision-include');
  const btnExc = document.getElementById('btn-decision-exclude');
  const btnMay = document.getElementById('btn-decision-maybe');
  const exclContainer = document.getElementById('exclusion-reason-container');

  // Reset base button styles
  btnInc.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 transition group";
  btnExc.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-brand-600 hover:bg-rose-50/50 text-slate-700 transition group";
  btnMay.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 text-slate-700 transition group";

  if (state.selectedDecision === 'INCLUDE') {
    btnInc.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold shadow-sm transition";
    exclContainer.classList.add('hidden');
  } else if (state.selectedDecision === 'EXCLUDE') {
    btnExc.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-brand-600 bg-rose-50 text-brand-800 font-extrabold shadow-sm transition";
    exclContainer.classList.remove('hidden');
  } else if (state.selectedDecision === 'MAYBE') {
    btnMay.className = "flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-amber-500 bg-amber-50 text-amber-800 font-extrabold shadow-sm transition";
    exclContainer.classList.add('hidden');
  } else {
    exclContainer.classList.add('hidden');
  }
}

// SUBMIT DECISION
function submitDecision() {
  if (!state.selectedDecision) {
    alert("Please select a decision (Include, Exclude, or Uncertain) first!");
    return;
  }

  const papers = getActivePapers();
  const currentPaper = papers[state.currentPaperIndex];
  const notes = document.getElementById('student-notes-input').value.trim();
  const reason = (state.selectedDecision === 'EXCLUDE') ? document.getElementById('select-exclusion-reason').value : null;

  const answerObj = {
    paperId: currentPaper.id,
    decision: state.selectedDecision,
    reason: reason,
    notes: notes,
    timestamp: new Date().toISOString()
  };

  const answers = getActiveAnswers();
  answers[currentPaper.id] = answerObj;
  saveAnswersToStorage();

  // If a lead just screened, clear any manual override for this paper so fresh consensus is computed
  if (state.userRole === 'lead' || state.userRole === 'colead') {
    if (state.leadDecisions.consensusOverrides?.[state.activeStage]?.[currentPaper.id]) {
      delete state.leadDecisions.consensusOverrides[state.activeStage][currentPaper.id];
      localStorage.setItem('sr_lead_consensus_overrides', JSON.stringify(state.leadDecisions.consensusOverrides));
    }
  }

  document.getElementById('decision-status-pill').textContent = 'Saved';
  document.getElementById('decision-status-pill').className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';

  updateProgressUI();
  updateLeadScreeningBanner(currentPaper);

  if (state.activeStage === 'training') {
    showTrainingFeedback(answerObj, currentPaper);
  } else {
    // In Exam 1 & 2: advance to next paper automatically
    if (state.currentPaperIndex < papers.length - 1) {
      setTimeout(() => { nextPaper(); }, 200);
    } else {
      // Completed exam
      if (state.userRole === 'lead' || state.userRole === 'colead') {
        const leadName = (state.userRole === 'lead') ? 'Zoe' : 'Eva';
        alert(`👑 Outstanding! You have screened all 30 papers in this Exam as Project Lead (${leadName})! Your manual choices have set the authoritative key. Opening your debrief scorecard now.`);
      } else {
        alert("🎉 Great job! You have screened all 30 papers in this Exam! Unlocking your debrief scorecard now.");
      }
      toggleView('scorecard');
    }
  }
}

// TRAINING FEEDBACK CARD
function showTrainingFeedback(answerObj, paper) {
  const card = document.getElementById('training-feedback-card');
  card.classList.remove('hidden');

  const banner = document.getElementById('feedback-banner');
  const iconContainer = document.getElementById('feedback-icon-container');
  const title = document.getElementById('feedback-title');
  const subtitle = document.getElementById('feedback-subtitle');
  const badge = document.getElementById('feedback-agreement-badge');

  const bench = getResolvedPaperDecisions(paper, state.activeStage);
  const isMatch = (answerObj.decision === bench.consensusDecision);
  const isMaybe = (answerObj.decision === 'MAYBE');

  if (state.userRole === 'lead' || state.userRole === 'colead') {
    // Lead Reviewer viewing feedback
    const myName = (state.userRole === 'lead') ? 'Zoe' : 'Eva';
    const peerName = (state.userRole === 'lead') ? 'Eva' : 'Zoe';
    const peerDecision = (state.userRole === 'lead') ? bench.evaDecision : bench.zoeDecision;
    const peerIsManual = (state.userRole === 'lead') ? bench.evaIsManual : bench.zoeIsManual;

    if (peerIsManual) {
      if (answerObj.decision === peerDecision) {
        banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-emerald-600 text-white';
        iconContainer.className = 'w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold';
        iconContainer.innerHTML = '🤝';
        title.textContent = `Full Co-Lead Agreement!`;
        subtitle.textContent = `Both you (${myName}) and ${peerName} independently voted ${answerObj.decision}.`;
        badge.textContent = 'Agreed';
      } else {
        banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-purple-600 text-white';
        iconContainer.className = 'w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold';
        iconContainer.innerHTML = '⚔️';
        title.textContent = `Lead Discrepancy with ${peerName}`;
        subtitle.textContent = `You chose ${answerObj.decision}, while ${peerName} chose ${peerDecision}. You can resolve consensus in the Lead Hub.`;
        badge.textContent = 'Conflict';
      }
    } else {
      banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-brand-600 text-white';
      iconContainer.className = 'w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center text-white font-bold';
      iconContainer.innerHTML = '👑';
      title.textContent = `Decision Recorded as Project Lead (${myName})`;
      subtitle.textContent = `Your decision (${answerObj.decision}) has set the official answer key. ${peerName} has not screened this paper yet.`;
      badge.textContent = 'Key Saved';
    }
  } else {
    // Student Reviewer viewing feedback
    if (isMatch) {
      banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-emerald-600 text-white';
      iconContainer.className = 'w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold';
      iconContainer.innerHTML = '✓';
      title.textContent = 'Agreement: Matches Consensus!';
      subtitle.textContent = `Your decision (${answerObj.decision}) aligns with the expert consensus of Project Leads Zoe and Eva.`;
      badge.textContent = 'Correct';
    } else if (isMaybe) {
      banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-amber-500 text-white';
      iconContainer.className = 'w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold';
      iconContainer.innerHTML = '?';
      title.textContent = 'Uncertain: Borderline Abstract';
      subtitle.textContent = `Consensus resolved to: ${bench.consensusDecision}. When uncertain, screening teams retrieve full-text.`;
      badge.textContent = 'Discussion';
    } else {
      banner.className = 'flex items-center justify-between p-3.5 rounded-xl mb-4 bg-brand-600 text-white';
      iconContainer.className = 'w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center text-white font-bold';
      iconContainer.innerHTML = '✕';
      title.textContent = 'Discrepancy: Disagrees with Consensus';
      subtitle.textContent = `You selected ${answerObj.decision}, but expert consensus is ${bench.consensusDecision}.`;
      badge.textContent = 'Discrepancy';
    }
  }

  // Update reviewer role title in feedback card
  const roleHeader = document.getElementById('fb-student-role-header');
  if (state.userRole === 'lead') {
    roleHeader.textContent = "Your Decision (Project Lead - Zoe)";
  } else if (state.userRole === 'colead') {
    roleHeader.textContent = "Your Decision (Project Lead - Eva)";
  } else {
    roleHeader.textContent = `Your Decision (${state.userName || 'Student'})`;
  }

  // Comparison Grid
  const elStd = document.getElementById('fb-decision-student');
  elStd.textContent = answerObj.decision + (answerObj.reason ? ` (${answerObj.reason})` : '');
  elStd.className = getDecisionColorClass(answerObj.decision);

  const elCon = document.getElementById('fb-decision-consensus');
  let conTag = '';
  if (bench.consensusStatus === 'AGREED') conTag = ' <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">🤝 Both Leads Agreed</span>';
  else if (bench.consensusStatus === 'OVERRIDE') conTag = ' <span class="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">⚖️ Resolved</span>';
  else if (bench.consensusStatus === 'CONFLICT') conTag = ' <span class="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">⚠️ Discrepancy</span>';
  elCon.innerHTML = `${bench.consensusDecision}${bench.exclusionCode ? ` (${bench.exclusionCode})` : ''}${conTag}`;
  elCon.className = getDecisionColorClass(bench.consensusDecision);

  const elLead = document.getElementById('fb-decision-lead');
  const zoeBadge = bench.zoeIsManual ? ' <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✓ Real Choice</span>' : ' <span class="text-[9px] text-slate-400 font-medium">(Baseline)</span>';
  elLead.innerHTML = `${bench.zoeDecision}${bench.zoeReason && bench.zoeDecision === 'EXCLUDE' ? ` (${bench.zoeReason})` : ''}${zoeBadge}`;
  elLead.className = getDecisionColorClass(bench.zoeDecision);

  const elCo = document.getElementById('fb-decision-colead');
  const evaBadge = bench.evaIsManual ? ' <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✓ Real Choice</span>' : ' <span class="text-[9px] text-slate-400 font-medium">(Baseline)</span>';
  elCo.innerHTML = `${bench.evaDecision}${bench.evaReason && bench.evaDecision === 'EXCLUDE' ? ` (${bench.evaReason})` : ''}${evaBadge}`;
  elCo.className = getDecisionColorClass(bench.evaDecision);

  // Rationale & Pearl
  document.getElementById('fb-rationale-text').textContent = paper.rationale;
  document.getElementById('fb-pearl-text').textContent = paper.learning_pearl;

  if (window.innerWidth < 1024) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function getDecisionColorClass(dec) {
  if (dec === 'INCLUDE') return 'font-extrabold text-emerald-600';
  if (dec === 'EXCLUDE') return 'font-extrabold text-brand-600';
  return 'font-extrabold text-amber-600';
}

// NAVIGATION
function nextPaper() {
  const papers = getActivePapers();
  if (state.currentPaperIndex < papers.length - 1) {
    state.currentPaperIndex++;
    state.activeHighlight = null;
    renderPaperCard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function prevPaper() {
  if (state.currentPaperIndex > 0) {
    state.currentPaperIndex--;
    state.activeHighlight = null;
    renderPaperCard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function jumpToPaper(idx) {
  const papers = getActivePapers();
  if (idx >= 0 && idx < papers.length) {
    state.currentPaperIndex = idx;
    state.activeHighlight = null;
    renderPaperCard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// PROGRESS AND PILLS
function updateProgressUI() {
  const papers = getActivePapers();
  const answers = getActiveAnswers();
  const total = papers.length;
  let incCount = 0;
  let excCount = 0;
  let maybeCount = 0;

  Object.values(answers).forEach(ans => {
    if (ans.decision === 'INCLUDE') incCount++;
    else if (ans.decision === 'EXCLUDE') excCount++;
    else if (ans.decision === 'MAYBE') maybeCount++;
  });

  const totalAnswered = incCount + excCount + maybeCount;
  const pct = total > 0 ? Math.round((totalAnswered / total) * 100) : 0;

  document.getElementById('badge-included-count').textContent = `${incCount} Inc`;
  document.getElementById('badge-excluded-count').textContent = `${excCount} Exc`;
  document.getElementById('badge-maybe-count').textContent = `${maybeCount} Maybe`;

  const bar = document.getElementById('progress-bar-fill');
  bar.style.width = `${Math.max(5, pct)}%`;

  // Render Jump Pills
  const pillGrid = document.getElementById('paper-pill-grid');
  pillGrid.innerHTML = '';

  papers.forEach((p, index) => {
    const ans = answers[p.id];
    const isCurrent = (index === state.currentPaperIndex);
    const pill = document.createElement('button');
    pill.textContent = p.id;
    pill.title = `Paper #${p.id}: ${p.title}`;
    pill.onclick = () => jumpToPaper(index);

    let baseClass = "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition shrink-0 ";
    if (isCurrent) {
      baseClass += "ring-2 ring-brand-600 ring-offset-1 ";
    }

    if (!ans) {
      baseClass += "bg-pink-50 text-slate-600 hover:bg-pink-100 border border-pink-200";
    } else if (ans.decision === 'INCLUDE') {
      baseClass += "bg-emerald-500 text-white hover:bg-emerald-600";
    } else if (ans.decision === 'EXCLUDE') {
      baseClass += "bg-brand-600 text-white hover:bg-brand-700";
    } else {
      baseClass += "bg-amber-500 text-white hover:bg-amber-600";
    }

    pill.className = baseClass;
    pillGrid.appendChild(pill);
  });
}

// GUIDELINES DRAWER
function toggleGuidelinesDrawer(show) {
  const container = document.getElementById('guidelines-drawer-container');
  if (show) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function formatPicoAsHtml(rawText, showBullets = state.showPicoBullets !== false) {
  if (!rawText || typeof rawText !== 'string') return '';

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';

  let rawItems = [];
  if (text.includes('\n')) {
    rawItems = text.split('\n');
  } else if (text.includes('•')) {
    rawItems = text.split('•');
  } else {
    rawItems = [text];
  }

  const items = [];
  for (let item of rawItems) {
    let s = item.trim();
    if (!s) continue;
    while (/^([•\-\*]|\d+[\.\)])\s*/.test(s)) {
      s = s.replace(/^([•\-\*]|\d+[\.\)])\s*/, '').trim();
    }
    if (s) items.push(s);
  }

  if (items.length === 0) return '';

  // The 1st line is NEVER a bullet! It represents the main overarching category statement
  const firstItem = items[0];
  const remainingItems = items.slice(1);

  let html = `<div class="pico-item-lead font-bold text-slate-800 leading-snug text-xs mb-1.5">${escapeHtml(firstItem)}</div>`;

  if (remainingItems.length > 0) {
    if (showBullets) {
      html += `
        <ul class="space-y-1.5 text-xs">
          ${remainingItems.map(item => `
            <li class="flex items-start space-x-2">
              <span class="text-brand-500 font-bold shrink-0 select-none text-xs leading-relaxed mt-0.5">•</span>
              <span class="pico-item-text flex-1 text-slate-700 leading-relaxed font-normal">${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      html += `
        <div class="space-y-1.5 text-xs pl-2.5 border-l-2 border-pink-200">
          ${remainingItems.map(item => `
            <div class="pico-item-text text-slate-700 leading-relaxed font-normal">${escapeHtml(item)}</div>
          `).join('')}
        </div>
      `;
    }
  }

  return html;
}

function togglePicoBullets() {
  state.showPicoBullets = !(state.showPicoBullets !== false);
  localStorage.setItem('sr_show_pico_bullets', JSON.stringify(state.showPicoBullets));
  updatePicoBulletsButtonUI();
  renderGuidelinesDrawerContent();
  showToast(state.showPicoBullets ? 'PICO sub-item bullets enabled' : 'PICO bullets removed', 'info');
}

function updatePicoBulletsButtonUI() {
  const btn = document.getElementById('btn-toggle-pico-bullets');
  const icon = document.getElementById('pico-bullets-toggle-icon');
  const label = document.getElementById('pico-bullets-toggle-label');
  if (!btn || !label) return;

  if (state.showPicoBullets !== false) {
    if (icon) icon.textContent = '⚪';
    label.textContent = 'Remove Bullets';
    btn.className = 'px-2.5 py-1 rounded-xl text-[11px] font-bold border border-pink-200 bg-white hover:bg-pink-50 text-slate-700 transition flex items-center space-x-1.5 shadow-sm';
  } else {
    if (icon) icon.textContent = '•';
    label.textContent = 'Show Bullets';
    btn.className = 'px-2.5 py-1 rounded-xl text-[11px] font-bold border border-brand-300 bg-pink-100/80 hover:bg-pink-200 text-brand-900 transition flex items-center space-x-1.5 shadow-sm';
  }
}

function formatPicoForTextarea(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';

  let rawItems = [];
  if (text.includes('\n')) {
    rawItems = text.split('\n');
  } else if (text.includes('•')) {
    rawItems = text.split('•');
  } else {
    rawItems = [text];
  }

  const items = [];
  for (let item of rawItems) {
    let s = item.trim();
    if (!s) continue;
    while (/^([•\-\*]|\d+[\.\)])\s*/.test(s)) {
      s = s.replace(/^([•\-\*]|\d+[\.\)])\s*/, '').trim();
    }
    if (s) items.push(s);
  }

  return items.join('\n');
}

function renderGuidelinesDrawerContent() {
  const g = state.guidelines;
  if (!g) return;

  updatePicoBulletsButtonUI();

  if (g.title) document.getElementById('drawer-title').textContent = g.title;
  if (g.objective || g.question) document.getElementById('drawer-question').textContent = g.objective || g.question;

  if (g.pico) {
    document.getElementById('drawer-pico-p').innerHTML = formatPicoAsHtml(g.pico.population, state.showPicoBullets);
    document.getElementById('drawer-pico-i').innerHTML = formatPicoAsHtml(g.pico.intervention, state.showPicoBullets);
    document.getElementById('drawer-pico-c').innerHTML = formatPicoAsHtml(g.pico.comparator, state.showPicoBullets);
    document.getElementById('drawer-pico-o').innerHTML = formatPicoAsHtml(g.pico.outcomes, state.showPicoBullets);
    document.getElementById('drawer-pico-s').innerHTML = formatPicoAsHtml(g.pico.studyDesign, state.showPicoBullets);
  }

  const exclContainer = document.getElementById('drawer-exclusion-list');
  exclContainer.innerHTML = '';
  if (g.exclusionCriteria && Array.isArray(g.exclusionCriteria)) {
    g.exclusionCriteria.forEach(item => {
      const row = document.createElement('div');
      row.className = 'p-2.5 rounded-xl bg-pink-50/60 border border-pink-200';
      row.innerHTML = `
        <div class="flex items-center space-x-2 mb-0.5">
          <span class="px-1.5 py-0.5 rounded bg-brand-100 text-brand-900 font-mono font-bold text-[10px]">${item.code}</span>
          <span class="font-bold text-slate-800 text-xs">${item.label}</span>
        </div>
        <p class="text-[11px] text-slate-600 leading-snug">${item.description}</p>
      `;
      exclContainer.appendChild(row);
    });
  }

  // Also sync the screening workspace exclusion dropdown
  const selectExcl = document.getElementById('select-exclusion-reason');
  if (selectExcl && g.exclusionCriteria && Array.isArray(g.exclusionCriteria) && g.exclusionCriteria.length > 0) {
    const curVal = selectExcl.value || state.selectedExclusionReason;
    selectExcl.innerHTML = '';
    g.exclusionCriteria.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = `${item.label} (${item.code})`;
      selectExcl.appendChild(opt);
    });
    if (curVal && Array.from(selectExcl.options).some(o => o.value === curVal)) {
      selectExcl.value = curVal;
      state.selectedExclusionReason = curVal;
    } else {
      selectExcl.value = g.exclusionCriteria[0].code;
      state.selectedExclusionReason = g.exclusionCriteria[0].code;
    }
  }

  const tipsContainer = document.getElementById('drawer-tips-list');
  tipsContainer.innerHTML = '';
  if (g.screeningTips && Array.isArray(g.screeningTips)) {
    g.screeningTips.forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsContainer.appendChild(li);
    });
  }
}

// VIEW SWITCHER
function toggleView(viewName) {
  const scrWorkspace = document.getElementById('screening-workspace');
  const scrScorecard = document.getElementById('scorecard-view');
  const btnHeader = document.getElementById('btn-view-scorecard');

  if (viewName === 'scorecard') {
    scrWorkspace.classList.add('hidden');
    scrScorecard.classList.remove('hidden');
    renderScorecardStats();
    renderScorecardTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btnHeader.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      <span>Back to Screen</span>
    `;
    btnHeader.onclick = () => toggleView('screening');
  } else {
    scrScorecard.classList.add('hidden');
    scrWorkspace.classList.remove('hidden');
    renderPaperCard();
    btnHeader.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
      <span>Scorecard</span>
    `;
    btnHeader.onclick = () => toggleView('scorecard');
  }
}

// SCORECARD CALCULATIONS
function calculateStats() {
  const papers = getActivePapers();
  const answers = getActiveAnswers();

  let screened = 0;
  let consensusMatches = 0;
  let leadMatches = 0;
  let coleadMatches = 0;
  let falseExclusions = 0;
  let falseInclusions = 0;

  let a = 0; // Both Include
  let b = 0; // Reviewer Include, Benchmark Exclude
  let c = 0; // Reviewer Exclude, Benchmark Include
  let d = 0; // Both Exclude

  papers.forEach(p => {
    const ans = answers[p.id];
    const bench = getResolvedPaperDecisions(p, state.activeStage);

    if (ans && ans.decision) {
      screened++;

      if (ans.decision === bench.consensusDecision) consensusMatches++;
      if (ans.decision === bench.zoeDecision) leadMatches++;
      if (ans.decision === bench.evaDecision) coleadMatches++;

      if (ans.decision === 'EXCLUDE' && bench.consensusDecision === 'INCLUDE') falseExclusions++;
      if (ans.decision === 'INCLUDE' && bench.consensusDecision === 'EXCLUDE') falseInclusions++;

      const stInc = (ans.decision === 'INCLUDE' || ans.decision === 'MAYBE');
      
      // Target benchmark for Cohen's Kappa
      let targetBenchmarkInc = (bench.consensusDecision === 'INCLUDE');
      if (state.userRole === 'lead' && bench.evaIsManual) {
        targetBenchmarkInc = (bench.evaDecision === 'INCLUDE');
      } else if (state.userRole === 'colead' && bench.zoeIsManual) {
        targetBenchmarkInc = (bench.zoeDecision === 'INCLUDE');
      }

      if (stInc && targetBenchmarkInc) a++;
      else if (stInc && !targetBenchmarkInc) b++;
      else if (!stInc && targetBenchmarkInc) c++;
      else if (!stInc && !targetBenchmarkInc) d++;
    }
  });

  let kappa = 0;
  let kappaLabel = "Pending";
  if (screened > 0) {
    const total = screened;
    const po = (a + d) / total;
    const pYesStudent = (a + b) / total;
    const pNoStudent = (c + d) / total;
    const pYesConsensus = (a + c) / total;
    const pNoConsensus = (b + d) / total;
    const pe = (pYesStudent * pYesConsensus) + (pNoStudent * pNoConsensus);

    if (pe < 1) {
      kappa = (po - pe) / (1 - pe);
    } else {
      kappa = 1;
    }

    if (kappa >= 0.81) kappaLabel = "Almost Perfect";
    else if (kappa >= 0.61) kappaLabel = "Substantial";
    else if (kappa >= 0.41) kappaLabel = "Moderate";
    else if (kappa >= 0.21) kappaLabel = "Fair";
    else if (kappa >= 0.0) kappaLabel = "Slight";
    else kappaLabel = "Poor";
  }

  const consensusAgreementPct = screened > 0 ? Math.round((consensusMatches / screened) * 100) : 0;
  const leadAgreementPct = screened > 0 ? Math.round((leadMatches / screened) * 100) : 0;
  const coleadAgreementPct = screened > 0 ? Math.round((coleadMatches / screened) * 100) : 0;

  return {
    totalPapers: papers.length,
    screened,
    consensusMatches,
    consensusAgreementPct,
    leadAgreementPct,
    coleadAgreementPct,
    falseExclusions,
    falseInclusions,
    kappa: Math.max(0, kappa).toFixed(2),
    kappaLabel
  };
}

function renderScorecardStats() {
  const stats = calculateStats();

  let rolePrefix = "Student";
  if (state.userRole === 'lead') rolePrefix = "Project Lead - Zoe";
  else if (state.userRole === 'colead') rolePrefix = "Project Lead - Eva";

  document.getElementById('scorecard-student-name').textContent = `${rolePrefix}: ${state.userName}`;

  let stageLabel = "Training";
  if (state.activeStage === 'exam1') stageLabel = "Exam 1";
  else if (state.activeStage === 'exam2') stageLabel = "Exam 2";
  document.getElementById('scorecard-round-badge').textContent = `${stageLabel} Debrief`;

  document.getElementById('stat-consensus-agreement').textContent = `${stats.consensusAgreementPct}%`;
  document.getElementById('stat-consensus-count').textContent = `(${stats.consensusMatches} / ${stats.screened} screened)`;
  
  document.getElementById('stat-cohens-kappa').textContent = stats.kappa;
  document.getElementById('stat-kappa-label').textContent = stats.kappaLabel;

  const leadLabelEl = document.getElementById('stat-lead-label');
  const coleadLabelEl = document.getElementById('stat-colead-label');

  if (state.userRole === 'lead') {
    if (leadLabelEl) leadLabelEl.textContent = "With Eva (Co-Lead):";
    document.getElementById('stat-lead-agree').textContent = `${stats.coleadAgreementPct}%`;
    if (coleadLabelEl) coleadLabelEl.textContent = "With Consensus:";
    document.getElementById('stat-colead-agree').textContent = `${stats.consensusAgreementPct}%`;
  } else if (state.userRole === 'colead') {
    if (leadLabelEl) leadLabelEl.textContent = "With Zoe (Lead):";
    document.getElementById('stat-lead-agree').textContent = `${stats.leadAgreementPct}%`;
    if (coleadLabelEl) coleadLabelEl.textContent = "With Consensus:";
    document.getElementById('stat-colead-agree').textContent = `${stats.consensusAgreementPct}%`;
  } else {
    if (leadLabelEl) leadLabelEl.textContent = "With Zoe (Lead):";
    document.getElementById('stat-lead-agree').textContent = `${stats.leadAgreementPct}%`;
    if (coleadLabelEl) coleadLabelEl.textContent = "With Eva (Lead):";
    document.getElementById('stat-colead-agree').textContent = `${stats.coleadAgreementPct}%`;
  }

  document.getElementById('stat-false-exclude').textContent = stats.falseExclusions;
  document.getElementById('stat-false-include').textContent = stats.falseInclusions;
}

// SCORECARD TABLE
function filterScorecardTable(type) {
  state.filterScorecard = type;
  
  ['all', 'matches', 'discrepancies', 'uncertain'].forEach(t => {
    const el = document.getElementById(`tab-filter-${t}`);
    if (el) {
      if (t === type) {
        el.className = "px-3 py-1 rounded-lg bg-brand-600 text-white font-extrabold shadow-sm transition";
      } else {
        el.className = "px-3 py-1 rounded-lg text-slate-600 hover:text-brand-700 font-bold transition";
      }
    }
  });

  renderScorecardTable();
}

function renderScorecardTable() {
  const tbody = document.getElementById('scorecard-table-body');
  tbody.innerHTML = '';

  const papers = getActivePapers();
  const answers = getActiveAnswers();

  let filtered = papers.filter(p => {
    const ans = answers[p.id];
    const bench = getResolvedPaperDecisions(p, state.activeStage);
    if (!ans) return (state.filterScorecard === 'all');

    if (state.filterScorecard === 'all') return true;
    if (state.filterScorecard === 'matches') return (ans.decision === bench.consensusDecision);
    if (state.filterScorecard === 'discrepancies') return (ans.decision !== bench.consensusDecision && ans.decision !== 'MAYBE');
    if (state.filterScorecard === 'uncertain') return (ans.decision === 'MAYBE');
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-medium">No papers match current filter.</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const ans = answers[p.id];
    const bench = getResolvedPaperDecisions(p, state.activeStage);
    const isAnswered = !!ans;
    const isMatch = isAnswered && (ans.decision === bench.consensusDecision);
    const isMaybe = isAnswered && (ans.decision === 'MAYBE');

    let statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-slate-500 border border-pink-200">Unscreened</span>`;
    if (isAnswered) {
      if (isMatch) {
        statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">Match</span>`;
      } else if (isMaybe) {
        statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">Uncertain</span>`;
      } else {
        statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">Discrepancy</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-pink-50/50 cursor-pointer transition";
    tr.onclick = () => toggleRowDetail(p.id);

    let consensusTag = '';
    if (bench.consensusStatus === 'AGREED') consensusTag = ' <span class="text-[9px] text-emerald-700 font-extrabold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 ml-0.5">🤝 Both</span>';
    else if (bench.consensusStatus === 'OVERRIDE') consensusTag = ' <span class="text-[9px] text-purple-700 font-extrabold bg-purple-50 px-1 py-0.5 rounded border border-purple-200 ml-0.5">⚖️ Resolved</span>';
    else if (bench.consensusStatus === 'CONFLICT') consensusTag = ' <span class="text-[9px] text-rose-700 font-extrabold bg-rose-50 px-1 py-0.5 rounded border border-rose-200 ml-0.5">⚠️ Diverged</span>';

    const zoeBadge = bench.zoeIsManual ? ' <span class="text-[9px] text-emerald-600 font-extrabold" title="Manual vote by Zoe">✓ Zoe</span>' : ' <span class="text-[9px] text-slate-300" title="Baseline dataset">(base)</span>';
    const evaBadge = bench.evaIsManual ? ' <span class="text-[9px] text-emerald-600 font-extrabold" title="Manual vote by Eva">✓ Eva</span>' : ' <span class="text-[9px] text-slate-300" title="Baseline dataset">(base)</span>';

    tr.innerHTML = `
      <td class="py-3 px-3 text-center font-extrabold text-slate-400">#${p.id}</td>
      <td class="py-3 px-3">
        <div class="font-extrabold text-slate-900 line-clamp-1">${escapeHtml(p.title)}</div>
        <div class="text-[11px] text-slate-400">${escapeHtml(p.journal)} (${p.year})</div>
      </td>
      <td class="py-3 px-3 text-center font-bold">
        ${isAnswered ? formatDecisionBadge(ans.decision) : '<span class="text-slate-300">-</span>'}
      </td>
      <td class="py-3 px-3 text-center font-bold">
        ${formatDecisionBadge(bench.consensusDecision)}${consensusTag}
      </td>
      <td class="py-3 px-3 text-center">
        ${formatDecisionBadge(bench.zoeDecision, true)}${zoeBadge}
      </td>
      <td class="py-3 px-3 text-center">
        ${formatDecisionBadge(bench.evaDecision, true)}${evaBadge}
      </td>
      <td class="py-3 px-3 text-center">
        ${statusPill}
      </td>
    `;
    tbody.appendChild(tr);

    // Detail Row
    const detailTr = document.createElement('tr');
    detailTr.id = `row-detail-${p.id}`;
    detailTr.className = "hidden bg-pink-50/40";
    detailTr.innerHTML = `
      <td colspan="7" class="p-4 border-t border-b border-pink-200">
        <div class="space-y-3 text-xs">
          <div>
            <h5 class="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Abstract</h5>
            <p class="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-pink-200 whitespace-pre-line">${escapeHtml(p.abstract)}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-xl border border-pink-200">
              <span class="font-bold text-brand-900 block mb-1">Lead Rationale & Consensus:</span>
              <p class="text-slate-700 leading-relaxed">${escapeHtml(p.rationale)}</p>
            </div>
            <div class="bg-amber-50 p-3 rounded-xl border border-amber-200">
              <span class="font-bold text-amber-900 block mb-1">Teaching Pearl:</span>
              <p class="text-amber-900 font-semibold leading-relaxed">${escapeHtml(p.learning_pearl)}</p>
            </div>
          </div>
          ${isAnswered && ans.notes ? `
            <div class="bg-white p-2.5 rounded-xl border border-pink-200">
              <span class="font-bold text-slate-500 uppercase text-[10px] block">Your Notes:</span>
              <p class="text-slate-700 italic">${escapeHtml(ans.notes)}</p>
            </div>
          ` : ''}
          <div class="flex justify-end pt-1">
            <button onclick="jumpToPaper(${p.id - 1}); toggleView('screening');" class="text-brand-600 hover:underline font-extrabold text-xs">
              Open in Screening Workspace &rarr;
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });
}

function toggleRowDetail(paperId) {
  const row = document.getElementById(`row-detail-${paperId}`);
  if (row) row.classList.toggle('hidden');
}

function formatDecisionBadge(dec, subtle = false) {
  if (dec === 'INCLUDE') {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${subtle ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-100 text-emerald-800'}">INCLUDE</span>`;
  } else if (dec === 'EXCLUDE') {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${subtle ? 'bg-rose-50 text-brand-700' : 'bg-rose-100 text-brand-900'}">EXCLUDE</span>`;
  } else {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${subtle ? 'bg-amber-50 text-amber-700' : 'bg-amber-100 text-amber-800'}">MAYBE</span>`;
  }
}

// EXPORT TO CSV (STUDENT RESULT DOWNLOAD)
function downloadResultsCSV() {
  const papers = getActivePapers();
  const answers = getActiveAnswers();
  const stageName = state.activeStage;
  
  let csv = "Stage,Paper_ID,Title,Journal,Year,DOI,Reviewer_Name,Reviewer_Role,Decision,Exclusion_Reason,Notes,Consensus_Decision,Lead_Decision,CoLead_Decision,Status,Timestamp\n";

  papers.forEach(p => {
    const ans = answers[p.id];
    const bench = getResolvedPaperDecisions(p, stageName);
    const stDec = ans ? ans.decision : "UNSCREENED";
    const stReason = ans ? (ans.reason || "") : "";
    const stNotes = ans ? (ans.notes || "").replace(/"/g, '""') : "";
    const status = !ans ? "UNSCREENED" : (ans.decision === bench.consensusDecision ? "MATCH" : (ans.decision === "MAYBE" ? "UNCERTAIN" : "DISCREPANCY"));
    const time = ans ? ans.timestamp : "";

    const titleClean = p.title.replace(/"/g, '""');
    const journalClean = p.journal.replace(/"/g, '""');

    csv += `"${stageName}",${p.id},"${titleClean}","${journalClean}",${p.year},"${p.doi || ''}","${state.userName}","${state.userRole}","${stDec}","${stReason}","${stNotes}","${bench.consensusDecision}","${bench.zoeDecision}","${bench.evaDecision}","${status}","${time}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SR_Screening_${state.userName.replace(/\s+/g, '_')}_${stageName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// COPY SUMMARY REPORT
function copySummaryReport() {
  const stats = calculateStats();
  const papers = getActivePapers();
  const answers = getActiveAnswers();

  let text = `========================================================\n`;
  text += `SYSTEMATIC REVIEW SCREENING TRAINING REPORT\n`;
  text += `Reviewer: ${state.userName} (${state.userRole.toUpperCase()})\n`;
  text += `Stage: ${state.activeStage.toUpperCase()} (${papers.length} Papers)\n`;
  text += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
  text += `--------------------------------------------------------\n`;
  text += `Consensus Agreement:      ${stats.consensusAgreementPct}% (${stats.consensusMatches}/${stats.screened})\n`;
  text += `Cohen's Kappa (κ):        ${stats.kappa} (${stats.kappaLabel})\n`;
  text += `Agreement with Zoe (Lead):  ${stats.leadAgreementPct}%\n`;
  text += `Agreement with Eva (Lead):  ${stats.coleadAgreementPct}%\n`;
  text += `Critical False Exclusions: ${stats.falseExclusions}\n`;
  text += `Over-Inclusions:          ${stats.falseInclusions}\n`;
  text += `--------------------------------------------------------\n`;
  text += `DISCREPANCY AUDIT:\n`;

  let discCount = 0;
  papers.forEach(p => {
    const ans = answers[p.id];
    const bench = getResolvedPaperDecisions(p, state.activeStage);
    if (ans && ans.decision !== bench.consensusDecision) {
      discCount++;
      text += `\n[#${p.id}] ${p.title}\n`;
      text += `  • Your Choice: ${ans.decision} ${ans.reason ? '(' + ans.reason + ')' : ''}\n`;
      text += `  • Consensus:   ${bench.consensusDecision}\n`;
      text += `  • Zoe (Lead): ${bench.zoeDecision} | Eva (Lead): ${bench.evaDecision}\n`;
      text += `  • Pearl: ${p.learning_pearl}\n`;
    }
  });

  if (discCount === 0) {
    text += `\nPerfect Score! 100% agreement with consensus!\n`;
  }

  text += `========================================================\n`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-report');
    const oldText = btn.innerHTML;
    btn.innerHTML = `<span class="text-brand-900 font-extrabold">✓ Copied!</span>`;
    setTimeout(() => { btn.innerHTML = oldText; }, 2500);
  });
}

// ROLE MODAL & MANAGEMENT
function openRoleModal() {
  document.getElementById('role-name-input').value = state.userName;
  state.tempRole = state.userRole;
  document.getElementById('role-modal-container').classList.remove('hidden');
}

function closeRoleModal() {
  document.getElementById('role-modal-container').classList.add('hidden');
}

function selectUserRole(role) {
  // If attempting to switch to Project Lead (zfisk) or Co-Lead (ekuhar), require password authentication!
  if (role === 'lead') {
    if (!state.authenticatedLead || state.authenticatedLead.role !== 'lead') {
      closeRoleModal();
      openLeadLoginModal('zfisk');
      return;
    }
  } else if (role === 'colead') {
    if (!state.authenticatedLead || state.authenticatedLead.role !== 'colead') {
      closeRoleModal();
      openLeadLoginModal('ekuhar');
      return;
    }
  }

  state.tempRole = role;
  const nameInput = document.getElementById('role-name-input');
  if (role === 'lead') nameInput.value = 'Project Lead - Zoe';
  else if (role === 'colead') nameInput.value = 'Project Lead - Eva';
  else nameInput.value = 'Student';
}

function saveRoleAndClose() {
  state.userRole = state.tempRole;
  const typedName = document.getElementById('role-name-input').value.trim();
  if (typedName) state.userName = typedName;

  // If switched back to student, clear lead auth
  if (state.userRole === 'student') {
    state.authenticatedLead = null;
    localStorage.removeItem('sr_auth_lead');
  }

  localStorage.setItem('sr_user_role', state.userRole);
  localStorage.setItem('sr_user_name', state.userName);

  closeRoleModal();
  renderApp();
}

// LEAD LOGIN MODAL & PASSWORD AUTH
function openLeadLoginModal(suggestedUsername = '') {
  document.getElementById('login-username-input').value = suggestedUsername || '';
  document.getElementById('login-password-input').value = '';
  document.getElementById('login-error-message').classList.add('hidden');
  document.getElementById('lead-login-modal-container').classList.remove('hidden');
  setTimeout(() => {
    if (suggestedUsername) {
      document.getElementById('login-password-input').focus();
    } else {
      document.getElementById('login-username-input').focus();
    }
  }, 100);
}

function closeLeadLoginModal() {
  document.getElementById('lead-login-modal-container').classList.add('hidden');
}

function submitLeadLogin() {
  const username = document.getElementById('login-username-input').value.trim();
  const password = document.getElementById('login-password-input').value.trim();
  const errorBox = document.getElementById('login-error-message');
  const errorText = document.getElementById('login-error-text');

  const account = LEAD_ACCOUNTS[username];
  if (!account || account.password !== password) {
    errorBox.classList.remove('hidden');
    errorText.textContent = "Invalid username or password. Access restricted to project leads.";
    return;
  }

  // Login Success!
  state.authenticatedLead = account;
  state.userRole = account.role;
  state.userName = account.name;

  localStorage.setItem('sr_auth_lead', username);
  localStorage.setItem('sr_user_role', account.role);
  localStorage.setItem('sr_user_name', account.name);

  closeLeadLoginModal();
  closeRoleModal();
  updateHeaderAndRoleUI();

  // Open Lead Hub
  openLeadHubModal();
}

function logoutLead() {
  state.authenticatedLead = null;
  state.userRole = 'student';
  state.userName = 'Student';

  localStorage.removeItem('sr_auth_lead');
  localStorage.setItem('sr_user_role', 'student');
  localStorage.setItem('sr_user_name', 'Student');

  closeLeadHubModal();
  updateHeaderAndRoleUI();
  renderApp();
  alert("Signed out of Lead Hub. Active reviewer identity is now Student.");
}

// LEAD HUB MODAL & GRADEBOOK
function openLeadHubModal() {
  // Password gate: must be authenticated as zfisk or ekuhar
  if (!state.authenticatedLead) {
    openLeadLoginModal();
    return;
  }

  const badge = document.getElementById('lead-auth-badge');
  if (badge) {
    badge.textContent = `Logged in: ${state.authenticatedLead.title}`;
  }

  renderLeadHubDashboard();
  renderGradebookTable();
  document.getElementById('lead-hub-modal-container').classList.remove('hidden');
}

function closeLeadHubModal() {
  document.getElementById('lead-hub-modal-container').classList.add('hidden');
}

// RENDER DUAL-LEAD MASTER SCREENING PROGRESS & DISCREPANCY RESOLVER
function renderLeadHubDashboard() {
  // Zoe counts
  const zTrain = Object.keys(state.leadDecisions.zoe?.training || {}).filter(k => state.leadDecisions.zoe.training[k]?.decision).length;
  const zE1 = Object.keys(state.leadDecisions.zoe?.exam1 || {}).filter(k => state.leadDecisions.zoe.exam1[k]?.decision).length;
  const zE2 = Object.keys(state.leadDecisions.zoe?.exam2 || {}).filter(k => state.leadDecisions.zoe.exam2[k]?.decision).length;
  const zTotal = zTrain + zE1 + zE2;
  const zPct = Math.round((zTotal / 70) * 100);

  // Eva counts
  const eTrain = Object.keys(state.leadDecisions.eva?.training || {}).filter(k => state.leadDecisions.eva.training[k]?.decision).length;
  const eE1 = Object.keys(state.leadDecisions.eva?.exam1 || {}).filter(k => state.leadDecisions.eva.exam1[k]?.decision).length;
  const eE2 = Object.keys(state.leadDecisions.eva?.exam2 || {}).filter(k => state.leadDecisions.eva.exam2[k]?.decision).length;
  const eTotal = eTrain + eE1 + eE2;
  const ePct = Math.round((eTotal / 70) * 100);

  // Update DOM for Zoe
  const elZTrain = document.getElementById('lead-zoe-train');
  if (elZTrain) {
    elZTrain.textContent = `${zTrain}/10`;
    document.getElementById('lead-zoe-exam1').textContent = `${zE1}/30`;
    document.getElementById('lead-zoe-exam2').textContent = `${zE2}/30`;
    document.getElementById('lead-zoe-total').textContent = `${zTotal}/70 (${zPct}%)`;
    document.getElementById('lead-zoe-bar').style.width = `${zPct}%`;
  }

  // Update DOM for Eva
  const elETrain = document.getElementById('lead-eva-train');
  if (elETrain) {
    elETrain.textContent = `${eTrain}/10`;
    document.getElementById('lead-eva-exam1').textContent = `${eE1}/30`;
    document.getElementById('lead-eva-exam2').textContent = `${eE2}/30`;
    document.getElementById('lead-eva-total').textContent = `${eTotal}/70 (${ePct}%)`;
    document.getElementById('lead-eva-bar').style.width = `${ePct}%`;
  }

  // Calculate mutual screening and discrepancies
  const stages = [
    { name: 'training', label: 'Training', papers: state.trainingPapers },
    { name: 'exam1', label: 'Exam 1', papers: state.exam1Papers },
    { name: 'exam2', label: 'Exam 2', papers: state.exam2Papers }
  ];

  let mutualCount = 0;
  let matchCount = 0;
  let a = 0, b = 0, c = 0, d = 0;
  const conflicts = [];

  stages.forEach(st => {
    st.papers.forEach(p => {
      const zAns = state.leadDecisions.zoe?.[st.name]?.[p.id];
      const eAns = state.leadDecisions.eva?.[st.name]?.[p.id];

      if (zAns?.decision && eAns?.decision) {
        mutualCount++;
        const zDec = zAns.decision;
        const eDec = eAns.decision;

        if (zDec === eDec) {
          matchCount++;
        } else {
          // Divergence
          const override = state.leadDecisions.consensusOverrides?.[st.name]?.[p.id];
          conflicts.push({
            stage: st.name,
            stageLabel: st.label,
            paper: p,
            zoeDecision: zDec,
            zoeReason: zAns.reason,
            evaDecision: eDec,
            evaReason: eAns.reason,
            override: override,
            activeConsensus: override || p.consensus_decision || zDec
          });
        }

        const zInc = (zDec === 'INCLUDE' || zDec === 'MAYBE');
        const eInc = (eDec === 'INCLUDE' || eDec === 'MAYBE');
        if (zInc && eInc) a++;
        else if (zInc && !eInc) b++;
        else if (!zInc && eInc) c++;
        else if (!zInc && !eInc) d++;
      }
    });
  });

  const rawAgreePct = mutualCount > 0 ? Math.round((matchCount / mutualCount) * 100) : 0;
  
  let kappa = "--";
  if (mutualCount > 0) {
    const total = mutualCount;
    const po = (a + d) / total;
    const pYesZoe = (a + b) / total;
    const pNoZoe = (c + d) / total;
    const pYesEva = (a + c) / total;
    const pNoEva = (b + d) / total;
    const pe = (pYesZoe * pYesEva) + (pNoZoe * pNoEva);
    if (pe < 1) {
      kappa = ((po - pe) / (1 - pe)).toFixed(2);
    } else {
      kappa = "1.00";
    }
  }

  const elMutual = document.getElementById('interlead-mutual');
  if (elMutual) {
    elMutual.textContent = `${mutualCount} papers`;
    document.getElementById('interlead-raw-agree').textContent = mutualCount > 0 ? `${rawAgreePct}%` : '--%';
    document.getElementById('interlead-kappa').textContent = kappa;
    document.getElementById('interlead-discrepancy-count').textContent = `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}`;
  }

  // Render Conflicts List
  const conflictsBadge = document.getElementById('conflicts-badge');
  const conflictsList = document.getElementById('conflicts-list-container');
  if (conflictsBadge && conflictsList) {
    conflictsBadge.textContent = `${conflicts.length} to resolve`;
    conflictsBadge.className = conflicts.length > 0
      ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200'
      : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200';

    if (conflicts.length === 0) {
      if (mutualCount > 0) {
        conflictsList.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center space-x-2">
            <span>✨</span>
            <span>Perfect alignment! All ${mutualCount} mutually screened papers between Zoe and Eva agree 100%.</span>
          </div>
        `;
      } else {
        conflictsList.innerHTML = `
          <div class="p-3 rounded-xl bg-pink-50 text-slate-500 border border-pink-100 text-xs text-center font-medium">
            No mutual papers screened yet. Both Zoe and Eva can screen papers in Training, Exam 1, and Exam 2 to compare.
          </div>
        `;
      }
    } else {
      conflictsList.innerHTML = '';
      conflicts.forEach(c => {
        const item = document.createElement('div');
        item.className = "p-3 rounded-xl bg-pink-50/60 border border-pink-200 space-y-2 text-xs";
        item.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-1">
            <div class="flex items-center space-x-1.5">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-pink-200 text-brand-900">${c.stageLabel}</span>
              <span class="font-extrabold text-slate-900">#${c.paper.id}</span>
              <span class="text-slate-700 font-semibold line-clamp-1 max-w-xs sm:max-w-md">${escapeHtml(c.paper.title)}</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="text-[10px] text-slate-500">Active Consensus:</span>
              <span class="font-extrabold ${getDecisionColorClass(c.activeConsensus)}">${c.activeConsensus}</span>
              ${c.override ? `<button onclick="clearLeadDiscrepancyOverride('${c.stage}', ${c.paper.id})" class="text-[10px] text-slate-400 hover:text-brand-600 underline ml-1" title="Clear manual override">Reset</button>` : ''}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div class="p-2 rounded-lg bg-white border border-pink-100">
              <span class="text-slate-500 font-bold block">Zoe's Vote:</span>
              <span class="font-black ${getDecisionColorClass(c.zoeDecision)}">${c.zoeDecision}</span>
              ${c.zoeReason ? `<span class="text-slate-500 text-[10px] block">${c.zoeReason}</span>` : ''}
            </div>
            <div class="p-2 rounded-lg bg-white border border-pink-100">
              <span class="text-slate-500 font-bold block">Eva's Vote:</span>
              <span class="font-black ${getDecisionColorClass(c.evaDecision)}">${c.evaDecision}</span>
              ${c.evaReason ? `<span class="text-slate-500 text-[10px] block">${c.evaReason}</span>` : ''}
            </div>
          </div>

          <div class="flex items-center space-x-1.5 pt-1">
            <span class="text-[10px] font-bold text-slate-600">Resolve Consensus:</span>
            <button onclick="resolveLeadDiscrepancy('${c.stage}', ${c.paper.id}, '${c.zoeDecision}')" class="px-2 py-1 rounded-lg bg-white hover:bg-pink-100 border border-pink-300 text-[11px] font-extrabold text-brand-900 transition ${c.override === c.zoeDecision ? 'ring-2 ring-brand-600 font-black' : ''}">
              Use Zoe's (${c.zoeDecision})
            </button>
            <button onclick="resolveLeadDiscrepancy('${c.stage}', ${c.paper.id}, '${c.evaDecision}')" class="px-2 py-1 rounded-lg bg-white hover:bg-pink-100 border border-pink-300 text-[11px] font-extrabold text-brand-900 transition ${c.override === c.evaDecision ? 'ring-2 ring-brand-600 font-black' : ''}">
              Use Eva's (${c.evaDecision})
            </button>
            <button onclick="resolveLeadDiscrepancy('${c.stage}', ${c.paper.id}, 'MAYBE')" class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[11px] font-bold text-amber-900 transition ${c.override === 'MAYBE' ? 'ring-2 ring-amber-500 font-black' : ''}">
              Mark Uncertain (MAYBE)
            </button>
          </div>
        `;
        conflictsList.appendChild(item);
      });
    }
  }
}

function switchAndScreenAs(role) {
  if (role === 'lead') {
    state.authenticatedLead = LEAD_ACCOUNTS['zfisk'];
    state.userRole = 'lead';
    state.userName = 'Zoe';
  } else if (role === 'colead') {
    state.authenticatedLead = LEAD_ACCOUNTS['ekuhar'];
    state.userRole = 'colead';
    state.userName = 'Eva';
  }
  localStorage.setItem('sr_auth_lead', (role === 'lead') ? 'zfisk' : 'ekuhar');
  localStorage.setItem('sr_user_role', role);
  localStorage.setItem('sr_user_name', state.userName);

  closeLeadHubModal();
  toggleView('screening');
  
  // Jump to first unscreened paper for this lead in active stage
  const papers = getActivePapers();
  const answers = getActiveAnswers();
  let firstUnscreened = papers.findIndex(p => !answers[p.id]?.decision);
  if (firstUnscreened === -1) firstUnscreened = 0;
  state.currentPaperIndex = firstUnscreened;

  renderApp();
}

function resolveLeadDiscrepancy(stage, paperId, decision) {
  if (!state.leadDecisions.consensusOverrides[stage]) {
    state.leadDecisions.consensusOverrides[stage] = {};
  }
  state.leadDecisions.consensusOverrides[stage][paperId] = decision;
  localStorage.setItem('sr_lead_consensus_overrides', JSON.stringify(state.leadDecisions.consensusOverrides));
  
  renderLeadHubDashboard();
  renderApp();
}

function clearLeadDiscrepancyOverride(stage, paperId) {
  if (state.leadDecisions.consensusOverrides[stage]) {
    delete state.leadDecisions.consensusOverrides[stage][paperId];
    localStorage.setItem('sr_lead_consensus_overrides', JSON.stringify(state.leadDecisions.consensusOverrides));
  }
  renderLeadHubDashboard();
  renderApp();
}

function scrollToConflictResolver() {
  const el = document.getElementById('interlead-conflicts-box');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function exportLeadDecisionsJSON() {
  const exportData = {
    appName: "Systematic Review Screening Trainer",
    exportDate: new Date().toISOString(),
    exportedBy: state.userName,
    exportedRole: state.userRole,
    zoe: state.leadDecisions.zoe,
    eva: state.leadDecisions.eva,
    consensusOverrides: state.leadDecisions.consensusOverrides
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SR_Lead_Decisions_Package_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importLeadDecisionsJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let importedCount = 0;

      ['training', 'exam1', 'exam2'].forEach(stage => {
        if (data.zoe && data.zoe[stage]) {
          Object.keys(data.zoe[stage]).forEach(id => {
            if (data.zoe[stage][id]?.decision) {
              state.leadDecisions.zoe[stage][id] = data.zoe[stage][id];
              importedCount++;
            }
          });
        }
        if (data.eva && data.eva[stage]) {
          Object.keys(data.eva[stage]).forEach(id => {
            if (data.eva[stage][id]?.decision) {
              state.leadDecisions.eva[stage][id] = data.eva[stage][id];
              importedCount++;
            }
          });
        }
        if (data.consensusOverrides && data.consensusOverrides[stage]) {
          Object.keys(data.consensusOverrides[stage]).forEach(id => {
            state.leadDecisions.consensusOverrides[stage][id] = data.consensusOverrides[stage][id];
          });
        }
      });

      localStorage.setItem('sr_lead_decisions_zoe', JSON.stringify(state.leadDecisions.zoe));
      localStorage.setItem('sr_lead_decisions_eva', JSON.stringify(state.leadDecisions.eva));
      localStorage.setItem('sr_lead_consensus_overrides', JSON.stringify(state.leadDecisions.consensusOverrides));

      renderLeadHubDashboard();
      renderApp();
      alert(`🎉 Successfully imported lead screening data! Merged decisions across Training, Exam 1, and Exam 2.`);
    } catch (err) {
      alert("Error parsing JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function exportUpdatedDataJS() {
  const defaultData = window.DEFAULT_DATA || { guidelines: {}, training: [], exam1: [], exam2: [] };
  
  // Deep clone default data
  const updatedData = JSON.parse(JSON.stringify(defaultData));
  
  ['training', 'exam1', 'exam2'].forEach(stage => {
    const papers = (stage === 'training') ? updatedData.training : (stage === 'exam1' ? updatedData.exam1 : updatedData.exam2);
    if (!Array.isArray(papers)) return;
    
    papers.forEach(p => {
      const bench = getResolvedPaperDecisions(p, stage);
      p.lead_decision = bench.zoeDecision;
      p.colead_decision = bench.evaDecision;
      p.consensus_decision = bench.consensusDecision;
      if (bench.exclusionCode && p.consensus_decision === 'EXCLUDE') {
        p.exclusion_code = bench.exclusionCode;
      }
    });
  });

  const jsContent = `// Bundled datasets for zero-server and offline file:// support\nwindow.DEFAULT_DATA = ${JSON.stringify(updatedData, null, 2)};\n`;
  const blob = new Blob([jsContent], { type: 'text/javascript;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `data.js`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupGradebookUpload() {
  const input = document.getElementById('input-gradebook-csv');
  if (!input) return;

  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    let processed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        processStudentSubmissionCSV(text, file.name);
        processed++;
        if (processed === files.length) {
          localStorage.setItem('sr_gradebook_roster', JSON.stringify(state.gradebookRoster));
          renderGradebookTable();
          alert(`Successfully uploaded and graded ${files.length} student submission(s)!`);
        }
      };
      reader.readAsText(file);
    });
  });
}

function processStudentSubmissionCSV(csvText, filename) {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return;

  // Header parse
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const nameIdx = header.indexOf('reviewer_name');
  const stageIdx = header.indexOf('stage');
  const idIdx = header.indexOf('paper_id') !== -1 ? header.indexOf('paper_id') : header.indexOf('id');
  const decIdx = header.indexOf('decision');
  const conIdx = header.indexOf('consensus_decision');
  const leadIdx = header.indexOf('lead_decision');
  const coleadIdx = header.indexOf('colead_decision');
  const statusIdx = header.indexOf('status');

  let studentName = filename.replace('.csv', '');
  let stageName = 'Exam';
  let total = 0;
  let matches = 0;
  let leadMatches = 0;
  let coleadMatches = 0;
  let falseExcl = 0;
  let falseIncl = 0;

  for (let i = 1; i < lines.length; i++) {
    // Quick split by comma accounting for quotes
    const cols = parseCSVRow(lines[i]);
    if (!cols || cols.length < 5) continue;

    if (nameIdx !== -1 && cols[nameIdx]) studentName = cols[nameIdx];
    if (stageIdx !== -1 && cols[stageIdx]) stageName = cols[stageIdx];

    let decision = (decIdx !== -1) ? cols[decIdx] : '';
    let consensus = (conIdx !== -1) ? cols[conIdx] : '';
    let lead = (leadIdx !== -1) ? cols[leadIdx] : '';
    let colead = (coleadIdx !== -1) ? cols[coleadIdx] : '';

    // If paper ID is available, evaluate against live authoritative lead decisions
    if (idIdx !== -1 && cols[idIdx]) {
      const pId = parseInt(cols[idIdx]);
      let stageKey = 'exam1';
      if (stageName.toLowerCase().includes('train')) stageKey = 'training';
      else if (stageName.toLowerCase().includes('2')) stageKey = 'exam2';

      const stagePapers = (stageKey === 'training') ? state.trainingPapers : (stageKey === 'exam1' ? state.exam1Papers : state.exam2Papers);
      const paper = stagePapers.find(p => p.id === pId);
      if (paper) {
        const bench = getResolvedPaperDecisions(paper, stageKey);
        consensus = bench.consensusDecision;
        lead = bench.zoeDecision;
        colead = bench.evaDecision;
      }
    }

    if (decision && decision !== 'UNSCREENED') {
      total++;
      if (decision === consensus) matches++;
      if (decision === lead) leadMatches++;
      if (decision === colead) coleadMatches++;
      if (decision === 'EXCLUDE' && consensus === 'INCLUDE') falseExcl++;
      if (decision === 'INCLUDE' && consensus === 'EXCLUDE') falseIncl++;
    }
  }

  const consensusPct = total > 0 ? Math.round((matches / total) * 100) : 0;
  const leadPct = total > 0 ? Math.round((leadMatches / total) * 100) : 0;
  const coleadPct = total > 0 ? Math.round((coleadMatches / total) * 100) : 0;

  // Estimate Cohen's Kappa
  const po = total > 0 ? (matches / total) : 0;
  const pe = 0.5; // Baseline approximation
  const kappa = pe < 1 ? ((po - pe) / (1 - pe)).toFixed(2) : "1.00";

  // Check if student record exists, update or add
  const existingIdx = state.gradebookRoster.findIndex(r => r.name === studentName && r.stage === stageName);
  const record = {
    name: studentName,
    stage: stageName,
    totalScreened: total,
    consensusPct: consensusPct,
    leadPct: leadPct,
    coleadPct: coleadPct,
    kappa: Math.max(0, kappa),
    falseExcl: falseExcl,
    timestamp: new Date().toLocaleDateString()
  };

  if (existingIdx !== -1) {
    state.gradebookRoster[existingIdx] = record;
  } else {
    state.gradebookRoster.push(record);
  }
}

function parseCSVRow(rowText) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < rowText.length; i++) {
    const ch = rowText[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function renderGradebookTable() {
  const tbody = document.getElementById('gradebook-table-body');
  const exportBtn = document.getElementById('btn-export-gradebook');
  if (!tbody) return;

  if (state.gradebookRoster.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-slate-400 font-medium">
          No student submissions uploaded yet. Have your students download their CSV after completing an exam and drop it here.
        </td>
      </tr>
    `;
    if (exportBtn) exportBtn.classList.add('hidden');
    return;
  }

  if (exportBtn) exportBtn.classList.remove('hidden');
  tbody.innerHTML = '';

  state.gradebookRoster.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-pink-50/50";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-extrabold text-slate-900">${escapeHtml(r.name)}</td>
      <td class="py-2.5 px-3 font-semibold text-brand-800 uppercase text-[10px]">${escapeHtml(r.stage)}</td>
      <td class="py-2.5 px-3 text-center font-extrabold text-brand-700">${r.consensusPct}%</td>
      <td class="py-2.5 px-3 text-center font-bold text-slate-700">${r.leadPct}%</td>
      <td class="py-2.5 px-3 text-center font-bold text-slate-700">${r.coleadPct !== undefined ? r.coleadPct : r.leadPct}%</td>
      <td class="py-2.5 px-3 text-center font-bold text-emerald-700">${r.kappa}</td>
      <td class="py-2.5 px-3 text-center font-bold text-rose-700">${r.falseExcl}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadGradebookSummaryCSV() {
  if (state.gradebookRoster.length === 0) return;

  let csv = "Student_Name,Exam_Stage,Total_Screened,Consensus_Agreement_Pct,With_Zoe_Agreement_Pct,With_Eva_Agreement_Pct,Cohens_Kappa,Missed_Studies_False_Excl,Date\n";
  state.gradebookRoster.forEach(r => {
    csv += `"${r.name}","${r.stage}",${r.totalScreened},"${r.consensusPct}%","${r.leadPct}%","${r.coleadPct !== undefined ? r.coleadPct : r.leadPct}%",${r.kappa},${r.falseExcl},"${r.timestamp}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SR_Class_Gradebook_Summary.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadMasterKey(stage) {
  let papers = state.exam1Papers;
  if (stage === 'training') papers = state.trainingPapers;
  else if (stage === 'exam2') papers = state.exam2Papers;

  let csv = "Paper_ID,Title,DOI,Consensus_Decision,Lead_Decision_Zoe,CoLead_Decision_Eva,Exclusion_Code,Rationale,Learning_Pearl\n";

  papers.forEach(p => {
    const bench = getResolvedPaperDecisions(p, stage);
    const titleClean = p.title.replace(/"/g, '""');
    const ratClean = p.rationale.replace(/"/g, '""');
    const pearlClean = p.learning_pearl.replace(/"/g, '""');
    csv += `${p.id},"${titleClean}","${p.doi || ''}","${bench.consensusDecision}","${bench.zoeDecision}","${bench.evaDecision}","${bench.exclusionCode || ''}","${ratClean}","${pearlClean}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Lead_Master_Key_${stage.toUpperCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// SETTINGS & FILE IMPORT
function openSettingsModal() {
  document.getElementById('settings-modal-container').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal-container').classList.add('hidden');
}

function setupCustomFileUpload() {
  const input = document.getElementById('file-input-papers');
  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const targetStage = document.getElementById('select-import-stage').value;

      try {
        let papers = [];
        if (file.name.endsWith('.json')) {
          papers = JSON.parse(content);
        } else {
          // Parse CSV
          papers = parseCSVToPapers(content);
        }

        if (targetStage === 'training') {
          state.trainingPapers = papers;
          localStorage.setItem('sr_custom_training', JSON.stringify(papers));
        } else if (targetStage === 'exam1') {
          state.exam1Papers = papers;
          localStorage.setItem('sr_custom_exam1', JSON.stringify(papers));
        } else {
          state.exam2Papers = papers;
          localStorage.setItem('sr_custom_exam2', JSON.stringify(papers));
        }

        alert(`Successfully loaded ${papers.length} papers into ${targetStage}!`);
        closeSettingsModal();
        renderApp();
      } catch (err) {
        alert("Error parsing file: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

function parseCSVToPapers(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
  const papers = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    if (!cols || cols.length < 2) continue;

    const paper = {
      id: i,
      title: '',
      authors: '',
      journal: '',
      year: 2023,
      doi: '',
      abstract: '',
      lead_decision: 'INCLUDE',
      colead_decision: 'INCLUDE',
      consensus_decision: 'INCLUDE',
      exclusion_code: null,
      difficulty: 'Standard',
      rationale: '',
      learning_pearl: ''
    };

    headers.forEach((h, colIdx) => {
      const val = cols[colIdx] || '';
      if (h === 'id') paper.id = parseInt(val, 10) || i;
      else if (h.includes('title')) paper.title = val;
      else if (h.includes('author')) paper.authors = val;
      else if (h.includes('journal')) paper.journal = val;
      else if (h.includes('year')) paper.year = parseInt(val, 10) || 2023;
      else if (h.includes('doi')) paper.doi = val;
      else if (h.includes('abstract')) paper.abstract = val;
      else if (h.includes('leaddecision') || h === 'lead') paper.lead_decision = val.toUpperCase();
      else if (h.includes('colead')) paper.colead_decision = val.toUpperCase();
      else if (h.includes('consensus')) paper.consensus_decision = val.toUpperCase();
      else if (h.includes('exclusion')) paper.exclusion_code = val || null;
      else if (h.includes('rationale')) paper.rationale = val;
      else if (h.includes('pearl')) paper.learning_pearl = val;
    });

    if (paper.title || paper.abstract) papers.push(paper);
  }

  return papers;
}

function downloadTemplateCSV() {
  let csv = "id,title,authors,journal,year,doi,abstract,lead_decision,colead_decision,consensus_decision,exclusion_code,difficulty,rationale,learning_pearl\n";
  csv += '1,"Sample Paper Title","Smith, J., et al.","Shock",2023,"10.1097/SHK.0000000000001944","Background: Cecal ligation and puncture... Methods: In this CLP model... Results: Survival improved...","INCLUDE","INCLUDE","INCLUDE","","Easy","Meets animal sepsis criteria","Verify animal model and intervention"\n';
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "systematic_review_papers_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function applyCustomPapers() {
  const targetStage = document.getElementById('select-import-stage').value;
  const jsonText = document.getElementById('textarea-custom-json').value.trim();

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of papers.");

      if (targetStage === 'training') {
        state.trainingPapers = parsed;
        localStorage.setItem('sr_custom_training', JSON.stringify(parsed));
      } else if (targetStage === 'exam1') {
        state.exam1Papers = parsed;
        localStorage.setItem('sr_custom_exam1', JSON.stringify(parsed));
      } else {
        state.exam2Papers = parsed;
        localStorage.setItem('sr_custom_exam2', JSON.stringify(parsed));
      }

      alert(`Successfully loaded ${parsed.length} papers into ${targetStage}!`);
      closeSettingsModal();
      renderApp();
    } catch (e) {
      alert("Invalid JSON: " + e.message);
    }
  }
}

function resetCurrentStageProgress() {
  if (confirm(`Reset all saved answers for ${state.activeStage}?`)) {
    if (state.userRole === 'lead') {
      state.leadDecisions.zoe[state.activeStage] = {};
      localStorage.setItem('sr_lead_decisions_zoe', JSON.stringify(state.leadDecisions.zoe));
    } else if (state.userRole === 'colead') {
      state.leadDecisions.eva[state.activeStage] = {};
      localStorage.setItem('sr_lead_decisions_eva', JSON.stringify(state.leadDecisions.eva));
    } else {
      state.answers[state.activeStage] = {};
      localStorage.removeItem(`sr_answers_${state.activeStage}`);
    }
    state.currentPaperIndex = 0;
    renderApp();
    closeSettingsModal();
    alert(`Progress for ${state.activeStage} reset.`);
  }
}

function resetAllData() {
  if (confirm("Reset ALL answers, roles, and uploaded gradebook data?")) {
    localStorage.clear();
    location.reload();
  }
}

// KEYBOARD SHORTCUTS
function bindKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    if (e.key === '1' || key === 'i') {
      e.preventDefault();
      selectDecision('INCLUDE');
    } else if (e.key === '2' || key === 'e') {
      e.preventDefault();
      selectDecision('EXCLUDE');
    } else if (e.key === '3' || key === 'm') {
      e.preventDefault();
      selectDecision('MAYBE');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const feedbackVisible = !document.getElementById('training-feedback-card').classList.contains('hidden');
      if (feedbackVisible && state.activeStage === 'training') {
        nextPaper();
      } else {
        submitDecision();
      }
    } else if (key === 'n' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextPaper();
    } else if (key === 'p' || e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPaper();
    } else if (key === 'g') {
      e.preventDefault();
      const drawer = document.getElementById('guidelines-drawer-container');
      toggleGuidelinesDrawer(drawer.classList.contains('hidden'));
    } else if (e.key === 'Escape') {
      toggleGuidelinesDrawer(false);
      closeSettingsModal();
      closeRoleModal();
      closeLeadHubModal();
      closeLeadLoginModal();
      closePaperEditorModal();
      closeGuidelinesEditorModal();
      if (state.isInlineEditActive) cancelInlineEdits();
    }
  });
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// DIRECT INLINE & MODAL EDITING SYSTEM
state.isInlineEditActive = false;

const INLINE_EDITABLE_SELECTORS = [
  '#header-project-title',
  '#paper-title',
  '#paper-authors',
  '#paper-abstract',
  '#fb-rationale-text',
  '#fb-pearl-text',
  '#drawer-title',
  '#drawer-question',
  '#drawer-pico-p',
  '#drawer-pico-i',
  '#drawer-pico-c',
  '#drawer-pico-o',
  '#drawer-pico-s'
];

function toggleInlineEditMode() {
  state.isInlineEditActive = !state.isInlineEditActive;
  const floatingBar = document.getElementById('inline-edit-floating-bar');
  const btnLabel = document.getElementById('btn-inline-edit-label');

  INLINE_EDITABLE_SELECTORS.forEach(selector => {
    const el = document.querySelector(selector);
    if (!el) return;
    if (state.isInlineEditActive) {
      el.contentEditable = "true";
      el.classList.add('is-inline-editable');
    } else {
      el.contentEditable = "false";
      el.classList.remove('is-inline-editable');
    }
  });

  if (state.isInlineEditActive) {
    if (floatingBar) floatingBar.classList.remove('hidden');
    if (btnLabel) btnLabel.textContent = 'Editing...';
    showToast('Direct Edit Mode ON: Click any outlined text to edit!', 'info');
  } else {
    if (floatingBar) floatingBar.classList.add('hidden');
    if (btnLabel) btnLabel.textContent = '✏️ Edit Text';
  }
}

function extractPicoTextFromElement(el) {
  if (!el) return '';
  const lines = [];
  const leadEl = el.querySelector('.pico-item-lead');
  if (leadEl) {
    const leadText = leadEl.textContent.trim();
    if (leadText) lines.push(leadText);
  }
  const itemTexts = el.querySelectorAll('.pico-item-text');
  if (itemTexts.length > 0) {
    itemTexts.forEach(item => {
      const t = item.textContent.trim();
      if (t) lines.push(t);
    });
    return lines.join('\n');
  }
  if (lines.length > 0) {
    return lines.join('\n');
  }
  const listItems = el.querySelectorAll('li');
  if (listItems.length > 0) {
    return Array.from(listItems)
      .map(li => {
        let s = li.textContent.trim();
        while (/^([•\-\*]|\d+[\.\)])\s*/.test(s)) {
          s = s.replace(/^([•\-\*]|\d+[\.\)])\s*/, '').trim();
        }
        return s;
      })
      .filter(Boolean)
      .join('\n');
  }
  return el.innerText.trim();
}

function saveInlineEdits() {
  const currentPaper = getActivePapers()[state.currentPaperIndex];

  // 1. Save Paper Edits if elements exist
  const elTitle = document.getElementById('paper-title');
  if (elTitle && currentPaper) currentPaper.title = elTitle.innerText.trim();

  const elAuthors = document.getElementById('paper-authors');
  if (elAuthors && currentPaper) currentPaper.authors = elAuthors.innerText.trim();

  const elAbstract = document.getElementById('paper-abstract');
  if (elAbstract && currentPaper) currentPaper.abstract = elAbstract.innerText.trim();

  const elRationale = document.getElementById('fb-rationale-text');
  if (elRationale && currentPaper) currentPaper.rationale = elRationale.innerText.trim();

  const elPearl = document.getElementById('fb-pearl-text');
  if (elPearl && currentPaper) currentPaper.learning_pearl = elPearl.innerText.trim();

  // 2. Save Guidelines Edits if elements exist
  if (state.guidelines) {
    const elHeaderProj = document.getElementById('header-project-title');
    if (elHeaderProj) state.guidelines.title = elHeaderProj.innerText.trim();

    const elQuestion = document.getElementById('drawer-question');
    if (elQuestion) {
      state.guidelines.question = elQuestion.innerText.trim();
      state.guidelines.objective = state.guidelines.question;
    }

    if (!state.guidelines.pico) state.guidelines.pico = {};
    const elP = document.getElementById('drawer-pico-p');
    if (elP) state.guidelines.pico.population = extractPicoTextFromElement(elP);
    const elI = document.getElementById('drawer-pico-i');
    if (elI) state.guidelines.pico.intervention = extractPicoTextFromElement(elI);
    const elC = document.getElementById('drawer-pico-c');
    if (elC) state.guidelines.pico.comparator = extractPicoTextFromElement(elC);
    const elO = document.getElementById('drawer-pico-o');
    if (elO) state.guidelines.pico.outcomes = extractPicoTextFromElement(elO);
    const elS = document.getElementById('drawer-pico-s');
    if (elS) state.guidelines.pico.studyDesign = extractPicoTextFromElement(elS);

    localStorage.setItem('sr_custom_guidelines', JSON.stringify(state.guidelines));
  }

  // Persist updated papers
  localStorage.setItem(`sr_custom_${state.activeStage}`, JSON.stringify(getActivePapers()));

  // Exit edit mode
  toggleInlineEditMode();
  renderApp();
  showToast('Saved! Your text changes are now live and saved in browser.', 'success');
}

function cancelInlineEdits() {
  toggleInlineEditMode();
  renderPaperCard();
  renderGuidelinesDrawerContent();
  showToast('Edits cancelled.', 'info');
}

// PAPER MODAL EDITOR
function openPaperEditorModal() {
  const paper = getActivePapers()[state.currentPaperIndex];
  if (!paper) return;

  const headingEl = document.getElementById('paper-editor-heading');
  if (headingEl) headingEl.textContent = `Edit Paper #${paper.id} (${paper.title.slice(0, 35)}...)`;

  document.getElementById('edit-paper-title').value = paper.title || '';
  document.getElementById('edit-paper-authors').value = paper.authors || '';
  document.getElementById('edit-paper-journal').value = paper.journal || '';
  document.getElementById('edit-paper-year').value = paper.year || 2022;
  document.getElementById('edit-paper-abstract').value = paper.abstract || '';
  document.getElementById('edit-paper-consensus').value = paper.consensus_decision || 'INCLUDE';

  const exclSelect = document.getElementById('edit-paper-exclusion-code');
  if (exclSelect) {
    const curCode = paper.exclusion_code || '';
    if (state.guidelines && state.guidelines.exclusionCriteria && state.guidelines.exclusionCriteria.length > 0) {
      exclSelect.innerHTML = '<option value="">None (Included)</option>';
      state.guidelines.exclusionCriteria.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = `${item.code} (${item.label})`;
        exclSelect.appendChild(opt);
      });
    }
    exclSelect.value = curCode;
  }

  document.getElementById('edit-paper-rationale').value = paper.rationale || '';
  document.getElementById('edit-paper-pearl').value = paper.learning_pearl || '';

  document.getElementById('paper-editor-modal-container').classList.remove('hidden');
}

function closePaperEditorModal() {
  const modal = document.getElementById('paper-editor-modal-container');
  if (modal) modal.classList.add('hidden');
}

function savePaperEditor() {
  const paper = getActivePapers()[state.currentPaperIndex];
  if (!paper) return;

  paper.title = document.getElementById('edit-paper-title').value.trim();
  paper.authors = document.getElementById('edit-paper-authors').value.trim();
  paper.journal = document.getElementById('edit-paper-journal').value.trim();
  paper.year = parseInt(document.getElementById('edit-paper-year').value, 10) || 2022;
  paper.abstract = document.getElementById('edit-paper-abstract').value.trim();
  paper.consensus_decision = document.getElementById('edit-paper-consensus').value;
  paper.lead_decision = paper.consensus_decision;
  paper.colead_decision = paper.consensus_decision;

  const exclCode = document.getElementById('edit-paper-exclusion-code').value.trim();
  paper.exclusion_code = (paper.consensus_decision === 'EXCLUDE' && exclCode) ? exclCode : null;

  paper.rationale = document.getElementById('edit-paper-rationale').value.trim();
  paper.learning_pearl = document.getElementById('edit-paper-pearl').value.trim();

  // Persist to local storage
  localStorage.setItem(`sr_custom_${state.activeStage}`, JSON.stringify(getActivePapers()));

  closePaperEditorModal();
  renderPaperCard();
  renderFeedbackCard();
  showToast(`Paper #${paper.id} updated and saved!`, 'success');
}

// GUIDELINES MODAL EDITOR
function openGuidelinesEditorModal() {
  const g = state.guidelines || {};
  document.getElementById('edit-gl-title').value = g.title || '';
  document.getElementById('edit-gl-question').value = g.objective || g.question || '';
  document.getElementById('edit-gl-population').value = formatPicoForTextarea(g.pico?.population);
  document.getElementById('edit-gl-intervention').value = formatPicoForTextarea(g.pico?.intervention);
  document.getElementById('edit-gl-comparator').value = formatPicoForTextarea(g.pico?.comparator);
  document.getElementById('edit-gl-outcomes').value = formatPicoForTextarea(g.pico?.outcomes);
  document.getElementById('edit-gl-studydesign').value = formatPicoForTextarea(g.pico?.studyDesign);
  document.getElementById('edit-gl-tips').value = (g.screeningTips || []).join('\n');

  const chk = document.getElementById('edit-gl-show-bullets');
  if (chk) chk.checked = (state.showPicoBullets !== false);

  document.getElementById('guidelines-editor-modal-container').classList.remove('hidden');
}

function closeGuidelinesEditorModal() {
  const modal = document.getElementById('guidelines-editor-modal-container');
  if (modal) modal.classList.add('hidden');
}

function stripAllBulletsFromModal() {
  const ids = ['edit-gl-population', 'edit-gl-intervention', 'edit-gl-comparator', 'edit-gl-outcomes', 'edit-gl-studydesign'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = formatPicoForTextarea(el.value);
  });
  showToast('Stripped bullet symbols from all PICO fields!', 'success');
}

function saveGuidelinesEditor() {
  if (!state.guidelines) state.guidelines = {};

  state.guidelines.title = document.getElementById('edit-gl-title').value.trim();
  state.guidelines.question = document.getElementById('edit-gl-question').value.trim();
  state.guidelines.objective = state.guidelines.question;

  if (!state.guidelines.pico) state.guidelines.pico = {};
  state.guidelines.pico.population = document.getElementById('edit-gl-population').value.trim();
  state.guidelines.pico.intervention = document.getElementById('edit-gl-intervention').value.trim();
  state.guidelines.pico.comparator = document.getElementById('edit-gl-comparator').value.trim();
  state.guidelines.pico.outcomes = document.getElementById('edit-gl-outcomes').value.trim();
  state.guidelines.pico.studyDesign = document.getElementById('edit-gl-studydesign').value.trim();

  const chk = document.getElementById('edit-gl-show-bullets');
  if (chk) {
    state.showPicoBullets = chk.checked;
    localStorage.setItem('sr_show_pico_bullets', JSON.stringify(state.showPicoBullets));
    updatePicoBulletsButtonUI();
  }

  const tipsRaw = document.getElementById('edit-gl-tips').value;
  state.guidelines.screeningTips = tipsRaw.split('\n').map(t => t.trim()).filter(Boolean);

  if (state.guidelines.exclusionCriteria && Array.isArray(state.guidelines.exclusionCriteria)) {
    state.guidelines.exclusionCriteria = state.guidelines.exclusionCriteria.filter(item => item.code !== 'EX-NOT-BENEFICIAL');
    if (!state.guidelines.exclusionCriteria.some(item => item.code === 'EX-CLINICAL')) {
      state.guidelines.exclusionCriteria.unshift({
        code: "EX-CLINICAL",
        label: "Clinical Paper / Human Patients",
        description: "Human clinical trials, ICU patient studies, observational cohorts, or clinical case reports. Our review is strictly limited to preclinical mammalian laboratory animal models!"
      });
    }
  }

  localStorage.setItem('sr_custom_guidelines', JSON.stringify(state.guidelines));

  closeGuidelinesEditorModal();
  document.getElementById('header-project-title').textContent = state.guidelines.title;
  renderGuidelinesDrawerContent();
  showToast('Guidelines & PICO updated successfully!', 'success');
}

// EXPORT EDITED DATA.JS
function downloadUpdatedDataJs() {
  const exportPayload = {
    guidelines: state.guidelines || (window.DEFAULT_DATA ? window.DEFAULT_DATA.guidelines : {}),
    training: state.trainingPapers || [],
    exam1: state.exam1Papers || [],
    exam2: state.exam2Papers || []
  };

  const jsContent = `// Bundled datasets for zero-server and offline file:// support\nwindow.DEFAULT_DATA = ${JSON.stringify(exportPayload, null, 2)};\n`;

  const blob = new Blob([jsContent], { type: 'application/javascript;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded data.js! Replace data.js in your folder to make changes permanent.', 'success');
}

// FACTORY RESET TEXT
function revertTextToDefaults() {
  if (!confirm("Are you sure you want to revert all text to factory defaults? Any custom text changes will be reset.")) return;

  localStorage.removeItem('sr_custom_guidelines');
  localStorage.removeItem('sr_custom_training');
  localStorage.removeItem('sr_custom_exam1');
  localStorage.removeItem('sr_custom_exam2');

  const defaultData = window.DEFAULT_DATA || { guidelines: {}, training: [], exam1: [], exam2: [] };
  state.guidelines = JSON.parse(JSON.stringify(defaultData.guidelines));
  state.trainingPapers = JSON.parse(JSON.stringify(defaultData.training));
  state.exam1Papers = JSON.parse(JSON.stringify(defaultData.exam1));
  state.exam2Papers = JSON.parse(JSON.stringify(defaultData.exam2));

  renderApp();
  closeSettingsModal();
  showToast('Restored all text to original factory defaults!', 'info');
}

// TOAST NOTIFICATION
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-notification');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.className = 'fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-black transition transform duration-200 flex items-center space-x-2 ';

  if (type === 'success') {
    toast.className += 'bg-emerald-600 text-white';
  } else if (type === 'error') {
    toast.className += 'bg-rose-600 text-white';
  } else {
    toast.className += 'bg-slate-900 text-white border border-slate-700';
  }

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
