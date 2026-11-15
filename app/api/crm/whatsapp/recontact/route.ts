import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function POST() {
  return NextResponse.json({ error: 'El proceso anterior de MIA fue retirado. Usá las instrucciones y correcciones del espacio privado de pruebas.' }, { status: 410 });
}
