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
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 3200,
            style: {
              background: 'rgba(17, 24, 39, 0.92)',
              color: '#fff',
              backdropFilter: 'blur(12px) saturate(150%)',
              WebkitBackdropFilter: 'blur(12px) saturate(150%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow:
                '0 10px 30px -8px rgba(17, 24, 39, 0.35), 0 4px 12px -4px rgba(17, 24, 39, 0.2)',
              maxWidth: '380px',
            },
            success: {
              iconTheme: {
                primary: '#ee7a10',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
