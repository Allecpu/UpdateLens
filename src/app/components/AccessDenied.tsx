type AccessDeniedReason = 'NOT_WHITELISTED' | 'DISABLED';

interface AccessDeniedProps {
  reason: AccessDeniedReason;
  email?: string;
}

const AccessDenied = ({ reason, email }: AccessDeniedProps) => {
  const isDisabled = reason === 'DISABLED';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md text-center">
        {/* Shield/Lock Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-10 w-10 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {isDisabled ? (
              // Lock icon for disabled accounts
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            ) : (
              // Shield icon for not whitelisted
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
              />
            )}
          </svg>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-2xl font-bold text-foreground">
          Accesso non autorizzato
        </h1>

        {/* Message based on reason */}
        <p className="mb-6 text-muted-foreground">
          {isDisabled ? (
            <>
              Il tuo account <strong className="text-foreground">{email}</strong> è stato disabilitato.
              <br />
              Contatta l'amministratore per richiedere la riattivazione.
            </>
          ) : (
            <>
              L'account <strong className="text-foreground">{email}</strong> non è autorizzato ad accedere a questa applicazione.
              <br />
              Contatta l'amministratore per richiedere l'accesso.
            </>
          )}
        </p>

        {/* Contact info */}
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Per richiedere l'accesso, contatta il tuo amministratore di sistema.
          </p>
        </div>

        {/* Logout hint */}
        <p className="mt-6 text-xs text-muted-foreground">
          Se hai effettuato l'accesso con l'account sbagliato, puoi{' '}
          <a
            href="/.auth/logout"
            className="text-primary underline hover:no-underline"
          >
            uscire
          </a>{' '}
          e riprovare con un altro account.
        </p>
      </div>
    </div>
  );
};

export default AccessDenied;
