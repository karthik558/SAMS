import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { verifyCurrentUserPassword } from "@/services/auth";
import { toast } from "sonner";

type Options = {
  title?: string;
  description?: string;
  confirmLabel?: string;
};

type InternalState = {
  open: boolean;
  options: Options;
  resolver: ((value: boolean) => void) | null;
};

const DEFAULT_OPTIONS: Options = {
  title: "Verify password",
  description: "Enter your password to continue.",
  confirmLabel: "Confirm",
};

/**
 * Hook that renders a password confirmation dialog and returns a promise-based helper.
 * Useful for wrapping destructive or sensitive mutations with an additional credential check.
 */
export function usePasswordConfirmation(defaultOptions?: Options) {
  const mergedDefaults = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...(defaultOptions ?? {}) }),
    [defaultOptions]
  );

  const [state, setState] = useState<InternalState>({
    open: false,
    options: mergedDefaults,
    resolver: null,
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetLocalState = useCallback(() => {
    setPassword("");
    setShowPassword(false);
    setSubmitting(false);
    setError(null);
  }, []);

  const resolveAndClose = useCallback(
    (result: boolean) => {
      setState((prev) => {
        if (prev.resolver) prev.resolver(result);
        return { open: false, options: mergedDefaults, resolver: null };
      });
      resetLocalState();
    },
    [mergedDefaults, resetLocalState]
  );

  const confirm = useCallback(
    (options?: Options) =>
      new Promise<boolean>((resolve) => {
        setState({
          open: true,
          options: { ...mergedDefaults, ...(options ?? {}) },
          resolver: resolve,
        });
        resetLocalState();
      }),
    [mergedDefaults, resetLocalState]
  );

  const handleSubmit = useCallback(
    async (evt?: React.FormEvent<HTMLFormElement>) => {
      if (evt) evt.preventDefault();
      if (!password) {
        setError("Password is required.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const ok = await verifyCurrentUserPassword(password);
        if (ok) {
          resolveAndClose(true);
        } else {
          setError("Incorrect password. Please try again.");
          toast.error("Password verification failed");
        }
      } catch (e: any) {
        const message = e?.message || "Password verification failed";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
        setPassword("");
      }
    },
    [password, resolveAndClose]
  );

  const dialog = (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) {
          resolveAndClose(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="h-4 w-4" />
              </span>
              {state.options.title}
            </DialogTitle>
            {state.options.description ? (
              <DialogDescription>{state.options.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="password-confirmation-input">Password</Label>
            <div className="relative">
              <Input
                id="password-confirmation-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => resolveAndClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !password}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {state.options.confirmLabel || "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
