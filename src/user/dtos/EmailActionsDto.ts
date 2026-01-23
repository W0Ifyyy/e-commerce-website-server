import { IsEmail, IsString } from "class-validator";

export default class EmailActionsDto{
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @IsString()
    emailType: string;
}