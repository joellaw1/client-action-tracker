import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-client";

/**
 * POST /api/scan/review — Accept, edit, or dismiss an email scan suggestion.
 * Body: { id: string, action: "accept" | "edit" | "dismiss", reviewer: string, editedAction?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { id, action, reviewer, editedAction } = await req.json();

    if (!id || !action || !reviewer) {
      return NextResponse.json(
        { error: "Missing required fields: id, action, reviewer" },
        { status: 400 }
      );
    }

    if (!["accept", "edit", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be accept, edit, or dismiss" },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    await sheets.reviewEmailScan(id, action, reviewer, editedAction);

    return NextResponse.json({
      success: true,
      message: `Scan result ${id} ${action === "accept" ? "accepted" : action === "edit" ? "edited and accepted" : "dismissed"}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
