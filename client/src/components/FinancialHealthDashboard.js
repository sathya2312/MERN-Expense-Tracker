import React, { useMemo } from 'react';
import { useGetHealthQuery, useGetRecommendationsQuery } from '../store/apiSlice';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinancialHealthDashboard() {
  const period = useMemo(() => currentPeriod(), []);
  const { data, isLoading, isError, error } = useGetHealthQuery(period);
  const { data: recs } = useGetRecommendationsQuery(period);

  if (isLoading) return <div className='p-4 bg-white rounded shadow'>Loading financial health…</div>;
  if (isError) return <div className='p-4 bg-white rounded shadow text-red-600'>Failed to load health: {error?.data?.message || 'Error'}</div>;

  return (
    <div className='p-4 bg-white rounded shadow'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-xl font-semibold'>Financial Health ({data?.period})</h3>
        <div className='text-sm'>
          <span className='font-semibold'>Score:</span> {data?.healthScore} ({data?.grade})
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3 mb-4'>
        <Kpi title='Budget adherence' value={`${Math.round(data?.kpis?.budgetAdherencePct || 0)}%`} />
        <Kpi title='Discretionary ratio' value={`${Math.round(data?.kpis?.discretionaryRatioPct || 0)}%`} />
        <Kpi title='Forecast variance' value={`${Math.round(data?.kpis?.forecastVariancePct || 0)}%`} />
        <Kpi title='Savings rate' value={data?.kpis?.savingsRatePct === null ? 'N/A' : `${Math.round(data?.kpis?.savingsRatePct || 0)}%`} />
      </div>

      <div className='mb-4'>
        <h4 className='font-semibold mb-2'>Key Drivers</h4>
        {(data?.drivers || []).length === 0 ? (
          <div className='text-sm text-gray-600'>No major drivers detected.</div>
        ) : (
          <ul className='list-disc pl-5 text-sm'>
            {data.drivers.map((d, idx) => (
              <li key={idx} className={d.impact === 'negative' ? 'text-red-600' : 'text-gray-700'}>
                <span className='font-medium'>{d.title}</span> — {d.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className='font-semibold mb-2'>Savings Recommendations</h4>
        {(recs?.items || []).length === 0 ? (
          <div className='text-sm text-gray-600'>No recommendations yet.</div>
        ) : (
          <div className='space-y-2'>
            {recs.items.slice(0, 3).map(r => (
              <div key={r.id} className='border rounded p-3'>
                <div className='flex justify-between'>
                  <div className='font-medium'>{r.title}</div>
                  <div className='text-sm text-gray-600'>Priority {r.priority}</div>
                </div>
                <div className='text-sm text-gray-700 mt-1'>{r.rationale}</div>
                {r.estimatedMonthlySavings > 0 && (
                  <div className='text-sm mt-1'>Estimated savings: <span className='font-semibold'>${r.estimatedMonthlySavings}</span>/mo</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className='border rounded p-3'>
      <div className='text-xs text-gray-500'>{title}</div>
      <div className='text-lg font-semibold'>{value}</div>
    </div>
  );
}
