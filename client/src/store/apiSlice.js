import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseURI = 'https://mernexpensetracker92.herokuapp.com';

export const apiSlice = createApi({
    baseQuery: fetchBaseQuery({ baseUrl: baseURI }),
    tagTypes: ['categories', 'transaction', 'budget', 'alerts', 'insights', 'forecast', 'recommendations'],
    endpoints: builder => ({
        getCategories: builder.query({
            query: () => '/api/categories',
            providesTags: ['categories']
        }),
        getLabels: builder.query({
            query: () => '/api/labels',
            providesTags: ['transaction']
        }),
        addTransaction: builder.mutation({
            query: (initialTransaction) => ({
                url: '/api/transaction',
                method: 'POST',
                body: initialTransaction
            }),
            invalidatesTags: ['transaction', 'budget', 'alerts', 'insights', 'forecast', 'recommendations']
        }),
        deleteTransaction: builder.mutation({
            query: recordId => ({
                url: '/api/transaction',
                method: 'DELETE',
                body: recordId
            }),
            invalidatesTags: ['transaction', 'budget', 'alerts', 'insights', 'forecast', 'recommendations']
        }),
        // -- Budget endpoints (ER-01) --
        getBudgets: builder.query({
            query: () => '/api/budget',
            providesTags: ['budget']
        }),
        getBudget: builder.query({
            query: (month) => '/api/budget/' + month,
            providesTags: (result, error, month) => [{ type: 'budget', id: month }]
        }),
        getBudgetUtilization: builder.query({
            query: (month) => '/api/budget/' + month + '/utilization',
            providesTags: (result, error, month) => [{ type: 'budget', id: month + '_util' }]
        }),
        createBudget: builder.mutation({
            query: (body) => ({ url: '/api/budget', method: 'POST', body }),
            invalidatesTags: ['budget']
        }),
        updateBudget: builder.mutation({
            query: ({ month, ...body }) => ({ url: '/api/budget/' + month, method: 'PUT', body }),
            invalidatesTags: ['budget']
        }),
        deleteBudget: builder.mutation({
            query: (month) => ({ url: '/api/budget/' + month, method: 'DELETE' }),
            invalidatesTags: ['budget']
        }),

        // -- ER-02 Intelligent Planning endpoints --
        getBudgetVsActual: builder.query({
            query: (period) => ({ url: '/api/insights/budget-vs-actual', params: { period } }),
            providesTags: (result, error, period) => [{ type: 'insights', id: 'bva-' + period }]
        }),
        getHealth: builder.query({
            query: (period) => ({ url: '/api/insights/health', params: { period } }),
            providesTags: (result, error, period) => [{ type: 'insights', id: 'health-' + period }]
        }),
        getAlerts: builder.query({
            query: (params) => ({ url: '/api/alerts', params }),
            providesTags: ['alerts']
        }),
        updateAlertStatus: builder.mutation({
            query: ({ id, status }) => ({ url: '/api/alerts/' + id, method: 'PATCH', body: { status } }),
            invalidatesTags: ['alerts']
        }),
        getForecast: builder.query({
            query: (period) => ({ url: '/api/forecast', params: { period } }),
            providesTags: (result, error, period) => [{ type: 'forecast', id: period }]
        }),
        getRecommendations: builder.query({
            query: (period) => ({ url: '/api/recommendations', params: { period } }),
            providesTags: (result, error, period) => [{ type: 'recommendations', id: period }]
        })
    })
})

export default apiSlice;
