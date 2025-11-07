// Creates OpenAI client on demand using the encrypted key stored in Prisma.
import OpenAI from "openai";
import { prisma } from "../../db/prisma";
import { decrypt } from "../../utils/crypto";

export async function getOpenAIClient() {
  const record = await prisma.aIIntegrationSetting.findUnique({ where: { id: "openai" } });
  if (!record) {
    throw new Error("Chave da OpenAI não configurada.");
  }
  const apiKey = decrypt(record.encryptedApiKey);
  return new OpenAI({ apiKey });
}
