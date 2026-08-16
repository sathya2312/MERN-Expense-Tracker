import React, { useMemo, useState } from 'react';
import { useGetAlertsQuery, useUpdateAlertStatusMutation } from '../store/apiSlice';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AlertsCenter() {
  const [status, setStatus] = useState('unread');
  const [type, setType] = useState('');
  const period = useMemo(() => currentPeriod(), []);

  const { data, isLoading, isError, error } = useGetAlertsQuery({ status, type: type || undefined, period });
  const [updateStatus] = useUpdateAlertStatusMutation();

  if (isLoading) return <div className='p-4 bg-white rounded shadow'>Loading alerts…</div>;
  if (isError) return <div className='p-4 bg-white rounded shadow text-red-600'>Failed to load alerts: {error?.data?.message || 'Error'}</div>;

  return (
    <div className='p-4 bg-white rounded shadow'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-xl font-semibold'>Alerts ({period})</h3>
        <div className='flex gap-2 text-sm'>
          <select className='border rounded px-2 py-1' value={status} onChange={e => setStatus(e.target.value)}>
            <option value='unread'>Unread</option>
            <option value='all'>All</option>
          </select>
          <select className='border rounded px-2 py-1' value={type} onChange={e => setType(e.target.value)}>
            <option value=''>All Types</option>
            <option value='threshold'>Threshold</option>
            <option value='anomaly'>Anomaly</option>
          </select>
        </div>
      </div>

      <div className='space-y-2'>
        {(data?.items || []).length === 0 ? (
          <div className='text-sm text-gray-600'>No alerts.</div>
        ) : (
          data.items.map(a => (
            <div key={a.id} className='border rounded p-3'>
              <div className='flex justify-between'>
                <div>
                  <span className={a.severity === 'critical' ? 'text-red-600 font-semibold' : 'text-yellow-700 font-semibold'}>
                    {a.severity.toUpperCase()}
                  </span>
                  <span className='ml-2 font-medium'>{a.message}</span>
                </div>
                <div className='text-xs text-gray-500'>{new Date(a.triggeredAt).toLocaleString()}</div>
              </div>

              <div className='text-sm text-gray-700 mt-1'>
                {a.scope === 'category' && a.categoryNormalized ? (
                  <div>Category: <span className='font-medium'>{a.categoryNormalized}</span></div>
                ) : null}
                {a.explanation?.thresholdPct ? (
                  <div>Utilization: {Math.round(a.explanation.utilizationPct || 0)}% (threshold {a.explanation.thresholdPct}%)</div>
                ) : null}
                {a.explanation?.baseline !== undefined ? (
                  <div>Baseline: {Math.round(a.explanation.baseline)} | Observed: {Math.round(a.explanation.observed)} | Δ {Math.round(a.explanation.delta || 0)}</div>
                ) : null}
              </div>

              <div className='flex gap-2 mt-2'>
                {a.status !== 'read' && (
                  <button className='px-3 py-1 border rounded' onClick={() => updateStatus({ id: a.id, status: 'read' })}>Mark read</button>
                )}
                {a.status !== 'dismissed' && (
                  <button className='px-3 py-1 border rounded' onClick={() => updateStatus({ id: a.id, status: 'dismissed' })}>Dismiss</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
