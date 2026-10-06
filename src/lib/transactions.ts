import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

const MAX_TRANSACTION_RETRIES = 3;

export async function runSerializable<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isRetryable || attempt === MAX_TRANSACTION_RETRIES - 1) {
        if (isRetryable) throw new AppError("TRANSACTION_CONFLICT");
        throw error;
      }
    }
  }

  throw new AppError("TRANSACTION_CONFLICT");
}
