import axiosClient from './axiosClient';

export const loginUser = async (credentials) => {
  const response = await axiosClient.post('/auth/login', credentials);
  return response.data;
};

export const registerUser = async (credentials) => {
  const response = await axiosClient.post('/auth/register', credentials);
  return response.data;
};
