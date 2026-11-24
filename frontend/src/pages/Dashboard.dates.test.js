import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./Dashboard";
import { getCategories } from "../api/categoriesApi";
import { addTransaction, getTransactions } from "../api/transactionsApi";

// CRA's Jest resolver cannot load React Router's package exports.
jest.mock("react-router-dom", () => ({ Link: "a" }), { virtual: true });
jest.mock("../api/categoriesApi");
jest.mock("../api/transactionsApi");

const category = { id: "food", type: "expense", name: "Jedzenie" };
const categories = [category];

function transaction(date, description) {
  return { id: date, date, description, categoryId: category.id, type: "expense", amount: "10.00" };
}

const novemberTransactions = [
  transaction("2026-10-31", "Ostatni dzień października"),
  transaction("2026-11-01", "Pierwszy dzień listopada"),
  transaction("2026-11-30", "Ostatni dzień listopada"),
  transaction("2026-12-01", "Pierwszy dzień grudnia"),
];

function renderDashboard(transactions = novemberTransactions) {
  getCategories.mockResolvedValue(categories);
  getTransactions.mockResolvedValue(transactions);
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["categories"], categories);
  client.setQueryData(["transactions"], transactions);
  render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>
  );
}

const startDateInput = () => screen.getByLabelText("Początek zakresu dat");
const endDateInput = () => screen.getByLabelText("Koniec zakresu dat");

beforeEach(() => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(2026, 10, 20, 12));
});

afterEach(() => {
  jest.useRealTimers();
});

test("includes both days at the boundaries of the current month", () => {
  renderDashboard();

  expect(startDateInput()).toHaveValue("2026-11-01");
  expect(endDateInput()).toHaveValue("2026-11-30");
  expect(screen.getByText("Pierwszy dzień listopada")).toBeInTheDocument();
  expect(screen.getByText("Ostatni dzień listopada")).toBeInTheDocument();
  expect(screen.queryByText("Ostatni dzień października")).not.toBeInTheDocument();
  expect(screen.queryByText("Pierwszy dzień grudnia")).not.toBeInTheDocument();
});

test("resets edited filters to the local month at the time of the click", () => {
  renderDashboard();
  fireEvent.change(startDateInput(), { target: { value: "2026-10-01" } });
  fireEvent.change(endDateInput(), { target: { value: "2026-10-31" } });
  expect(screen.getByText("Ostatni dzień października")).toBeInTheDocument();

  jest.setSystemTime(new Date(2026, 11, 1, 0, 10));
  fireEvent.click(screen.getByRole("button", { name: "Bieżący miesiąc" }));

  expect(startDateInput()).toHaveValue("2026-12-01");
  expect(endDateInput()).toHaveValue("2026-12-31");
  expect(screen.getByText("Pierwszy dzień grudnia")).toBeInTheDocument();
  expect(screen.queryByText("Ostatni dzień października")).not.toBeInTheDocument();
});

test("includes February 29 in a leap year", () => {
  jest.setSystemTime(new Date(2028, 1, 20, 12));
  renderDashboard([transaction("2028-02-29", "Dzień przestępny")]);

  expect(startDateInput()).toHaveValue("2028-02-01");
  expect(endDateInput()).toHaveValue("2028-02-29");
  expect(screen.getByText("Dzień przestępny")).toBeInTheDocument();
});

test("defaults to today just after local midnight and submits the manually selected date", async () => {
  jest.setSystemTime(new Date(2026, 10, 20, 0, 10));
  addTransaction.mockResolvedValue({});
  renderDashboard();

  const date = screen.getByLabelText("Data");
  expect(date).toHaveValue("2026-11-20");
  fireEvent.change(date, { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "15" } });
  fireEvent.change(screen.getByPlaceholderText("np. Zakupy w Biedronce"), {
    target: { value: "Zakupy" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Dodaj wydatek" }));

  await waitFor(() => expect(addTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ date: "2026-11-01" }),
    expect.anything()
  ));
});

test("displays saved date-only values on the same calendar day", () => {
  renderDashboard();

  expect(screen.getByText("1.11.2026")).toHaveAttribute("datetime", "2026-11-01");
  expect(screen.getByText("30.11.2026")).toHaveAttribute("datetime", "2026-11-30");
});
