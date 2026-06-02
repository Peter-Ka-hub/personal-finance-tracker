import axiosClient from './api/axiosClient';

// Note: rendering the full <App/> (react-router v7 + react-query + recharts) is
// not exercised here because react-scripts 5's jest transform mishandles those
// libraries' hooks under React 19. The production build is verified separately
// in CI (`npm run build`), and the API surface is covered by the e2e tests.

describe('frontend api client', () => {
  test('uses the configured API base URL', () => {
    // REACT_APP_API_URL is unset in tests → falls back to the local default
    expect(axiosClient.defaults.baseURL).toBe('http://localhost/api');
  });

  test('attaches a Bearer token from localStorage to requests', () => {
    localStorage.setItem('token', 'abc123');
    const onRequest = axiosClient.interceptors.request.handlers[0].fulfilled;
    const config = onRequest({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
    localStorage.removeItem('token');
  });

  test('does not attach an Authorization header when no token is stored', () => {
    localStorage.removeItem('token');
    const onRequest = axiosClient.interceptors.request.handlers[0].fulfilled;
    const config = onRequest({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});
