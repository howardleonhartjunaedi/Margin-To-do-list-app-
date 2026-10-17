import { route } from "@/server/http";
import { searchTasks } from "@/server/tasks";

export const GET = route(async (req, userId) => searchTasks(userId, new URL(req.url).searchParams.get("q") ?? ""));
