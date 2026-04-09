import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheets = getSheetsClient();
    const items = await sheets.getActionItems({
      clientName: searchParams.get("client") || undefined,
      status: searchParams.get("status") || undefined,
      assignedTo: searchParams.get("assignee") || undefined,
    });
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sheets = getSheetsClient();
    const id = await sheets.addActionItem(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
