import { IsString, IsStrongPassword } from "class-validator";

export default class ConfirmResetPasswordDto {
    @IsString()
    token: string;

    @IsString()
    @IsStrongPassword()
    newPassword: string;
}