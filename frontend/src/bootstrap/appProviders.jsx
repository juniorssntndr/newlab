import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../state/AuthContext.jsx';
import { NotificationProvider } from '../state/NotificationContext.jsx';
import { queryClient } from './queryClient.js';

export const AppProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <NotificationProvider>
                    {children}
                </NotificationProvider>
            </AuthProvider>
        </BrowserRouter>
    </QueryClientProvider>
);
