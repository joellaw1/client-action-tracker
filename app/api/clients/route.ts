import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-client";

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const clients = await sheets.getClients();
    return NextResponse.json({ clients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sheets = getSheetsClient();
    const id = await sheets.addClient(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
