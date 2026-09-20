export interface ConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface InfoDialogOptions {
  title?: string;
  confirmLabel?: string;
}

let dialogQueue: Promise<void> = Promise.resolve();

const enqueueDialog = <T>(task: () => Promise<T>): Promise<T> => {
  const result = dialogQueue.then(task, task);
  dialogQueue = result.then(() => undefined, () => undefined);
  return result;
};

const openDialog = (
  message: string,
  options: {
    title: string;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
  },
): Promise<boolean> =>
  new Promise((resolve) => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;

    const backdrop = document.createElement("div");
    backdrop.className = "user-dialog-backdrop";
    backdrop.innerHTML = `
      <section class="user-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" aria-describedby="user-dialog-message">
        <div class="user-dialog-copy">
          <small id="user-dialog-kind"></small>
          <strong id="user-dialog-title"></strong>
          <p id="user-dialog-message"></p>
        </div>
        <div class="user-dialog-actions"></div>
      </section>`;

    const kind = backdrop.querySelector<HTMLElement>("#user-dialog-kind")!;
    const title = backdrop.querySelector<HTMLElement>("#user-dialog-title")!;
    const messageElement = backdrop.querySelector<HTMLElement>("#user-dialog-message")!;
    const actions = backdrop.querySelector<HTMLElement>(".user-dialog-actions")!;
    kind.textContent = options.cancelLabel ? "BESTÄTIGUNG" : "HINWEIS";
    title.textContent = options.title;
    messageElement.textContent = message;

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = options.danger ? "user-dialog-confirm user-dialog-confirm--danger" : "user-dialog-confirm primary";
    confirm.textContent = options.confirmLabel;

    const cancel = options.cancelLabel ? document.createElement("button") : undefined;
    if (cancel) {
      cancel.type = "button";
      cancel.textContent = options.cancelLabel;
      actions.append(cancel);
    }
    actions.append(confirm);
    document.body.append(backdrop);

    let finished = false;
    const finish = (value: boolean): void => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      previouslyFocused?.focus();
      resolve(value);
    };

    const focusableButtons = (): HTMLButtonElement[] =>
      Array.from(backdrop.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = focusableButtons();
      if (buttons.length < 2) return;
      const current = document.activeElement;
      const index = buttons.indexOf(current as HTMLButtonElement);
      const nextIndex = event.shiftKey
        ? (index <= 0 ? buttons.length - 1 : index - 1)
        : (index < 0 || index === buttons.length - 1 ? 0 : index + 1);
      event.preventDefault();
      buttons[nextIndex].focus();
    };

    document.addEventListener("keydown", onKeyDown, true);
    confirm.addEventListener("click", () => finish(true));
    cancel?.addEventListener("click", () => finish(false));

    // For destructive decisions, focus the safe option so Enter cannot delete accidentally.
    (options.danger && cancel ? cancel : confirm).focus();
  });

export const confirmDialog = (
  message: string,
  options: ConfirmDialogOptions = {},
): Promise<boolean> =>
  enqueueDialog(() =>
    openDialog(message, {
      title: options.title ?? "Bitte bestätigen",
      confirmLabel: options.confirmLabel ?? "Bestätigen",
      cancelLabel: options.cancelLabel ?? "Abbrechen",
      danger: options.danger,
    }),
  );

export const showDialog = (
  message: string,
  options: InfoDialogOptions = {},
): Promise<void> =>
  enqueueDialog(async () => {
    await openDialog(message, {
      title: options.title ?? "Hinweis",
      confirmLabel: options.confirmLabel ?? "OK",
    });
  });
