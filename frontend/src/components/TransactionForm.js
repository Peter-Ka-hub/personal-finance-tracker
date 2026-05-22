import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { addTransaction } from "../api/transactionsApi";

export default function TransactionForm({ categories }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [formError, setFormError] = useState("");

  const filteredCategories = categories.filter((c) => c.type === type);

  // set default category if empty or type changed
  React.useEffect(() => {
    if (
      filteredCategories.length > 0 &&
      !filteredCategories.find((c) => c.id === categoryId)
    ) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, categoryId]);

  const addMutation = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries(["transactions"]);
      setAmount("");
      setDescription("");
      setFormError("");
    },
    onError: () =>
      setFormError("Wystąpił błąd podczas dodawania transakcji."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !description || !date || !categoryId) {
      setFormError("Proszę wypełnić poprawnie wszystkie pola.");
      return;
    }

    addMutation.mutate({
      type,
      amount: parseFloat(amount),
      categoryId,
      description,
      date,
    });
  };

  return (
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setType("expense")}
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
            onClick={() => setType("income")}
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
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
            {filteredCategories.length === 0 && (
              <option value="" disabled>
                Brak kategorii - dodaj w Ustawieniach
              </option>
            )}
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
          disabled={addMutation.isPending || filteredCategories.length === 0}
          className={`w-full font-medium py-2 rounded-lg text-white transition-colors mt-2 ${
            type === "expense"
              ? "bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300"
              : "bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300"
          }`}
        >
          {addMutation.isPending
            ? "Dodawanie..."
            : `Dodaj ${type === "expense" ? "wydatek" : "przychód"}`}
        </button>
      </form>
    </div>
  );
}
