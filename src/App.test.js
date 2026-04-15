import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('AuthScreen - Login and Registration', () => {
  test('renders login screen on initial load', () => {
    render(<App />);
    expect(screen.getByText(/Zaloguj si\u0119 do konta/i)).toBeInTheDocument();
    expect(screen.getByText(/Mened\u017cer Finansów/i)).toBeInTheDocument();
  });

  test('shows error when submitting empty form', async () => {
    render(<App />);
    const submitButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(submitButton);
    expect(screen.getByText(/Prosz\u0119 wype\u0142ni\u0107 wszystkie pola/i)).toBeInTheDocument();
  });

  test('logs in successfully with username and password', async () => {
    render(<App />);
    const usernameInput = screen.getByPlaceholderText('np. jan.kowalski');
    const passwordInput = screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    const submitButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(submitButton);
    expect(screen.getByText(/Finance Tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome, testuser!/i)).toBeInTheDocument();
  });

  test('toggles between login and registration forms', async () => {
    render(<App />);
    expect(screen.getByText(/Zaloguj si\u0119 do konta/i)).toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: /Zarejestruj si\u0119/i });
    await userEvent.click(toggleButton);
    expect(screen.getByText(/Stw\u00f3rz nowe konto/i)).toBeInTheDocument();
  });
});

describe('Main App - Dashboard', () => {
  beforeEach(async () => {
    render(<App />);
    const usernameInput = screen.getByPlaceholderText('np. jan.kowalski');
    const passwordInput = screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    const submitButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(submitButton);
  });

  test('displays default transactions', () => {
    expect(screen.getByText('Wynagrodzenie za marzec')).toBeInTheDocument();
    expect(screen.getByText('Zakupy w supermarkecie')).toBeInTheDocument();
  });

  test('displays summary cards with totals', () => {
    expect(screen.getByText(/Aktualne Saldo/i)).toBeInTheDocument();
    expect(screen.getByText(/Przychody/i)).toBeInTheDocument();
    expect(screen.getByText(/Wydatki/i)).toBeInTheDocument();
  });
});

describe('Add Transaction Form', () => {
  beforeEach(async () => {
    render(<App />);
    const usernameInput = screen.getByPlaceholderText('np. jan.kowalski');
    const passwordInput = screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    const submitButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(submitButton);
  });

  test('successfully adds income', async () => {
    const incomeButton = screen.getByRole('button', { name: 'Przychód' });
    await userEvent.click(incomeButton);
    const amountInput = screen.getByPlaceholderText('np. 150.00');
    const descriptionInput = screen.getByPlaceholderText('np. Zakupy w Biedronce');
    await userEvent.type(amountInput, '500');
    await userEvent.type(descriptionInput, 'Bonus');
    const submitButton = screen.getByRole('button', { name: /Dodaj przychód/i });
    await userEvent.click(submitButton);
    expect(screen.getByText('Bonus')).toBeInTheDocument();
  });

  test('shows error with empty form', async () => {
    const submitButton = screen.getByRole('button', { name: /Dodaj wydatek/i });
    await userEvent.click(submitButton);
    expect(screen.getByText(/Prosz\u0119 wype\u0142ni\u0107 poprawnie wszystkie pola/i)).toBeInTheDocument();
  });
});

describe('Logout', () => {
  beforeEach(async () => {
    render(<App />);
    const usernameInput = screen.getByPlaceholderText('np. jan.kowalski');
    const passwordInput = screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    const submitButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(submitButton);
  });

  test('logs out user', async () => {
    expect(screen.getByText(/Welcome, testuser!/i)).toBeInTheDocument();
    const logoutButton = screen.getByTitle('Wyloguj');
    await userEvent.click(logoutButton);
    expect(screen.getByText(/Zaloguj si\u0119 do konta/i)).toBeInTheDocument();
  });
});

describe('Integration Tests', () => {
  test('complete login and transaction workflow', async () => {
    render(<App />);
    const usernameInput =  screen.getByPlaceholderText('np. jan.kowalski');
    const passwordInput = screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    const loginButton = screen.getByRole('button', { name: /Zaloguj si\u0119/i });
    await userEvent.click(loginButton);
    expect(screen.getByText(/Finance Tracker/i)).toBeInTheDocument();
    
    // Add income
    const incomeButton = screen.getByRole('button', { name: 'Przychód' });
    await userEvent.click(incomeButton);
    const amountInput = screen.getByPlaceholderText('np. 150.00');
    const descriptionInput = screen.getByPlaceholderText('np. Zakupy w Biedronce');
    await userEvent.type(amountInput, '1000');
    await userEvent.type(descriptionInput, 'Salary');
    const addIncomeButton = screen.getByRole('button', { name: /Dodaj przychód/i });
    await userEvent.click(addIncomeButton);
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });
});
