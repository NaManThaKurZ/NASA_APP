import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Pipeline crashed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
