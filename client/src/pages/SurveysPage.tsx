import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import {
  getSurveyTemplates, getSurveyCampaigns, createSurveyCampaign, getSurveyCampaign,
  submitSurveyResponse, getSurveyResults, getSurveyRecommendations, spawnNextWeeklyCampaign,
  SurveyTemplate, SurveyCampaign, SurveyResults, SurveyQuestion, SurveyRecommendations,
} from '../api';
import { PageHeader } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell, PieChart, Pie, Legend,
} from 'recharts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type ActiveCampaign = Omit<SurveyCampaign, 'questions'> & {
  questions: SurveyQuestion[];
  already_responded: boolean;
};

type ResultsTab = 'overview' | 'department' | 'role' | 'recommendations';

export default function SurveysPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>([]);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active survey (employee taking it)
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Results (manager view)
  const [selectedResults, setSelectedResults] = useState<SurveyResults | null>(null);
  const [recommendations, setRecommendations] = useState<SurveyRecommendations | null>(null);
  const [resultsTab, setResultsTab] = useState<ResultsTab>('overview');

  // Create form (manager)
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    template_id: '', title: '', start_date: '', end_date: '', min_group_size: '5',
    anonymized: true, recurrence: 'none' as 'none' | 'weekly',
    schedule_day_of_week: '1', target_roles: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [camps, tmpls] = await Promise.all([getSurveyCampaigns(), getSurveyTemplates()]);
      setCampaigns(camps);
      setTemplates(tmpls);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTakeSurvey(campaign: SurveyCampaign) {
    try {
      const detail = await getSurveyCampaign(campaign.id);
      const rawQuestions = detail.questions as unknown as string | SurveyQuestion[];
      const questions: SurveyQuestion[] = Array.isArray(rawQuestions)
        ? rawQuestions
        : JSON.parse((rawQuestions as string) || '[]');
      setActiveCampaign({ ...detail, questions } as ActiveCampaign);
      setResponses({});
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSubmitResponses(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCampaign) return;
    const questions: SurveyQuestion[] = activeCampaign.questions;
    const missing = questions.filter(q => responses[q.id] === undefined);
    if (missing.length > 0) {
      setError('Please answer all questions before submitting.');
      return;
    }
    try {
      const result = await submitSurveyResponse(activeCampaign.id, responses);
      setSubmitSuccess(result.message);
      setActiveCampaign(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleViewResults(campaignId: number) {
    try {
      const [results, recs] = await Promise.all([
        getSurveyResults(campaignId),
        getSurveyRecommendations(campaignId),
      ]);
      setSelectedResults(results);
      setRecommendations(recs);
      setResultsTab('overview');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const targetRoles = createForm.target_roles
        ? createForm.target_roles.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      await createSurveyCampaign({
        template_id: parseInt(createForm.template_id),
        title: createForm.title,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        min_group_size: parseInt(createForm.min_group_size),
        anonymized: createForm.anonymized,
        recurrence: createForm.recurrence,
        schedule_day_of_week: createForm.recurrence === 'weekly' ? parseInt(createForm.schedule_day_of_week) : undefined,
        target_roles: targetRoles,
      });
      setShowCreate(false);
      setCreateForm({ template_id: '', title: '', start_date: '', end_date: '', min_group_size: '5', anonymized: true, recurrence: 'none', schedule_day_of_week: '1', target_roles: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSpawnNext(campaignId: number) {
    try {
      await spawnNextWeeklyCampaign(campaignId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  function interpretationColor(interp: string): string {
    if (['low', 'adequate_control', 'low_sleep_interference'].includes(interp)) return '#22c55e';
    if (['moderate', 'moderate_control', 'moderate_sleep_interference'].includes(interp)) return '#f59e0b';
    if (['high', 'low_control_risk', 'high_sleep_interference_risk'].includes(interp)) return '#ef4444';
    return '#9ca3af';
  }

  function interpretationBadge(interp: string) {
    const map: Record<string, string> = {
      low: 'bg-green-100 text-green-800', moderate: 'bg-yellow-100 text-yellow-800', high: 'bg-red-100 text-red-800',
      adequate_control: 'bg-green-100 text-green-800', moderate_control: 'bg-yellow-100 text-yellow-800', low_control_risk: 'bg-red-100 text-red-800',
      low_sleep_interference: 'bg-green-100 text-green-800', moderate_sleep_interference: 'bg-yellow-100 text-yellow-800', high_sleep_interference_risk: 'bg-red-100 text-red-800',
      insufficient_data: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      low: '✓ Low', moderate: '⚠ Moderate', high: '⚠ High',
      adequate_control: '✓ Adequate', moderate_control: '⚠ Moderate', low_control_risk: '⚠ Low',
      low_sleep_interference: '✓ Low', moderate_sleep_interference: '⚠ Moderate', high_sleep_interference_risk: '⚠ High',
      insufficient_data: 'Insufficient data',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[interp] ?? 'bg-gray-100'}`}>{labels[interp] ?? interp}</span>;
  }

  function priorityBadge(priority: 'high' | 'medium' | 'low') {
    const cls = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' }[priority];
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>{priority}</span>;
  }

  function subscaleLabel(s: string) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // ── Employee survey-taking view ────────────────────────────────────────────
  if (activeCampaign) {
    const questions = activeCampaign.questions;
    const baseQuestions = questions.filter(q => !q.role_specific);
    const roleQuestions = questions.filter(q => q.role_specific);
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => setActiveCampaign(null)} className="text-sm text-pink-600 hover:underline mb-3 inline-block">← Back to surveys</button>
          <h1 className="text-xl font-bold text-gray-900">{activeCampaign.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{activeCampaign.description}</p>
          {activeCampaign.anonymized === 1 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              🔒 <strong>Anonymous &amp; confidential:</strong> Your individual responses are <em>never</em> seen by your manager.
              Only group averages (minimum {activeCampaign.min_group_size} responses) are reported.
              Results are used solely to improve scheduling and working conditions.
            </div>
          )}
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmitResponses} className="space-y-6">
          {baseQuestions.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i + 1} response={responses[q.id]} onChange={val => setResponses(r => ({ ...r, [q.id]: val }))} />
          ))}
          {roleQuestions.length > 0 && (
            <>
              <div className="pt-2 pb-1 border-t border-gray-200">
                <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Role-specific questions</p>
              </div>
              {roleQuestions.map((q, i) => (
                <QuestionCard key={q.id} q={q} index={baseQuestions.length + i + 1} response={responses[q.id]} onChange={val => setResponses(r => ({ ...r, [q.id]: val }))} />
              ))}
            </>
          )}
          <button type="submit" className="w-full bg-pink-500 text-white py-3 rounded-xl font-medium hover:bg-pink-600">
            Submit Responses
          </button>
        </form>
      </div>
    );
  }

  // ── Results view (manager) ─────────────────────────────────────────────────
  if (selectedResults) {
    const tabs: { id: ResultsTab; label: string }[] = [
      { id: 'overview', label: '📊 Overview' },
      { id: 'department', label: '🏢 By Department' },
      { id: 'role', label: '👤 By Role' },
      { id: 'recommendations', label: '💡 Recommendations' },
    ];

    return (
      <div className="max-w-3xl mx-auto p-6">
        <button onClick={() => setSelectedResults(null)} className="text-sm text-pink-600 hover:underline mb-3 inline-block">← Back to surveys</button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Survey Results</h1>
        <p className="text-xs text-gray-500 mb-4">
          {selectedResults.response_count} responses · min group: {selectedResults.min_group_size}
          {selectedResults.instrument && <span className="ml-2 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{selectedResults.instrument}</span>}
        </p>

        {!selectedResults.results_available ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-amber-800 font-medium mb-2">Results Suppressed</p>
            <p className="text-sm text-amber-700">{selectedResults.message}</p>
          </div>
        ) : (
          <>
            {/* Tab nav */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setResultsTab(t.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${resultsTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {resultsTab === 'overview' && (
              <SubscaleResultsPanel
                subscaleResults={selectedResults.subscale_results ?? []}
                interpretationBadge={interpretationBadge}
                interpretationColor={interpretationColor}
                subscaleLabel={subscaleLabel}
                title="All Respondents"
                responseCount={selectedResults.response_count}
              />
            )}

            {/* Department tab */}
            {resultsTab === 'department' && (
              <div className="space-y-6">
                {(selectedResults.department_breakdowns ?? []).length === 0 ? (
                  <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-xl text-sm">
                    No department segments meet the minimum group size ({selectedResults.min_group_size}) for privacy-safe reporting.
                  </div>
                ) : (
                  selectedResults.department_breakdowns!.map(seg => (
                    <SubscaleResultsPanel
                      key={seg.segment}
                      subscaleResults={seg.subscale_results}
                      interpretationBadge={interpretationBadge}
                      interpretationColor={interpretationColor}
                      subscaleLabel={subscaleLabel}
                      title={seg.segment}
                      responseCount={seg.response_count}
                    />
                  ))
                )}
              </div>
            )}

            {/* Role tab */}
            {resultsTab === 'role' && (
              <div className="space-y-6">
                {(selectedResults.role_title_breakdowns ?? []).length === 0 ? (
                  <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-xl text-sm">
                    No role segments meet the minimum group size ({selectedResults.min_group_size}) for privacy-safe reporting.
                  </div>
                ) : (
                  selectedResults.role_title_breakdowns!.map(seg => (
                    <SubscaleResultsPanel
                      key={seg.segment}
                      subscaleResults={seg.subscale_results}
                      interpretationBadge={interpretationBadge}
                      interpretationColor={interpretationColor}
                      subscaleLabel={subscaleLabel}
                      title={seg.segment}
                      responseCount={seg.response_count}
                    />
                  ))
                )}
              </div>
            )}

            {/* Recommendations tab */}
            {resultsTab === 'recommendations' && (
              <div className="space-y-4">
                {!recommendations?.results_available ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
                    {recommendations?.message ?? 'No recommendations available.'}
                  </div>
                ) : recommendations!.recommendations.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-green-700">
                    ✓ No critical concerns detected. Continue monitoring with weekly surveys.
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                      💡 {recommendations!.purpose_limitation}
                    </div>
                    {recommendations!.recommendations.map((rec, i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {priorityBadge(rec.priority)}
                          <span className="font-semibold text-gray-800 text-sm">{rec.category}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{rec.action}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600">
              {selectedResults.data_governance}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Main listing view ──────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Burnout Surveys"
        subtitle={user?.isManager
          ? 'Create and manage anonymous burnout surveys. Schedule weekly check-ins and view results by department, role, and revenue metrics.'
          : 'Complete periodic surveys to help improve scheduling and reduce burnout. Your responses are anonymous.'}
        color="#EC4899"
        icon="📋"
        actions={user?.isManager
          ? (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-pink-600 transition-colors"
            >
              + New Campaign
            </button>
          )
          : undefined}
      />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {submitSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{submitSuccess}</div>}

      {/* Privacy notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        🔒 <strong>Privacy guarantee:</strong> Survey results are aggregated (minimum group size: 5). Individual responses are <em>never</em> exposed.
        Results are used <em>only</em> for improving schedule quality — not for performance management or punitive decisions.
      </div>

      {/* Create campaign modal */}
      {showCreate && user?.isManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Survey Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrument</label>
                <select required value={createForm.template_id}
                  onChange={e => setCreateForm(f => ({ ...f, template_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select instrument…</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.instrument} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title</label>
                <input type="text" required value={createForm.title} placeholder="e.g. Weekly Burnout Check-in"
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" required value={createForm.start_date}
                    onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" required value={createForm.end_date}
                    onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
                <div className="flex gap-2">
                  {(['none', 'weekly'] as const).map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setCreateForm(f => ({ ...f, recurrence: opt }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${createForm.recurrence === opt ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {opt === 'none' ? '📅 One-time' : '🔄 Weekly'}
                    </button>
                  ))}
                </div>
              </div>
              {createForm.recurrence === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send Day</label>
                  <select value={createForm.schedule_day_of_week}
                    onChange={e => setCreateForm(f => ({ ...f, schedule_day_of_week: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">New weekly instances will be automatically queued on this day.</p>
                </div>
              )}

              {/* Anonymity toggle */}
              <div className="flex items-center gap-3 py-1">
                <input type="checkbox" id="anon-toggle" checked={createForm.anonymized}
                  onChange={e => setCreateForm(f => ({ ...f, anonymized: e.target.checked }))}
                  className="w-4 h-4 accent-pink-500" />
                <label htmlFor="anon-toggle" className="text-sm text-gray-700">
                  🔒 Anonymous responses <span className="text-gray-400">(recommended)</span>
                </label>
              </div>

              {/* Target roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Roles / Departments <span className="text-gray-400">(optional)</span></label>
                <input type="text" value={createForm.target_roles} placeholder="e.g. Server, Kitchen, Manager"
                  onChange={e => setCreateForm(f => ({ ...f, target_roles: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Comma-separated. Leave blank to include all staff. Role-specific bonus questions will be shown to matching employees.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Group Size <span className="text-gray-400">(privacy threshold)</span></label>
                <input type="number" min="3" max="20" value={createForm.min_group_size}
                  onChange={e => setCreateForm(f => ({ ...f, min_group_size: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-pink-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-600">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl">
          <p className="text-lg font-medium">No survey campaigns yet</p>
          {user?.isManager && <p className="text-sm mt-1">Create a campaign to start measuring team wellbeing.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{c.title}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                    {c.instrument && <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{c.instrument}</span>}
                    {c.recurrence === 'weekly' && (
                      <span className="text-xs text-pink-700 bg-pink-50 px-2 py-0.5 rounded">🔄 Weekly</span>
                    )}
                    {c.anonymized === 1 && (
                      <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">🔒 Anonymous</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{c.start_date} – {c.end_date}</div>
                  {c.recurrence === 'weekly' && c.next_send_date && (
                    <div className="text-xs text-pink-600 mt-0.5">Next instance: {c.next_send_date}</div>
                  )}
                  {user?.isManager && c.response_count !== undefined && (
                    <div className="text-xs text-gray-500 mt-0.5">{c.response_count} response{c.response_count !== 1 ? 's' : ''} (min: {c.min_group_size})</div>
                  )}
                  {c.already_responded && (
                    <div className="text-xs text-green-700 mt-0.5">✓ You responded on {c.responded_at?.slice(0, 10)}</div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {!user?.isManager && c.status === 'active' && !c.already_responded && (
                    <button onClick={() => handleTakeSurvey(c)} className="bg-pink-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-pink-600">
                      Take Survey
                    </button>
                  )}
                  {user?.isManager && (
                    <button onClick={() => handleViewResults(c.id)} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                      View Results
                    </button>
                  )}
                  {user?.isManager && c.recurrence === 'weekly' && (
                    <button onClick={() => handleSpawnNext(c.id)} className="border border-pink-300 text-pink-700 px-3 py-1.5 rounded-lg text-sm hover:bg-pink-50">
                      + Next Week
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function QuestionCard({ q, index, response, onChange }: {
  q: SurveyQuestion; index: number; response: number | undefined; onChange: (val: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-800 mb-3">{index}. {q.text}</p>
      <div className="flex gap-2 flex-wrap items-end">
        {Array.from({ length: q.scale }, (_, j) => j + 1).map(val => (
          <label key={val} className="cursor-pointer">
            <input type="radio" name={q.id} value={val} className="sr-only"
              checked={response === val} onChange={() => onChange(val)} />
            <span className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors
              ${response === val ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-300 text-gray-600 hover:border-pink-300'}`}>
              {val}
            </span>
          </label>
        ))}
        <span className="text-xs text-gray-400 ml-1">1 = Never &nbsp; {q.scale} = Always</span>
      </div>
    </div>
  );
}

const INTERP_PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#9ca3af'];

function SubscaleResultsPanel({ subscaleResults, interpretationBadge, interpretationColor, subscaleLabel, title, responseCount }: {
  subscaleResults: Array<{ subscale: string; avg_score: number | null; item_count: number; interpretation: string; pct_high: number }>;
  interpretationBadge: (i: string) => JSX.Element;
  interpretationColor: (i: string) => string;
  subscaleLabel: (s: string) => string;
  title: string;
  responseCount: number;
}) {
  // Data for bar chart
  const barData = subscaleResults
    .filter(sr => sr.avg_score !== null)
    .map(sr => ({
      name: subscaleLabel(sr.subscale),
      score: sr.avg_score ?? 0,
      pct: sr.pct_high,
      fill: interpretationColor(sr.interpretation),
    }));

  // Distribution pie: how many subscales are low/moderate/high
  const counts = { Low: 0, Moderate: 0, High: 0 };
  for (const sr of subscaleResults) {
    if (['low', 'adequate_control', 'low_sleep_interference'].includes(sr.interpretation)) counts.Low++;
    else if (['moderate', 'moderate_control', 'moderate_sleep_interference'].includes(sr.interpretation)) counts.Moderate++;
    else if (['high', 'low_control_risk', 'high_sleep_interference_risk'].includes(sr.interpretation)) counts.High++;
  }
  const pieData = Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{responseCount} respondents</p>
        </div>
        <div className="flex gap-2">
          {counts.High > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{counts.High} High</span>}
          {counts.Moderate > 0 && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{counts.Moderate} Moderate</span>}
          {counts.Low > 0 && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{counts.Low} Low</span>}
        </div>
      </div>

      {/* Bar chart: avg score per subscale */}
      {barData.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">Average score per subscale (higher = more burnout/risk)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 5]} />
              <Tooltip formatter={(value: number) => [value.toFixed(2), 'Avg Score']} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pct high bar chart */}
      {barData.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">% of responses in the high-risk range per subscale</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(value: number) => [`${value}%`, '% High Risk']} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`pct-cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar chart */}
      {barData.length >= 3 && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">Subscale profile</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={barData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
              <Radar name="Score" dataKey="score" stroke="#EC4899" fill="#EC4899" fillOpacity={0.25} />
              <Tooltip formatter={(value: number) => [value.toFixed(2), 'Score']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Distribution pie */}
      {pieData.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <PieChart width={100} height={100}>
            <Pie data={pieData} cx={45} cy={45} innerRadius={25} outerRadius={45} dataKey="value">
              {pieData.map((entry, i) => {
                const colors: Record<string, string> = { Low: '#22c55e', Moderate: '#f59e0b', High: '#ef4444' };
                return <Cell key={i} fill={colors[entry.name] ?? INTERP_PIE_COLORS[i]} />;
              })}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex flex-col gap-1">
            {pieData.map((entry, i) => {
              const colors: Record<string, string> = { Low: '#22c55e', Moderate: '#f59e0b', High: '#ef4444' };
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[entry.name] ?? INTERP_PIE_COLORS[i] }} />
                  {entry.name}: {entry.value} subscale{entry.value !== 1 ? 's' : ''}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-subscale rows */}
      <div className="space-y-2">
        {subscaleResults.map(sr => (
          <div key={sr.subscale} className="flex items-center gap-3 py-1.5 border-t border-gray-100 first:border-t-0">
            <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{subscaleLabel(sr.subscale)}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {sr.avg_score !== null && (
                <span className="text-sm font-semibold text-gray-800 w-8 text-right">{sr.avg_score.toFixed(1)}</span>
              )}
              <span className="text-xs text-gray-400 w-10 text-right">{sr.pct_high}%</span>
              {interpretationBadge(sr.interpretation)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
