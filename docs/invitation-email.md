# Invitation email delivery

QRousel always creates a copyable, single-use invitation link. Email is optional.

To activate email delivery, set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as Netlify environment variables. The sender must be verified in Resend. No email is sent while either value is absent.

QRousel enforces 10 invitation-email attempts per UTC day and 100 per UTC month. If either cap is reached, the invitation is still created and its copyable link remains usable.
