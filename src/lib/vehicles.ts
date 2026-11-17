import { createServerSupabase } from '@/lib/supabase-server';

// Somente campos liberados na consulta gratuita (sem dados de segurança do laudo).
export interface PublicVehicle {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  city?: string;
  state?: string;
  fipe?: { code: string; value: string; reference: string };
}

export async function getPublicVehicleByPlate(plate: string): Promise<PublicVehicle | null> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('vehicles')
    .select('plate, brand, model, year, raw_data')
    .eq('plate', plate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = (data.raw_data ?? {}) as Partial<PublicVehicle>;

  return {
    plate: data.plate,
    brand: data.brand,
    model: data.model,
    year: data.year,
    color: raw.color,
    city: raw.city,
    state: raw.state,
    fipe: raw.fipe,
  };
}
