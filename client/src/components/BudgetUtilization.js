import React, { useState } from 'react';
import { default as api } from '../store/apiSlice';

function paceColor(status) {
    if (status === 'On track') return { bg: '#d1fae5', text: '#065f46' };
    if (status === 'At risk')  return { bg: '#fef3c7', text: '#92400e' };
    if (status === 'Off track') return { bg: '#fee2e2', text: '#991b1b' };
    return { bg: '#e5e7eb', text: '#374151' };
}

function PaceBadge({ status }) {
    const c = paceColor(status);
    return (
        <span style={{ background: c.bg, color: c.text }}
            className='text-xs font-semibold px-2 py-0.5 rounded-full'>
            {status}
        </span>
    );
}

function ProgressBar({ percent, status }) {
    const barColor = status === 'On track' ? '#10b981'
        : status === 'At risk' ? '#f59e0b' : '#ef4444';
    const capped = Math.min(percent, 100);
    return (
        <div className='w-full bg-gray-200 rounded-full h-2 mt-1 mb-1'>
            <div style={{ width: capped + '%', background: barColor, transition: 'width 0.3s' }}
                className='h-2 rounded-full'></div>
        </div>
    );
}

function UtilRow({ label, data }) {
    if (!data) return null;
    return (
        <div className='bg-gray-50 rounded p-3 mb-2' style={{ borderLeft: '4px solid #4C3A51' }}>
            <div className='flex justify-between items-center'>
                <span className='font-semibold text-sm'>{label}</span>
                <PaceBadge status={data.pace ? data.pace.status : 'N/A'} />
            </div>
            <ProgressBar percent={data.percentUsed} status={data.pace ? data.pace.status : 'N/A'} />
            <div className='flex justify-between text-xs text-gray-600 mt-1'>
                <span>Budget: ${data.budget}</span>
                <span>Spent: ${data.spent}</span>
                <span>Remaining: ${data.remaining}</span>
                <span>{data.percentUsed}% used</span>
            </div>
            {data.pace && data.pace.daysElapsed > 0 && (
                <p className='text-xs text-gray-400 mt-1'>
                    Day {data.pace.daysElapsed}/{data.pace.daysInMonth} &mdash;
                    Expected spend: ${data.pace.expectedSpend}
                </p>
            )}
        </div>
    );
}
export default function BudgetUtilization() {
    const today = new Date();
    const defaultMonth = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0');
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

    const { data: utilData, isFetching, isError, error } =
        api.useGetBudgetUtilizationQuery(selectedMonth, { skip: !selectedMonth });

    return (
        <div className='form max-w-sm mx-auto w-96'>
            <h1 className='font-bold pb-2 text-xl'>Budget Utilization</h1>
            <div className='mb-4'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Select Month</label>
                <input type='month' value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className='form-input' />
            </div>
            {isFetching && <p className='text-sm text-gray-500'>Loading utilization...</p>}
            {isError && (
                <p className='text-sm text-red-500'>
                    {error && error.data ? error.data.message : 'No budget found for this month.'}
                </p>
            )}
            {!isFetching && !isError && utilData && (
                <>
                    <h2 className='font-semibold text-base mb-2'>Overall</h2>
                    <UtilRow label='Total Budget' data={utilData.utilization.overall} />
                    {utilData.utilization.byCategory.length > 0 && (
                        <>
                            <h2 className='font-semibold text-base mb-2 mt-3'>By Category</h2>
                            {utilData.utilization.byCategory.map(cb => (
                                <UtilRow key={cb.type} label={cb.type} data={cb} />
                            ))}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
