import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db, users, eq } from "@metricshub/db";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await hash(password, 12);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name ?? null,
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    return NextResponse.json(
      { user: { id: user?.id, email: user?.email, name: user?.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[signup] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
