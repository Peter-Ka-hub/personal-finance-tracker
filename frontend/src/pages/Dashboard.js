import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Trash2,
  PieChart as PieChartIcon,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { getTransactions, deleteTransaction } from "../api/transactionsApi";
import { getCategories } from "../api/categoriesApi";
import TransactionForm from "../components/TransactionForm";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
};

// Pomocnicze – pierwszy i ostatni dzień bieżącego miesiąca
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

// Nazwa miesiąca po polsku
function getMonthName(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  // Stan filtrowania dat – domyślnie bieżący miesiąc
  const defaultRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const { data: allTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => queryClient.invalidateQueries(["transactions"]),
  });

  // Filtrowane transakcje wg zakresu dat
  const transactions = useMemo(() => {
    return allTransactions.filter((t) => {
      const tDate = t.date;
      return tDate >= startDate && tDate <= endDate;
    });
  }, [allTransactions, startDate, endDate]);

  // Obliczenia podsumowujące
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return transactions.reduce(
      (acc, curr) => {
        const val = parseFloat(curr.amount);
        if (curr.type === "income") {
          acc.totalIncome += val;
          acc.balance += val;
        } else {
          acc.totalExpense += val;
          acc.balance -= val;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [transactions]);

  // Top 3 wydatki i przychody (do podsumowania na dashboardzie)
  const topExpenses = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const grouped = expenses.reduce((acc, curr) => {
      const val = parseFloat(curr.amount);
      const catName = curr.category ? curr.category.name : "Inne";
      const catColor = curr.category?.color || "#9CA3AF";
      if (!acc[catName]) {
        acc[catName] = { value: 0, color: catColor };
      }
      acc[catName].value += val;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, data]) => ({ name, value: data.value, color: data.color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [transactions]);

  const topIncomes = useMemo(() => {
    const incomes = transactions.filter((t) => t.type === "income");
    const grouped = incomes.reduce((acc, curr) => {
      const val = parseFloat(curr.amount);
      const catName = curr.category ? curr.category.name : "Inne";
      const catColor = curr.category?.color || "#9CA3AF";
      if (!acc[catName]) {
        acc[catName] = { value: 0, color: catColor };
      }
      acc[catName].value += val;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, data]) => ({ name, value: data.value, color: data.color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [transactions]);

  // Reset do bieżącego miesiąca
  const resetToCurrentMonth = () => {
    const range = getCurrentMonthRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  if (txLoading || catLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm">Ładowanie danych...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* FILTR DAT */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar size={18} className="text-blue-500" />
            <span className="font-semibold text-sm">Zakres dat:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-slate-400 text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={resetToCurrentMonth}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Bieżący miesiąc
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Wyświetlane dane za okres:{" "}
          <span className="font-medium text-slate-500">
            {getMonthName(startDate)} – {getMonthName(endDate)}
          </span>
        </p>
      </div>

      {/* KARTY PODSUMOWANIA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-500 font-medium">Saldo okresu</h3>
            <div
              className={`p-2 rounded-lg ${
                balance >= 0
                  ? "bg-blue-50 text-blue-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              <Wallet size={20} />
            </div>
          </div>
          <p
            className={`text-3xl font-bold ${
              balance >= 0 ? "text-slate-800" : "text-red-600"
            }`}
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
        {/* LEWA KOLUMNA: Formularz + podgląd struktury */}
        <div className="lg:col-span-1 space-y-6">
          <TransactionForm categories={categories} />

          {/* Mini podgląd struktury – link do strony wykresów */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PieChartIcon size={20} className="text-blue-500" />
                Struktura finansów
              </h3>
              <Link
                to="/charts"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Szczegóły
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Top wydatki */}
            {topExpenses.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Top wydatki
                </p>
                <div className="space-y-2">
                  {topExpenses.map((item, i) => {
                    const pct =
                      totalExpense > 0
                        ? Math.round((item.value / totalExpense) * 100)
                        : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-slate-700 flex-1 truncate">
                          {item.name}
                        </span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top przychody */}
            {topIncomes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Top przychody
                </p>
                <div className="space-y-2">
                  {topIncomes.map((item, i) => {
                    const pct =
                      totalIncome > 0
                        ? Math.round((item.value / totalIncome) * 100)
                        : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-slate-700 flex-1 truncate">
                          {item.name}
                        </span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {topExpenses.length === 0 && topIncomes.length === 0 && (
              <div className="text-center text-slate-400 py-4 text-sm">
                Brak danych do analizy w wybranym okresie.
              </div>
            )}

            <Link
              to="/charts"
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <PieChartIcon size={16} />
              Zobacz pełne wykresy
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* PRAWA KOLUMNA: Lista transakcji */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Historia operacji</h3>
              <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                {transactions.length} wpisów
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Wallet size={48} className="mb-4 opacity-20" />
                <p>Brak transakcji w wybranym okresie.</p>
                <p className="text-sm mt-1">
                  Zmień zakres dat lub dodaj nowy wpis.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {transactions.map((t) => (
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
                          <span
                            className="bg-white px-2 py-0.5 rounded border shadow-sm flex items-center gap-1.5"
                            style={{
                              borderColor: t.category?.color
                                ? `${t.category.color}40`
                                : "#e2e8f0",
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  t.category?.color || "#cbd5e1",
                              }}
                            ></span>
                            {t.category
                              ? t.category.name
                              : "Nieznana kategoria"}
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
                        {formatCurrency(parseFloat(t.amount))}
                      </span>

                      <button
                        onClick={() => deleteMutation.mutate(t.id)}
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
    </div>
  );
}
