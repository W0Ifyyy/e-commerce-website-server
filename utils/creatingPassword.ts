import * as bcrypt from 'bcrypt';

export async function hashPassword(
  password: string,
  saltRounds = 10,
): Promise<string> {
  try {
    let salt = await bcrypt.genSalt(saltRounds);
    let hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error: any) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    let result = await bcrypt.compare(password, hashedPassword);
    return result;
  } catch (error: any) {
    throw new Error(
      `An error occured while comparing passwords: ${error.message}`,
    );
  }
}
