import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
} from "lucide-react";
import { getTransactions } from "../api/transactionsApi";
import { getCategories } from "../api/categoriesApi";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
};

// Paleta kolorów fallback – wykorzystywana, gdy kategoria nie ma przypisanego koloru
const FALLBACK_COLORS_EXPENSE = [
  "#F43F5E", "#FB923C", "#F59E0B", "#EF4444", "#E11D48", "#D946EF",
  "#C026D3", "#A855F7", "#EC4899", "#F97316",
];
const FALLBACK_COLORS_INCOME = [
  "#10B981", "#06B6D4", "#3B82F6", "#14B8A6", "#22D3EE", "#0EA5E9",
  "#6366F1", "#8B5CF6", "#2DD4BF", "#34D399",
];

// Custom tooltip dla wykresów
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          ></div>
          <span className="font-semibold text-slate-800 text-sm">
            {data.name}
          </span>
        </div>
        <p className="text-slate-600 text-sm font-medium">
          {formatCurrency(data.value)}
        </p>
        <p className="text-slate-400 text-xs">{data.percentage}% udziału</p>
      </div>
    );
  }
  return null;
};

// Custom Legend
const CustomLegendContent = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          ></div>
          <span className="text-slate-600 font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// Custom Active Shape (etykieta na hover)
const renderActiveLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Nie pokazuj etykiet mniejszych niż 5%

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-bold"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Charts() {
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });
  const { isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // Grupowanie wydatków po kategorii
  const expensesByCategory = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const total = expenses.reduce((s, t) => s + parseFloat(t.amount), 0);
    const grouped = expenses.reduce((acc, curr) => {
      const val = parseFloat(curr.amount);
      const catName = curr.category ? curr.category.name : "Inne";
      const catColor = curr.category?.color || null;
      if (!acc[catName]) {
        acc[catName] = { value: 0, color: catColor };
      }
      acc[catName].value += val;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, data], index) => ({
        name,
        value: Math.round(data.value * 100) / 100,
        color: data.color || FALLBACK_COLORS_EXPENSE[index % FALLBACK_COLORS_EXPENSE.length],
        percentage: total > 0 ? Math.round((data.value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Grupowanie przychodów po kategorii
  const incomeByCategory = useMemo(() => {
    const incomes = transactions.filter((t) => t.type === "income");
    const total = incomes.reduce((s, t) => s + parseFloat(t.amount), 0);
    const grouped = incomes.reduce((acc, curr) => {
      const val = parseFloat(curr.amount);
      const catName = curr.category ? curr.category.name : "Inne";
      const catColor = curr.category?.color || null;
      if (!acc[catName]) {
        acc[catName] = { value: 0, color: catColor };
      }
      acc[catName].value += val;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, data], index) => ({
        name,
        value: Math.round(data.value * 100) / 100,
        color: data.color || FALLBACK_COLORS_INCOME[index % FALLBACK_COLORS_INCOME.length],
        percentage: total > 0 ? Math.round((data.value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + parseFloat(t.amount), 0),
    [transactions]
  );

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + parseFloat(t.amount), 0),
    [transactions]
  );

  if (txLoading || catLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm">Ładowanie wykresów...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek strony */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Powrót do pulpitu"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <PieChartIcon size={24} className="text-blue-500" />
              Struktura Finansów
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Analiza przychodów i wydatków według kategorii
            </p>
          </div>
        </div>
      </div>

      {/* Karty podsumowujące */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-md text-white">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingUp size={18} />
            <span className="text-sm font-medium">Suma przychodów</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p>
          <p className="text-xs opacity-75 mt-1">
            {incomeByCategory.length} kategorii
          </p>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-5 rounded-2xl shadow-md text-white">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingDown size={18} />
            <span className="text-sm font-medium">Suma wydatków</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p>
          <p className="text-xs opacity-75 mt-1">
            {expensesByCategory.length} kategorii
          </p>
        </div>
      </div>

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wykres Przychodów */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp size={18} />
              </div>
              Struktura Przychodów
            </h2>
          </div>

          {incomeByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 px-6 pb-6">
              <TrendingUp size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Brak przychodów do analizy.</p>
              <p className="text-xs mt-1">
                Dodaj przychody na pulpicie, aby zobaczyć wykres.
              </p>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={renderActiveLabel}
                      animationBegin={0}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {incomeByCategory.map((entry, index) => (
                        <Cell
                          key={`income-cell-${index}`}
                          fill={entry.color}
                          stroke="white"
                          strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegendContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista kategorii przychodów */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {incomeByCategory.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-slate-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {item.percentage}%
                      </span>
                      <span className="text-sm font-semibold text-slate-800 min-w-[90px] text-right">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Wykres Wydatków */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <TrendingDown size={18} />
              </div>
              Struktura Wydatków
            </h2>
          </div>

          {expensesByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 px-6 pb-6">
              <TrendingDown size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Brak wydatków do analizy.</p>
              <p className="text-xs mt-1">
                Dodaj wydatki na pulpicie, aby zobaczyć wykres.
              </p>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={renderActiveLabel}
                      animationBegin={0}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell
                          key={`expense-cell-${index}`}
                          fill={entry.color}
                          stroke="white"
                          strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegendContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista kategorii wydatków */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {expensesByCategory.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-slate-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {item.percentage}%
                      </span>
                      <span className="text-sm font-semibold text-slate-800 min-w-[90px] text-right">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
