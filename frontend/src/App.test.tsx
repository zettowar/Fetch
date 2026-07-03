import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the landing page at /', () => {
    renderApp('/');
    expect(screen.getByText(/Crown the top pup/)).toBeDefined();
    expect(screen.getByText(/In development/)).toBeDefined();
  });

  it('redirects a logged-out visit to /app/home to the login page', () => {
    // Deep links bounce to /login (carrying the destination in router state)
    // so the user returns there after authenticating.
    renderApp('/app/home');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined();
  });

  it('renders login page at /login', () => {
    renderApp('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
  });

  it('renders signup page at /signup', () => {
    renderApp('/signup');
    expect(screen.getByRole('heading', { name: 'Join the pack' })).toBeDefined();
    expect(screen.getByLabelText('Display name')).toBeDefined();
  });
});
