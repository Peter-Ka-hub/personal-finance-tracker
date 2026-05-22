import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { getCategories, addCategory, deleteCategory } from "../api/categoriesApi";

export default function CategoriesSettings() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [color, setColor] = useState("#3B82F6"); // Default blue
  const [formError, setFormError] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories
  });

  const addMutation = useMutation({
    mutationFn: addCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(['categories']);
      setName("");
      setFormError("");
    },
    onError: (err) => {
      setFormError("Błąd dodawania kategorii");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(['categories']);
    }
  });

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!name) {
      setFormError("Podaj nazwę kategorii");
      return;
    }
    addMutation.mutate({ name, type, color, icon: 'circle' });
  };

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  if (isLoading) {
    return <div className="text-center py-10">Ładowanie kategorii...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold mb-6">Zarządzaj kategoriami</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h3 className="text-lg font-semibold mb-4">Dodaj nową</h3>
            
            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddCategory} className="space-y-4">
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
                  Nazwa
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Zakupy, Podróże"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kolor etykiety
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 px-1 py-1 border border-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={addMutation.isPending}
                className={`w-full font-medium py-2 rounded-lg text-white transition-colors flex items-center justify-center gap-2 ${
                  type === "expense"
                    ? "bg-rose-500 hover:bg-rose-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                <Plus size={18} />
                Dodaj kategorię
              </button>
            </form>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-slate-700">Wydatki</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || '#9CA3AF' }}></div>
                      <span className="font-medium text-slate-700">{cat.name}</span>
                    </div>
                    <button 
                      onClick={() => deleteMutation.mutate(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {expenseCategories.length === 0 && <p className="text-sm text-slate-400">Brak kategorii wydatków.</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-slate-700">Przychody</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || '#9CA3AF' }}></div>
                      <span className="font-medium text-slate-700">{cat.name}</span>
                    </div>
                    <button 
                      onClick={() => deleteMutation.mutate(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {incomeCategories.length === 0 && <p className="text-sm text-slate-400">Brak kategorii przychodów.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
