"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api";

export function AcceptInvite({ token, signedInAs }: { token: string; signedInAs: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="primary"
        size="lg"
        magnetic
        disabled={pending}
        className="self-start"
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const { projectId } = await api.acceptInvite(token);
            router.push(`/project/${projectId}`);
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn’t accept the invitation. Try again.");
            setPending(false);
          }
        }}
      >
        {pending ? "Joining…" : "Accept and open the project"}
      </Button>
      <p className="text-xs text-ink-3">Signed in as {signedInAs}.</p>
      {error && <ErrorState message={error} />}
    </div>
  );
}
