import api from './fetchClient';
import type { MealPlan } from '../types';

const mealPlanApi = {
  getByProperty: (propertyId: string) =>
    api.get<MealPlan[]>(`/properties/${propertyId}/meal-plans`),
  create: (propertyId: string, data: { mealPlanType: string; pricePerNight: number }) =>
    api.post<MealPlan>(`/properties/${propertyId}/meal-plans`, data),
  update: (propertyId: string, id: string, data: { pricePerNight: number }) =>
    api.patch<MealPlan>(`/properties/${propertyId}/meal-plans/${id}`, data),
};

export default mealPlanApi;
