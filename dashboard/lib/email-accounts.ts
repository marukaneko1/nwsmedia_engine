"use server";

export interface SenderAccount {
  email: string;
  displayName: string;
}

interface InternalAccount extends SenderAccount {
  appPassword: string;
}

function loadAccounts(): InternalAccount[] {
  const accounts: InternalAccount[] = [];

  const first = process.env.GMAIL_USER;
  const firstPass = process.env.GMAIL_APP_PASSWORD;
  if (first && firstPass) {
    accounts.push({
      email: first,
      appPassword: firstPass,
      displayName: process.env.GMAIL_DISPLAY_NAME || "NWS MEDIA",
    });
  }

  for (let i = 2; i <= 10; i++) {
    const email = process.env[`GMAIL_USER_${i}`];
    const pass = process.env[`GMAIL_APP_PASSWORD_${i}`];
    if (email && pass) {
      accounts.push({
        email,
        appPassword: pass,
        displayName: process.env[`GMAIL_DISPLAY_NAME_${i}`] || email,
      });
    }
  }

  return accounts;
}

export async function getSenderAccounts(): Promise<SenderAccount[]> {
  return loadAccounts().map(({ email, displayName }) => ({
    email,
    displayName,
  }));
}

export function getAccountCredentials(
  senderEmail?: string
): { user: string; pass: string; displayName: string } | null {
  const accounts = loadAccounts();
  if (accounts.length === 0) return null;

  if (senderEmail) {
    const match = accounts.find((a) => a.email === senderEmail);
    if (match)
      return {
        user: match.email,
        pass: match.appPassword,
        displayName: match.displayName,
      };
  }

  return {
    user: accounts[0].email,
    pass: accounts[0].appPassword,
    displayName: accounts[0].displayName,
  };
}
