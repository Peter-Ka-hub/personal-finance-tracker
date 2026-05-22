import axiosClient from './axiosClient';

export const getCategories = async () => {
  const response = await axiosClient.get('/categories');
  return response.data;
};

export const addCategory = async (categoryData) => {
  const response = await axiosClient.post('/categories', categoryData);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await axiosClient.delete(`/categories/${id}`);
  return response.data;
};
