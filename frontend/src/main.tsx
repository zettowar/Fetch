import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        {/* Brand toast: Navy (Biscuit after dark), bottom of the screen
            above the tab bar, four seconds. What happened first, what it
            means second. */}
        <Toaster
          position="bottom-center"
          gutter={8}
          containerStyle={{ bottom: 'calc(var(--tab-bar-h, 0px) + 14px)' }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-fg)',
              border: '1px solid var(--toast-border)',
              borderRadius: '20px',
              padding: '12px 16px',
              fontSize: '14.5px',
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: '0 12px 28px -12px rgba(17, 19, 46, 0.55)',
              maxWidth: '380px',
            },
            success: {
              iconTheme: { primary: '#22b07a', secondary: '#fff' },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: 'rgb(var(--danger))', secondary: '#fff' },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
