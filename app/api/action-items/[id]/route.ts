import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const sheets = getSheetsClient();
    await sheets.updateActionItemStatus(
      params.id,
      body.status,
      body.status === "Completed" ? new Date().toISOString() : undefined
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
