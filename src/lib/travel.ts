import { supabase, isSupabaseConfigured } from './supabase';
import type { FlightRequest } from '../types';

export interface CreateFlightRequestInput {
  userId: string;
  fullName: string;
  phone: string;
  originCity: string;
  destinationCity: string;
  preferredAirline: string | null;
  departureDate: string;
  returnDate: string | null;
  passengerCount: number;
  notes: string;
}

export async function createFlightRequest(
  input: CreateFlightRequestInput
): Promise<{ request: FlightRequest | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const request: FlightRequest = {
      id: `local-${Date.now()}`,
      user_id: input.userId,
      full_name: input.fullName,
      phone: input.phone,
      origin_city: input.originCity,
      destination_city: input.destinationCity,
      preferred_airline: input.preferredAirline,
      departure_date: input.departureDate,
      return_date: input.returnDate,
      passenger_count: input.passengerCount,
      notes: input.notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    return { request, error: null };
  }

  const { data, error } = await supabase
    .from('flight_requests')
    .insert({
      user_id: input.userId,
      full_name: input.fullName,
      phone: input.phone,
      origin_city: input.originCity,
      destination_city: input.destinationCity,
      preferred_airline: input.preferredAirline,
      departure_date: input.departureDate,
      return_date: input.returnDate,
      passenger_count: input.passengerCount,
      notes: input.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { request: null, error: error.message };
  return { request: data as FlightRequest, error: null };
}
