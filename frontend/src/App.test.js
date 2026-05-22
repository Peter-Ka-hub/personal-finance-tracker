import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  test('renders the App component without crashing', () => {
    // Basic test to ensure the app wrapper renders correctly
    // Since App contains BrowserRouter and QueryClientProvider, 
    // it will render the Auth screen initially when not authenticated.
    render(<App />);
    expect(screen.getByText(/Zaloguj się do konta/i)).toBeInTheDocument();
  });
});
