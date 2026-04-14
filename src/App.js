import React, { useState, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  LogOut,
  Plus,
  Trash2,
  PieChart as PieChartIcon,
  User,
  Lock,
} from "lucide-react";

// --- KOMPONENTY LOGOWANIA I REJESTRACJI ---

const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Proszę wypełnić wszystkie pola.");
      return;
    }
    // W tej prostej wersji akceptujemy dowolne dane logowania
    // W prawdziwej aplikacji tutaj nastąpiłaby weryfikacja z backendem
    onLogin(username);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Menedżer Finansów
          </h1>
          <p className="text-blue-100">Zarządzaj swoim budżetem mądrze</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            {isLogin ? "Zaloguj się do konta" : "Stwórz nowe konto"}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nazwa użytkownika
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="np. jan.kowalski"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hasło
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {isLogin ? "Zaloguj się" : "Zarejestruj się"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            {isLogin ? "Nie masz jeszcze konta? " : "Masz już konto? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-blue-600 font-medium hover:underline"
            >
              {isLogin ? "Zarejestruj się" : "Zaloguj się"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- GŁÓWNA APLIKACJA ---

const KATEGORIE_WYDATKOW = [
  "Jedzenie",
  "Transport",
  "Mieszkanie",
  "Rozrywka",
  "Zdrowie",
  "Inne",
];
const KATEGORIE_PRZYCHODOW = ["Wypłata", "Premia", "Prezent", "Inne"];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      type: "income",
      amount: 5000,
      category: "Wypłata",
      description: "Wynagrodzenie za marzec",
      date: "2023-10-01",
    },
    {
      id: 2,
      type: "expense",
      amount: 150,
      category: "Jedzenie",
      description: "Zakupy w supermarkecie",
      date: "2023-10-02",
    },
    {
      id: 3,
      type: "expense",
      amount: 80,
      category: "Transport",
      description: "Paliwo",
      date: "2023-10-03",
    },
    {
      id: 4,
      type: "expense",
      amount: 1200,
      category: "Mieszkanie",
      description: "Czynsz",
      date: "2023-10-05",
    },
  ]);

  // Stan formularza
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(KATEGORIE_WYDATKOW[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [formError, setFormError] = useState("");

  // Zmiana typu transakcji resetuje kategorię na domyślną dla danego typu
  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory(
      newType === "expense" ? KATEGORIE_WYDATKOW[0] : KATEGORIE_PRZYCHODOW[0],
    );
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !description || !date) {
      setFormError("Proszę wypełnić poprawnie wszystkie pola.");
      return;
    }

    const newTransaction = {
      id: Date.now(),
      type,
      amount: parseFloat(amount),
      category,
      description,
      date,
    };

    setTransactions([newTransaction, ...transactions]);

    // Reset formularza
    setAmount("");
    setDescription("");
    setFormError("");
  };

  const handleDeleteTransaction = (id) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  // Obliczenia podsumowujące
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return transactions.reduce(
      (acc, curr) => {
        if (curr.type === "income") {
          acc.totalIncome += curr.amount;
          acc.balance += curr.amount;
        } else {
          acc.totalExpense += curr.amount;
          acc.balance -= curr.amount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 },
    );
  }, [transactions]);

  // Dane do wykresu (grupowanie wydatków po kategorii)
  const expensesByCategory = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

    // Sortowanie malejąco wg kwoty
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const maxExpenseCategoryValue =
    expensesByCategory.length > 0 ? expensesByCategory[0].value : 1;

  // Formatowanie waluty
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(value);
  };

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12">
      {/* Nawigacja */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <Wallet size={24} />
            <span>Finance Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 hidden sm:block">
              Welcome, {user}!
            </span>
            <button
              onClick={() => setUser(null)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Wyloguj"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-6">
        {/* KARTY PODSUMOWANIA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-500 font-medium">Aktualne Saldo</h3>
              <div
                className={`p-2 rounded-lg ${balance >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}
              >
                <Wallet size={20} />
              </div>
            </div>
            <p
              className={`text-3xl font-bold ${balance >= 0 ? "text-slate-800" : "text-red-600"}`}
            >
              {formatCurrency(balance)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-500 font-medium">Przychody</h3>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {formatCurrency(totalIncome)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-500 font-medium">Wydatki</h3>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <TrendingDown size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {formatCurrency(totalExpense)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEWA KOLUMNA: Formularz i Wykres */}
          <div className="lg:col-span-1 space-y-6">
            {/* FORMULARZ DODAWANIA */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus size={20} className="text-blue-500" />
                Dodaj operację
              </h3>

              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddTransaction} className="space-y-4">
                {/* Przełącznik Typu */}
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("expense")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      type === "expense"
                        ? "bg-white text-rose-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Wydatek
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("income")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      type === "income"
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Przychód
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kwota (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="np. 150.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kategoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {(type === "expense"
                      ? KATEGORIE_WYDATKOW
                      : KATEGORIE_PRZYCHODOW
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Opis
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="np. Zakupy w Biedronce"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full font-medium py-2 rounded-lg text-white transition-colors mt-2 ${
                    type === "expense"
                      ? "bg-rose-500 hover:bg-rose-600"
                      : "bg-emerald-500 hover:bg-emerald-600"
                  }`}
                >
                  Dodaj {type === "expense" ? "wydatek" : "przychód"}
                </button>
              </form>
            </div>

            {/* WYKRES KATEGORII (Tylko dla wydatków) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <PieChartIcon size={20} className="text-blue-500" />
                Struktura wydatków
              </h3>

              {expensesByCategory.length === 0 ? (
                <div className="text-center text-slate-400 py-6 text-sm">
                  Brak wydatków do analizy.
                </div>
              ) : (
                <div className="space-y-4">
                  {expensesByCategory.map((item, index) => {
                    const percentage = Math.round(
                      (item.value / totalExpense) * 100,
                    );
                    const barWidth = Math.max(
                      (item.value / maxExpenseCategoryValue) * 100,
                      2,
                    ); // min 2% width

                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">
                            {item.name}
                          </span>
                          <span className="text-slate-500">
                            {formatCurrency(item.value)} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-2.5 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* PRAWA KOLUMNA: Lista transakcji */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
              <h3 className="text-lg font-bold mb-4">Historia operacji</h3>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Wallet size={48} className="mb-4 opacity-20" />
                  <p>Brak historii transakcji.</p>
                  <p className="text-sm mt-1">
                    Dodaj swój pierwszy wpis używając formularza.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sortowanie po dacie malejąco */}
                  {[...transactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/50 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              t.type === "income"
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            {t.type === "income" ? (
                              <TrendingUp size={20} />
                            ) : (
                              <TrendingDown size={20} />
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {t.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                {t.category}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(t.date).toLocaleDateString("pl-PL")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={`font-bold whitespace-nowrap ${
                              t.type === "income"
                                ? "text-emerald-600"
                                : "text-slate-800"
                            }`}
                          >
                            {t.type === "income" ? "+" : "-"}
                            {formatCurrency(t.amount)}
                          </span>

                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń wpis"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
