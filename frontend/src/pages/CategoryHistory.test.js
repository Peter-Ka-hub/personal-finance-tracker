import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./Dashboard";
import Charts from "./Charts";
import CategoriesSettings from "./CategoriesSettings";
import { addTransaction } from "../api/transactionsApi";

jest.mock("react-router-dom", () => ({ Link: "a" }), { virtual: true });
jest.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}), { virtual: true });
jest.mock("../api/transactionsApi");

const archived = {
  id: "archived", name: "Wycofana", type: "expense", color: "#123456",
  archivedAt: "2026-11-15T12:00:00Z",
};
const active = { id: "active", name: "Aktywna", type: "expense", color: "#654321" };
const transaction = (categoryId, description) => ({
  id: categoryId, categoryId, description, type: "expense", amount: "15.00", date: "2026-11-12",
});

function renderWithData(view, categories, transactions = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["categories"], categories);
  client.setQueryData(["transactions"], transactions);
  render(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
  return client;
}

test("history keeps the archived name and color, with a fallback for a missing category", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-11-20T12:00:00Z"));
  try {
    renderWithData(<Dashboard />, [archived, active], [
      transaction(archived.id, "Stary wydatek"),
      transaction("missing", "Wydatek bez kategorii"),
    ]);
    const historyRow = screen.getByText("Stary wydatek").parentElement;
    const label = within(historyRow).getByText(archived.name);
    expect(label.firstElementChild).toHaveStyle({ backgroundColor: "rgb(18, 52, 86)" });
    expect(within(screen.getByText("Wydatek bez kategorii").parentElement)
      .getByText("Nieznana kategoria")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: archived.name })).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test("a category archived after selection is replaced by an active option", async () => {
  const original = { ...archived, archivedAt: null };
  const client = renderWithData(<Dashboard />, [original, active]);
  expect(screen.getByRole("combobox")).toHaveValue(original.id);

  client.setQueryData(["categories"], [archived, active]);
  await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue(active.id));
  expect(screen.queryByRole("option", { name: archived.name })).not.toBeInTheDocument();
});

test("form prevents submission when every category is archived", () => {
  renderWithData(<Dashboard />, [archived]);
  const submit = screen.getByRole("button", { name: "Dodaj wydatek" });
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(addTransaction).not.toHaveBeenCalled();
});

test("charts keep archive colors separate from a new category with the same name", () => {
  renderWithData(<Charts />, [archived, { ...active, name: archived.name }], [
    transaction(archived.id, "Stary wydatek"),
    transaction(active.id, "Nowy wydatek"),
    transaction("missing", "Wydatek bez kategorii"),
  ]);
  const labels = screen.getAllByText(archived.name);
  expect(labels).toHaveLength(2);
  expect(labels[0].previousElementSibling).toHaveStyle({ backgroundColor: "rgb(18, 52, 86)" });
  expect(labels[1].previousElementSibling).toHaveStyle({ backgroundColor: "rgb(101, 67, 33)" });
  expect(screen.getByText("Nieznana kategoria")).toBeInTheDocument();
});

test("settings only offer the archive action for active categories", () => {
  renderWithData(<CategoriesSettings />, [archived, active]);
  expect(screen.getByRole("button", { name: `Archiwizuj kategorię ${active.name}` })).toBeInTheDocument();
  expect(screen.queryByText(archived.name)).not.toBeInTheDocument();
});
