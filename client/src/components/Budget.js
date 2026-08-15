import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { default as api } from '../store/apiSlice';

const CATEGORIES = ['Investment', 'Expense', 'Savings'];

export default function Budget() {
    const [editMonth, setEditMonth] = useState(null);
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
        defaultValues: { month: '', overall: '', categoryBudgets: [] }
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'categoryBudgets' });

    const { data: budgets, isFetching } = api.useGetBudgetsQuery();
    const [createBudget, { isLoading: creating }] = api.useCreateBudgetMutation();
    const [updateBudget, { isLoading: updating }] = api.useUpdateBudgetMutation();
    const [deleteBudget] = api.useDeleteBudgetMutation();

    const onSubmit = async (data) => {
        const payload = {
            month: data.month,
            overall: Number(data.overall),
            categoryBudgets: (data.categoryBudgets || []).map(cb => ({
                type: cb.type,
                amount: Number(cb.amount)
            }))
        };
        try {
            if (editMonth) {
                await updateBudget({ month: editMonth, ...payload }).unwrap();
            } else {
                await createBudget(payload).unwrap();
            }
            setEditMonth(null);
            reset({ month: '', overall: '', categoryBudgets: [] });
        } catch (e) {
            alert(e.data ? e.data.message : 'Error saving budget');
        }
    };

    const handleEdit = (b) => {
        setEditMonth(b.month);
        reset({ month: b.month, overall: b.overall,
            categoryBudgets: (b.categoryBudgets || []).map(cb => ({ type: cb.type, amount: cb.amount })) });
    };

    const handleDelete = async (month) => {
        if (!window.confirm('Delete budget for ' + month + '?')) return;
        try { await deleteBudget(month).unwrap(); }
        catch (e) { alert(e.data ? e.data.message : 'Error deleting budget'); }
    };

    const handleCancel = () => {
        setEditMonth(null);
        reset({ month: '', overall: '', categoryBudgets: [] });
    };

    const handleReset = () => {
        setEditMonth(null);
        reset({ month: '', overall: '', categoryBudgets: [] });
    };

    const usedTypes = fields.map(f => f.type);
    const availableCategories = CATEGORIES.filter(c => !usedTypes.includes(c));

    return (
        <div className='form max-w-sm mx-auto w-96'>
            <h1 className='font-bold pb-4 text-xl'>
                {editMonth ? 'Edit Budget: ' + editMonth : 'Budget Setup'}
            </h1>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className='grid gap-3'>
                    <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>Month</label>
                        <input type='month' {...register('month', { required: 'Month is required' })}
                            className='form-input' disabled={!!editMonth} />
                        {errors.month && <p className='text-red-500 text-xs mt-1'>{errors.month.message}</p>}
                    </div>
                    <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>Overall Budget ($)</label>
                        <input type='number' min='0' step='0.01'
                            {...register('overall', {
                                required: 'Overall budget is required',
                                min: { value: 0, message: 'Must be non-negative' },
                                validate: v => !isNaN(Number(v)) || 'Must be a number'
                            })}
                            className='form-input' placeholder='e.g. 3000' />
                        {errors.overall && <p className='text-red-500 text-xs mt-1'>{errors.overall.message}</p>}
                    </div>
                    <div>
                        <div className='flex justify-between items-center mb-1'>
                            <label className='text-sm font-medium text-gray-700'>Category Budgets (optional)</label>
                            {availableCategories.length > 0 && (
                                <button type='button' onClick={() => append({ type: availableCategories[0], amount: '' })}
                                    className='text-xs border px-2 py-1 rounded btn-blue text-white'>+ Add</button>
                            )}
                        </div>
                        {fields.map((field, index) => (
                            <div key={field.id} className='flex gap-2 items-center mb-2'>
                                <select {...register('categoryBudgets.' + index + '.type')} className='form-input flex-1'>
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <input type='number' min='0' step='0.01'
                                    {...register('categoryBudgets.' + index + '.amount', {
                                        required: 'Required', min: { value: 0, message: '>= 0' },
                                        validate: v => !isNaN(Number(v)) || 'Number'
                                    })}
                                    className='form-input flex-1' placeholder='Amount' />
                                <button type='button' onClick={() => remove(index)}
                                    className='text-red-500 font-bold px-2'>x</button>
                            </div>
                        ))}
                    </div>
                    <div className='flex gap-2'>
                        <button type='submit' disabled={creating || updating}
                            className='border py-2 text-white btn-blue w-full'>
                            {editMonth ? (updating ? 'Saving...' : 'Update Budget') : (creating ? 'Saving...' : 'Save Budget')}
                        </button>
                        <button type='button' onClick={handleReset}
                            className='border py-2 px-3 rounded text-gray-600 bg-gray-100'>Reset</button>
                        {editMonth && (
                            <button type='button' onClick={handleCancel}
                                className='border py-2 px-3 rounded text-gray-600 bg-gray-100'>Cancel</button>
                        )}
                    </div>
                </div>
            </form>            <div className='mt-6'>
                <h2 className='font-bold text-lg mb-3'>Saved Budgets</h2>
                {isFetching && <p className='text-sm text-gray-500'>Loading...</p>}
                {!isFetching && (!budgets || budgets.length === 0) && (
                    <p className='text-sm text-gray-400'>No budgets set yet.</p>
                )}
                {(budgets || []).map(b => (
                    <div key={b._id} className='flex justify-between items-center bg-gray-50 rounded px-3 py-2 mb-2'
                        style={{ borderLeft: '4px solid #4C3A51' }}>
                        <div>
                            <p className='font-semibold'>{b.month}</p>
                            <p className='text-sm text-gray-600'>Overall: ${b.overall}</p>
                            {(b.categoryBudgets || []).map(cb => (
                                <p key={cb.type} className='text-xs text-gray-500'>{cb.type}: ${cb.amount}</p>
                            ))}
                        </div>
                        <div className='flex gap-2'>
                            <button onClick={() => handleEdit(b)}
                                className='text-xs border px-2 py-1 rounded btn-blue text-white'>Edit</button>
                            <button onClick={() => handleDelete(b.month)}
                                className='text-xs border px-2 py-1 rounded bg-red-500 text-white'>Del</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
