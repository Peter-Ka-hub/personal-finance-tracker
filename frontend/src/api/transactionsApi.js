import axiosClient from './axiosClient';

export const getTransactions = async () => {
  const response = await axiosClient.get('/transactions');
  return response.data;
};

export const addTransaction = async (transactionData) => {
  const response = await axiosClient.post('/transactions', transactionData);
  return response.data;
};

export const deleteTransaction = async (id) => {
  const response = await axiosClient.delete(`/transactions/${id}`);
  return response.data;
};
