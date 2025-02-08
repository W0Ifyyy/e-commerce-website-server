import * as bcrypt from 'bcrypt';

export async function hashToken(
  token: string,
  saltRounds = 10,
): Promise<string> {
  try {
    let salt = await bcrypt.genSalt(saltRounds);
    let hashedToken = await bcrypt.hash(token, salt);
    return hashedToken;
  } catch (error: any) {
    throw new Error(`Error hashing token: ${error.message}`);
  }
}

export async function compareTokens(
  token: string,
  hashedToken: string,
): Promise<boolean> {
  try {
    let result = await bcrypt.compare(token, hashedToken);
    return result;
  } catch (error: any) {
    throw new Error(
      `An error occured while comparing tokens: ${error.message}`,
    );
  }
}
