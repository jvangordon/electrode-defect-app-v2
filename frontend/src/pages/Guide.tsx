import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../App';
import {
  BookOpen, ChevronDown, ChevronRight, Clock, ArrowRight,
  Keyboard, Users, Wrench, HardHat, BarChart3, Shield,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Scenario {
  title: string;
  persona: string;
  personaColor: string;
  time: string;
  steps: string[];
  linkTo: string | (() => void);
  linkLabel: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const PERSONA_COLORS: Record<string, string> = {
  'Department Manager': '#f59e0b',
  'Process Engineer': '#f59e0b',
  'Reliability Engineer': '#f59e0b',
  'Quality Lead': '#a78bfa',
  Operator: '#2dd4bf',
  'Any User': '#60a5fa',
  'Process Engineer + Quality Lead': '#f59e0b',
};

const PERSONA_ICONS: Record<string, typeof Users> = {
  'Department Manager': BarChart3,
  'Process Engineer': Wrench,
  'Reliability Engineer': Shield,
  'Quality Lead': Shield,
  Operator: HardHat,
  'Any User': Users,
  'Process Engineer + Quality Lead': Wrench,
};

const SCENARIOS: Scenario[] = [
  {
    title: 'Morning Triage',
    persona: 'Department Manager',
    personaColor: PERSONA_COLORS['Department Manager'],
    time: '2 min',
    steps: [
      'Open the Operations dashboard — it loads automatically as the home page.',
      'Scan the KPI row at the top: 90-day defect rate, total defects, electrodes produced, open investigations, equipment alerts.',
      'Check the Defect Rate Trend chart — is the overall trend going up or down?',
      'Scan the Furnace Status Grid — green is healthy, amber needs watching, red needs action.',
      'Glance at Recent High-Defect Runs on the right panel for anything new since yesterday.',
    ],
    linkTo: '/',
    linkLabel: 'Go to Dashboard',
  },
  {
    title: 'Why did this run fail?',
    persona: 'Process Engineer',
    personaColor: PERSONA_COLORS['Process Engineer'],
    time: '5 min',
    steps: [
      'Navigate to Run Comparison from the sidebar.',
      'Select the department tab (Bake or Graphite) and optionally filter by furnace.',
      'Find the high-defect run in the table (red-highlighted rows) and click it — badge "1" appears.',
      'Click a clean run on the same furnace — badge "2" appears.',
      'Click the Compare button to open the side-by-side view.',
      'Review Parameter Comparison for highlighted deviations in amber.',
      'Check Position Maps for spatial defect clustering patterns.',
      'Toggle Sensor Data Overlay tags to spot temperature or resistance anomalies.',
    ],
    linkTo: '/comparison',
    linkLabel: 'Go to Run Comparison',
  },
  {
    title: 'Is this furnace getting worse?',
    persona: 'Reliability Engineer',
    personaColor: PERSONA_COLORS['Reliability Engineer'],
    time: '3 min',
    steps: [
      'Navigate to Equipment Trending from the sidebar.',
      'The left panel lists all furnaces sorted by defect rate with trend indicators.',
      'Click a furnace to see its 18-month trend charts.',
      'Check the Defect Rate Trend — a dashed trend line shows the direction. "Degrading" appears in red if statistically significant.',
      'Review supporting metrics (Avg kWh, Downtime, Run Time, Car Deck) for explanations.',
      'Use the Cross-Equipment Comparison bar chart at the bottom to compare across all furnaces.',
    ],
    linkTo: '/equipment',
    linkLabel: 'Go to Equipment Trending',
  },
  {
    title: 'Should I flag this load?',
    persona: 'Operator',
    personaColor: PERSONA_COLORS['Operator'],
    time: '3 min',
    steps: [
      'Navigate to Anomaly Detection from the sidebar.',
      'For bake runs: check the SPC Control Chart — red dots exceed statistical control limits.',
      'Review the Flagged Anomalous Runs table for severity and specific deviations.',
      'For graphite runs: switch to the Composition Risk tab.',
      'Check the pre-load risk score (Q1-Q5). Q4-Q5 runs deserve pre-load inspection.',
      'Consider redistributing high-risk electrodes before starting the run.',
    ],
    linkTo: '/anomaly',
    linkLabel: 'Go to Anomaly Detection',
  },
  {
    title: 'Full Investigation',
    persona: 'Process Engineer + Quality Lead',
    personaColor: PERSONA_COLORS['Process Engineer + Quality Lead'],
    time: '10 min',
    steps: [
      'Navigate to Investigations from the sidebar.',
      'Search by GPN (electrode ID), lot number, or run number in the search bar.',
      'Click a row to open the investigation detail.',
      'Review status, assigned engineer, defect code, root cause category, and due date.',
      'Read through the Notes thread for team context.',
      'Check Corrective Actions — advance their status (Open → In Progress → Completed).',
      'Click "View Electrode" to see the full 10-step manufacturing lifecycle.',
      'Check Risk Factor Attribution and Sibling Electrodes for spatial patterns.',
    ],
    linkTo: '/investigations',
    linkLabel: 'Go to Investigations',
  },
  {
    title: 'Configuring Thresholds',
    persona: 'Quality Lead',
    personaColor: PERSONA_COLORS['Quality Lead'],
    time: '2 min',
    steps: [
      'Click the Settings button in the sidebar (gear icon).',
      'Adjust the defect rate warning and critical thresholds.',
      'Set the SPC sigma threshold for anomaly detection sensitivity.',
      'Configure the equipment trending lookback window.',
      'Click Save to apply your changes across all views.',
    ],
    linkTo: '__settings__',
    linkLabel: 'Open Settings',
  },
  {
    title: 'Finding Past Knowledge',
    persona: 'Any User',
    personaColor: PERSONA_COLORS['Any User'],
    time: '1 min',
    steps: [
      'Press ⌘K (or Ctrl+K on Windows/Linux) to open the knowledge search.',
      'Type your question in natural language — e.g., "BF-3 degradation" or "car deck position risk".',
      'Browse the results for matching investigations, electrodes, knowledge articles, or corrective actions.',
      'Click any result to navigate directly to the relevant detail page.',
    ],
    linkTo: '__search__',
    linkLabel: 'Open Search (⌘K)',
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is defective weight and why does it matter?',
    answer:
      'Defective weight is the total weight of electrodes that fail quality inspection at any manufacturing step. Since graphite electrodes are high-value products used in electric arc furnaces for steel recycling, each defective electrode represents significant material and processing cost. Reducing defective weight by even a few percentage points can save hundreds of thousands of dollars annually.',
  },
  {
    question: 'What are the 10 process steps?',
    answer:
      'Plant A Extrusion → Plant A Bake → Plant A PI (Post-Impregnation) → Plant A Rebake → Plant B Bake → Plant B PI → Plant B Rebake → Plant B Graphite → Plant B Finishing → Plant B Assembly. An electrode may pass through all or a subset of these steps depending on the product specification.',
  },
  {
    question: 'What do the defect codes mean?',
    answer:
      'Defect codes indicate the type of defect found during inspection. Common codes include CR (crack), PR (porosity), SP (spalling), BK (breakage), LN (longitudinal crack), SFC (surface crack), DI (dimensional), and OX (oxidation). Each code has sub-variants (e.g., CR-1, CR-2) indicating severity or location.',
  },
  {
    question: 'What is car deck position and why does it matter?',
    answer:
      'In bake furnaces (tunnel kilns), electrodes are loaded onto car decks that move through the furnace. The deck number (1-9) determines the electrode\'s position in the thermal gradient. Historical data shows that high-numbered decks (8-9) produce approximately 70% more downstream defects than low-numbered decks (4-5), likely due to thermal non-uniformity at the rear of the kiln.',
  },
  {
    question: 'What are risk quintiles (Q1-Q5)?',
    answer:
      'For graphite furnace runs, each run receives a pre-load risk score based on the composition of electrodes being loaded — which lots they came from, their upstream defect history, and lot-level risk tiers. Q1 (lowest risk) historically produces ~1% defect rates, while Q5 (highest risk) historically produces ~8% defect rates with a high probability of a significant defect event. Operators can use this to redistribute high-risk electrodes or flag runs for closer inspection.',
  },
  {
    question: 'What makes an SPC flag trigger?',
    answer:
      'The SPC (Statistical Process Control) system flags bake runs where process parameters deviate beyond 2 standard deviations from the mean. The primary parameters monitored are car deck position, duration hours, actual kWh, and total downtime. The sigma value shown (e.g., "1.7σ high") indicates how many standard deviations from the mean the parameter falls. Runs with multiple parameters beyond 1.5σ are flagged as higher severity.',
  },
  {
    question: 'How does the equipment degradation detection work?',
    answer:
      'Monthly defect rates are computed for each furnace over 18 months. A linear regression (trend line) is fitted to this data. If the slope is positive (defect rate increasing) and the p-value is below a significance threshold, the furnace is flagged as "Degrading." The slope value tells you the rate of degradation in percentage points per month.',
  },
  {
    question: 'Can I create a new investigation from the app?',
    answer:
      'Yes. From the Investigations list view, you can create new investigations. From any electrode detail view, you can see existing investigations linked to that electrode. The investigation workflow follows: Open → In Progress → Closed → Verified.',
  },
  {
    question: 'How do corrective actions work?',
    answer:
      'Each investigation can have multiple corrective actions. Actions have a title, description, assigned person, priority (low/medium/high/critical), due date, and estimated cost savings. Actions follow the workflow: Open → In Progress → Completed. Overdue actions are highlighted in red. The expected vs actual savings fields allow tracking whether the corrective action delivered its projected ROI.',
  },
  {
    question: 'What data is simulated vs real?',
    answer:
      'In the current deployment, all data is simulated but designed to tell a coherent manufacturing story — BF-3 shows a degradation trend, high car decks produce more defects, edge positions in graphite furnaces have ~3x defect rates, and high-risk lots correlate with downstream quality issues. In production, the seed data would be replaced with live data from Databricks Lakebase via a SQL connector.',
  },
  {
    question: 'How would this connect to real production data?',
    answer:
      'The backend uses standard PostgreSQL queries via psycopg2. In production on Databricks, the database layer would switch to Lakebase (fully Postgres-compatible), and a Databricks SQL connector could be added for analytical queries against the lakehouse. The backend/db.py module is designed to make this swap straightforward — change the connection string and optionally add a secondary connector for heavy analytical queries.',
  },
];

const SHORTCUTS = [
  { keys: '⌘K', description: 'Open knowledge search' },
  { keys: 'Click furnace tile', description: 'Jump to equipment detail' },
  { keys: 'Click two runs + Compare', description: 'Side-by-side analysis' },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ScenarioCard({
  scenario,
  isOpen,
  onToggle,
  onNavigate,
}: {
  scenario: Scenario;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (to: string | (() => void)) => void;
}) {
  const { isDark } = useTheme();
  const PersonaIcon = PERSONA_ICONS[scenario.persona] || Users;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDark
          ? 'bg-[#141824] border-[#252a3a] hover:border-[#353a4a]'
          : 'bg-white border-[#e2e5eb] hover:border-[#c5c9d5] shadow-sm'
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: scenario.personaColor }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className="flex-shrink-0">
          {isOpen ? (
            <ChevronDown size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
          ) : (
            <ChevronRight size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {scenario.title}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: scenario.personaColor + '18',
                color: scenario.personaColor,
              }}
            >
              <PersonaIcon size={12} />
              {scenario.persona}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-sm flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Clock size={14} />
          {scenario.time}
        </div>
      </button>

      {isOpen && (
        <div className={`px-5 pb-5 pt-0 ml-9 border-t ${isDark ? 'border-[#252a3a]' : 'border-[#e2e5eb]'}`}>
          <ol className={`list-decimal list-inside space-y-2.5 pt-4 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {scenario.steps.map((step, i) => (
              <li key={i} className="pl-1">{step}</li>
            ))}
          </ol>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(scenario.linkTo);
            }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: scenario.personaColor + '18',
              color: scenario.personaColor,
            }}
          >
            {scenario.linkLabel}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function FaqAccordion({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDark
          ? 'bg-[#141824] border-[#252a3a]'
          : 'bg-white border-[#e2e5eb] shadow-sm'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-5 text-left"
      >
        <div
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        >
          <ChevronRight size={16} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
        </div>
        <span className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {item.question}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className={`px-5 pb-5 ml-7 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {item.answer}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Guide({
  onOpenSettings,
  onOpenSearch,
}: {
  onOpenSettings?: () => void;
  onOpenSearch?: () => void;
}) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [openScenario, setOpenScenario] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleNavigate = (to: string | (() => void)) => {
    if (typeof to === 'function') {
      to();
    } else if (to === '__settings__') {
      onOpenSettings?.();
    } else if (to === '__search__') {
      onOpenSearch?.();
    } else {
      navigate(to);
    }
  };

  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="p-10 max-w-[1100px] mx-auto space-y-12">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={28} className="text-amber-400" />
          <h1 className={`text-3xl font-bold ${textPrimary}`}>Training Guide</h1>
        </div>
        <p className={`text-base ${textSecondary}`}>
          Learn how to use EDRS effectively with step-by-step workflows, answers to common questions, and keyboard shortcuts.
        </p>
      </div>

      {/* Section A: Quick Start Walkthrough */}
      <section>
        <h2 className={`text-2xl font-bold mb-6 ${textPrimary}`}>Quick Start Walkthrough</h2>
        <p className={`text-sm mb-6 ${textSecondary}`}>
          Select a scenario that matches your role. Each card walks you through the steps with a link to try it live.
        </p>
        <div className="space-y-3">
          {SCENARIOS.map((scenario, i) => (
            <ScenarioCard
              key={i}
              scenario={scenario}
              isOpen={openScenario === i}
              onToggle={() => setOpenScenario(openScenario === i ? null : i)}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </section>

      {/* Section B: FAQ */}
      <section>
        <h2 className={`text-2xl font-bold mb-6 ${textPrimary}`}>Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <FaqAccordion
              key={i}
              item={item}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* Section C: Keyboard Shortcuts */}
      <section>
        <h2 className={`text-2xl font-bold mb-6 ${textPrimary}`}>Keyboard Shortcuts</h2>
        <div
          className={`rounded-xl border p-6 ${
            isDark
              ? 'bg-[#141824] border-[#252a3a]'
              : 'bg-white border-[#e2e5eb] shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 mb-5">
            <Keyboard size={20} className="text-amber-400" />
            <span className={`text-base font-semibold ${textPrimary}`}>Quick Actions</span>
          </div>
          <div className="space-y-4">
            {SHORTCUTS.map((shortcut, i) => (
              <div key={i} className="flex items-center gap-4">
                <kbd
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono font-medium min-w-[160px] justify-center ${
                    isDark
                      ? 'bg-[#1e2233] border border-[#2e3347] text-gray-200'
                      : 'bg-gray-100 border border-gray-200 text-gray-700'
                  }`}
                >
                  {shortcut.keys}
                </kbd>
                <span className={`text-sm ${textSecondary}`}>{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
