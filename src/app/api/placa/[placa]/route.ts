import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { INVALID_PLATE_MESSAGE, isValidPlate, normalizePlate } from '@/lib/plate';
import { getPublicVehicleByPlate } from '@/lib/vehicles';

// GET /api/placa/ABC1D23 -> dados públicos do veículo já presente no cache (tabela 'vehicles').
// Para gerar uma nova consulta (com limite diário) e desbloquear o laudo, use POST /api/consultar.
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/placa/[placa]'>) {
  const { placa } = await ctx.params;
  const plate = normalizePlate(placa);

  if (!isValidPlate(plate)) {
    return NextResponse.json({ error: INVALID_PLATE_MESSAGE }, { status: 400 });
  }

  try {
    const vehicle = await getPublicVehicleByPlate(plate);

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Placa ainda não consultada. Faça a consulta pela página inicial.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ source: 'cache', unlocked: false, vehicle });
  } catch (err) {
    console.error('Erro na rota /api/placa/[placa]:', err);
    return NextResponse.json(
      { error: 'Erro interno ao buscar dados do veículo.' },
      { status: 500 }
    );
  }
}
