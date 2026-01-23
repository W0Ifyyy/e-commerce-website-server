import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator";

export default class ConfirmResetPasswordDto {
    @IsString()
    token: string;

    @IsNotEmpty()
    @IsString()
    @IsStrongPassword()
    newPassword: string;
}