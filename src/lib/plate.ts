// Placa antiga (ABC1234) ou Mercosul (ABC1D23)
const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPlate(plate: string): boolean {
  return PLATE_REGEX.test(plate);
}

export const INVALID_PLATE_MESSAGE =
  'Formato de placa inválido. Use o padrão ABC1234 ou ABC1D23.';
