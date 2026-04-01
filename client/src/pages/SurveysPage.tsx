import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import {
  getSurveyTemplates, getSurveyCampaigns, createSurveyCampaign, getSurveyCampaign,
  submitSurveyResponse, getSurveyResults,
  SurveyTemplate, SurveyCampaign, SurveyResults, SurveyQuestion,
} from '../api';
import { PageHeader } from '../components/ui';

type ActiveCampaign = Omit<SurveyCampaign, 'questions'> & {
  questions: SurveyQuestion[];
  already_responded: boolean;
};

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

  // Create form (manager)
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ template_id: '', title: '', start_date: '', end_date: '', min_group_size: '5' });

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
      setError(`Please answer all questions before submitting.`);
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
      const results = await getSurveyResults(campaignId);
      setSelectedResults(results);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSurveyCampaign({
        template_id: parseInt(createForm.template_id),
        title: createForm.title,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        min_group_size: parseInt(createForm.min_group_size),
      });
      setShowCreate(false);
      setCreateForm({ template_id: '', title: '', start_date: '', end_date: '', min_group_size: '5' });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
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

  // Employee survey-taking view
  if (activeCampaign) {
    const questions = activeCampaign.questions;
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => setActiveCampaign(null)} className="text-sm text-indigo-600 hover:underline mb-3 inline-block">← Back to surveys</button>
          <h1 className="text-xl font-bold text-gray-900">{activeCampaign.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{activeCampaign.description}</p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            🔒 <strong>Privacy:</strong> Your responses are anonymous and will only be reported as group averages
            (minimum {activeCampaign.min_group_size} responses). Results are used only for schedule quality improvement —
            never for performance management or punitive decisions.
          </div>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmitResponses} className="space-y-6">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-800 mb-3">{i + 1}. {q.text}</p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: q.scale }, (_, j) => j + 1).map(val => (
                  <label key={val} className="cursor-pointer">
                    <input
                      type="radio" name={q.id} value={val} className="sr-only"
                      checked={responses[q.id] === val}
                      onChange={() => setResponses(r => ({ ...r, [q.id]: val }))}
                    />
                    <span className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors
                      ${responses[q.id] === val ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 text-gray-600 hover:border-indigo-400'}`}>
                      {val}
                    </span>
                  </label>
                ))}
                <span className="text-xs text-gray-400 self-end ml-1">1 = Never / Strongly disagree &nbsp; {q.scale} = Always / Strongly agree</span>
              </div>
            </div>
          ))}
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700">
            Submit Responses
          </button>
        </form>
      </div>
    );
  }

  // Results modal
  if (selectedResults) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button onClick={() => setSelectedResults(null)} className="text-sm text-indigo-600 hover:underline mb-3 inline-block">← Back to surveys</button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Survey Results</h1>
        <p className="text-xs text-gray-500 mb-4">{selectedResults.response_count} responses collected (minimum: {selectedResults.min_group_size})</p>

        {!selectedResults.results_available ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-amber-800 font-medium mb-2">Results Suppressed</p>
            <p className="text-sm text-amber-700">{selectedResults.message}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              🔒 <strong>Purpose limitation:</strong> {selectedResults.purpose_limitation}
            </div>
            {selectedResults.subscale_results?.map(sr => (
              <div key={sr.subscale} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">{sr.subscale.replace(/_/g, ' ')}</span>
                  {interpretationBadge(sr.interpretation)}
                </div>
                {sr.avg_score !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(sr.avg_score / 5) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{sr.avg_score.toFixed(1)}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">{sr.item_count} question{sr.item_count !== 1 ? 's' : ''}</p>
              </div>
            ))}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600">
              {selectedResults.data_governance}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Burnout Surveys"
        subtitle={user?.isManager
          ? 'Create and manage validated burnout measurement campaigns. Results are anonymized and aggregated.'
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
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        🔒 <strong>Privacy guarantee:</strong> Survey results are aggregated (minimum group size: 5). Individual responses are never exposed.
        Results are used <em>only</em> for improving schedule quality — not for performance management or punitive decisions.
        This is consistent with WHO&apos;s occupational health framing of burnout.
      </div>

      {/* Create campaign modal */}
      {showCreate && user?.isManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
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
                <input type="text" required value={createForm.title} placeholder="e.g. Q1 2026 Burnout Check-in"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Group Size <span className="text-gray-400">(privacy threshold)</span></label>
                <input type="number" min="3" max="20" value={createForm.min_group_size}
                  onChange={e => setCreateForm(f => ({ ...f, min_group_size: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
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
          {user?.isManager && <p className="text-sm mt-1">Create a campaign to start measuring team burnout.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{c.title}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                    {c.instrument && <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{c.instrument}</span>}
                  </div>
                  <div className="text-sm text-gray-600">{c.start_date} – {c.end_date}</div>
                  {user?.isManager && c.response_count !== undefined && (
                    <div className="text-xs text-gray-500 mt-0.5">{c.response_count} response{c.response_count !== 1 ? 's' : ''} (min: {c.min_group_size})</div>
                  )}
                  {c.already_responded && (
                    <div className="text-xs text-green-700 mt-0.5">✓ You responded on {c.responded_at?.slice(0, 10)}</div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!user?.isManager && c.status === 'active' && !c.already_responded && (
                    <button onClick={() => handleTakeSurvey(c)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                      Take Survey
                    </button>
                  )}
                  {user?.isManager && (
                    <button onClick={() => handleViewResults(c.id)} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                      View Results
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
