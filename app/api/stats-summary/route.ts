import { NextResponse } from 'next/server';
import { getStatsSummary } from '@/lib/data';
export async function GET(){ const summary = await getStatsSummary(); return NextResponse.json(summary); }