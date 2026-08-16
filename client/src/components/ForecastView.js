import React, { useMemo } from 'react';
import { useGetForecastQuery } from '../store/apiSlice';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ForecastView() {
  const period = useMemo(() => currentPeriod(), []);
  const { data, isLoading, isError, error } = useGetForecastQuery(period);

  if (isLoading) return <div className='p-4 bg-white rounded shadow'>Loading forecast…</div>;
  if (isError) return <div className='p-4 bg-white rounded shadow text-red-600'>Failed to load forecast: {error?.data?.message || 'Error'}</div>;

  return (
    <div className='p-4 bg-white rounded shadow'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-xl font-semibold'>Forecast ({data?.period})</h3>
        <div className='text-sm text-gray-600'>Confidence: {data?.confidence}</div>
      </div>

      <div className='grid grid-cols-3 gap-3 mb-4'>
        <Metric label='Spend to date' value={`$${data?.overall?.spendToDate || 0}`} />
        <Metric label='Projected remaining' value={`$${data?.overall?.projectedRemainingSpend || 0}`} />
        <Metric label='Projected month-end' value={`$${data?.overall?.projectedMonthEndSpend || 0}`} />
      </div>

      <div>
        <h4 className='font-semibold mb-2'>Category Forecast</h4>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead>
              <tr className='text-left border-b'>
                <th className='py-2'>Category</th>
                <th>Spend to date</th>
                <th>Projected month-end</th>
                <th>Budget</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {(data?.categories || []).map(c => (
                <tr key={c.categoryNormalized} className='border-b'>
                  <td className='py-2 font-medium'>{c.categoryNormalized}</td>
                  <td>${c.spendToDate}</td>
                  <td>${c.projectedMonthEndSpend}</td>
                  <td>{c.budgetLimit !== undefined ? `$${c.budgetLimit}` : '—'}</td>
                  <td className={c.projectedOverBudget ? 'text-red-600 font-semibold' : 'text-green-700'}>
                    {c.projectedOverBudget ? 'HIGH' : 'LOW'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className='mt-4 text-xs text-gray-600'>
        Method: {data?.assumptions?.method} | History window: {data?.assumptions?.historyWindowMonths} months
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className='border rounded p-3'>
      <div className='text-xs text-gray-500'>{label}</div>
      <div className='text-lg font-semibold'>{value}</div>
    </div>
  );
}
