import { IsString, IsStrongPassword } from "class-validator";

export default class ChangePasswordDto{
    @IsString()
    oldPassword: string;
    
    @IsStrongPassword()
    @IsString()
    newPassword: string;
}