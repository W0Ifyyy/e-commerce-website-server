import { IsEmail, IsString } from "class-validator";


export class RequestPasswordDto{
    @IsEmail()
    email: string
}