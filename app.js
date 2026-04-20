const LABELS = ['NAI', 'VAI', 'OAI'];
const CONFUSION_MATRIX = [
  [16255, 1443, 8],
  [4596, 2085, 28],
  [311, 321, 13],
];
const CONFUSION_MATRIX_SUMMARY = {
  accuracy: '73.24%',
  macroF1: '42.29%',
  title: 'Confusion matrix',
};
const FIELD_ORDER = [
  'State',
  'Zip',
  'Country_Area',
  'Fiscal_Year',
  'Project_Area',
  'Product_Type',
  'Presidential_Administration',
  'President_Party',
  'Years_Since_Admin_Start',
  'Product_Type_Warning_Letter_Frequency',
  'Product_Type_Injunction_Frequency',
  'Region',
  'US_Region',
  'Past_Inspections',
  'Past_NAI',
  'Past_VAI',
  'Past_OAI',
];

const stateMap = {
  'Connecticut': 'Northeast',
  'Maine': 'Northeast',
  'Massachusetts': 'Northeast',
  'New Hampshire': 'Northeast',
  'Rhode Island': 'Northeast',
  'Vermont': 'Northeast',
  'New Jersey': 'Northeast',
  'New York': 'Northeast',
  'Pennsylvania': 'Northeast',
  'Illinois': 'Midwest',
  'Indiana': 'Midwest',
  'Michigan': 'Midwest',
  'Ohio': 'Midwest',
  'Wisconsin': 'Midwest',
  'Iowa': 'Midwest',
  'Kansas': 'Midwest',
  'Minnesota': 'Midwest',
  'Missouri': 'Midwest',
  'Nebraska': 'Midwest',
  'North Dakota': 'Midwest',
  'South Dakota': 'Midwest',
  'Delaware': 'South',
  'Florida': 'South',
  'Georgia': 'South',
  'Maryland': 'South',
  'North Carolina': 'South',
  'South Carolina': 'South',
  'Virginia': 'South',
  'District of Columbia': 'South',
  'West Virginia': 'South',
  'Alabama': 'South',
  'Kentucky': 'South',
  'Mississippi': 'South',
  'Tennessee': 'South',
  'Arkansas': 'South',
  'Louisiana': 'South',
  'Oklahoma': 'South',
  'Texas': 'South',
  'Arizona': 'West',
  'Colorado': 'West',
  'Idaho': 'West',
  'Montana': 'West',
  'Nevada': 'West',
  'New Mexico': 'West',
  'Utah': 'West',
  'Wyoming': 'West',
  'Alaska': 'West',
  'California': 'West',
  'Hawaii': 'West',
  'Oregon': 'West',
  'Washington': 'West',
  'Puerto Rico': 'Territory',
  'Virgin Islands': 'Territory',
  'Guam': 'Territory',
  'Northern Mariana Islands': 'Territory',
  'American Samoa': 'Territory',
  '-': 'Unknown',
};

function mapAdministration(year) {
  if (year >= 2009 && year <= 2016) return 'Obama';
  if (year >= 2017 && year <= 2020) return 'Trump';
  if (year >= 2021 && year <= 2024) return 'Biden';
  return 'Trump';
}

function yearsSinceAdminStart(year) {
  if (year >= 2009 && year <= 2016) return year - 2009;
  if (year >= 2017 && year <= 2020) return year - 2017;
  if (year >= 2021 && year <= 2025) return year - 2021;
  return 0;
}

function getProductWarningFrequency(productType, exportData) {
  return exportData.product_type_warning_rank[productType] ?? 0;
}

function getProductInjunctionFrequency(productType, exportData) {
  return exportData.product_type_injunction_rank[productType] ?? 0;
}

function categoryCode(featureName, value, exportData) {
  const order = exportData.category_orders[featureName] || [];
  const index = order.indexOf(value);
  if (index >= 0) return index;
  const unknownIndex = order.indexOf('Unknown');
  return unknownIndex >= 0 ? unknownIndex : 0;
}

function buildFeatureRow(form, exportData) {
  const state = form.state.value;
  const zipRaw = form.zip.value.trim();
  const zip = zipRaw === '' ? 0 : Number(zipRaw);
  const countryArea = form.countryArea.value;
  const fiscalYear = Number(form.fiscalYear.value);
  const projectArea = form.projectArea.value;
  const productType = form.productType.value;
  const pastInspections = Number(form.pastInspections.value || 0);
  const pastNai = Number(form.pastNAI.value || 0);
  const pastVai = Number(form.pastVAI.value || 0);
  const pastOai = Number(form.pastOAI.value || 0);

  const presidentialAdministration = mapAdministration(fiscalYear);
  const presidentParty = presidentialAdministration === 'Trump' ? 0 : 1;
  const yearsSince = yearsSinceAdminStart(fiscalYear);
  const region = exportData.country_to_region[countryArea] || 'Unknown';
  const usRegion = stateMap[state] || 'Unknown';
  const warningFreq = getProductWarningFrequency(productType, exportData);
  const injunctionFreq = getProductInjunctionFrequency(productType, exportData);

  return {
    State: state,
    Zip: zip,
    Country_Area: countryArea,
    Fiscal_Year: fiscalYear,
    Project_Area: projectArea,
    Product_Type: productType,
    Presidential_Administration: presidentialAdministration,
    President_Party: presidentParty,
    Years_Since_Admin_Start: yearsSince,
    Product_Type_Warning_Letter_Frequency: warningFreq,
    Product_Type_Injunction_Frequency: injunctionFreq,
    Region: region,
    US_Region: usRegion,
    Past_Inspections: pastInspections,
    Past_NAI: pastNai,
    Past_VAI: pastVai,
    Past_OAI: pastOai,
  };
}

function isCategoricalFeature(featureName, exportData) {
  return exportData.categorical_features.includes(featureName);
}

function evaluateTree(node, row, featureNames, exportData) {
  let current = node;
  while (!Object.prototype.hasOwnProperty.call(current, 'leaf_value')) {
    const featureName = featureNames[current.split_feature];
    const threshold = current.threshold;
    let goLeft = false;

    if (typeof threshold === 'string' && threshold.includes('||')) {
      const allowed = new Set(
        threshold
          .split('||')
          .filter(Boolean)
          .map((token) => Number(token))
      );
      const code = categoryCode(featureName, row[featureName], exportData);
      goLeft = allowed.has(code);
    } else if (isCategoricalFeature(featureName, exportData)) {
      const code = categoryCode(featureName, row[featureName], exportData);
      const allowed = new Set(
        String(threshold)
          .split('||')
          .filter(Boolean)
          .map((token) => Number(token))
      );
      goLeft = allowed.has(code);
    } else {
      const value = Number(row[featureName]);
      if (Number.isNaN(value)) {
        goLeft = Boolean(current.default_left);
      } else if (current.decision_type === '<=' || current.decision_type === '<= ') {
        goLeft = value <= Number(threshold);
      } else if (current.decision_type === '<') {
        goLeft = value < Number(threshold);
      } else {
        goLeft = value === Number(threshold);
      }
    }

    current = goLeft ? current.left_child : current.right_child;
  }

  return Number(current.leaf_value);
}

function softmax(rawScores) {
  const maxScore = Math.max(...rawScores);
  const expScores = rawScores.map((value) => Math.exp(value - maxScore));
  const total = expScores.reduce((sum, value) => sum + value, 0);
  return expScores.map((value) => value / total);
}

function predictProba(featureRow, exportData) {
  const trees = exportData.model_dump.tree_info;
  const scores = [0, 0, 0];

  trees.forEach((tree, treeIndex) => {
    const classIndex = treeIndex % 3;
    const leafValue = evaluateTree(tree.tree_structure, featureRow, exportData.feature_names, exportData);
    scores[classIndex] += leafValue;
  });

  return softmax(scores);
}

function setOptions(select, values, placeholder = null) {
  select.innerHTML = '';
  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderBadges(container, probs) {
  const classes = ['nai', 'vai', 'oai'];
  container.innerHTML = LABELS.map((label, index) => {
    const pct = (probs[index] * 100).toFixed(2);
    return `<span class="badge ${classes[index]}">${label}: ${pct}%</span>`;
  }).join('');
}

function renderProbabilities(container, probs) {
  container.innerHTML = LABELS.map((label, index) => {
    const pct = probs[index] * 100;
    return `
      <div class="probability-item">
        <div class="probability-row">
          <strong>${label}</strong>
          <span>${pct.toFixed(2)}%</span>
        </div>
        <div class="bar"><span style="width: ${pct}%"></span></div>
        <small>Probability of ${label} for this case</small>
      </div>
    `;
  }).join('');
}

function renderConfusionMatrix(container) {
  const maxValue = Math.max(...CONFUSION_MATRIX.flat());
  const headerRow = LABELS.map((label) => `<div class="matrix-axis header">${label}</div>`).join('');
  const rows = CONFUSION_MATRIX.map((row, rowIndex) => {
    const rowLabel = LABELS[rowIndex];
    const total = row.reduce((sum, value) => sum + value, 0);
    const cells = row.map((value, colIndex) => {
      const intensity = value / maxValue;
      const opacity = 0.12 + intensity * 0.62;
      const isDiagonal = rowIndex === colIndex;
      return `
        <div
          class="matrix-cell ${isDiagonal ? 'diagonal' : 'off-diagonal'}"
          style="background: linear-gradient(135deg, rgba(118, 228, 194, ${opacity}), rgba(138, 180, 255, ${opacity * 0.82}));"
          title="Actual ${rowLabel}, Predicted ${LABELS[colIndex]}: ${value}"
        >
          <span class="count">${value.toLocaleString()}</span>
          <span class="share">${((value / total) * 100).toFixed(2)}% of actual ${rowLabel}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="matrix-chip">Actual ${rowLabel}</div>
      ${cells}
    `;
  }).join('');

  container.innerHTML = `
    <div class="matrix-grid">
      <div class="matrix-axis corner">Actual vs Predicted</div>
      ${headerRow}
      ${rows}
    </div>
    <div class="matrix-summary">
      <strong>${CONFUSION_MATRIX_SUMMARY.title}</strong>
      <p>Accuracy: ${(CONFUSION_MATRIX_SUMMARY.accuracy * 100).toFixed(2)}% | Macro-F1: ${(CONFUSION_MATRIX_SUMMARY.macroF1 * 100).toFixed(2)}%</p>
    </div>
  `;
}

function renderDerived(container, row) {
  container.innerHTML = `
    <strong>Derived inputs used by the model</strong><br />
    Administration: ${row.Presidential_Administration}<br />
    President party: ${row.President_Party === 1 ? 'Democrat' : 'Republican'}<br />
    Years since administration start: ${row.Years_Since_Admin_Start}<br />
    Region: ${row.Region}<br />
    US region: ${row.US_Region}<br />
    Product warning frequency rank: ${row.Product_Type_Warning_Letter_Frequency}<br />
    Product injunction frequency rank: ${row.Product_Type_Injunction_Frequency}
  `;
}

function initApp(exportData) {
  const form = document.getElementById('riskForm');
  const resetBtn = document.getElementById('resetBtn');
  const resultsSection = document.getElementById('resultsSection');
  const topLabel = document.getElementById('topLabel');
  const topDescription = document.getElementById('topDescription');
  const resultBadges = document.getElementById('resultBadges');
  const probabilityList = document.getElementById('probabilityList');
  const derivedPanel = document.getElementById('derivedPanel');
  const heroMetrics = document.getElementById('heroMetrics');
  const confusionMatrix = document.getElementById('confusionMatrix');

  const stateSelect = document.getElementById('stateSelect');
  const countrySelect = document.getElementById('countrySelect');
  const projectAreaSelect = document.getElementById('projectAreaSelect');
  const productTypeSelect = document.getElementById('productTypeSelect');

  const stateValues = exportData.category_orders.State || [];
  const countryValues = exportData.category_orders.Country_Area || [];
  const projectValues = exportData.category_orders.Project_Area || [];
  const productValues = exportData.category_orders.Product_Type || [];

  setOptions(stateSelect, stateValues.filter((value) => value !== 'Unknown'));
  setOptions(countrySelect, countryValues.filter((value) => value !== 'Unknown'));
  setOptions(projectAreaSelect, projectValues.filter((value) => value !== 'Unknown'));
  setOptions(productTypeSelect, productValues.filter((value) => value !== 'Unknown'));

  if (stateSelect.options.length) stateSelect.value = stateSelect.options[0].value;
  if (countrySelect.options.length) countrySelect.value = countrySelect.options[0].value;
  if (projectAreaSelect.options.length) projectAreaSelect.value = projectAreaSelect.options[0].value;
  if (productTypeSelect.options.length) productTypeSelect.value = productTypeSelect.options[0].value;

  const metrics = exportData.metrics || {};
  heroMetrics.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">Eval macro-F1</span>
      <strong>${(Number(metrics.eval_macro_f1 || 0) * 100).toFixed(2)}%</strong>
      <small>Test score</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Eval accuracy</span>
      <strong>${(Number(metrics.eval_accuracy || 0) * 100).toFixed(2)}%</strong>
      <small>Test accuracy</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Trees</span>
      <strong>${exportData.model_dump.tree_info.length}</strong>
      <small>Exact fitted ensemble in browser</small>
    </div>
  `;

  renderConfusionMatrix(confusionMatrix);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const row = buildFeatureRow(form, exportData);
    const probs = predictProba(row, exportData);
    const bestIndex = probs.indexOf(Math.max(...probs));
    const bestLabel = LABELS[bestIndex];

    topLabel.textContent = bestLabel;
    topDescription.textContent = `Estimated risk profile for this case. The model assigns the highest probability to ${bestLabel}.`;
    renderBadges(resultBadges, probs);
    renderProbabilities(probabilityList, probs);
    renderDerived(derivedPanel, row);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    if (stateSelect.options.length) stateSelect.value = stateSelect.options[0].value;
    if (countrySelect.options.length) countrySelect.value = countrySelect.options[0].value;
    if (projectAreaSelect.options.length) projectAreaSelect.value = projectAreaSelect.options[0].value;
    if (productTypeSelect.options.length) productTypeSelect.value = productTypeSelect.options[0].value;
    resultsSection.hidden = true;
  });
}

async function main() {
  const response = await fetch('site/assets/fda_model_export.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to load model export bundle.');
  }
  const exportData = await response.json();
  initApp(exportData);
}

main().catch((error) => {
  const page = document.querySelector('.page-shell');
  const alertBox = document.createElement('div');
  alertBox.className = 'section';
  alertBox.innerHTML = `
    <h2>Model bundle could not be loaded</h2>
    <p>${error.message}</p>
    <p>Please make sure the exported model file exists at <strong>site/assets/fda_model_export.json</strong>.</p>
  `;
  page.prepend(alertBox);
});
