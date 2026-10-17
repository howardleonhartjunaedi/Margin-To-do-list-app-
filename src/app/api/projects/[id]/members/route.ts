import { route } from "@/server/http";
import { listMembers } from "@/server/sharing";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => listMembers(userId, (await params).id));
